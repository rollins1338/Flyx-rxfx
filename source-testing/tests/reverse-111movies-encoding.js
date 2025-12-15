/**
 * Reverse engineer 111movies encoding
 * 
 * Found: Custom base64 alphabet (lowercase first)
 * Standard: ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
 * Custom:   abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=
 * 
 * The encoding function found:
 * - Takes input string
 * - Uses custom base64 decode
 * - Returns decoded string
 * 
 * But we need the ENCODER (the reverse)
 */

// Custom alphabet (lowercase first)
const CUSTOM_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Custom base64 decode (found in their code)
function customBase64Decode(encoded) {
  let result = '';
  let buffer = 0;
  let bits = 0;
  
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded.charAt(i);
    const value = CUSTOM_ALPHABET.indexOf(char);
    if (value === -1 || value === 64) continue; // Skip invalid or padding
    
    buffer = (buffer << 6) | value;
    bits += 6;
    
    if (bits >= 8) {
      bits -= 8;
      result += String.fromCharCode((buffer >> bits) & 0xFF);
    }
  }
  
  return result;
}

// Custom base64 encode (reverse of decode)
function customBase64Encode(input) {
  let result = '';
  let buffer = 0;
  let bits = 0;
  
  for (let i = 0; i < input.length; i++) {
    buffer = (buffer << 8) | input.charCodeAt(i);
    bits += 8;
    
    while (bits >= 6) {
      bits -= 6;
      result += CUSTOM_ALPHABET[(buffer >> bits) & 0x3F];
    }
  }
  
  // Handle remaining bits
  if (bits > 0) {
    buffer <<= (6 - bits);
    result += CUSTOM_ALPHABET[buffer & 0x3F];
  }
  
  // Add padding
  while (result.length % 4 !== 0) {
    result += '=';
  }
  
  return result;
}

// Translate between alphabets
function translateAlphabet(str, fromAlpha, toAlpha) {
  let result = '';
  for (const char of str) {
    const idx = fromAlpha.indexOf(char);
    if (idx >= 0) {
      result += toAlpha[idx];
    } else {
      result += char;
    }
  }
  return result;
}

// Test the encoding
async function testEncoding() {
  console.log('=== TESTING 111MOVIES ENCODING ===\n');
  
  // Fetch page data
  const pageRes = await fetch('https://111movies.com/movie/155', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await pageRes.text();
  
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  const nextData = JSON.parse(nextDataMatch[1]);
  const pageData = nextData.props?.pageProps?.data;
  
  console.log('Page data:', pageData);
  console.log('Page data length:', pageData.length);
  
  // Try to decode the page data with custom base64
  console.log('\n--- Trying custom base64 decode on page data ---');
  try {
    const decoded = customBase64Decode(pageData);
    console.log('Decoded length:', decoded.length);
    console.log('Decoded (hex):', Buffer.from(decoded).toString('hex').substring(0, 100));
    console.log('Decoded (ascii):', decoded.substring(0, 50));
  } catch (e) {
    console.log('Decode failed:', e.message);
  }
  
  // Try standard base64 with alphabet translation
  console.log('\n--- Trying alphabet translation + standard base64 ---');
  try {
    const translated = translateAlphabet(pageData, CUSTOM_ALPHABET, STANDARD_ALPHABET);
    console.log('Translated:', translated.substring(0, 50));
    const decoded = Buffer.from(translated, 'base64').toString();
    console.log('Decoded:', decoded.substring(0, 50));
  } catch (e) {
    console.log('Failed:', e.message);
  }
  
  // The page data might already be decoded - let's check what format it's in
  console.log('\n--- Analyzing page data format ---');
  const chars = [...new Set(pageData)].sort();
  console.log('Unique chars:', chars.join(''));
  console.log('Char count:', chars.length);
  
  // Check if it matches base64 charset
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=_-';
  const nonBase64 = chars.filter(c => !base64Chars.includes(c));
  console.log('Non-base64 chars:', nonBase64.join('') || 'none');
  
  // The page data uses: a-z, A-Z, 0-9, _, -
  // This is URL-safe base64 (- instead of +, _ instead of /)
  
  console.log('\n--- Trying URL-safe base64 decode ---');
  try {
    // Convert URL-safe to standard base64
    const standard = pageData.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(standard, 'base64');
    console.log('Decoded length:', decoded.length);
    console.log('Decoded (hex):', decoded.toString('hex').substring(0, 100));
    
    // Check if it's binary data
    const isPrintable = decoded.every(b => b >= 32 && b <= 126);
    console.log('Is printable ASCII:', isPrintable);
    
    if (!isPrintable) {
      // Might be encrypted or compressed
      console.log('Binary data detected - might be encrypted');
    }
  } catch (e) {
    console.log('URL-safe base64 decode failed:', e.message);
  }
}

// Analyze the relationship between page data and API encoded data
async function analyzeTransformation() {
  console.log('\n=== ANALYZING PAGE DATA -> API TRANSFORMATION ===\n');
  
  // We know from Puppeteer capture:
  // Page data: ~172 chars
  // API encoded: ~688 chars (4x expansion)
  
  // This 4x expansion suggests:
  // - Each input byte becomes 4 output chars
  // - Or each input char is encoded as 4 chars
  
  // Let's look at the API encoded format
  // Sample: fqopWnqHDzrTfI4p3z6of12p9RJ6DV6-fPtpVV6ofqMpREmUpUrHfP4D1VrNfqop97SyDUrTfPhD_i6l
  
  // Notice the pattern:
  // - 'p' appears frequently (every ~4-5 chars)
  // - Characters: a-z, A-Z, 0-9, -, _
  
  // The 'p' might be a delimiter or part of the encoding scheme
  
  const apiSample = 'fqopWnqHDzrTfI4p3z6of12p9RJ6DV6-fPtpVV6ofqMpREmUpUrHfP4D1VrNfqop97SyDUrTfPhD_i6lf1MpWnK-5U6-fI4pVUrNf1PDl51QpV6afPspVVrtf1opRmS-DUrJfIop3U69f1PD78S-Di6UfIMpVVrtfqMpW5lTDirHfIopeVrifqGp9RAyDU6rfPDD_i60f14pWnfuDirHfIMpVz67fqspR5iuCz6hfIopVVrmf1op97fxDi6hfIMD_zrAfqopWEA-Cz6afPGD_U69f1sDlEldCirTfP0p3U69f10pWRRuDzrTfPspVV6RfqGpRmlzXU6-fPGp3zrSf1spR51aXUrOfP4D1U6RfqMpWnm2pz66fPspVU6Rf1spRmAUCz6UfPop3UrmfqMpW5fdCV62fIGpVUrmf1PD77SrpzrOfIop3U67f14pWnH2pi6hfPMpVzrmfq0pWR7yDU6UfPPD1Vr4fqopREAyCzrOfIopVVrLf10Dlj7h5z6UfPMpVU6lf12pWnidXz6rfPDD_i6Rf1MpR57UDU66fIop3VrSfq4pW8RzDz6hfPhD_i67f10pWR1a5zrOfPMpeV6lfq0pRnizDirzfP0pVz6of1ypW5jdpz66fPoD1V69f1MDljdTDirHfIopei69f12pR5SUDVrufPtp3Ur4fqspWmAB5UrOfIMpVz6Rf1PDl53yXz6-fPoD1UrLfqoD7mVdXUrzfIGp3V6of1tpRjKUCi62fP0pVi6ofqopWRKUCV6-fP0p3z69fqq';
  
  console.log('API sample length:', apiSample.length);
  
  // Split by 'p' and analyze
  const parts = apiSample.split('p');
  console.log('Parts split by "p":', parts.length);
  console.log('Average part length:', (apiSample.length / parts.length).toFixed(2));
  
  // Look at part lengths
  const partLengths = parts.map(p => p.length);
  const uniqueLengths = [...new Set(partLengths)].sort((a, b) => a - b);
  console.log('Unique part lengths:', uniqueLengths.join(', '));
  
  // Count frequency of each length
  const lengthFreq = {};
  partLengths.forEach(l => lengthFreq[l] = (lengthFreq[l] || 0) + 1);
  console.log('Length frequencies:', lengthFreq);
  
  // The parts seem to be variable length
  // Let's look at the character distribution
  const charFreq = {};
  for (const c of apiSample) {
    charFreq[c] = (charFreq[c] || 0) + 1;
  }
  
  const sortedChars = Object.entries(charFreq).sort((a, b) => b[1] - a[1]);
  console.log('\nTop 10 most frequent chars:');
  sortedChars.slice(0, 10).forEach(([c, n]) => console.log(`  '${c}': ${n}`));
  
  // 'p' is very frequent - it's likely a structural element
  // Let's see if there's a pattern in what comes before/after 'p'
  
  console.log('\n--- Analyzing patterns around "p" ---');
  const pContexts = [];
  for (let i = 0; i < apiSample.length; i++) {
    if (apiSample[i] === 'p') {
      const before = apiSample.substring(Math.max(0, i - 3), i);
      const after = apiSample.substring(i + 1, Math.min(apiSample.length, i + 4));
      pContexts.push({ before, after });
    }
  }
  
  // Look at what comes before 'p'
  const beforeP = {};
  pContexts.forEach(ctx => {
    const last = ctx.before.slice(-1);
    beforeP[last] = (beforeP[last] || 0) + 1;
  });
  console.log('Chars before "p":', beforeP);
  
  // Look at what comes after 'p'
  const afterP = {};
  pContexts.forEach(ctx => {
    const first = ctx.after.slice(0, 1);
    afterP[first] = (afterP[first] || 0) + 1;
  });
  console.log('Chars after "p":', afterP);
}

// Try to find the encoding by comparing known input/output pairs
async function findEncodingPattern() {
  console.log('\n=== FINDING ENCODING PATTERN ===\n');
  
  // We need to compare:
  // 1. Page data (input to encoder)
  // 2. API encoded (output of encoder)
  
  // From Puppeteer capture, we know the page data gets transformed
  // Let's see if we can find a mathematical relationship
  
  // Page data chars: a-z, A-Z, 0-9, _, -
  // API encoded chars: a-z, A-Z, 0-9, _, -, p (frequent)
  
  // The 4x expansion could mean:
  // - Each char is encoded as 4 chars
  // - Or the data is encrypted/transformed then base64 encoded
  
  // Let's try: if each input char becomes 4 output chars
  // Input: 172 chars -> Output: 688 chars (exactly 4x!)
  
  console.log('Testing 4x char expansion theory...');
  
  // If each char maps to 4 chars, we can try to find the mapping
  // by looking at the first few chars
  
  // Page data starts with: rbl6mMm6w_eLwMBKw2s1l_S6m2T6sFmAsMBKsFldwMSWr2gAmbQLsbez
  // API encoded starts with: fqopWnqHDzrTfI4p3z6of12p9RJ6DV6-fPtpVV6ofqMpREmUpUrHfP4D1VrN
  
  // Let's see if there's a pattern
  const pageStart = 'rbl6mMm6w_eLwMBKw2s1l_S6m2T6sFmAsMBKsFldwMSWr2gAmbQLsbez';
  const apiStart = 'fqopWnqHDzrTfI4p3z6of12p9RJ6DV6-fPtpVV6ofqMpREmUpUrHfP4D1VrN';
  
  console.log('Page start:', pageStart.substring(0, 20));
  console.log('API start:', apiStart.substring(0, 80));
  
  // If 4 chars per input char:
  // 'r' -> 'fqop' ?
  // 'b' -> 'WnqH' ?
  // 'l' -> 'DzrT' ?
  // '6' -> 'fI4p' ?
  
  // Let's check if 'p' always appears at position 4, 8, 12, etc.
  console.log('\nChecking if "p" appears at regular intervals...');
  const pPositions = [];
  for (let i = 0; i < apiStart.length; i++) {
    if (apiStart[i] === 'p') {
      pPositions.push(i);
    }
  }
  console.log('Positions of "p":', pPositions);
  
  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < pPositions.length; i++) {
    intervals.push(pPositions[i] - pPositions[i - 1]);
  }
  console.log('Intervals between "p":', intervals);
  
  // If intervals are all 4, then 'p' is a delimiter every 4 chars
  const allFour = intervals.every(i => i === 4);
  console.log('All intervals are 4:', allFour);
  
  if (!allFour) {
    // The encoding is more complex
    // Let's look at the structure differently
    
    // Maybe the format is: [3 chars][p][3 chars][p]...
    // Or: [variable][p][variable][p]...
    
    // Let's split by 'p' and analyze each segment
    const segments = apiStart.split('p');
    console.log('\nSegments split by "p":');
    segments.forEach((seg, i) => console.log(`  ${i}: "${seg}" (${seg.length} chars)`));
  }
}

async function main() {
  await testEncoding();
  await analyzeTransformation();
  await findEncodingPattern();
}

main().catch(console.error);
