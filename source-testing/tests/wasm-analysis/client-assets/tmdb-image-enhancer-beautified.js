/**
 * BEAUTIFIED tmdb-image-enhancer.js from Flixer
 * This file shows how the client interacts with the WASM module
 */

let imageProcessingCalls = 0,
    lastImageProcessTime = 0,
    imageEnhancementInitialized = false,
    imageProcessorKey = null,
    wasmModule = null,
    serverTimeOffset = null,
    serverTimeLastFetched = 0;

const SERVER_TIME_CACHE_TTL = 300000; // 5 minutes

const clearImageProcessingCache = (e = false) => {
    localStorage.removeItem("cc");
    localStorage.removeItem("lc");
    imageProcessingCalls = 0;
    lastImageProcessTime = 0;
};

const updateImageProcessingStats = () => {
    const e = localStorage.getItem("cc");
    imageProcessingCalls = e ? parseInt(e) : 0;
    const r = localStorage.getItem("lc");
    lastImageProcessTime = r ? parseFloat(r) : 0;
    if (imageProcessingCalls >= 45) {
        console.warn(`[TMDB Image Enhancer] Processing calls: ${imageProcessingCalls}/50 - Near limit`);
    }
};

const trackImageProcessingCall = () => {
    imageProcessingCalls++;
    localStorage.setItem("cc", imageProcessingCalls.toString());
    localStorage.setItem("lc", Date.now().toString());
    if (imageProcessingCalls >= 50) {
        console.error("[TMDB Image Enhancer] Processing limit reached (50 calls)");
        throw new Error("Image processing limit reached (50 calls) - refresh page to reset");
    }
};

const loadImageProcessingWasm = async () => new Promise((resolve, reject) => {
    const wasmData = window.wasmImgData;
    if (wasmData && wasmData.ready) {
        return void resolve();
    }
    if (wasmData && !wasmData.ready) {
        const onReady = () => {
            window.removeEventListener("wasmReady", onReady);
            window.removeEventListener("wasmError", onError);
            resolve();
        };
        const onError = (e) => {
            window.removeEventListener("wasmReady", onReady);
            window.removeEventListener("wasmError", onError);
            reject(e.detail || new Error("Image processing WASM loading failed"));
        };
        window.addEventListener("wasmReady", onReady);
        window.addEventListener("wasmError", onError);
        return;
    }
    
    const script = document.createElement("script");
    script.type = "module";
    const timestamp = Date.now();
    const baseUrl = typeof window !== "undefined" && window.WASM_BASE_URL ? window.WASM_BASE_URL : "";
    
    script.innerHTML = `
      import init, { process_img_data, get_img_key } from '${baseUrl}/assets/wasm/img_data.js?v=${timestamp}';
      
      window.wasmImgData = {
        init,
        process_img_data,
        get_img_key,
        ready: false
      };
      
      init({ module_or_path: '${baseUrl}/assets/wasm/img_data_bg.wasm?v=${timestamp}' })
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
    `;
    
    const onReady = () => {
        window.removeEventListener("wasmReady", onReady);
        window.removeEventListener("wasmError", onError);
        resolve();
    };
    const onError = (e) => {
        window.removeEventListener("wasmReady", onReady);
        window.removeEventListener("wasmError", onError);
        reject(e.detail || new Error("Image processing WASM loading failed"));
    };
    window.addEventListener("wasmReady", onReady);
    window.addEventListener("wasmError", onError);
    document.head.appendChild(script);
});

export const initImageEnhancement = async () => {
    if (imageEnhancementInitialized && imageProcessorKey && wasmModule) {
        return { imageProcessor: wasmModule, enhancementKey: imageProcessorKey };
    }
    try {
        clearImageProcessingCache(false);
        await loadImageProcessingWasm();
        const wasmData = window.wasmImgData;
        if (!wasmData || !wasmData.ready) {
            throw new Error("Image enhancement WASM module not ready");
        }
        if (!wasmData.key || wasmData.key.length !== 64) {
            throw new Error(`Invalid WASM key: length=${wasmData.key?.length || 0} (expected 64)`);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        imageProcessorKey = wasmData.key;
        wasmModule = {
            process_img_data: wasmData.process_img_data,
            get_img_key: wasmData.get_img_key
        };
        imageEnhancementInitialized = true;
        updateImageProcessingStats();
        return { imageProcessor: wasmModule, enhancementKey: imageProcessorKey };
    } catch (e) {
        console.error("[TMDB Image Enhancer] Failed to initialize image enhancement system:", e);
        throw new Error("Failed to initialize TMDB image enhancement");
    }
};

export function buildImageApiUrl(type, params) {
    const baseUrl = typeof window !== "undefined" && window.TMDB_API_BASE_URL ? window.TMDB_API_BASE_URL : "";
    if (!params || !params.tmdbId || String(params.tmdbId).trim() === "") {
        throw new Error("tmdbId is required to build image API url");
    }
    if (type === "movie") {
        return `${baseUrl}/api/tmdb/movie/${params.tmdbId}/images`;
    }
    if (!params.seasonId || !params.episodeId) {
        throw new Error("seasonId and episodeId are required for TV image API url");
    }
    return `${baseUrl}/api/tmdb/tv/${params.tmdbId}/season/${params.seasonId}/episode/${params.episodeId}/images`;
}

function generateNonce() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).replace(/[/+=]/g, "").substring(0, 22);
}

/**
 * IMPORTANT: This is the CLIENT-SIDE fingerprint generation
 * This is DIFFERENT from the WASM fingerprint used for key derivation!
 * 
 * This fingerprint is sent in the X-Client-Fingerprint header
 * The WASM has its own internal fingerprint for key derivation
 */
function generateClientFingerprint() {
    const screen = window.screen;
    const nav = navigator;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.fillText("FP", 2, 2);
    }
    const canvasData = canvas.toDataURL().substring(22, 50);
    
    // Build fingerprint string
    const fpString = `${screen.width}x${screen.height}:${screen.colorDepth}:${nav.userAgent.substring(0, 50)}:${nav.platform}:${nav.language}:${new Date().getTimezoneOffset()}:${canvasData}`;
    
    // Hash it to a number
    let hash = 0;
    for (let i = 0; i < fpString.length; i++) {
        hash = (hash << 5) - hash + fpString.charCodeAt(i);
        hash &= hash;
    }
    return Math.abs(hash).toString(36);
}

async function fetchServerTime() {
    const now = Date.now();
    if (serverTimeOffset !== null && now - serverTimeLastFetched < 300000) {
        return Math.floor((now + serverTimeOffset) / 1000);
    }
    try {
        let baseUrl = "";
        if (typeof window !== "undefined") {
            baseUrl = window.TMDB_API_BASE_URL || window.TMDB_CLIENT_BASE_URL || "";
        }
        if (!baseUrl) {
            console.warn("[TMDB Image Enhancer] TMDB_API_BASE_URL not set, using client time.");
            return Math.floor(Date.now() / 1000);
        }
        const startTime = Date.now();
        const url = `${baseUrl}/api/time?t=${startTime}`;
        console.log("[TMDB Image Enhancer] Fetching server time from:", url);
        const response = await fetch(url, {
            method: "GET",
            headers: { "Cache-Control": "no-cache" }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch server time: HTTP ${response.status} from ${url}`);
        }
        const endTime = Date.now();
        const rtt = endTime - startTime;
        const data = await response.json();
        if (!data || typeof data.timestamp !== "number") {
            throw new Error(`Invalid server time response: ${JSON.stringify(data)}`);
        }
        const serverTime = data.timestamp * 1000;
        serverTimeOffset = serverTime + rtt / 2 - endTime;
        serverTimeLastFetched = endTime;
        console.log(`[TMDB Image Enhancer] Server time synced: offset=${serverTimeOffset}ms, RTT=${rtt}ms`);
        return Math.floor((endTime + serverTimeOffset) / 1000);
    } catch (e) {
        console.warn("[TMDB Image Enhancer] Failed to fetch server time, using client time:", e);
        return Math.floor(Date.now() / 1000);
    }
}

/**
 * Generate HMAC-SHA256 signature for request authentication
 * 
 * Message format: `${apiKey}:${timestamp}:${nonce}:${path}`
 * Key: apiKey (the 64-char hex key from WASM)
 */
async function generateRequestSignature(apiKey, timestamp, nonce, path) {
    const message = `${apiKey}:${timestamp}:${nonce}:${path}`;
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const keyBytes = encoder.encode(apiKey);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageBytes);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Build secure headers for API requests
 * 
 * Headers:
 * - X-Api-Key: The 64-char hex key from WASM get_img_key()
 * - X-Request-Timestamp: Server-synced timestamp
 * - X-Request-Nonce: Random 22-char nonce
 * - X-Request-Signature: HMAC-SHA256 signature
 * - X-Client-Fingerprint: Client-side fingerprint (NOT the WASM key derivation fingerprint)
 */
export async function buildSecureHeaders(apiKey, url) {
    let path = url;
    try {
        path = new URL(url).pathname;
    } catch (e) {
        const match = url.match(/\/api\/tmdb\/.*/);
        if (match) {
            path = match[0];
        }
    }
    const timestamp = await fetchServerTime();
    const nonce = generateNonce();
    const fingerprint = generateClientFingerprint();
    const signature = await generateRequestSignature(apiKey, timestamp, nonce, path);
    return {
        "X-Api-Key": apiKey,
        "X-Request-Timestamp": timestamp.toString(),
        "X-Request-Nonce": nonce,
        "X-Request-Signature": signature,
        "X-Client-Fingerprint": fingerprint
    };
}

/**
 * Main function to fetch and decrypt TMDB image data
 * 
 * Flow:
 * 1. Initialize WASM and get the session key (get_img_key())
 * 2. Build API URL for the content
 * 3. Generate secure headers with HMAC signature
 * 4. Fetch encrypted server list
 * 5. Decrypt using WASM process_img_data(encrypted, apiKey)
 * 6. For each server, fetch and decrypt the source URL
 */
export async function enhanceTmdbImageData(type, params) {
    if (!params || !params.tmdbId || String(params.tmdbId).trim() === "") {
        throw new Error("tmdbId is required");
    }
    if (type === "tv" && (!params.seasonId || !params.episodeId)) {
        throw new Error("seasonId and episodeId are required for TV");
    }
    
    const { imageProcessor, enhancementKey } = await initImageEnhancement();
    
    if (!enhancementKey || enhancementKey.length !== 64) {
        throw new Error(`Invalid enhancement key: length=${enhancementKey?.length || 0} (expected 64). WASM may not be initialized properly.`);
    }
    
    const apiUrl = buildImageApiUrl(type, params);
    const headers = await buildSecureHeaders(enhancementKey, apiUrl);
    
    // Progress callback
    if (typeof window !== "undefined" && window.__SOURCE_FETCH_PROGRESS__) {
        window.__SOURCE_FETCH_PROGRESS__({
            phase: "fetching-servers",
            message: "Fetching available servers..."
        });
    }
    
    // Fetch encrypted server list
    const response = await fetch(apiUrl, {
        headers: {
            "bW90aGFmYWth": "1",  // Base64 of "mothafaka" - anti-scraping marker
            "Accept": "text/plain",
            ...headers
        }
    });
    
    if (!response.ok) {
        let errorDetail = "";
        try {
            const text = await response.text();
            errorDetail = text ? ` - ${text.substring(0, 200)}` : "";
        } catch (e) {}
        throw new Error(`Failed to fetch enabled servers: HTTP ${response.status}${errorDetail}`);
    }
    
    const encryptedData = await response.text();
    let servers = {};
    let serverList = [];
    
    try {
        if (!imageProcessor || typeof imageProcessor.process_img_data !== "function") {
            throw new Error("WASM image processor not available");
        }
        if (!enhancementKey || enhancementKey.length !== 64) {
            throw new Error(`Invalid enhancement key length: ${enhancementKey?.length || 0} (expected 64)`);
        }
        
        // DECRYPT THE SERVER LIST
        const decrypted = await imageProcessor.process_img_data(encryptedData, enhancementKey);
        const parsed = JSON.parse(decrypted);
        
        if (parsed?.sources && Array.isArray(parsed.sources)) {
            servers = {};
            for (const source of parsed.sources) {
                if (source?.server) {
                    servers[source.server] = source.server;
                }
            }
            if (parsed?.servers && Object.keys(parsed.servers).length > 0) {
                servers = parsed.servers;
            }
        } else {
            servers = parsed?.servers || {};
        }
        
        serverList = Object.keys(servers);
        if (serverList.length === 0) {
            throw new Error("No servers returned from backend");
        }
        
        if (typeof window !== "undefined" && window.__SOURCE_FETCH_PROGRESS__) {
            window.__SOURCE_FETCH_PROGRESS__({
                phase: "fetching-server",
                message: `Found ${serverList.length} available servers, starting to fetch...`,
                totalServers: serverList.length
            });
        }
    } catch (e) {
        throw new Error(`Failed to decrypt server list from backend: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    // NATO phonetic alphabet order for server priority
    const natoOrder = [
        "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel",
        "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa",
        "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey",
        "xray", "yankee", "zulu"
    ];
    
    const sortedServers = natoOrder.filter(s => serverList.includes(s))
        .concat(serverList.filter(s => !natoOrder.includes(s)));
    
    const results = [];
    const failedServers = [];
    
    // Try each server until we get a valid source
    for (let i = 0; i < sortedServers.length; i++) {
        const server = sortedServers[i];
        
        // Rate limiting
        if (Date.now() - lastImageProcessTime < 200) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (imageProcessingCalls >= 50) {
            console.warn("[Enhancer] Aborting loop: imageProcessingCalls limit reached");
            break;
        }
        
        if (typeof window !== "undefined" && window.__SOURCE_FETCH_PROGRESS__) {
            window.__SOURCE_FETCH_PROGRESS__({
                phase: "fetching-server",
                message: `Fetching source from ${server}...`,
                currentServer: server,
                totalServers: serverList.length,
                completedServers: i,
                failedServers: [...failedServers]
            });
        }
        
        const serverHeaders = await buildSecureHeaders(enhancementKey, apiUrl);
        const serverResponse = await fetch(apiUrl, {
            headers: {
                "Accept": "text/plain",
                "X-Only-Sources": "1",
                "X-Server": server || "",
                ...serverHeaders
            }
        });
        
        if (!serverResponse.ok) {
            console.warn("[Enhancer] Server response not OK for", server, "status=", serverResponse.status);
            failedServers.push(server);
            results.push({ nato: server, url: "" });
            continue;
        }
        
        const serverEncryptedData = await serverResponse.text();
        lastImageProcessTime = Date.now();
        trackImageProcessingCall();
        
        let sourceUrl = "";
        try {
            // DECRYPT THE SOURCE URL
            const decrypted = await imageProcessor.process_img_data(serverEncryptedData, enhancementKey);
            const parsed = JSON.parse(decrypted);
            
            if (parsed && Array.isArray(parsed.sources)) {
                if (parsed.sources.length === 0) {
                    sourceUrl = "";
                } else {
                    const source = parsed.sources.find(s => 
                        s?.server?.toLowerCase?.() === server || s?.server
                    );
                    if (source && typeof source.url === "string" && source.url.trim() !== "") {
                        sourceUrl = source.url;
                    }
                }
            } else if (parsed && parsed.sources && typeof parsed.sources.file === "string") {
                const file = parsed.sources.file;
                sourceUrl = file.trim() !== "" ? file : "";
            } else if (parsed && parsed.sources && typeof parsed.sources === "object") {
                const file = parsed.sources.file || parsed.sources.url || "";
                sourceUrl = typeof file === "string" && file.trim() !== "" ? file : "";
            }
        } catch (e) {
            sourceUrl = "";
            const errorMsg = e instanceof Error ? e.message : String(e);
            if (errorMsg.includes("E58") || errorMsg.includes("E57") || errorMsg.includes("E56")) {
                failedServers.push(server);
            }
        }
        
        results.push({ nato: server, url: sourceUrl });
        
        if (sourceUrl) {
            // Found a valid source, stop searching
            if (typeof window !== "undefined" && window.__SOURCE_FETCH_PROGRESS__) {
                window.__SOURCE_FETCH_PROGRESS__({
                    phase: "found",
                    message: `Source found from ${server}!`,
                    currentServer: server,
                    totalServers: serverList.length,
                    completedServers: i + 1,
                    failedServers: [...failedServers]
                });
            }
            break;
        }
        
        if (!failedServers.includes(server)) {
            failedServers.push(server);
        }
    }
    
    // Fill in remaining servers
    for (const server of sortedServers) {
        if (!results.find(r => r.nato === server) && serverList.includes(server)) {
            results.push({ nato: server, url: null });
        }
    }
    
    updateImageProcessingStats();
    
    // Build final result
    const posterSources = {};
    for (const result of results) {
        if (serverList.includes(result.nato)) {
            if (result.url === null) {
                posterSources[result.nato] = null;
            } else if (result.url) {
                posterSources[result.nato] = {
                    url: result.url,
                    server: result.nato,
                    file: result.url
                };
            } else {
                posterSources[result.nato] = {
                    url: "",
                    server: result.nato
                };
            }
        }
    }
    
    if (Object.keys(posterSources).length === 0 && serverList.length > 0) {
        console.warn("[Enhancer] No sources found, but backend returned servers. Creating null entries for all backend servers.");
        for (const server of serverList) {
            posterSources[server] = null;
        }
    }
    
    if (Object.keys(posterSources).length === 0) {
        throw new Error("No servers available from backend");
    }
    
    return {
        poster_sources: posterSources,
        tmdb_image_id: parseInt(params.tmdbId),
        total_processing_time: 0,
        image_type: type
    };
}

export async function fetchServerSource(type, params, server) {
    const { imageProcessor, enhancementKey } = await initImageEnhancement();
    const apiUrl = buildImageApiUrl(type, params);
    const headers = await buildSecureHeaders(enhancementKey || "", apiUrl);
    
    const response = await fetch(apiUrl, {
        headers: {
            "Accept": "text/plain",
            "X-Only-Sources": "1",
            "X-Server": server,
            ...headers
        }
    });
    
    if (!response.ok) {
        return null;
    }
    
    const encryptedData = await response.text();
    const decrypted = await imageProcessor.process_img_data(encryptedData, enhancementKey);
    
    try {
        const parsed = JSON.parse(decrypted);
        if (Array.isArray(parsed?.sources)) {
            const source = parsed.sources.find(s => 
                s?.server?.toLowerCase?.() === server || s?.server
            );
            if (source && typeof source.url === "string" && source.url) {
                return { url: source.url };
            }
        } else if (parsed && parsed.sources && typeof parsed.sources.file === "string" && parsed.sources.file) {
            return { url: parsed.sources.file };
        }
    } catch (e) {}
    
    return null;
}

export const clearImageEnhancementSession = () => {
    clearImageProcessingCache(true);
};

export const getImageProcessingSessionInfo = () => {
    updateImageProcessingStats();
    return {
        processingCalls: imageProcessingCalls,
        remainingCalls: Math.max(0, 50 - imageProcessingCalls),
        lastProcessTime: lastImageProcessTime
    };
};

if (typeof window !== "undefined") {
    window.clearImageEnhancementSession = clearImageEnhancementSession;
    window.getImageProcessingSessionInfo = getImageProcessingSessionInfo;
}
