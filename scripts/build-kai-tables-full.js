#!/usr/bin/env node
/**
 * Build FULL AnimeKai server decrypt tables.
 * 
 * Strategy:
 * 1. We know prefix: {"url":"https:\/\/4spromax.site\/e\/
 * 2. We know suffix pattern: ","skip":{"intro":[N,N],"outro":[N,N]}}
 * 3. Video IDs are between prefix and suffix
 * 4. We can get the actual embed URLs by fetching the MegaUp pages
 *    (the embed URL is what we're trying to decrypt, but we can get it
 *     from the server list HTML which shows the server name/type)
 * 
 * Better strategy: We can get the ACTUAL plaintext by using a different
 * method to get the embed URL, then match it against the cipher bytes.
 */
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUST = path.join(__dirname, '..', 'rpi-proxy', 'rust-fetch', 'target', 'release', 'rust-fetch.exe');

function fetch(url, hdrs = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', ...hdrs } },
      r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); }).on('error', rej);
  });
}

function rustExec(url, mode) {
  return execFileSync(RUST, ['--url', url, '--mode', mode], { encoding: 'utf8', timeout: 5000 }).trim();
}

const KAI_HDRS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json', 'Referer': 'https://animekai.to/' };
const cipherPos = (i) => i === 0 ? 0 : i === 1 ? 7 : i === 2 ? 11 : i === 3 ? 13 : i === 4 ? 15 : i === 5 ? 17 : i === 6 ? 19 : 20 + (i - 7);

function decodeToData(encrypted) {
  const b64 = encrypted.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64 + '='.repeat((4 - b64.length % 4) % 4), 'base64').slice(21);
}

async function main() {
  // Collect pairs of (encrypted_response, known_plaintext)
  // We get the known plaintext by figuring out the embed URL independently
  
  console.log('=== Collecting known plaintext-ciphertext pairs ===\n');
  
  const pairs = []; // { plaintext, cipherData }
  
  // For each anime, get the link view responses AND figure out the actual URLs
  const queries = ['bleach', 'naruto', 'one piece', 'dragon ball z', 'jujutsu kaisen'];
  
  for (const query of queries) {
    console.log(`Processing: ${query}`);
    try {
      const sr = await fetch(`https://animekai.to/ajax/anime/search?keyword=${encodeURIComponent(query)}`, KAI_HDRS);
      const sd = JSON.parse(sr.body);
      const slug = sd.result?.html?.match(/href="\/watch\/([^"]+)"/)?.[1];
      if (!slug) continue;
      
      const wp = await fetch('https://animekai.to/watch/' + slug);
      const sync = JSON.parse(wp.body.match(/<script[^>]*id="syncData"[^>]*>([\s\S]*?)<\/script>/)[1]);
      const animeId = sync.anime_id;
      
      const encId = rustExec(animeId, 'kai-encrypt');
      const epResp = await fetch(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${encId}`, KAI_HDRS);
      const epData = JSON.parse(epResp.body);
      if (!epData.result) continue;
      
      const token = epData.result.match(/token="([^"]+)"/)?.[1];
      if (!token) continue;
      
      const encToken = rustExec(token, 'kai-encrypt');
      const srvResp = await fetch(`https://animekai.to/ajax/links/list?token=${token}&_=${encToken}`, KAI_HDRS);
      const srvData = JSON.parse(srvResp.body);
      if (!srvData.result) continue;
      
      const lids = [...srvData.result.matchAll(/data-lid="([^"]+)"/g)].map(m => m[1]);
      
      for (const lid of lids.slice(0, 4)) {
        try {
          const encLid = rustExec(lid, 'kai-encrypt');
          const viewResp = await fetch(`https://animekai.to/ajax/links/view?id=${lid}&_=${encLid}`, KAI_HDRS);
          const viewData = JSON.parse(viewResp.body);
          if (!viewData.result) continue;
          
          const cipherData = decodeToData(viewData.result);
          pairs.push({ encrypted: viewData.result, cipherData, query, lid });
        } catch {}
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\nCollected ${pairs.length} encrypted responses`);
  
  // Now, we know the plaintext format:
  // {"url":"https:\/\/4spromax.site\/e\/VIDEO_ID","skip":{"intro":[A,B],"outro":[C,D]}}
  // 
  // The prefix is always: {"url":"https:\/\/4spromax.site\/e\/
  // That's 36 chars (positions 0-35)
  //
  // After the video ID, we have: ","skip":{"intro":[
  // The video ID length varies but is typically ~20 chars
  //
  // The suffix after the numbers is: ],"outro":[N,N]}}
  
  // Let's figure out the EXACT plaintext for each sample.
  // We know the structure. The video ID is alphanumeric.
  // The intro/outro numbers are small integers.
  
  // Key insight: the suffix "}}" is always the last 2 chars.
  // And before that: ]}}  or ,N]}}
  // The pattern is: ...,"outro":[N,N]}}
  
  // Let's work backwards from the end.
  // Last char (pos ptLen-1) = '}'
  // Second to last (pos ptLen-2) = '}'
  // Before that: ']' then numbers, then '[' then ':' then '"' then 'o' etc.
  
  // Actually, let me try a completely different approach.
  // Since we have the partial decrypt working for positions 0-35,
  // and we know the structure, let me try to figure out the video IDs
  // by looking at what characters are possible at each position.
  
  // For each position, we can check all 183 old tables to see which chars
  // could produce the observed cipher byte. If only one printable ASCII char
  // is possible, we know the plaintext.
  
  // Load old tables for reference (even though they're wrong, some might still match)
  const tsSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'lib', 'animekai-crypto.ts'), 'utf8');
  const oldTables = {};
  const tableRegex = /(\d+):\s*\{([^}]+)\}/g;
  let m;
  while ((m = tableRegex.exec(tsSource)) !== null) {
    const idx = parseInt(m[1]);
    if (idx > 200) continue;
    const entries = {};
    const entryRegex = /'([^']+)':(0x[0-9a-fA-F]+)/g;
    let em;
    while ((em = entryRegex.exec(m[2])) !== null) {
      entries[em[1]] = parseInt(em[2], 16);
    }
    if (Object.keys(entries).length > 10) oldTables[idx] = entries;
  }
  
  // Build ALL possible reverse mappings across ALL tables
  // For each byte value, which chars could it represent (across any table)?
  const byteToChars = {}; // byte → Set of chars
  for (const [_, tbl] of Object.entries(oldTables)) {
    for (const [ch, byte] of Object.entries(tbl)) {
      if (!byteToChars[byte]) byteToChars[byte] = new Set();
      byteToChars[byte].add(ch);
    }
  }
  
  // Now for each unknown position, see what chars are possible
  console.log('\n=== Inferring unknown positions ===');
  const prefix = '{"url":"https:\\/\\/4spromax.site\\/e\\/';
  
  // Build the full decrypt table
  const fullDecrypt = {}; // pos → { byte → char }
  
  // Add known prefix
  for (let pos = 0; pos < prefix.length; pos++) {
    const cp = cipherPos(pos);
    const byte = pairs[0].cipherData[cp];
    if (!fullDecrypt[pos]) fullDecrypt[pos] = {};
    fullDecrypt[pos][byte] = prefix[pos];
  }
  
  // For each pair, try to figure out the full plaintext
  for (const pair of pairs.slice(0, 5)) {
    const data = pair.cipherData;
    const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
    
    // We know positions 0-35 (prefix)
    // Positions 36+ are the video ID until we hit ","skip"
    // The video ID chars are: a-zA-Z0-9 and maybe - _ 
    
    // Let's find where the video ID ends by looking for the ","skip" pattern
    // The char after video ID is '"' (double quote)
    // Then ',' then '"' then 's' then 'k' then 'i' then 'p' then '"'
    
    // We need to find the position where the byte could be '"'
    // across all our tables. But since tables changed, we can't use old tables.
    
    // Different approach: the suffix is fixed-structure JSON.
    // Let's assume the suffix is: ","skip":{"intro":[0,100],"outro":[1300,1385]}}
    // (numbers vary but structure is fixed)
    // The minimum suffix without numbers is: ","skip":{"intro":[,],"outro":[,]}}
    // That's 36 chars minimum
    
    // So the video ID is at most ptLen - 36 - 36 = ptLen - 72 chars
    // But more realistically, video IDs are ~20 chars
    
    // Let's try: assume video ID is positions 36 to ~55
    // Then position ~56 should be '"' (end of URL value)
    
    console.log(`\nSample ${pair.lid}: ptLen=${ptLen}`);
  }
  
  // FINAL APPROACH: Just build tables empirically.
  // We have 22 samples. For each position, we have one cipher byte.
  // We know the plaintext for positions 0-35.
  // For the rest, we need to figure it out.
  
  // The most reliable way: use the STRUCTURE of JSON.
  // After the URL, the JSON has: ","skip":{"intro":[N,N],"outro":[N,N]}}
  // Working backwards from the end:
  // pos[-1] = '}', pos[-2] = '}', pos[-3] = ']'
  // Then numbers (digits and comma)
  // Then '['
  // Then ':'
  // Then '"outro"'  (6 chars)
  // Then ','
  // Then ']'
  // Then numbers
  // Then '['
  // Then ':'
  // Then '"intro"' (7 chars including quotes)
  // Then ':'
  // Then '{'
  // Then '"skip"' (6 chars)
  // Then ':'
  // Then ','
  // Then '"' (end of URL)
  
  // So from the end: }  }  ]  NUMS  [  :  "  o  u  t  r  o  "  ,  ]  NUMS  [  :  "  i  n  t  r  o  "  :  {  "  s  k  i  p  "  :  ,  "
  // That's the suffix structure (reading backwards)
  
  // Let's build tables from the suffix
  console.log('\n=== Building tables from suffix pattern ===');
  
  // For each sample, figure out the suffix
  for (const pair of pairs.slice(0, 8)) {
    const data = pair.cipherData;
    const ptLen = data.length > 20 ? 7 + (data.length - 20) : 1;
    
    // The last 2 chars are always }}
    const suffixChars = ['}', '}'];
    // Before that: ] then digits/comma then [ : " o u t r o " , ] digits/comma [ : " i n t r o " : { " s k i p " : , "
    // Let's build the known suffix backwards
    // We don't know the exact numbers, but we know the structure chars
    
    // Positions from end:
    // -1: }  -2: }  -3: ]  
    // Then variable digits
    // After digits: , then more digits, then [
    // Then: :"outro",]
    // Then variable digits  
    // Then: ,digits,[:"intro":{,"skip":,"
    
    // This is getting complex. Let me just map the KNOWN structural chars.
    // The suffix (ignoring numbers) is: ","skip":{"intro":[,],"outro":[,]}}
    
    // Let me find the numbers by process of elimination.
    // Digits are 0-9. Other chars are structural.
    // At each position from the end, if the byte can only map to a structural char
    // (not a digit), then we know it's structural.
    
    // For now, let's just add the last 2 chars (}}) to our table
    for (let offset = 1; offset <= 2; offset++) {
      const pos = ptLen - offset;
      const cp = cipherPos(pos);
      if (cp < data.length) {
        const byte = data[cp];
        if (!fullDecrypt[pos]) fullDecrypt[pos] = {};
        fullDecrypt[pos][byte] = '}';
      }
    }
    
    // pos -3 should be ']'
    {
      const pos = ptLen - 3;
      const cp = cipherPos(pos);
      if (cp < data.length) {
        const byte = data[cp];
        if (!fullDecrypt[pos]) fullDecrypt[pos] = {};
        fullDecrypt[pos][byte] = ']';
      }
    }
  }
  
  // Count total known entries per position
  const positionCoverage = {};
  for (const [pos, entries] of Object.entries(fullDecrypt)) {
    positionCoverage[pos] = Object.keys(entries).length;
  }
  
  // We have very few entries per position (just 1 char each).
  // To build full tables, we need MANY different chars at each position.
  // This requires many more samples with diverse content.
  
  // ALTERNATIVE: Instead of building full tables, just build a MINIMAL
  // decrypt function that handles the specific response format.
  // We know the response is always JSON with a URL and skip data.
  // We can hardcode the structural chars and only need tables for
  // the variable parts (video ID, numbers).
  
  // Actually, the BEST approach: since we know the server's encrypt tables
  // are different from ours, and we can't easily extract them,
  // let's use a DIFFERENT decryption method.
  
  // The window.__$ key might be the seed for generating the tables.
  // Let me check if the key XORed with position gives us the table index.
  
  console.log('\n=== Checking window.__$ key relationship ===');
  const pageResp = await fetch('https://animekai.to/watch/bleach-re3j');
  const keyMatch = pageResp.body.match(/window\.__\$\s*=\s*'([^']+)'/);
  const pageKey = keyMatch[1];
  console.log('Key:', pageKey);
  console.log('Key length:', pageKey.length);
  
  // Decode the key
  const keyB64 = pageKey.replace(/-/g, '+').replace(/_/g, '/');
  const keyBuf = Buffer.from(keyB64 + '='.repeat((4 - keyB64.length % 4) % 4), 'base64');
  console.log('Key decoded length:', keyBuf.length, 'bytes');
  console.log('Key hex:', keyBuf.toString('hex'));
  
  // Check if key bytes XORed with cipher bytes give us the plaintext
  const testData = pairs[0].cipherData;
  console.log('\nXOR test (key byte XOR cipher byte at each position):');
  for (let pos = 0; pos < Math.min(20, prefix.length); pos++) {
    const cp = cipherPos(pos);
    const cByte = testData[cp];
    const kByte = keyBuf[pos % keyBuf.length];
    const xored = cByte ^ kByte;
    const expected = prefix.charCodeAt(pos);
    console.log(`  pos ${pos}: cipher=0x${cByte.toString(16).padStart(2,'0')} key=0x${kByte.toString(16).padStart(2,'0')} XOR=0x${xored.toString(16).padStart(2,'0')}(${String.fromCharCode(xored)}) expected=0x${expected.toString(16).padStart(2,'0')}(${prefix[pos]}) ${xored === expected ? '✓' : '✗'}`);
  }
}

main().catch(e => console.error('Fatal:', e));
