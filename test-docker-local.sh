#!/bin/bash
set -e

echo "Building Docker image locally..."
docker build -t multi-rpc-test .

echo "Running Docker container..."
docker run --rm -p 8080:8080 -e PORT=8080 -e RUST_LOG=debug multi-rpc-test &
CONTAINER_PID=$!

echo "Waiting for container to start..."
sleep 10

echo "Testing health endpoint..."
if curl -f http://localhost:8080/health; then
    echo -e "\n✅ Health check passed!"
else
    echo -e "\n❌ Health check failed!"
fi

echo "Stopping container..."
docker stop $(docker ps -q --filter ancestor=multi-rpc-test) || true

echo "Done!"