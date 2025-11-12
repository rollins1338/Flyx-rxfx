const https = require('https');
const http = require('http');
const fs = require('fs');

// Check if Puppeteer is available
let puppeteer = null;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    // Puppeteer not installed
}

// Utility function to make HTTP requests with redirect handling
function fetch(url, options = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Too many redirects'));
            return;
        }
        
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': options.referer || 'https://vidsrc.xyz/',
                'Origin': options.origin || 'https://vidsrc.xyz',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...options.headers
            }
        };

        const req = protocol.request(reqOptions, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = res.headers.location.startsWith('http') 
                    ? res.headers.location 
                    : new URL(res.headers.location, url).href;
                
                return fetch(redirectUrl, options, redirectCount + 1)
                    .then(resolve)
                    .catch(reject);
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ 
                status: res.statusCode, 
                data, 
                headers: res.headers,
                finalUrl: url
            }));
        });

        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

// Decode VidSrc hash (triple-layer: BASE64 → MD5:BASE64 → encrypted data)
function decodeVidSrcHash(hash) {
    try {
        // First layer: Base64 decode
        const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
        
        // Second layer: Split MD5 and data
        const parts = firstDecode.split(':');
        if (parts.length >= 2) {
            const md5 = parts[0];
            const encodedData = parts[1];
            
            // Third layer: Base64 decode the data
            const finalData = Buffer.from(encodedData, 'base64').toString('utf-8');
            
            return {
                success: true,
                md5,
                data: finalData,
                raw: firstDecode
            };
        }
        
        return { success: false, error: 'Invalid hash format' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Extract all server hashes from VidSrc page
function extractServerHashes(html) {
    const servers = [];
    
    // Extract data-hash attributes (these are the server sources)
    const hashRegex = /data-hash=["']([^"']+)["']/gi;
    let match;
    let serverIndex = 0;
    
    while ((match = hashRegex.exec(html)) !== null) {
        serverIndex++;
        const dataHash = match[1];
        
        // Decode the hash using our triple-layer decoder
        const decoded = decodeVidSrcHash(dataHash);
        
        if (decoded.success) {
            // The decoded data contains the CloudNestra RCP URL
            servers.push({
                index: serverIndex,
                type: `server${serverIndex}`,
                hash: dataHash,
                md5: decoded.md5,
                decodedData: decoded.data,
                rcpUrl: `https://cloudnestra.com/rcp/${dataHash}`,
                server: identifyServerFromData(decoded.data)
            });
        } else {
            console.log(`  ⚠ Failed to decode server ${serverIndex}: ${decoded.error}`);
        }
    }
    
    return servers;
}

// Identify server from decoded data or URL
function identifyServerFromData(data) {
    const serverPatterns = {
        'cloudstream': /cloudstream|cloudnestra/i,
        '2embed': /2embed|embed2/i,
        'superembed': /superembed/i,
        'vidplay': /vidplay|mycloud/i,
        'filemoon': /filemoon/i,
        'doodstream': /doodstream|dood/i,
        'upstream': /upstream/i,
        'mixdrop': /mixdrop/i,
        'streamtape': /streamtape/i,
        'voe': /voe\.sx/i,
        'streamwish': /streamwish/i
    };
    
    for (const [name, pattern] of Object.entries(serverPatterns)) {
        if (pattern.test(data)) return name;
    }
    
    return 'cloudnestra'; // Default for CloudNestra-based servers
}

// Extract M3U8 using browser automation (Puppeteer)
async function extractWithBrowser(finalUrl) {
    if (!puppeteer) {
        console.log(`  ⚠ Puppeteer not available - install with: npm install puppeteer`);
        return null;
    }
    
    console.log(`  → Launching browser automation...`);
    
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        const m3u8Urls = [];
        
        // Intercept network requests
        await page.setRequestInterception(true);
        page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8')) {
                console.log(`  🎯 M3U8 request intercepted: ${url.substring(0, 80)}...`);
                m3u8Urls.push(url);
            }
            request.continue();
        });
        
        // Navigate to player page
        console.log(`  → Loading player page in browser...`);
        await page.goto(finalUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait a bit for player to initialize
        await page.waitForTimeout(5000);
        
        await browser.close();
        
        if (m3u8Urls.length > 0) {
            console.log(`  ✓ Found ${m3u8Urls.length} M3U8 URL(s) via browser automation`);
            return m3u8Urls[0]; // Return the first one
        }
        
        console.log(`  ✗ No M3U8 URLs intercepted`);
        return null;
        
    } catch (error) {
        console.log(`  ✗ Browser automation error: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }
}

// Extract M3U8 from CloudNestra-based servers (CloudStream, 2Embed, Superembed)
async function extractCloudNestra(server) {
    console.log(`  → Fetching CloudNestra RCP page...`);
    
    try {
        // Step 1: Fetch the first RCP page
        const rcpResponse = await fetch(server.rcpUrl, {
            referer: 'https://vidsrc.xyz/',
            origin: 'https://vidsrc.xyz'
        });
        
        if (rcpResponse.status !== 200) {
            console.log(`  ✗ RCP request failed: ${rcpResponse.status}`);
            return null;
        }
        
        const rcpHtml = rcpResponse.data;
        console.log(`  ✓ RCP page fetched (${rcpHtml.length} bytes)`);
        
        // Step 2: Look for nested iframe with prorcp or srcrcp
        const nestedPatterns = [
            /src:\s*['"]\/prorcp\/([^'"]+)['"]/,  // CloudStream Pro
            /src:\s*['"]\/srcrcp\/([^'"]+)['"]/,  // 2Embed, Superembed
            /src=["']\/prorcp\/([^"']+)["']/,
            /src=["']\/srcrcp\/([^"']+)["']/
        ];
        
        let nestedHash = null;
        let endpoint = null;
        
        for (const pattern of nestedPatterns) {
            const match = rcpHtml.match(pattern);
            if (match) {
                nestedHash = match[1];
                endpoint = pattern.source.includes('prorcp') ? 'prorcp' : 'srcrcp';
                break;
            }
        }
        
        if (!nestedHash) {
            console.log('  ✗ No nested iframe found in RCP page');
            return null;
        }
        
        console.log(`  ✓ Found nested ${endpoint} hash`);
        
        // Step 3: Fetch the final player page
        const finalUrl = `https://cloudnestra.com/${endpoint}/${nestedHash}`;
        console.log(`  → Fetching final player...`);
        
        const finalResponse = await fetch(finalUrl, {
            referer: 'https://cloudnestra.com/',
            origin: 'https://cloudnestra.com'
        });
        
        if (finalResponse.status !== 200) {
            console.log(`  ✗ Final player request failed: ${finalResponse.status}`);
            return null;
        }
        
        const finalHtml = finalResponse.data;
        console.log(`  ✓ Final player fetched (${finalHtml.length} bytes)`);
        
        // Save for debugging
        const debugFile = `examples/server${server.index}-final-player.html`;
        fs.writeFileSync(debugFile, finalHtml);
        console.log(`  → Saved to ${debugFile}`);
        
        // Step 4: Try static extraction first
        const staticResult = await extractM3U8FromHTML(finalHtml, finalUrl);
        
        // If we got an encrypted marker, try browser automation
        if (staticResult && staticResult.encrypted) {
            console.log(`  → Attempting browser automation to decrypt...`);
            const browserResult = await extractWithBrowser(finalUrl);
            if (browserResult) return browserResult;
        }
        
        // Return static result (might be null or encrypted marker)
        return staticResult;
        
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        return null;
    }
}

// Extract M3U8 from Vidplay/MyCloud
async function extractVidplay(playerUrl) {
    console.log('  → Fetching Vidplay player page...');
    const response = await fetch(playerUrl, {
        referer: 'https://vidsrc.xyz/'
    });
    const html = response.data;
    
    return await extractM3U8FromHTML(html, playerUrl);
}

// Extract M3U8 from Filemoon
async function extractFilemoon(playerUrl) {
    console.log('  → Fetching Filemoon player page...');
    const response = await fetch(playerUrl, {
        referer: 'https://vidsrc.xyz/'
    });
    const html = response.data;
    
    return await extractM3U8FromHTML(html, playerUrl);
}

// Extract M3U8 from Doodstream
async function extractDoodstream(playerUrl) {
    console.log('  → Fetching Doodstream player page...');
    const response = await fetch(playerUrl, {
        referer: 'https://vidsrc.xyz/'
    });
    const html = response.data;
    
    // Extract pass_md5 token
    const tokenMatch = html.match(/\/pass_md5\/([^\/'"]+)/);
    if (tokenMatch) {
        const token = tokenMatch[1];
        const apiUrl = `https://doodstream.com/pass_md5/${token}/${Date.now()}`;
        
        try {
            console.log('  → Calling Doodstream API...');
            const apiResponse = await fetch(apiUrl, {
                referer: playerUrl
            });
            const m3u8Match = apiResponse.data.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
            if (m3u8Match) {
                console.log('  ✓ M3U8 found from API');
                return m3u8Match[0];
            }
        } catch (e) {
            console.log('  ✗ Doodstream API call failed:', e.message);
        }
    }
    
    return null;
}

// Extract M3U8 from generic player
async function extractGeneric(playerUrl) {
    console.log('  → Fetching player page...');
    const response = await fetch(playerUrl, {
        referer: 'https://vidsrc.xyz/'
    });
    const html = response.data;
    
    // Save for debugging
    const urlHash = Buffer.from(playerUrl).toString('base64').substring(0, 20);
    fs.writeFileSync(`examples/player-${urlHash}.html`, html);
    console.log(`  → Saved player HTML`);
    
    // Check for nested iframe
    const nestedIframeMatch = html.match(/src:\s*['"]([^'"]+)['"]/);
    if (nestedIframeMatch) {
        let nestedUrl = nestedIframeMatch[1];
        
        // Build full URL
        const baseUrl = new URL(playerUrl);
        if (nestedUrl.startsWith('/')) {
            nestedUrl = `${baseUrl.protocol}//${baseUrl.hostname}${nestedUrl}`;
        } else if (nestedUrl.startsWith('//')) {
            nestedUrl = `${baseUrl.protocol}${nestedUrl}`;
        }
        
        console.log(`  → Found nested iframe: ${nestedUrl.substring(0, 80)}...`);
        console.log(`  → Fetching nested player...`);
        
        const nestedResponse = await fetch(nestedUrl, {
            referer: playerUrl
        });
        const nestedHtml = nestedResponse.data;
        
        // Save nested HTML
        const nestedHash = Buffer.from(nestedUrl).toString('base64').substring(0, 20);
        fs.writeFileSync(`examples/player-nested-${nestedHash}.html`, nestedHtml);
        console.log(`  → Saved nested player HTML`);
        
        // Try to extract M3U8 from nested page
        const m3u8 = await extractM3U8FromHTML(nestedHtml, nestedUrl);
        if (m3u8) return m3u8;
    }
    
    // Try to extract M3U8 from current page
    return await extractM3U8FromHTML(html, playerUrl);
}

// Helper function to extract M3U8 from HTML
async function extractM3U8FromHTML(html, sourceUrl = '') {
    // 1. Look for hidden div with encoded stream data (CloudNestra pattern)
    const hiddenDivMatch = html.match(/<div\s+id=["']([^"']+)["'][^>]*style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/i);
    if (hiddenDivMatch) {
        const varName = hiddenDivMatch[1];
        const encodedData = hiddenDivMatch[2];
        
        console.log(`  → Found hidden div: ${varName} (${encodedData.length} chars)`);
        
        // Check if this div is used in Playerjs initialization
        const playerJsMatch = html.match(new RegExp(`file:\\s*${varName}\\s*[,}]`));
        if (playerJsMatch) {
            console.log(`  → Hidden div is used as Playerjs file source`);
            console.log(`  → Data is encrypted and requires the player driver to decode`);
            
            // Try to fetch the player driver script
            const driverMatch = html.match(/src=["']([^"']*pjs_main_drv[^"']*)["']/);
            if (driverMatch) {
                let driverUrl = driverMatch[1];
                if (driverUrl.startsWith('/')) {
                    const baseUrl = new URL(sourceUrl || 'https://cloudnestra.com');
                    driverUrl = `${baseUrl.protocol}//${baseUrl.hostname}${driverUrl}`;
                }
                
                console.log(`  → Player driver: ${driverUrl.substring(0, 80)}...`);
                console.log(`  ⚠ Stream URL is encrypted in hidden div`);
                console.log(`  → Decryption requires executing the player driver script`);
                console.log(`  → Recommendation: Use browser automation to intercept the decrypted URL`);
                
                // Return a special marker indicating we found encrypted data
                return {
                    encrypted: true,
                    varName,
                    encodedData: encodedData.substring(0, 100) + '...',
                    driverUrl,
                    message: 'Stream URL is encrypted and requires browser automation to extract'
                };
            }
        }
        
        // Try base64 decode anyway
        try {
            const decoded = Buffer.from(encodedData, 'base64').toString('utf8');
            if (decoded.includes('http') || decoded.includes('.m3u8')) {
                console.log(`  ✓ Decoded M3U8 from hidden div`);
                const urlMatch = decoded.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/);
                if (urlMatch) return urlMatch[1];
                return decoded;
            }
        } catch (e) {}
    }
    
    // 2. Look for direct M3U8 URLs in the HTML
    const directM3u8 = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
    if (directM3u8) {
        console.log(`  ✓ Found direct M3U8 URL`);
        return directM3u8[0];
    }
    
    // 3. Look for file/source patterns
    const sourcePatterns = [
        /file:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /source:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /"file":\s*"([^"]+\.m3u8[^"]*)"/i,
        /"sources":\s*\[{[^}]*"file":\s*"([^"]+)"/i,
        /playlist:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /src:\s*["']([^"']+\.m3u8[^"']*)["']/i
    ];
    
    for (const pattern of sourcePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            console.log(`  ✓ Found M3U8 in source pattern`);
            return match[1];
        }
    }
    
    // 4. Look for base64 encoded sources in atob() calls
    const base64Pattern = /atob\s*\(\s*["']([A-Za-z0-9+/=]{20,})["']\s*\)/g;
    let b64Match;
    while ((b64Match = base64Pattern.exec(html)) !== null) {
        try {
            const decoded = Buffer.from(b64Match[1], 'base64').toString('utf8');
            if (decoded.includes('.m3u8') || decoded.includes('http')) {
                console.log(`  ✓ Decoded M3U8 from atob()`);
                const urlMatch = decoded.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/);
                if (urlMatch) return urlMatch[1];
                if (decoded.includes('.m3u8')) return decoded;
            }
        } catch (e) {}
    }
    
    // 5. Look for packed JavaScript (eval)
    const packedMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?\)\)/s);
    if (packedMatch) {
        const m3u8Match = packedMatch[0].match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/);
        if (m3u8Match) {
            console.log(`  ✓ Found M3U8 in packed JavaScript`);
            return m3u8Match[0];
        }
    }
    
    // 6. Check for data attributes
    const dataAttrMatch = html.match(/data-[a-z-]*(?:src|url|file)[a-z-]*=["']([^"']+\.m3u8[^"']*)["']/i);
    if (dataAttrMatch) {
        console.log(`  ✓ Found M3U8 in data attribute`);
        return dataAttrMatch[1];
    }
    
    console.log(`  ⚠ No M3U8 URL found in HTML`);
    console.log(`  → Stream may be loaded dynamically via JavaScript`);
    console.log(`  → Recommendation: Use browser automation (Puppeteer) to intercept network requests`);
    
    return null;
}

// Main extraction function for a single server
async function extractFromServer(server) {
    const serverName = server.server || 'cloudnestra';
    
    console.log(`\n[${'='.repeat(60)}]`);
    console.log(`[SERVER ${server.index}: ${serverName.toUpperCase()}]`);
    console.log(`[${'='.repeat(60)}]`);
    console.log(`  MD5: ${server.md5}`);
    console.log(`  RCP URL: ${server.rcpUrl.substring(0, 80)}...`);
    
    try {
        let m3u8 = null;
        
        // CloudNestra-based servers (CloudStream, 2Embed, Superembed)
        if (serverName === 'cloudnestra' || serverName === 'cloudstream' || 
            serverName === '2embed' || serverName === 'superembed') {
            m3u8 = await extractCloudNestra(server);
        }
        // Legacy server types (if any direct URLs are found)
        else if (serverName === 'vidplay') {
            m3u8 = await extractVidplay(server.rcpUrl);
        } else if (serverName === 'filemoon') {
            m3u8 = await extractFilemoon(server.rcpUrl);
        } else if (serverName === 'doodstream') {
            m3u8 = await extractDoodstream(server.rcpUrl);
        } else {
            m3u8 = await extractGeneric(server.rcpUrl);
        }
        
        if (m3u8) {
            // Check if it's an encrypted marker
            if (typeof m3u8 === 'object' && m3u8.encrypted) {
                console.log(`\n  ⚠ ENCRYPTED STREAM FOUND`);
                console.log(`  Variable: ${m3u8.varName}`);
                console.log(`  Driver: ${m3u8.driverUrl}`);
                console.log(`  ${m3u8.message}`);
                return {
                    index: server.index,
                    type: server.type,
                    server: serverName,
                    md5: server.md5,
                    rcpUrl: server.rcpUrl,
                    encrypted: true,
                    message: m3u8.message,
                    driverUrl: m3u8.driverUrl
                };
            }
            
            // Regular M3U8 URL found
            console.log(`\n  🎉 SUCCESS! M3U8 URL FOUND:`);
            console.log(`  ${m3u8}`);
            return { 
                index: server.index,
                type: server.type,
                server: serverName,
                md5: server.md5,
                rcpUrl: server.rcpUrl,
                m3u8 
            };
        } else {
            console.log(`\n  ✗ No M3U8 URL extracted`);
            return null;
        }
    } catch (error) {
        console.log(`\n  ✗ Error: ${error.message}`);
        if (error.stack) {
            console.log(`  Stack: ${error.stack.split('\n')[1]}`);
        }
        return null;
    }
}

// Main function
async function extractAllM3U8(tmdbId, type = 'movie', season = null, episode = null) {
    console.log('\n' + '═'.repeat(70));
    console.log('  VidSrc M3U8 Extractor - Enhanced with Full Deobfuscation');
    console.log('═'.repeat(70));
    console.log(`  TMDB ID: ${tmdbId}`);
    console.log(`  Type: ${type}`);
    if (type === 'tv') {
        console.log(`  Season: ${season}, Episode: ${episode}`);
    }
    console.log('═'.repeat(70) + '\n');
    
    // Build VidSrc URL
    let vidsrcUrl;
    if (type === 'tv') {
        if (!season || !episode) {
            console.error('✗ Season and episode required for TV shows');
            return;
        }
        vidsrcUrl = `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
    } else {
        vidsrcUrl = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
    }
    
    console.log(`Step 1: Fetching VidSrc page...`);
    console.log(`  URL: ${vidsrcUrl}\n`);
    
    try {
        const response = await fetch(vidsrcUrl);
        
        if (response.status !== 200) {
            console.error(`✗ Failed to fetch VidSrc page (Status: ${response.status})`);
            return;
        }
        
        const html = response.data;
        console.log(`✓ VidSrc page fetched (${html.length} bytes)\n`);
        
        // Save for debugging
        fs.writeFileSync('examples/vidsrc-page.html', html);
        console.log('→ Saved to examples/vidsrc-page.html\n');
        
        // Extract all server hashes
        console.log('Step 2: Extracting server hashes...\n');
        const servers = extractServerHashes(html);
        
        if (servers.length === 0) {
            console.log('✗ No servers found in VidSrc page');
            console.log('  The page may have changed or hashes may be expired\n');
            return;
        }
        
        console.log(`✓ Found ${servers.length} server(s):\n`);
        servers.forEach((server, i) => {
            console.log(`  ${i + 1}. Server ${server.index} (${server.server})`);
            console.log(`     MD5: ${server.md5}`);
        });
        
        console.log('\n' + '═'.repeat(70));
        console.log('  Step 3: Extracting M3U8 URLs from all servers...');
        console.log('═'.repeat(70));
        
        // Extract from all servers
        const results = [];
        for (const server of servers) {
            const result = await extractFromServer(server);
            if (result) {
                results.push(result);
            }
            // Delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Print final summary
        console.log('\n\n' + '═'.repeat(70));
        console.log('  EXTRACTION COMPLETE');
        console.log('═'.repeat(70) + '\n');
        
        if (results.length === 0) {
            console.log('✗ No M3U8 URLs found from any server\n');
            console.log('Possible reasons:');
            console.log('  1. Streams are loaded dynamically via JavaScript');
            console.log('  2. Additional decryption/deobfuscation required');
            console.log('  3. Hashes have expired (try with fresh content)');
            console.log('\nRecommendation:');
            console.log('  Use browser automation (Puppeteer/Playwright) to:');
            console.log('  - Load the final player page in a real browser');
            console.log('  - Intercept network requests');
            console.log('  - Capture M3U8 URLs when they are requested\n');
            return;
        }
        
        const successfulResults = results.filter(r => r.m3u8 && !r.encrypted);
        const encryptedResults = results.filter(r => r.encrypted);
        
        if (successfulResults.length > 0) {
            console.log(`🎉 Successfully extracted ${successfulResults.length} M3U8 URL(s):\n`);
            
            successfulResults.forEach((result, i) => {
                console.log(`${i + 1}. SERVER ${result.index} - ${result.server.toUpperCase()}`);
                console.log(`   MD5:    ${result.md5}`);
                console.log(`   RCP:    ${result.rcpUrl.substring(0, 60)}...`);
                console.log(`   M3U8:   ${result.m3u8}`);
                console.log('');
            });
        }
        
        if (encryptedResults.length > 0) {
            console.log(`⚠ Found ${encryptedResults.length} encrypted stream(s):\n`);
            
            encryptedResults.forEach((result, i) => {
                console.log(`${i + 1}. SERVER ${result.index} - ${result.server.toUpperCase()}`);
                console.log(`   MD5:     ${result.md5}`);
                console.log(`   RCP:     ${result.rcpUrl.substring(0, 60)}...`);
                console.log(`   Status:  ${result.message}`);
                console.log(`   Driver:  ${result.driverUrl}`);
                console.log('');
            });
        }
        
        console.log('═'.repeat(70));
        console.log('  Next Steps:');
        console.log('═'.repeat(70));
        console.log('  1. Test the M3U8 URLs in a video player (VLC, ffplay, etc.)');
        console.log('  2. Check examples/ folder for saved HTML files');
        console.log('  3. If URLs don\'t work, they may have expired or need proxying');
        console.log('═'.repeat(70) + '\n');
        
    } catch (error) {
        console.error('\n✗ Fatal error:', error.message);
        console.error(error.stack);
    }
}

// Run the script
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('  VidSrc M3U8 Extractor - Usage');
    console.log('═'.repeat(70));
    console.log('\nFor Movies:');
    console.log('  node extract-all-m3u8.js <TMDB_ID>');
    console.log('  Example: node extract-all-m3u8.js 550');
    console.log('\nFor TV Shows:');
    console.log('  node extract-all-m3u8.js <TMDB_ID> tv <SEASON> <EPISODE>');
    console.log('  Example: node extract-all-m3u8.js 1396 tv 1 1');
    console.log('\n' + '═'.repeat(70) + '\n');
    process.exit(1);
}

const tmdbId = args[0];
const type = args[1] || 'movie';
const season = args[2] || null;
const episode = args[3] || null;

extractAllM3U8(tmdbId, type, season, episode);
