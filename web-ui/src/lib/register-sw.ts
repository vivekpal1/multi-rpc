export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available
                  if (confirm('New version available! Reload to update?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
}

// Handle offline/online events
export function setupOfflineDetection() {
  if (typeof window === 'undefined') return;
  
  let isOnline = navigator.onLine;
  
  const updateOnlineStatus = () => {
    const wasOffline = !isOnline;
    isOnline = navigator.onLine;
    
    if (wasOffline && isOnline) {
      // Back online
      console.log('Connection restored');
      // Trigger any pending syncs
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          if ('sync' in registration) {
            (registration as any).sync.register('sync-api-requests');
          }
        });
      }
    } else if (!isOnline) {
      // Gone offline
      console.log('Connection lost');
    }
  };
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}