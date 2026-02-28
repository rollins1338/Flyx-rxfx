/**
 * MegaUp Decryption via enc-dec.app API
 * 
 * The MegaUp encryption uses a VIDEO-SPECIFIC keystream (plaintext feedback cipher).
 * A pre-computed static keystream does NOT work because each video has a different keystream.
 * We must use the enc-dec.app API which has the full decryption logic.
 */

// Fixed User-Agent for MegaUp requests
export const MEGAUP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Decrypts MegaUp encrypted data via enc-dec.app API.
 * The keystream is video-specific so native XOR decryption is not possible.
 * 
 * @param encryptedBase64 - The encrypted data in URL-safe base64 format
 * @returns The decrypted JSON string
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
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`enc-dec.app returned ${response.status}`);
  }

  const data = await response.json();
  
  if (data.status !== 200) {
    throw new Error(`enc-dec.app API error: ${data.message || JSON.stringify(data)}`);
  }

  return typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
}

/**
 * Parses decrypted MegaUp response into structured data.
 */
export interface MegaUpSource {
  file: string;
  type?: string;
  label?: string;
}

export interface MegaUpTrack {
  file: string;
  kind: string;
  label?: string;
  default?: boolean;
}

export interface MegaUpResponse {
  sources: MegaUpSource[];
  tracks: MegaUpTrack[];
}

export function parseMegaUpResponse(decrypted: string): MegaUpResponse | null {
  try {
    const data = JSON.parse(decrypted);
    return {
      sources: data.sources || [],
      tracks: data.tracks || []
    };
  } catch {
    return null;
  }
}
