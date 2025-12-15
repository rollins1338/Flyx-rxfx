
      (function() {
        var siteId;
        var hostname = window.location.hostname;

        if (hostname === 'xprime.stream' || hostname.endsWith('.xprime.stream')) {
          siteId = '39ffb8b32419';
        } else if (hostname === 'xprime.today' || hostname.endsWith('.xprime.today')) {
          siteId = '3f8da2ff5192';
        }

        if (siteId) {
          var script = document.createElement('script');
          script.src = 'https://signal.scin.agency/api/script.js';
          script.defer = true;
          script.setAttribute('data-site-id', siteId);
          document.head.appendChild(script);
        }
      })();
    