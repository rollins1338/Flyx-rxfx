/**
 * MegaUp Native Decryption
 * 
 * This module provides native decryption for MegaUp encrypted video sources,
 * eliminating the dependency on enc-dec.app.
 * 
 * The encryption uses a stream cipher where the keystream depends on the User-Agent.
 * We use a fixed UA and its corresponding keystream for consistent decryption.
 */

// Fixed User-Agent for MegaUp requests
export const MEGAUP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Pre-computed keystream for the fixed UA (521 bytes)
const MEGAUP_KEYSTREAM_HEX = 'cd04e9c92863097ef5e0b5010d2d7bb7ff8e3efd831d83da12a45a1aca29d1953c552272fdb39a789049975aa97586781074b4a13d841e7945e2f0c5b632b4202dc8979699db15aacdc53193784eb52278fb7c0c33e2b3073bb1c2d6b86e9aa17a8c4d58e44d2b6035e2966ead4047bbe68392924ede09de62294c29b998568eaf420dd8a84a476d0e5ebd76ec8d83dfc186903afc109a855dc05da1d1c57084e8316191571538ecdd51be555c4e245bc38068ac8054af44089db6fc10470a7bca7d276045b11caeac973263324e86fcf8d79f8415c33fce7b53e0dfcba2ec8157ab8504c03a9687fd57909cc78aeef452b06f54c2d6d990390ed49ddc605a9fecc1509619342f70884a399a51097388f58d2668f1a80d9e14acb6502125658f5c42394595c52c8e76baa7b1249051bc09ab642f6eb26a9d2de9bc67f964af9ad02dbb3573998e6dd5d05c32160f340da7d94e7e463f98ecf7b75176838cbb239c1b73d394e9fe62eba27b52efda2b50d50ab727e2e21cea81787cc220b3ac038dbd47a9ead5b952b7f2e6ced5ce55a6cb5d2d6cc0f843b38c33f53ddc50d9261ac01ddad199b09c79414ade30fce9eb39b040b8881704b368eae842a65858ede4bed9cae74089d096558838309b170a4010547718792e00536ebbc1b903e7b9f77ff78b66535c7ba90f218bb1bc11677ade52cf3927cdd53a9560d76b0ee9e90328b5261f62e35f42';

// Lazy-loaded keystream buffer
let keystreamBuffer: Buffer | null = null;

function getKeystream(): Buffer {
  if (!keystreamBuffer) {
    keystreamBuffer = Buffer.from(MEGAUP_KEYSTREAM_HEX, 'hex');
  }
  return keystreamBuffer;
}

/**
 * Decrypts MegaUp encrypted data using native implementation.
 * 
 * @param encryptedBase64 - The encrypted data in URL-safe base64 format
 * @returns The decrypted JSON string
 */
export function decryptMegaUp(encryptedBase64: string): string {
  const keystream = getKeystream();
  
  // Convert from URL-safe base64 to standard base64
  const base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
  const encBytes = Buffer.from(base64, 'base64');
  
  // XOR decrypt with keystream
  const decLength = Math.min(keystream.length, encBytes.length);
  const decBytes = Buffer.alloc(decLength);
  
  for (let i = 0; i < decLength; i++) {
    decBytes[i] = encBytes[i] ^ keystream[i];
  }
  
  const result = decBytes.toString('utf8');
  
  // Find the last valid JSON (handles minor tail variations)
  // The decrypted data should be valid JSON ending with "}"
  for (let i = result.length; i > 0; i--) {
    const substr = result.substring(0, i);
    if (substr.endsWith('}')) {
      try {
        JSON.parse(substr);
        return substr;
      } catch {
        // Continue searching
      }
    }
  }
  
  // Return as-is if no valid JSON found
  return result;
}

/**
 * Parses decrypted MegaUp response into structured data.
 * 
 * @param decrypted - The decrypted JSON string
 * @returns Parsed MegaUp response with sources and tracks
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
