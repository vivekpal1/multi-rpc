#!/bin/bash
# Test script to verify the app starts correctly

echo "Testing Multi-RPC startup..."

# Set environment variables
export PORT=8080
export RUST_LOG=debug,multi_rpc=trace

# Run the app in background
echo "Starting server..."
cargo run --release &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
if curl -f http://localhost:8080/health; then
    echo -e "\n✅ Health check passed!"
else
    echo -e "\n❌ Health check failed!"
    kill $SERVER_PID
    exit 1
fi

# Clean up
echo -e "\nStopping server..."
kill $SERVER_PID

echo "✅ All tests passed!"