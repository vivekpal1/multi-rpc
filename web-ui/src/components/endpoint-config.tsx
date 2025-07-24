"use client";

import { useState } from "react";
import { Settings, Save, X, Plus, Trash2, AlertCircle } from "lucide-react";
import Modal from "./modal";

interface EndpointConfig {
  url: string;
  weight: number;
  priority: number;
  maxRetries: number;
  timeout: number;
  rateLimit?: number;
  headers?: Record<string, string>;
}

interface EndpointConfigProps {
  endpoints: EndpointConfig[];
  onSave: (endpoints: EndpointConfig[]) => Promise<void>;
}

export function EndpointConfiguration({ endpoints: initialEndpoints, onSave }: EndpointConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>(initialEndpoints);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddEndpoint = () => {
    setEndpoints([
      ...endpoints,
      {
        url: "",
        weight: 1,
        priority: 1,
        maxRetries: 3,
        timeout: 5000,
      },
    ]);
  };

  const handleRemoveEndpoint = (index: number) => {
    setEndpoints(endpoints.filter((_, i) => i !== index));
  };

  const handleUpdateEndpoint = (index: number, field: keyof EndpointConfig, value: any) => {
    const updated = [...endpoints];
    updated[index] = { ...updated[index], [field]: value };
    setEndpoints(updated);
  };

  const handleSave = async () => {
    setError(null);
    
    // Validate endpoints
    for (const endpoint of endpoints) {
      if (!endpoint.url) {
        setError("All endpoints must have a URL");
        return;
      }
      try {
        new URL(endpoint.url);
      } catch {
        setError(`Invalid URL: ${endpoint.url}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave(endpoints);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
      >
        <Settings className="w-4 h-4 mr-2" />
        Configure Endpoints
      </button>

      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        title="Endpoint Configuration"
      >
        <div className="sm:flex sm:items-start">
          <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
            <div className="mt-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              )}

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {endpoints.map((endpoint, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-900">
                        Endpoint {index + 1}
                      </h4>
                      <button
                        onClick={() => handleRemoveEndpoint(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          URL
                        </label>
                        <input
                          type="url"
                          value={endpoint.url}
                          onChange={(e) => handleUpdateEndpoint(index, 'url', e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                          placeholder="https://api.mainnet-beta.solana.com"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Weight
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={endpoint.weight}
                          onChange={(e) => handleUpdateEndpoint(index, 'weight', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Priority
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={endpoint.priority}
                          onChange={(e) => handleUpdateEndpoint(index, 'priority', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Max Retries
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={endpoint.maxRetries}
                          onChange={(e) => handleUpdateEndpoint(index, 'maxRetries', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          min="1000"
                          max="30000"
                          step="1000"
                          value={endpoint.timeout}
                          onChange={(e) => handleUpdateEndpoint(index, 'timeout', parseInt(e.target.value) || 5000)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Rate Limit (req/s, optional)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={endpoint.rateLimit || ''}
                          onChange={(e) => handleUpdateEndpoint(index, 'rateLimit', e.target.value ? parseInt(e.target.value) : undefined)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                          placeholder="No limit"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddEndpoint}
                className="mt-4 w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Endpoint
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || endpoints.length === 0}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  );
}