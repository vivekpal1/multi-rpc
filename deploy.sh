#!/bin/bash

# Google Cloud deployment script for Multi-RPC
# This script sets up the necessary resources and triggers the deployment

set -e

# Configuration
PROJECT_ID=${PROJECT_ID:-"your-project-id"}
REGION=${REGION:-"us-central1"}
SERVICE_ACCOUNT_NAME="multi-rpc-sa"

echo "🚀 Starting deployment for Multi-RPC to Google Cloud Platform"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Set project
echo "📋 Setting project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Create service account if it doesn't exist
echo "👤 Creating service account..."
if ! gcloud iam service-accounts describe ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com &> /dev/null; then
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --description="Service account for Multi-RPC" \
        --display-name="Multi-RPC Service Account"
fi

# Grant necessary permissions
echo "🔐 Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Grant Cloud Build permissions
echo "🏗️ Granting permissions to Cloud Build..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding \
    ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# Create secrets if they don't exist
echo "🔒 Creating secrets in Secret Manager..."
create_secret_if_not_exists() {
    SECRET_NAME=$1
    if ! gcloud secrets describe $SECRET_NAME &> /dev/null; then
        echo "Creating secret: $SECRET_NAME"
        echo -n "Enter value for $SECRET_NAME: "
        read -s SECRET_VALUE
        echo
        echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME --data-file=-
    else
        echo "Secret $SECRET_NAME already exists"
    fi
}

create_secret_if_not_exists "database-url"
create_secret_if_not_exists "redis-url"
create_secret_if_not_exists "nextauth-secret"
create_secret_if_not_exists "privy-app-id"
create_secret_if_not_exists "privy-app-secret"
create_secret_if_not_exists "stripe-secret-key"
create_secret_if_not_exists "stripe-webhook-secret"
create_secret_if_not_exists "rpc-endpoints"

# Create Cloud SQL instance (optional)
echo "💾 Do you want to create a Cloud SQL PostgreSQL instance? (y/n)"
read -r CREATE_DB
if [[ $CREATE_DB == "y" ]]; then
    INSTANCE_NAME="multi-rpc-db"
    DB_NAME="multirpc"
    
    if ! gcloud sql instances describe $INSTANCE_NAME &> /dev/null; then
        echo "Creating Cloud SQL instance..."
        gcloud sql instances create $INSTANCE_NAME \
            --database-version=POSTGRES_14 \
            --tier=db-f1-micro \
            --region=$REGION \
            --network=default
        
        # Create database
        gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME
        
        # Get connection name
        CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --format='value(connectionName)')
        echo "Cloud SQL connection name: $CONNECTION_NAME"
        echo "Update your DATABASE_URL secret with: postgresql://user:password@localhost/multirpc?host=/cloudsql/$CONNECTION_NAME"
    else
        echo "Cloud SQL instance already exists"
    fi
fi

# Create Redis instance (optional)
echo "🗄️ Do you want to create a Redis instance? (y/n)"
read -r CREATE_REDIS
if [[ $CREATE_REDIS == "y" ]]; then
    REDIS_NAME="multi-rpc-redis"
    
    if ! gcloud redis instances describe $REDIS_NAME --region=$REGION &> /dev/null; then
        echo "Creating Redis instance..."
        gcloud redis instances create $REDIS_NAME \
            --size=1 \
            --region=$REGION \
            --redis-version=redis_6_x
        
        # Get Redis host
        REDIS_HOST=$(gcloud redis instances describe $REDIS_NAME --region=$REGION --format='value(host)')
        echo "Redis host: $REDIS_HOST"
        echo "Update your REDIS_URL secret with: redis://$REDIS_HOST:6379"
    else
        echo "Redis instance already exists"
    fi
fi

# Submit build
echo "🏗️ Submitting build to Google Cloud Build..."
gcloud builds submit . \
    --config=cloudbuild.yaml \
    --substitutions=_PROJECT_NUMBER=$PROJECT_NUMBER

echo "✅ Deployment initiated! Check the build progress in the Google Cloud Console."
echo "Build URL: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"