type BatchRequest = {
  id: string;
  endpoint: string;
  params?: any;
  resolve: (data: any) => void;
  reject: (error: any) => void;
};

class RequestBatcher {
  private queue: Map<string, BatchRequest[]> = new Map();
  private processing = false;
  private batchDelay = 50; // ms
  private maxBatchSize = 10;

  async add(endpoint: string, params?: any): Promise<any> {
    const requestId = `${endpoint}-${JSON.stringify(params || {})}`;
    
    return new Promise((resolve, reject) => {
      // Check if we already have a pending request for the same data
      if (!this.queue.has(requestId)) {
        this.queue.set(requestId, []);
      }
      
      this.queue.get(requestId)!.push({
        id: requestId,
        endpoint,
        params,
        resolve,
        reject,
      });

      this.scheduleBatch();
    });
  }

  private scheduleBatch() {
    if (this.processing) return;
    
    this.processing = true;
    setTimeout(() => this.processBatch(), this.batchDelay);
  }

  private async processBatch() {
    const batch = new Map<string, BatchRequest[]>();
    
    // Move items from queue to batch
    for (const [key, requests] of this.queue.entries()) {
      if (batch.size >= this.maxBatchSize) break;
      batch.set(key, requests);
      this.queue.delete(key);
    }

    // Process each unique request
    for (const [key, requests] of batch.entries()) {
      const { endpoint, params } = requests[0];
      
      try {
        const data = await this.fetchData(endpoint, params);
        
        // Resolve all duplicate requests with the same data
        requests.forEach(req => req.resolve(data));
      } catch (error) {
        requests.forEach(req => req.reject(error));
      }
    }

    this.processing = false;
    
    // Process remaining items if any
    if (this.queue.size > 0) {
      this.scheduleBatch();
    }
  }

  private async fetchData(endpoint: string, params?: any): Promise<any> {
    const token = localStorage.getItem('access_token');
    
    const response = await fetch(endpoint, {
      method: params ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: params ? JSON.stringify(params) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    return response.json();
  }
}

export const requestBatcher = new RequestBatcher();

// Deduplicated fetch wrapper
export async function deduplicatedFetch(
  endpoint: string,
  params?: any
): Promise<any> {
  return requestBatcher.add(endpoint, params);
}