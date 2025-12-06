/**
 * Analyze the embed ID pattern to see if we can derive the m3u8 URL
 * 
 * Known patterns:
 * - Embed URL: https://rapidshare.cc/e/{embedId}
 * - M3U8 URL: https://rrr.rapidshare.cc/pmjz/v5/{token}/list.m3u8
 * 
 * Let's see if there's a relationship between embedId and the m3u8 token
 */

// Sample embed IDs from our extractions
const samples = [
  { name: 'Cyberpunk S1E1', embedId: 'kJCuIjiwWSyJcOLzFLpK6xfpCQ' },
  { name: 'FNAF Movie', embedId: '0MjjZmGrWSyJcOLzFLpK6xfpCQ' },
];

// The m3u8 URL you provided
const knownM3u8 = 'https://rrr.rapidshare.cc/pmjz/v5/bapD3C40jf5WGa2zsLH0R4MmBe5hkz4NP-Ck0ImGLNq2qGM7Z-61k3opVv2yJhb1aMVshDCSXG-ZNiMmOFLcJpAVO_NjxAYUfQRj3-IjcIu070-bmWpYkQWI7MzAEoftamVMjPPr_nr_X1Gf8dh01d0gVd5DU3qPkI5NAyNR1/list.m3u8';

function analyzeId(id: string) {
  console.log(`\nAnalyzing: ${id}`);
  console.log(`  Length: ${id.length}`);
  
  // Try base64 decode
  try {
    const decoded = Buffer.from(id, 'base64').toString('hex');
    console.log(`  Base64 -> Hex: ${decoded}`);
  } catch {}
  
  // Try URL-safe base64
  try {
    const urlSafe = id.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('hex');
    console.log(`  URL-safe Base64 -> Hex: ${decoded}`);
  } catch {}
  
  // Check for common patterns
  const parts = id.split(/[_-]/);
  console.log(`  Parts (split by _ or -): ${parts.length}`);
  
  // Check character distribution
  const hasUppercase = /[A-Z]/.test(id);
  const hasLowercase = /[a-z]/.test(id);
  const hasNumbers = /[0-9]/.test(id);
  const hasSpecial = /[_-]/.test(id);
  console.log(`  Has: uppercase=${hasUppercase}, lowercase=${hasLowercase}, numbers=${hasNumbers}, special=${hasSpecial}`);
}

function analyzeM3u8Token(url: string) {
  const match = url.match(/\/v5\/([^/]+)\/list\.m3u8/);
  if (match) {
    const token = match[1];
    console.log(`\nM3U8 Token: ${token}`);
    console.log(`  Length: ${token.length}`);
    analyzeId(token);
  }
}

console.log('=== Analyzing Embed IDs ===');
for (const sample of samples) {
  console.log(`\n--- ${sample.name} ---`);
  analyzeId(sample.embedId);
}

console.log('\n\n=== Analyzing Known M3U8 URL ===');
analyzeM3u8Token(knownM3u8);

// Compare the two embed IDs to find common parts
console.log('\n\n=== Comparing Embed IDs ===');
const id1 = samples[0].embedId;
const id2 = samples[1].embedId;

// Find common suffix
let commonSuffix = '';
for (let i = 1; i <= Math.min(id1.length, id2.length); i++) {
  if (id1.slice(-i) === id2.slice(-i)) {
    commonSuffix = id1.slice(-i);
  } else {
    break;
  }
}
console.log(`Common suffix: "${commonSuffix}" (${commonSuffix.length} chars)`);

// The common part might be a signature or key
const unique1 = id1.slice(0, -commonSuffix.length);
const unique2 = id2.slice(0, -commonSuffix.length);
console.log(`Unique part 1: ${unique1}`);
console.log(`Unique part 2: ${unique2}`);
