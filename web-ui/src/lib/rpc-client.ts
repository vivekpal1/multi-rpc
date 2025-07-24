import { z } from "zod";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8080";

export interface RpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

export interface RpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface RpcStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  bytesTransferred: number;
}

export interface EndpointHealth {
  id: string;
  url: string;
  healthy: boolean;
  latency: number;
  successRate: number;
  lastChecked: Date;
}

export class RpcClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = RPC_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async sendRequest(request: RpcRequest): Promise<RpcResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async batchRequest(requests: RpcRequest[]): Promise<RpcResponse[]> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(requests),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getStats(): Promise<RpcStats> {
    const response = await fetch(`${this.baseUrl}/api/stats`, {
      headers: {
        "X-API-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getEndpointHealth(): Promise<EndpointHealth[]> {
    const response = await fetch(`${this.baseUrl}/admin/health`, {
      headers: {
        "X-API-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

// Helper functions for common Solana RPC methods
export const solanaRpcMethods = {
  getBalance: (address: string): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getBalance",
    params: [address],
  }),

  getBlockHeight: (): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getBlockHeight",
  }),

  getHealth: (): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getHealth",
  }),

  getSlot: (): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getSlot",
  }),

  getVersion: (): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getVersion",
  }),

  getAccountInfo: (address: string): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [address, { encoding: "base58" }],
  }),

  getTransaction: (signature: string): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "getTransaction",
    params: [signature, { encoding: "json", maxSupportedTransactionVersion: 0 }],
  }),

  sendTransaction: (transaction: string): RpcRequest => ({
    jsonrpc: "2.0",
    id: 1,
    method: "sendTransaction",
    params: [transaction, { skipPreflight: false }],
  }),
};