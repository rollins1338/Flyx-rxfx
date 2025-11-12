/**
 * COMPLETE M3U8 EXTRACTOR - ALL SERVERS
 * Extracts from EVERY available server without browser automation
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

// HTTP request with redirect handling
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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                ...options.headers
            }
        };

        const req = protocol.request(reqOptions, (res) => {
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

// Decode VidSrc hash
function decodeHash(hash) {
    try {
        const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
        const [md5, encodedData] = firstDecode.split(':');
        const finalData = Buffer.from(encodedData, 'base64').toString('utf-8');
        
        return { success: true, md5, data: finalData };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Unpack JavaScript (for YesMovies)
function unpackJS(p, a, c, k) {
    while (c--) {
        if (k[c]) {
            p = p.replace(new RegExp('\\b' + c.toString(a) + '\\b', 'g'), k[c]);
        }
    }
    return p;
}

// Extract M3U8 from HTML
function extractM3U8FromHTML(html) {
    const patterns = [
        /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g,
        /file:\s*["']([^"']+\.m3u8[^"']*)["']/i,
        /"file":\s*"([^"]+\.m3u8[^"]*)"/i
    ];
    
    for (const pattern of patterns) {
        const matches = html.match(pattern);
        if (matches) {
            return matches[0].replace(/["']/g, '');
        }
    }
    
    return null;
}

// SERVER 1: CloudStream (encrypted - skip for now)
async function extractCloudStream(hash) {
    console.log('\n[SERVER 1: CLOUDSTREAM]');
    console.log('  Status: Encrypted - requires player driver decryption');
    console.log('  Skipping (use Server 2 or 3 instead)');
    return null;
}

// SERVER 2: 2Embed → YesMovies
async function extract2Embed(hash) {
    console.log('\n[SERVER 2: 2EMBED → YESMOVIES]');
    
    try {
        // Step 1: Decode hash
        const decoded = decodeHash(hash);
        if (!decoded.success) {
            console.log('  ✗ Failed to decode hash');
            return null;
        }
        
        // Step 2: Fetch RCP page
        const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
        console.log('  → Fetching RCP...');
        const rcpResponse = await fetch(rcpUrl);
        
        if (rcpResponse.status !== 200) {
            console.log(`  ✗ RCP failed: ${rcpResponse.status}`);
            return null;
        }
        
        // Step 3: Extract srcrcp hash
        const srcrcpMatch = rcpResponse.data.match(/src:\s*['"]\/srcrcp\/([^'"]+)['"]/);
        if (!srcrcpMatch) {
            console.log('  ✗ No srcrcp hash found');
            return null;
        }
        
        // Step 4: Fetch srcrcp page (2Embed player)
        const srcrcpUrl = `https://cloudnestra.com/srcrcp/${srcrcpMatch[1]}`;
        console.log('  → Fetching 2Embed player...');
        const embedResponse = await fetch(srcrcpUrl);
        
        // Step 5: Extract swish ID from iframe data-src
        const swishMatch = embedResponse.data.match(/data-src=["']https:\/\/streamsrcs\.2embed\.cc\/swish\?id=([^"']+)["']/);
        if (!swishMatch) {
            console.log('  ✗ No swish ID found');
            return null;
        }
        
        const swishId = swishMatch[1];
        console.log(`  → Swish ID: ${swishId}`);
        
        // Step 6: Fetch YesMovies player
        const yesmoviesUrl = `https://yesmovies.baby/e/${swishId}`;
        console.log('  → Fetching YesMovies player...');
        const yesmoviesResponse = await fetch(yesmoviesUrl, {
            referer: 'https://streamsrcs.2embed.cc/'
        });
        
        // Save for debugging
        fs.writeFileSync('examples/yesmovies-debug.html', yesmoviesResponse.data);
        console.log(`  → Saved response (${yesmoviesResponse.data.length} bytes)`);
        
        // Step 7: Extract and unpack JavaScript
        // Look for the packed code pattern
        const scriptContent = yesmoviesResponse.data;
        
        // Use the working unpacker from our earlier test
        const evalMatch = scriptContent.match(/eval\(function\(p,a,c,k,e,d\)\{while\(c--\)if\(k\[c\]\)p=p\.replace\(new RegExp\('\\\\b'\+c\.toString\(a\)\+'\\\\b','g'\),k\[c\]\);return p\}\('(.+)',(\d+),(\d+),'(.+)'\.split\('\|'\)\)\)/);
        
        if (!evalMatch) {
            console.log('  ✗ No packed JavaScript found');
            return null;
        }
        
        const [, p, a, c, kStr] = evalMatch;
        const k = kStr.split('|');
        
        console.log('  → Unpacking JavaScript...');
        console.log(`  → Parameters: a=${a}, c=${c}, tokens=${k.length}`);
        const unpacked = unpackJS(p, parseInt(a), parseInt(c), k);
        
        // Step 8: Extract M3U8 URLs
        const m3u8Matches = unpacked.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
        
        if (m3u8Matches && m3u8Matches.length > 0) {
            console.log(`  ✓ Found ${m3u8Matches.length} M3U8 URL(s)`);
            return m3u8Matches;
        }
        
        console.log('  ✗ No M3U8 URLs in unpacked code');
        return null;
        
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        return null;
    }
}

// SERVER 3: Superembed
async function extractSuperembed(hash) {
    console.log('\n[SERVER 3: SUPEREMBED]');
    
    try {
        const decoded = decodeHash(hash);
        if (!decoded.success) {
            console.log('  ✗ Failed to decode hash');
            return null;
        }
        
        // Fetch RCP page
        const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
        console.log('  → Fetching RCP...');
        const rcpResponse = await fetch(rcpUrl);
        
        if (rcpResponse.status !== 200) {
            console.log(`  ✗ RCP failed: ${rcpResponse.status}`);
            return null;
        }
        
        // Extract srcrcp hash
        const srcrcpMatch = rcpResponse.data.match(/src:\s*['"]\/srcrcp\/([^'"]+)['"]/);
        if (!srcrcpMatch) {
            console.log('  ✗ No srcrcp hash found');
            return null;
        }
        
        // Fetch srcrcp page
        const srcrcpUrl = `https://cloudnestra.com/srcrcp/${srcrcpMatch[1]}`;
        console.log('  → Fetching Superembed player...');
        const embedResponse = await fetch(srcrcpUrl);
        
        // Try to extract M3U8 directly
        const m3u8 = extractM3U8FromHTML(embedResponse.data);
        
        if (m3u8) {
            console.log('  ✓ Found M3U8 URL');
            return [m3u8];
        }
        
        console.log('  ✗ No M3U8 URL found');
        return null;
        
    } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        return null;
    }
}

// MAIN EXTRACTION FUNCTION
async function extractAllM3U8(tmdbId, type = 'movie', season = null, episode = null) {
    console.log('\n' + '═'.repeat(70));
    console.log('  COMPLETE M3U8 EXTRACTOR - ALL SERVERS');
    console.log('═'.repeat(70));
    console.log(`  TMDB ID: ${tmdbId}`);
    console.log(`  Type: ${type}`);
    if (type === 'tv') {
        console.log(`  Season: ${season}, Episode: ${episode}`);
    }
    console.log('═'.repeat(70));
    
    // Build VidSrc URL
    let vidsrcUrl;
    if (type === 'tv') {
        if (!season || !episode) {
            console.error('\n✗ Season and episode required for TV shows');
            return;
        }
        vidsrcUrl = `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}`;
    } else {
        vidsrcUrl = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
    }
    
    console.log(`\nStep 1: Fetching VidSrc page...`);
    console.log(`  URL: ${vidsrcUrl}`);
    
    try {
        const response = await fetch(vidsrcUrl);
        
        if (response.status !== 200) {
            console.error(`\n✗ Failed to fetch VidSrc page (Status: ${response.status})`);
            return;
        }
        
        const html = response.data;
        console.log(`✓ VidSrc page fetched (${html.length} bytes)`);
        
        // Extract all server hashes
        console.log(`\nStep 2: Extracting server hashes...`);
        const hashRegex = /data-hash=["']([^"']+)["']/gi;
        const hashes = [];
        let match;
        
        while ((match = hashRegex.exec(html)) !== null) {
            hashes.push(match[1]);
        }
        
        if (hashes.length === 0) {
            console.log('✗ No servers found');
            return;
        }
        
        console.log(`✓ Found ${hashes.length} server(s)`);
        
        // Extract from all servers
        console.log(`\nStep 3: Extracting from ALL servers...`);
        console.log('═'.repeat(70));
        
        const allResults = [];
        
        // Try each server
        for (let i = 0; i < hashes.length; i++) {
            const hash = hashes[i];
            let results = null;
            
            if (i === 0) {
                // Server 1: CloudStream (skip - encrypted)
                results = await extractCloudStream(hash);
            } else if (i === 1) {
                // Server 2: 2Embed → YesMovies
                results = await extract2Embed(hash);
            } else if (i === 2) {
                // Server 3: Superembed
                results = await extractSuperembed(hash);
            }
            
            if (results && results.length > 0) {
                allResults.push({
                    server: i + 1,
                    name: i === 0 ? 'CloudStream' : i === 1 ? '2Embed/YesMovies' : 'Superembed',
                    urls: results
                });
            }
            
            // Delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Print results
        console.log('\n' + '═'.repeat(70));
        console.log('  EXTRACTION COMPLETE');
        console.log('═'.repeat(70));
        
        if (allResults.length === 0) {
            console.log('\n✗ No M3U8 URLs found from any server');
            return;
        }
        
        console.log(`\n🎉 Successfully extracted from ${allResults.length} server(s):\n`);
        
        allResults.forEach((result, i) => {
            console.log(`${i + 1}. ${result.name.toUpperCase()}`);
            result.urls.forEach(url => {
                console.log(`   → ${url}`);
            });
            console.log('');
        });
        
        console.log('═'.repeat(70));
        console.log('  READY TO USE!');
        console.log('═'.repeat(70) + '\n');
        
        return allResults;
        
    } catch (error) {
        console.error('\n✗ Fatal error:', error.message);
        console.error(error.stack);
    }
}

// Run the script
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('  COMPLETE M3U8 EXTRACTOR - Usage');
    console.log('═'.repeat(70));
    console.log('\nFor Movies:');
    console.log('  node COMPLETE-EXTRACTOR.js <TMDB_ID>');
    console.log('  Example: node COMPLETE-EXTRACTOR.js 550');
    console.log('\nFor TV Shows:');
    console.log('  node COMPLETE-EXTRACTOR.js <TMDB_ID> tv <SEASON> <EPISODE>');
    console.log('  Example: node COMPLETE-EXTRACTOR.js 1396 tv 1 1');
    console.log('\n' + '═'.repeat(70) + '\n');
    process.exit(1);
}

const tmdbId = args[0];
const type = args[1] || 'movie';
const season = args[2] || null;
const episode = args[3] || null;

extractAllM3U8(tmdbId, type, season, episode);
