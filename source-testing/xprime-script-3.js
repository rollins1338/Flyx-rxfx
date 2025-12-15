
      // Register service worker
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          console.log('Attempting to register service worker...');

          navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
              console.log('Service Worker registered successfully with scope:', registration.scope);

              // Check for updates
              registration.addEventListener('updatefound', () => {
                console.log('New service worker being installed...');
                const newWorker = registration.installing;

                newWorker.addEventListener('statechange', () => {
                  console.log('Service worker state changed to:', newWorker.state);
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New version available - create notification
                    console.log('New version available! Prompting user...');
                    if (confirm('A new version of XPrime is available. Reload to update?')) {
                      window.location.reload();
                    }
                  }
                });
              });
            })
            .catch(error => {
              console.error('Service Worker registration failed:', error);
            });

          // Check if already controlled (page refresh)
          if (navigator.serviceWorker.controller) {
            console.log('This page is currently controlled by:', navigator.serviceWorker.controller);
          }
        });
      } else {
        console.warn('Service workers are not supported in this browser.');
      }
    