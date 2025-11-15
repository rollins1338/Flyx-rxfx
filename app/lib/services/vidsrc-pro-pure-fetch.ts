/**
 * VidSrc Pro - Pure Fetch Extractor
 * No VM, no Puppeteer - just HTTP requests, linkedom, and Caesar cipher decoding
 */

import { parseHTML } from 'linkedom';

interface FetchOptions {
  referer?: string;
  headers?: Record<string, string>;
}

async function fetchPage(url: string, options: FetchOptions = {}): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: options.referer || '',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

function extractDataHash(html: string): string | null {
  const { document } = parseHTML(html);
  const element = document.querySelector('[data-hash]');
  return element?.getAttribute('data-hash') || null;
}

function extractEncodedUrl(html: string): string | null {
  try {
    // Try linkedom first
    const { document } = parseHTML(html);
    const divs = Array.from(document.querySelectorAll('div[id]'));
    
    for (const div of divs) {
      const content = div.textContent?.trim() || '';
      // Look for long content with :// pattern (encoded URL)
      if (content.length > 100 && content.includes('://') && !content.includes('<')) {
        console.log('Found encoded URL via linkedom:', content.substring(0, 50) + '...');
        return content;
      }
    }
  } catch (e) {
    console.log('Linkedom parsing failed, trying regex fallback');
  }
  
  // Fallback to regex if linkedom fails
  const divRegex = /<div[^>]+id=["'][^"']*["'][^>]*>([^<]+)<\/div>/g;
  let match;
  
  while ((match = divRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content.length > 100 && content.includes('://')) {
      console.log('Found encoded URL via regex:', content.substring(0, 50) + '...');
      return content;
    }
  }
  
  console.log('No encoded URL found in HTML');
  return null;
}

function caesarDecode(str: string, shift: number): string {
  return str
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);

      // Lowercase letters only
      if (code >= 97 && code <= 122) {
        return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
      // Uppercase letters only
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      }

      // Leave everything else unchanged (numbers, special chars, etc.)
      return char;
    })
    .join('');
}

function resolvePlaceholders(url: string): string {
  // Replace placeholders with shadowlandschronicles.com
  return url
    .replace(/\{v1\}/g, 'shadowlandschronicles.com')
    .replace(/\{v2\}/g, 'shadowlandschronicles.com')
    .replace(/\{v3\}/g, 'shadowlandschronicles.com')
    .replace(/\{v4\}/g, 'shadowlandschronicles.com')
    .replace(/\{s1\}/g, 'shadowlandschronicles.com');
}

export async function extractVidsrcPro(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Step 1: Get data hash from embed page
    const embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}${
      type === 'tv' ? `/${season}/${episode}` : ''
    }`;

    console.log('Step 1: Fetching embed page:', embedUrl);
    const embedHtml = await fetchPage(embedUrl);
    const dataHash = extractDataHash(embedHtml);

    if (!dataHash) {
      console.log('Failed to extract data hash from embed page');
      return { success: false, error: 'Data hash not found in embed page' };
    }
    console.log('Found data hash:', dataHash);

    // Step 2: Get ProRCP URL from RCP endpoint
    const rcpUrl = `https://cloudnestra.com/rcp/${dataHash}`;
    console.log('Step 2: Fetching RCP page:', rcpUrl);
    const rcpHtml = await fetchPage(rcpUrl, {
      referer: 'https://vidsrc-embed.ru/',
    });

    const iframeSrcMatch = rcpHtml.match(/src:\s*['"]([^'"]+)['"]/);
    if (!iframeSrcMatch) {
      console.log('Failed to find iframe src in RCP page');
      return { success: false, error: 'ProRCP iframe not found' };
    }

    const proRcpUrl = `https://cloudnestra.com${iframeSrcMatch[1]}`;
    console.log('Step 3: Fetching ProRCP page:', proRcpUrl);

    // Step 3: Get ProRCP page and extract encoded URL from div
    const proRcpHtml = await fetchPage(proRcpUrl, {
      referer: 'https://vidsrc-embed.ru/',
    });

    console.log('ProRCP HTML length:', proRcpHtml.length);
    const encodedUrl = extractEncodedUrl(proRcpHtml);

    if (!encodedUrl) {
      console.log('Failed to extract encoded URL from ProRCP page');
      return { success: false, error: 'Encoded URL not found in ProRCP page' };
    }
    console.log('Found encoded URL, length:', encodedUrl.length);

    // Step 4: Decode with Caesar cipher (shift +3 for letters only)
    // eqqmp:// -> https://
    const decoded = caesarDecode(encodedUrl, 3);

    if (!decoded.startsWith('https://') && !decoded.startsWith('http://')) {
      return { success: false, error: 'Decoded URL is invalid' };
    }

    // Step 5: Resolve placeholders
    const finalUrl = resolvePlaceholders(decoded);

    // Extract the first URL if there are multiple (separated by " or ")
    const firstUrl = finalUrl.split(' or ')[0];

    return {
      success: true,
      url: firstUrl,
    };
  } catch (error) {
    console.error('VidSrc Pro extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
