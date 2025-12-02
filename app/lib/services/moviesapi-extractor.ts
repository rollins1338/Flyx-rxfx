/**
 * MoviesAPI Extractor
 * Uses the moviesapi.to scrapify API with proper encryption
 */

import CryptoJS from 'crypto-js';

interface StreamSource {
    quality: string;
    title: string;
    url: string;
    type: 'hls';
    referer: string;
    requiresSegmentProxy: boolean;
}

interface ExtractionResult {
    success: boolean;
    sources: StreamSource[];
    error?: string;
}

// API Configuration
const ENCRYPTION_KEY = 'moviesapi-secure-encryption-key-2024-v1';
const PLAYER_API_KEY = 'moviesapi-player-auth-key-2024-secure';
const SCRAPIFY_URL = 'https://w1.moviesapi.to/api/scrapify';

// Source configurations - ordered by reliability
// Orion (m4uhd) is best for newer movies, Beta (fmovies) is good general fallback
const SOURCES = [
    { name: 'Orion', source: 'm4uhd', priority: 1 },       // Best for newer movies
    { name: 'Beta', source: 'fmovies', priority: 2 },      // Good general fallback
    { name: 'Apollo', source: 'sflix2', srv: '0', priority: 3 },
    { name: 'Alpha', source: 'sflix2', srv: '1', priority: 4 },
    { name: 'Nexon', source: 'bmovies', priority: 5 },
];

/**
 * Fetch from scrapify API with encryption
 */
async function fetchFromScrapify(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number,
    sourceName: string = 'fmovies',
    srv?: string
): Promise<{ url: string; subtitles: any[] } | null> {
    try {
        // Build payload
        const payload: any = {
            source: sourceName,
            type: type,
            id: tmdbId,
        };
        
        if (type === 'tv' && season && episode) {
            payload.season = season;
            payload.episode = episode;
        }
        
        if (srv) {
            payload.srv = srv;
        }

        // Encrypt payload
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(payload),
            ENCRYPTION_KEY
        ).toString();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${SCRAPIFY_URL}/v1/fetch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-player-key': PLAYER_API_KEY,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://w1.moviesapi.to/',
                'Origin': 'https://w1.moviesapi.to'
            },
            body: JSON.stringify({ payload: encrypted }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        const json = await response.json();
        
        let streamUrl = '';
        let subtitles: any[] = [];
        
        if (json.sources && json.sources[0]) {
            streamUrl = json.sources[0].url;
            subtitles = json.sources[0].tracks || json.sources[0].subtitles || [];
        } else if (json.url) {
            streamUrl = json.url;
            subtitles = json.tracks || json.subtitles || [];
        }

        if (!streamUrl) {
            return null;
        }

        return { url: streamUrl, subtitles };
    } catch (error) {
        console.error(`[MoviesApi] Scrapify fetch error:`, error);
        return null;
    }
}

/**
 * Apply URL transformations based on source
 */
function transformUrl(url: string, sourceName: string): string {
    if (sourceName === 'Apollo' || sourceName === 'Nexon') {
        const stripped = url.replace(/^https?:\/\//, '');
        return `https://ax.1hd.su/${stripped}`;
    } else if (sourceName === 'Alpha') {
        const stripped = url.replace(/^https?:\/\//, '');
        return `https://xd.flix1.online/${stripped}`;
    }
    return url;
}

/**
 * Check if stream URL is accessible
 */
async function checkStreamAccessibility(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://w1.moviesapi.to/'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Main extraction function
 */
export async function extractMoviesApiStreams(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<ExtractionResult> {
    console.log(`[MoviesApi] Extracting for ${type} ID ${tmdbId}...`);

    // Try sources in order of priority
    for (const src of SOURCES) {
        console.log(`[MoviesApi] Trying source: ${src.name} (${src.source})`);
        
        try {
            const result = await fetchFromScrapify(
                tmdbId,
                type,
                season,
                episode,
                src.source,
                src.srv
            );

            if (!result || !result.url) {
                console.log(`[MoviesApi] ${src.name}: No URL returned`);
                continue;
            }

            // Transform URL if needed
            const streamUrl = transformUrl(result.url, src.name);
            console.log(`[MoviesApi] ${src.name}: Got URL, checking accessibility...`);

            // Check if stream is accessible
            const isAccessible = await checkStreamAccessibility(streamUrl);
            
            if (!isAccessible) {
                console.log(`[MoviesApi] ${src.name}: Stream not accessible (403/blocked)`);
                continue;
            }

            console.log(`[MoviesApi] ✓ ${src.name} working!`);
            console.log(`[MoviesApi] Stream URL: ${streamUrl}`);

            return {
                success: true,
                sources: [{
                    quality: 'auto',
                    title: `MoviesAPI - ${src.name}`,
                    url: streamUrl,
                    type: 'hls',
                    referer: 'https://w1.moviesapi.to/',
                    requiresSegmentProxy: true
                }]
            };
        } catch (error) {
            console.error(`[MoviesApi] ${src.name} error:`, error);
            continue;
        }
    }

    // If all sources failed, return error
    console.error('[MoviesApi] All sources failed');
    return {
        success: false,
        sources: [],
        error: 'All MoviesAPI sources unavailable'
    };
}
