#!/bin/bash
set -e

echo "Starting Multi-RPC server..."
echo "Environment variables:"
echo "PORT: ${PORT:-not set}"
echo "RUST_LOG: ${RUST_LOG:-not set}"
echo "RPC_ENDPOINTS: ${RPC_ENDPOINTS:-not set}"

# Execute the main binary
exec /usr/local/bin/multi-rpc "$@"