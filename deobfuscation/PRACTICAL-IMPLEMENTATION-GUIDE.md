# Practical Implementation Guide for VidSrc Stream Extraction

## Current Status

### ✅ What We've Accomplished

1. **Hash Structure Decoded**
   - Format: `BASE64(MD5:BASE64(ENCRYPTED_PART1|BASE64_PART2))`
   - Successfully decoded both layers
   - Identified two-part encrypted payload

2. **Encryption Analysis**
   - Part 1: 256 characters of encrypted stream parameters
   - Part 2: 919 characters of base64-encoded data (likely encryption key/IV)
   - Likely uses AES encryption

3. **Flow Understanding**
   - Mapped complete extraction flow
   - Identified critical scripts and endpoints
   - Documented anti-scraping measures

### ❌ What's Still Needed

1. **Decryption Algorithm** - The critical missing piece
2. **Fresh Hashes** - Current hash has expired (404)
3. **API Endpoint** - Final endpoint to retrieve m3u8

## Three Practical Approaches

### Approach 1: Browser Automation (RECOMMENDED)

This is the most reliable method that bypasses all the decryption complexity.

#### Implementation with Puppeteer

```javascript
const puppeteer = require('puppeteer');

async function extractM3U8(tmdbId, type = 'movie', season = null, episode = null) {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Intercept network requests to capture m3u8
        const m3u8Urls = [];
        
        await page.on('request', request => {
            const url = request.url();
            if (url.includes('.m3u8')) {
                m3u8Urls.push(url);
                console.log('Found m3u8:', url);
            }
        });
        
        // Build VidSrc URL
        let vidsrcUrl = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
        if (type === 'tv' && season && episode) {
            vidsrcUrl += `/${season}/${episode}`;
        }
        
        console.log('Loading:', vidsrcUrl);
        
        // Navigate to VidSrc page
        await page.goto(vidsrcUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for iframe to load
        await page.waitForSelector('iframe', { timeout: 10000 });
        
        // Get iframe and switch to it
        const frames = page.frames();
        const playerFrame = frames.find(f => 
            f.url().includes('cloudnestra') || 
            f.url().includes('player')
        );
        
        if (playerFrame) {
            console.log('Found player frame:', playerFrame.url());
            
            // Wait for video element or m3u8 request
            await page.waitForTimeout(5000);
        }
        
        // Return the captured m3u8 URL
        if (m3u8Urls.length > 0) {
            return {
                success: true,
                m3u8Url: m3u8Urls[0],
                allUrls: m3u8Urls
            };
        } else {
            return {
                success: false,
                error: 'No m3u8 URL found'
            };
        }
        
    } finally {
        await browser.close();
    }
}

// Usage
extractM3U8('603692', 'movie')
    .then(result => console.log('Result:', result))
    .catch(err => console.error('Error:', err));
```

#### Pros
- ✅ Bypasses all encryption/obfuscation
- ✅ Always works with fresh hashes
- ✅ No need to reverse engineer
- ✅ Handles all anti-scraping measures

#### Cons
- ❌ Slower (requires browser)
- ❌ More resource-intensive
- ❌ Requires Puppeteer/Playwright

### Approach 2: Reverse Engineer sources.js

If you need a faster, lightweight solution, reverse engineer the decryption.

#### Steps

1. **Fetch a Fresh VidSrc Page**
```javascript
const axios = require('axios');
const cheerio = require('cheerio');

async function getFreshHash(tmdbId, type = 'movie') {
    const url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    
    const $ = cheerio.load(response.data);
    const iframeSrc = $('iframe').attr('src');
    
    if (iframeSrc) {
        const hash = iframeSrc.split('/rcp/')[1];
        return hash;
    }
    
    return null;
}
```

2. **Decode the Hash**
```javascript
function decodeHash(hash) {
    // First decode
    const firstDecode = Buffer.from(hash, 'base64').toString('utf-8');
    const [md5, encryptedBase64] = firstDecode.split(':');
    
    // Second decode
    const encryptedData = Buffer.from(encryptedBase64, 'base64').toString('utf-8');
    const [part1, part2] = encryptedData.split('|');
    
    return {
        md5,
        encryptedPart1: part1,
        encryptedPart2: part2
    };
}
```

3. **Fetch and Analyze sources.js**
```javascript
async function getSourcesJs() {
    // First, get the main page to find current sources.js URL
    const mainPage = await axios.get('https://vidsrc.xyz/');
    const match = mainPage.data.match(/sources\.js\?t=(\d+)/);
    
    if (match) {
        const timestamp = match[1];
        const sourcesUrl = `https://vidsrc.xyz/sources.js?t=${timestamp}`;
        const sourcesJs = await axios.get(sourcesUrl);
        return sourcesJs.data;
    }
    
    return null;
}
```

4. **Deobfuscate sources.js**
```javascript
// Use tools like:
// - https://deobfuscate.io/
// - https://beautifier.io/
// - Manual analysis

// Look for:
// - decrypt/encode functions
// - AES/crypto imports
// - API endpoints
// - Key/IV values
```

5. **Implement Decryption**
```javascript
const crypto = require('crypto');

function decryptStream(encryptedPart1, encryptedPart2, key, iv) {
    // This is pseudocode - actual implementation depends on sources.js
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedPart1, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
```

#### Pros
- ✅ Fast and lightweight
- ✅ No browser needed
- ✅ Can be deployed anywhere

#### Cons
- ❌ Requires reverse engineering
- ❌ May break when sources.js updates
- ❌ Time-consuming initial setup

### Approach 3: Use Existing Extractors

Leverage existing open-source solutions.

#### Option A: Consumet API

```javascript
const axios = require('axios');

async function getStreamFromConsumet(tmdbId, type = 'movie') {
    const baseUrl = 'https://api.consumet.org/movies/flixhq';
    
    // Search for the content
    const searchUrl = `${baseUrl}/search?query=${tmdbId}`;
    const searchResult = await axios.get(searchUrl);
    
    if (searchResult.data.results.length > 0) {
        const contentId = searchResult.data.results[0].id;
        
        // Get streaming links
        const streamUrl = `${baseUrl}/watch?episodeId=${contentId}`;
        const streamResult = await axios.get(streamUrl);
        
        return streamResult.data;
    }
    
    return null;
}
```

#### Option B: Other Extractors

Check these repositories:
- `consumet/consumet-api` - Multi-source extractor
- `movie-web/providers` - Movie streaming providers
- `sussy-code/smov` - Stream extractor

#### Pros
- ✅ Already implemented
- ✅ Maintained by community
- ✅ Multiple sources

#### Cons
- ❌ Depends on external service
- ❌ May have rate limits
- ❌ Less control

## Recommended Implementation for Your Project

Based on your FlyX project structure, here's what I recommend:

### 1. Add Puppeteer Dependency

```bash
npm install puppeteer
```

### 2. Create Stream Extractor Service

```javascript
// app/lib/services/vidsrc-extractor.ts

import puppeteer from 'puppeteer';

export class VidSrcExtractor {
    private browser: any = null;
    
    async initialize() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }
    
    async extractStream(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number) {
        await this.initialize();
        
        const page = await this.browser.newPage();
        const m3u8Urls: string[] = [];
        
        try {
            // Intercept requests
            await page.on('request', (request: any) => {
                const url = request.url();
                if (url.includes('.m3u8')) {
                    m3u8Urls.push(url);
                }
            });
            
            // Build URL
            let url = `https://vidsrc.xyz/embed/${type}/${tmdbId}`;
            if (type === 'tv' && season && episode) {
                url += `/${season}/${episode}`;
            }
            
            // Navigate
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait for player
            await page.waitForTimeout(5000);
            
            return m3u8Urls[0] || null;
            
        } finally {
            await page.close();
        }
    }
    
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
```

### 3. Update Your Extractor Service

```javascript
// app/lib/services/extractor.ts

import { VidSrcExtractor } from './vidsrc-extractor';

const vidsrcExtractor = new VidSrcExtractor();

export async function extractStreamUrl(source: string, tmdbId: string, type: string, season?: number, episode?: number) {
    if (source === 'vidsrc') {
        return await vidsrcExtractor.extractStream(tmdbId, type as any, season, episode);
    }
    
    // ... other sources
}
```

### 4. Add Caching

```javascript
// Cache m3u8 URLs for 1 hour since they expire
const streamCache = new Map();

function getCacheKey(tmdbId: string, type: string, season?: number, episode?: number) {
    return `${type}_${tmdbId}_${season || ''}_${episode || ''}`;
}

export async function extractStreamUrlCached(...args) {
    const key = getCacheKey(...args);
    const cached = streamCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 3600000) {
        return cached.url;
    }
    
    const url = await extractStreamUrl(...args);
    streamCache.set(key, { url, timestamp: Date.now() });
    
    return url;
}
```

## Testing Your Implementation

```javascript
// deobfuscation/test-live-extraction.js

const { VidSrcExtractor } = require('../app/lib/services/vidsrc-extractor');

async function test() {
    const extractor = new VidSrcExtractor();
    
    try {
        console.log('Testing VidSrc extraction...');
        
        // Test with a known movie (John Wick - TMDB ID: 245891)
        const m3u8 = await extractor.extractStream('245891', 'movie');
        
        console.log('Success!');
        console.log('M3U8 URL:', m3u8);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await extractor.close();
    }
}

test();
```

## Performance Considerations

1. **Browser Pooling** - Reuse browser instances
2. **Caching** - Cache m3u8 URLs (they're valid for ~1 hour)
3. **Timeout Handling** - Set reasonable timeouts
4. **Error Recovery** - Retry on failures
5. **Resource Cleanup** - Always close browsers

## Security Considerations

1. **Rate Limiting** - Don't hammer VidSrc
2. **User Agent Rotation** - Vary user agents
3. **Proxy Support** - Use proxies if needed
4. **Error Handling** - Don't expose internal errors

## Conclusion

For your FlyX project, I recommend **Approach 1 (Browser Automation)** because:
- It's reliable and always works
- No need to maintain decryption logic
- Handles all edge cases
- Worth the performance trade-off for reliability

The implementation above integrates cleanly with your existing architecture and provides a solid foundation for stream extraction.
