
// Hook script to capture decrypted values
(function() {
  const originalSetup = window.jwplayer ? window.jwplayer.prototype.setup : null;
  
  // Hook jwplayer setup
  if (window.jwplayer) {
    const origJW = window.jwplayer;
    window.jwplayer = function(id) {
      const player = origJW(id);
      const origSetup = player.setup;
      player.setup = function(config) {
        console.log('[HOOK] JWPlayer setup called with:', JSON.stringify(config, null, 2));
        return origSetup.call(this, config);
      };
      return player;
    };
  }
  
  // Hook fetch
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    console.log('[HOOK] fetch called:', args[0]);
    return origFetch.apply(this, args).then(response => {
      console.log('[HOOK] fetch response:', response.url, response.status);
      return response;
    });
  };
  
  // Hook XMLHttpRequest
  const origXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function() {
    const xhr = new origXHR();
    const origOpen = xhr.open;
    xhr.open = function(method, url, ...args) {
      console.log('[HOOK] XHR open:', method, url);
      return origOpen.call(this, method, url, ...args);
    };
    return xhr;
  };
  
  // Log when PAGE_DATA is accessed
  let pageData = window.__PAGE_DATA;
  Object.defineProperty(window, '__PAGE_DATA', {
    get: function() {
      console.log('[HOOK] __PAGE_DATA accessed:', pageData);
      return pageData;
    },
    set: function(val) {
      console.log('[HOOK] __PAGE_DATA set:', val);
      pageData = val;
    }
  });
  
  console.log('[HOOK] Hooks installed');
})();
