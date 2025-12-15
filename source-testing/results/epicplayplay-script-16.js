(function(){
const $ = s => document.querySelector(s);

const CHANNEL_KEY   = "premium51";
const AUTH_TOKEN    = "7f2f4b4ee5da1a5aaca95d6ae4618589de16dc58439340bda789cff5ea9f814a";
const AUTH_COUNTRY  = "US";
const AUTH_TS       = "1765830800";
const AUTH_EXPIRY   = "1765848800";

window.SESSION_TOKEN = AUTH_TOKEN;

// Set session cookie for iOS/Safari compatibility
document.cookie = "eplayer_session=" + AUTH_TOKEN + "; domain=.kiko2.ru; path=/; SameSite=None; Secure";

function showPlayerContainer(){
  const o = $('#player-container');
  const l = $('#loader');
  if (l) l.remove();
  if (!$('#clappr-container')){
    const d = document.createElement('div');
    d.id = 'clappr-container';
    d.style.cssText = 'width:100%;height:100%;position:relative';
    o.appendChild(d);
  }
}

function fetchWithRetry(url, retries, delay, init){
  return new Promise((resolve, reject)=>{
    const attempt=()=>{
      const fetchOpts = {...init, keepalive: true};
      fetch(url, fetchOpts)
        .then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
        .then(resolve)
        .catch(err => (retries--) ? setTimeout(attempt, delay) : reject(err));
    };
    attempt();
  });
}

let player;
let reloadTimer = null;

function safeReloadPlayer(){
  if (reloadTimer) return; // avoid spamming
  console.warn("Playback stalled or errored. Reloading source in 3 seconds...");
  reloadTimer = setTimeout(()=>{
    try{
      if (player){
        player.stop();
        player.load(player.options.source && String(player.options.source).trim());
        player.play();
        player.unmute();
        player.setVolume(100);
      }
    }catch(_){}
    reloadTimer = null;
  }, 3000);
}

function waitForDependencies() {
  return new Promise((resolve) => {
    const checkDeps = () => {
      if (typeof Clappr !== 'undefined' && typeof HlsjsPlayback !== 'undefined') {
        console.log('Dependencies loaded');
        resolve();
      } else {
        setTimeout(checkDeps, 100);
      }
    };
    checkDeps();
  });
}

waitForDependencies().then(() => {
  console.log('Dependencies loaded, fetching server lookup');
  return fetchWithRetry('https://chevy.giokko.ru/server_lookup?channel_id='+encodeURIComponent(CHANNEL_KEY), 5, 500);
})
  .then(data => {
    console.log('Server lookup successful:', data);
    const sk = data.server_key;

    const m3u8 = (sk === 'top1/cdn')
      ? `https://top1.kiko2.ru/top1/cdn/${CHANNEL_KEY}/mono.css`
      : `https://${sk}new.kiko2.ru/${sk}/${CHANNEL_KEY}/mono.css`;

    console.log('M3U8 URL:', m3u8);
    showPlayerContainer();


    player = new Clappr.Player({
      source: m3u8,
      mimeType: "application/vnd.apple.mpegurl",

      parentId: '#clappr-container',
      autoPlay: true,
      mute: true,
      height: '100%',
      width:  '100%',
      disableErrorScreen: true,
      plugins: [HlsjsPlayback],

      mediacontrol:{
        seekbar:"#E0CDA9",
        buttons:"#E0CDAA9"
      },

      hlsjsConfig:{
        enableWorker: true,
        xhrSetup: function(xhr, url) {
          if (url.includes('key') || url.includes('auth')) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + window.SESSION_TOKEN);
            xhr.setRequestHeader('X-Channel-Key', CHANNEL_KEY);
          }
        },
        fragLoadingMaxRetry: Infinity,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 64000000,
        manifestLoadingMaxRetry: Infinity,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 64000000,
        levelLoadingMaxRetry: Infinity,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 64000000,
        liveSyncDuration: 30,
        liveMaxLatencyDuration: 60,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000
      },

      playback:{
        forceHLS: true,
        playInline:true,
        hlsjsConfig:{
          enableWorker: true,
          xhrSetup: function(xhr, url) {
            if (url.includes('key') || url.includes('auth')) {
              xhr.setRequestHeader('Authorization', 'Bearer ' + window.SESSION_TOKEN);
              xhr.setRequestHeader('X-Channel-Key', CHANNEL_KEY);
            }
          },
          backBufferLength: 90
        },
      }
    });

    player.on(Clappr.Events.PLAYER_READY, function() {
      const playback = player.getPlayback && player.getPlayback();
      const hls = playback && playback.hls;
      if (hls && hls.config) {
        hls.config.xhrSetup = function (xhr, url) {
          if (url.includes('key') || url.includes('auth')) {
            xhr.setRequestHeader('Authorization', 'Bearer ' + window.SESSION_TOKEN);
            xhr.setRequestHeader('X-Channel-Key', CHANNEL_KEY);
          }
        };
        
        hls.config.fragLoadingMaxRetry = Infinity;
        hls.config.fragLoadingRetryDelay = 500;
        hls.config.fragLoadingMaxRetryTimeout = 64000000;
        hls.config.manifestLoadingMaxRetry = Infinity;
        hls.config.manifestLoadingRetryDelay = 1000;
        hls.config.manifestLoadingMaxRetryTimeout = 64000000;
        hls.config.levelLoadingMaxRetry = Infinity;
        hls.config.levelLoadingRetryDelay = 1000;
        hls.config.levelLoadingMaxRetryTimeout = 64000000;
      }
    });

  })
  .catch(err=>{
    console.error('Player initialization error:', err);
    const errorStep = err.message.includes('Auth') ? 'Authentication' :
                      err.message.includes('Server lookup') ? 'Server Lookup' :
                      'Player Initialization';
    let auth500Advice = '';
    try {
      if (err && err.message && /Auth/i.test(err.message) && /500/.test(err.message)) {
        auth500Advice = `<div style="font-size:13px;color:#ffd59e;margin-bottom:15px">${t('vpn_advice')}</div>`;
      }
    } catch (e) { }

    $('#player-container').innerHTML = `
      <div style="color:#fff;text-align:center;padding:20px;font-family:'Segoe UI',sans-serif">
        <div style="font-size:24px;margin-bottom:10px">${t('error_title')}</div>
        <div style="font-size:16px;margin-bottom:15px">${t('failed_at')} <strong>${errorStep}</strong></div>
        <div style="font-size:14px;color:#ccc;margin-bottom:20px">${err.message}</div>
    ` + auth500Advice + `
        <button id="retryBtn" style="background:#E0CDA9;border:none;padding:12px 24px;font-size:16px;cursor:pointer;border-radius:4px">${t('retry')}</button>
      </div>
    `;
    
    document.getElementById('retryBtn').addEventListener('click', function() {
      $('#player-container').innerHTML = `
        <div id="loader">
          <div class="spinner"></div>
          <div class="text">Retrying...</div>
        </div>
      `;
      
      setTimeout(() => {
        waitForDependencies().then(() => {
          console.log('Retrying server lookup');
          return fetchWithRetry('https://chevy.giokko.ru/server_lookup?channel_id='+encodeURIComponent(CHANNEL_KEY), 5, 1500);
        })
          .then(data => {
            console.log('Server lookup successful');
            const sk = data.server_key;
            const m3u8 = (sk === 'top1/cdn')
              ? `https://top1.kiko2.ru/top1/cdn/${CHANNEL_KEY}/mono.css`
              : `https://${sk}new.kiko2.ru/${sk}/${CHANNEL_KEY}/mono.css`;

            showPlayerContainer();

            player = new Clappr.Player({
              source: m3u8,
              mimeType: "application/vnd.apple.mpegurl",
              parentId: '#clappr-container',
              autoPlay: true,
              mute: true,
              height: '100%',
              width:  '100%',
              disableErrorScreen: true,
              plugins: [HlsjsPlayback],
              mediacontrol:{
                seekbar:"#E0CDA9",
                buttons:"#E0CDAA9"
              },
              hlsjsConfig:{
                enableWorker: true,
                xhrSetup: function(xhr, url) {
                  if (url.includes('key') || url.includes('auth')) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + window.SESSION_TOKEN);
                    xhr.setRequestHeader('X-Channel-Key', CHANNEL_KEY);
                  }
                },
                fragLoadingMaxRetry: Infinity,
                fragLoadingRetryDelay: 500,
                fragLoadingMaxRetryTimeout: 64000000,
                manifestLoadingMaxRetry: Infinity,
                manifestLoadingRetryDelay: 1000,
                manifestLoadingMaxRetryTimeout: 64000000,
                levelLoadingMaxRetry: Infinity,
                levelLoadingRetryDelay: 1000,
                levelLoadingMaxRetryTimeout: 64000000,
                liveSyncDuration: 30,
                liveMaxLatencyDuration: 60,
                fragLoadingTimeOut: 20000,
                manifestLoadingTimeOut: 20000,
                levelLoadingTimeOut: 20000
              },
              playback:{
                forceHLS: true,
                playInline:true,
                hlsjsConfig:{
                  enableWorker: true,
                  backBufferLength: 90
                },
              }
            });

            player.on(Clappr.Events.PLAYER_READY, function() {
              const playback = player.getPlayback && player.getPlayback();
              const hls = playback && playback.hls;
              if (hls && hls.config) {
                hls.config.xhrSetup = function (xhr, url) {
                  if (url.includes('key') || url.includes('auth')) {
                    xhr.setRequestHeader('Authorization', 'Bearer ' + window.SESSION_TOKEN);
                    xhr.setRequestHeader('X-Channel-Key', CHANNEL_KEY);
                  }
                };
                hls.config.fragLoadingMaxRetry = Infinity;
                hls.config.fragLoadingRetryDelay = 500;
                hls.config.fragLoadingMaxRetryTimeout = 64000000;
                hls.config.manifestLoadingMaxRetry = Infinity;
                hls.config.manifestLoadingRetryDelay = 1000;
                hls.config.manifestLoadingMaxRetryTimeout = 64000000;
                hls.config.levelLoadingMaxRetry = Infinity;
                hls.config.levelLoadingRetryDelay = 1000;
                hls.config.levelLoadingMaxRetryTimeout = 64000000;
              }
            });
          })
          .catch(retryErr => {
            console.error('Retry failed:', retryErr);
            const retryErrorStep = retryErr.message.includes('Auth') ? 'Authentication' :
                                   retryErr.message.includes('Server lookup') ? 'Server Lookup' :
                                   'Player Initialization';
            let retryAuthAdvice = '';
            try {
              if (retryErr && retryErr.message && /Auth/i.test(retryErr.message) && /500/.test(retryErr.message)) {
                retryAuthAdvice = `<div style="font-size:13px;color:#ffd59e;margin-bottom:15px">${t('vpn_advice')}</div>`;
              }
            } catch (e) { }

            $('#player-container').innerHTML = `
              <div style="color:#fff;text-align:center;padding:20px;font-family:'Segoe UI',sans-serif">
                <div style="font-size:24px;margin-bottom:10px">${t('error_title')}</div>
                <div style="font-size:16px;margin-bottom:15px">${t('failed_at')} <strong>${retryErrorStep}</strong></div>
                <div style="font-size:14px;color:#ccc;margin-bottom:20px">${retryErr.message}</div>
                ${retryAuthAdvice}
                <button onclick="location.reload()" style="background:#E0CDA9;border:none;padding:12px 24px;font-size:16px;cursor:pointer;border-radius:4px">${t('reload')}</button>
              </div>
            `;
          });
      }, 500);
    });
  });

document.cookie = "access=true";

window.WSUnmute = () => {
  const b = document.getElementById('UnMutePlayer');
  if (b) b.style.display = 'none';
  if (player) player.setVolume(100);
};

})();