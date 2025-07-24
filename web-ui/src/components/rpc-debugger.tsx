"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface RPCRequest {
  id: string;
  timestamp: Date;
  method: string;
  params: any;
  endpoint: string;
  duration: number;
  status: 'success' | 'error' | 'pending';
  response?: any;
  error?: any;
}

export function RPCDebugger({ requests }: { requests: RPCRequest[] }) {
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRequests(newExpanded);
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIcon = (status: RPCRequest['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
  };

  return (
    <div className="space-y-2">
      {requests.map((request) => {
        const isExpanded = expandedRequests.has(request.id);
        
        return (
          <div
            key={request.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            <div
              className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() => toggleExpanded(request.id)}
            >
              <div className="flex items-center space-x-3">
                <button className="p-0.5">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {getStatusIcon(request.status)}
                <span className="font-mono text-sm text-gray-900">
                  {request.method}
                </span>
                <span className="text-xs text-gray-500">
                  {request.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {request.endpoint.replace(/^https?:\/\//, '').slice(0, 30)}...
                </span>
                <span className={`text-xs font-medium ${
                  request.duration < 100 ? 'text-green-600' :
                  request.duration < 500 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {request.duration}ms
                </span>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-200">
                <div className="p-4 space-y-3">
                  {/* Request */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Request</h4>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify({
                          jsonrpc: "2.0",
                          id: 1,
                          method: request.method,
                          params: request.params
                        }, null, 2), `req-${request.id}`)}
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                      >
                        {copiedId === `req-${request.id}` ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-gray-50 rounded p-3 text-xs overflow-x-auto">
                      <code className="text-gray-700">
                        {JSON.stringify({
                          jsonrpc: "2.0",
                          id: 1,
                          method: request.method,
                          params: request.params
                        }, null, 2)}
                      </code>
                    </pre>
                  </div>

                  {/* Response */}
                  {request.status !== 'pending' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          {request.status === 'success' ? 'Response' : 'Error'}
                        </h4>
                        <button
                          onClick={() => copyToClipboard(
                            JSON.stringify(request.response || request.error, null, 2),
                            `res-${request.id}`
                          )}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                        >
                          {copiedId === `res-${request.id}` ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className={`rounded p-3 text-xs overflow-x-auto ${
                        request.status === 'success' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <code className={request.status === 'success' ? 'text-green-700' : 'text-red-700'}>
                          {JSON.stringify(request.response || request.error, null, 2)}
                        </code>
                      </pre>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="pt-2 border-t border-gray-200">
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-gray-500">Endpoint</dt>
                        <dd className="font-mono text-gray-700">{request.endpoint}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Duration</dt>
                        <dd className="font-mono text-gray-700">{request.duration}ms</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}