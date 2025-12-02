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

// Fetch Logic
async function fetchUrl(url: string, options: RequestInit = {}): Promise<{ data: string; headers: Headers; statusCode: number }> {
    const defaultHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        ...options.headers
    };

    const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
        redirect: 'follow'
    });

    const data = await response.text();
    return { data, headers: response.headers, statusCode: response.status };
}

// Unpack packed JavaScript (p,a,c,k,e,d format)
function unpackScript(packed: string): string {
    // Extract the packed function arguments
    const match = packed.match(/eval\(function\(p,a,c,k,e,d\)\{[^}]+\}\('([^']+)',(\d+),(\d+),'([^']+)'\.split\('\|'\)/);
    if (!match) {
        throw new Error('Could not parse packed script');
    }
    
    const [, p, a, c, dict] = match;
    const radix = parseInt(a);
    const count = parseInt(c);
    const keywords = dict.split('|');
    
    // Unpack function
    let result = p;
    for (let i = count - 1; i >= 0; i--) {
        if (keywords[i]) {
            const pattern = new RegExp('\\b' + i.toString(radix) + '\\b', 'g');
            result = result.replace(pattern, keywords[i]);
        }
    }
    
    return result;
}

export async function extractMoviesApiStreams(
    tmdbId: string,
    type: 'movie' | 'tv',
    season?: number,
    episode?: number
): Promise<ExtractionResult> {
    // Build the moviesapi.club URL
    let clubUrl: string;
    if (type === 'movie') {
        clubUrl = `https://moviesapi.club/movie/${tmdbId}`;
    } else {
        clubUrl = `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
    }

    console.log(`[MoviesApi] Extracting for ${type} ID ${tmdbId} (${clubUrl})...`);

    try {
        // Step 1: Get the iframe URL from moviesapi.club
        console.log('[MoviesApi] Step 1: Fetching moviesapi.club page...');
        const clubPage = await fetchUrl(clubUrl);
        
        if (clubPage.statusCode !== 200) {
            throw new Error(`moviesapi.club returned ${clubPage.statusCode}`);
        }

        // Look for vidora.stream iframe
        const iframeMatch = clubPage.data.match(/src="(https:\/\/vidora\.stream\/embed\/[^"]+)"/);
        if (!iframeMatch) {
            console.log('[MoviesApi] No vidora.stream iframe found, checking for other sources...');
            
            // Try to find any iframe src
            const anyIframeMatch = clubPage.data.match(/iframe[^>]+src="([^"]+)"/i);
            if (anyIframeMatch) {
                console.log(`[MoviesApi] Found alternative iframe: ${anyIframeMatch[1]}`);
            }
            
            throw new Error('No vidora.stream iframe found on moviesapi.club');
        }

        const vidoraUrl = iframeMatch[1];
        console.log(`[MoviesApi] Step 2: Found vidora URL: ${vidoraUrl}`);

        // Step 2: Fetch the vidora.stream embed page
        const vidoraPage = await fetchUrl(vidoraUrl, {
            headers: { 'Referer': clubUrl }
        });

        if (vidoraPage.statusCode !== 200) {
            throw new Error(`vidora.stream returned ${vidoraPage.statusCode}`);
        }

        console.log(`[MoviesApi] Step 3: Parsing vidora page (${vidoraPage.data.length} chars)...`);

        // Step 3: Find and extract the packed script
        // Look for the dictionary pattern at the end of the packed script
        const dictMatch = vidoraPage.data.match(/\.split\('\|'\)\)\)/);
        if (!dictMatch) {
            throw new Error('Could not find packed script dictionary');
        }

        // Find the start of the eval
        const dictIndex = vidoraPage.data.indexOf(dictMatch[0]);
        const evalStart = vidoraPage.data.lastIndexOf("eval(function(p,a,c,k,e,d)", dictIndex);
        if (evalStart === -1) {
            throw new Error('Could not find packed script start');
        }

        const packedScript = vidoraPage.data.substring(evalStart, dictIndex + dictMatch[0].length);
        console.log(`[MoviesApi] Found packed script (${packedScript.length} chars)`);

        // Step 4: Unpack the script
        let unpackedCode: string;
        try {
            // Use eval to unpack (safe in server context)
            const unpackExpression = packedScript.replace(/^eval/, '');
            unpackedCode = eval(unpackExpression);
            console.log(`[MoviesApi] Unpacked script (${unpackedCode.length} chars)`);
        } catch (e: any) {
            console.error('[MoviesApi] Eval unpack failed:', e.message);
            // Try manual unpack as fallback
            unpackedCode = unpackScript(packedScript);
        }

        // Step 5: Extract the m3u8 URL
        const fileMatch = unpackedCode.match(/file:"([^"]+)"/);
        if (!fileMatch) {
            console.log('[MoviesApi] Unpacked code preview:', unpackedCode.substring(0, 500));
            throw new Error('Could not find file URL in unpacked script');
        }

        const m3u8Url = fileMatch[1];
        console.log(`[MoviesApi] ✓ Found M3U8 URL: ${m3u8Url}`);

        // Extract title if available
        const titleMatch = unpackedCode.match(/title:"([^"]+)"/);
        const title = titleMatch ? titleMatch[1] : 'MoviesAPI';

        return {
            success: true,
            sources: [{
                quality: 'auto',
                title: `MoviesAPI - ${title}`,
                url: m3u8Url,
                type: 'hls',
                referer: 'https://vidora.stream/',
                requiresSegmentProxy: true
            }]
        };

    } catch (error: any) {
        console.error('[MoviesApi] Extraction failed:', error.message);
        return { success: false, sources: [], error: error.message };
    }
}
