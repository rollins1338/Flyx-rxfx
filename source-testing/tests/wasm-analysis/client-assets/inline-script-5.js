
      import init, { process_img_data, get_img_key } from 'https://plsdontscrapemelove.flixer.sh/assets/wasm/img_data.js?v=1766276670771';
      
      window.wasmImgData = {
        init,
        process_img_data,
        get_img_key,
        ready: false
      };
      
      init({ module_or_path: 'https://plsdontscrapemelove.flixer.sh/assets/wasm/img_data_bg.wasm?v=1766276670771' })
        .then(async () => {
          try {
            const key = await get_img_key();
            if (!key || typeof key !== 'string') {
              throw new Error('get_img_key returned invalid value');
            }
            if (key.length !== 64) {
              throw new Error('get_img_key returned key with invalid length: ' + key.length + ' (expected 64)');
            }
            window.wasmImgData.key = key;
            window.wasmImgData.ready = true;
            window.dispatchEvent(new CustomEvent('wasmReady'));
          } catch (keyError) {
            console.error('[WASM] Error getting image key:', keyError);
            window.dispatchEvent(new CustomEvent('wasmError', { detail: keyError }));
          }
        })
        .catch(error => {
          console.error('[WASM] Error initializing WASM module:', error);
          window.dispatchEvent(new CustomEvent('wasmError', { detail: error }));
        });
    