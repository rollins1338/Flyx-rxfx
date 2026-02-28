/**
 * MegaUp Decryption via enc-dec.app API (Cloudflare Worker version)
 * 
 * The MegaUp encryption uses a VIDEO-SPECIFIC keystream (plaintext feedback cipher).
 * A pre-computed static keystream does NOT work because each video has a different keystream.
 * We must use the enc-dec.app API which has the full decryption logic.
 */

// Fixed User-Agent for MegaUp requests
export const MEGAUP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Decrypts MegaUp encrypted data via enc-dec.app API.
 */
export async function decryptMegaUp(encryptedBase64: string): Promise<string> {
  const response = await fetch('https://enc-dec.app/api/dec-mega', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': MEGAUP_USER_AGENT,
    },
    body: JSON.stringify({
      text: encryptedBase64,
      agent: MEGAUP_USER_AGENT,
    }),
  });

  if (!response.ok) {
    throw new Error(`enc-dec.app returned ${response.status}`);
  }

  const data: any = await response.json();
  
  if (data.status !== 200) {
    throw new Error(`enc-dec.app API error: ${data.message || JSON.stringify(data)}`);
  }

  return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
}
