/**
 * 111movies Direct API Access
 * 
 * Based on analysis:
 * 1. Page contains encoded 'data' in __NEXT_DATA__
 * 2. This data is transformed and sent to /fcd552c4{hash}/{encoded}/sr
 * 3. Response contains sources with 'data' field (hash:encrypted)
 * 4. Source data is sent to /fcd552c4{hash}/{source_data} to get m3u8
 * 
 * The hash appears to be: 321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0
 */

const API_HASH = '321aeac1e62c5304913b3420be75a19d390807281a425aabbb5dc4c0';
const BASE_URL = 'https://111movies.com';

// Custom base64 alphabet found in the JS
const CUSTOM_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// Try to decode using custom alphabet
function customBase64Decode(encoded, fromAlphabet, toAlphabet = STANDARD_ALPHABET) {
  let translated = '';
  for (const char of encoded) {
    const idx = fromAlphabet.indexOf(char);
    if (idx >= 0) {
      translated += toAlphabet[idx];
    } else {
      translated += char;
    }
  }
  return Buffer.from(translated, 'base64').toString();
}

// Fetch page data
async function fetchPageData(tmdbId, type = 'movie', season, episode) {
  let url;
  if (type === 'movie') {
    url = `${BASE_URL}/movie/${tmdbId}`;
  } else {
    url = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error('__NEXT_DATA__ not found');
  
  return JSON.parse(match[1]).props?.pageProps || {};
}

// Try to call the sources API directly
async function fetchSources(encodedData) {
  const url = `${BASE_URL}/fcd552c4${API_HASH}/${encodedData}/sr`;
  console.log('Fetching sources from:', url.substring(0, 100) + '...');
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': BASE_URL,
      'Origin': BASE_URL
    }
  });
  
  if (!response.ok) {
    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 200));
    return null;
  }
  
  return response.json();
}

// Try to call the stream API directly
async function fetchStream(sourceData) {
  const url = `${BASE_URL}/fcd552c4${API_HASH}/${sourceData}`;
  console.log('Fetching stream from:', url.substring(0, 100) + '...');
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': BASE_URL,
      'Origin': BASE_URL
    }
  });
  
  if (!response.ok) {
    console.log('Response status:', response.status);
    return null;
  }
  
  return response.json();
}

// Analyze the encoding transformation
function analyzeEncoding(pageData, apiEncoded) {
  console.log('\n=== ENCODING ANALYSIS ===');
  console.log('Page data length:', pageData.length);
  console.log('API encoded length:', apiEncoded.length);
  
  // Character frequency
  const pageChars = {};
  const apiChars = {};
  
  for (const c of pageData) pageChars[c] = (pageChars[c] || 0) + 1;
  for (const c of apiEncoded) apiChars[c] = (apiChars[c] || 0) + 1;
  
  console.log('\nPage data unique chars:', Object.keys(pageChars).length);
  console.log('API encoded unique chars:', Object.keys(apiChars).length);
  
  // Check if it's a simple character mapping
  const pageUnique = [...new Set(pageData)].sort().join('');
  const apiUnique = [...new Set(apiEncoded)].sort().join('');
  
  console.log('\nPage charset:', pageUnique);
  console.log('API charset:', apiUnique);
  
  // The API encoded data uses: 0-9, A-Z, a-z, -, _, p
  // This looks like a custom base64 with - and _ instead of + and /
  
  // Try to find a pattern
  console.log('\n--- Trying transformations ---');
  
  // Check if lengths are related
  const ratio = apiEncoded.length / pageData.length;
  console.log('Length ratio (api/page):', ratio.toFixed(2));
  
  // If ratio is ~4/3, it's likely base64 encoding of the page data
  // If ratio is ~1, it might be a character substitution
}

async function main() {
  console.log('=== 111MOVIES DIRECT API TEST ===\n');
  
  // Get page data
  const pageProps = await fetchPageData('155', 'movie');
  console.log('Page data:', pageProps.data?.substring(0, 80));
  
  // The page data needs to be transformed before calling the API
  // Let's try different transformations
  
  console.log('\n--- Testing direct API call with page data ---');
  
  // Try 1: Use page data directly
  let sources = await fetchSources(pageProps.data);
  if (sources) {
    console.log('Direct call worked!');
    console.log('Sources:', sources.length);
  } else {
    console.log('Direct call failed');
  }
  
  // Try 2: URL-safe base64 transformation
  console.log('\n--- Testing URL-safe base64 transformation ---');
  const urlSafe = pageProps.data.replace(/\+/g, '-').replace(/\//g, '_');
  sources = await fetchSources(urlSafe);
  if (sources) {
    console.log('URL-safe transformation worked!');
  }
  
  // Try 3: Custom alphabet transformation
  console.log('\n--- Testing custom alphabet transformation ---');
  // The page data uses: a-z, A-Z, 0-9, _, -
  // The API uses: a-z, A-Z, 0-9, _, -, p
  
  // Maybe the encoding adds 'p' as padding?
  // Or maybe there's a different transformation
  
  // Let's try to understand by comparing known input/output
  // From the Puppeteer capture:
  // Page data: mX1CsXTGm2mGrMeXrMsCm_TGmMBXrugvmMldwul6mM-WmuBKmFUyr20vrM1FwMeLw_ryw_iFsGlLr2TGlXBGsFTdmGmvmGrylX1SsXeLw2gdlGISmX1ym2lKmbgLs2lzlFlxmFlzlFs1lGsCsFruUSsMSvs_1blxSblKmGlb1_svSMsSUurFs_sCsGl1sFlzlFmxlFlzl2sLgbmKl2my1XmSIGldg2wLeXsS1XlyrGmvmGmdTFsGBXlGT2rLlGsIFsGmvmGmb4_m
  // API encoded: fqopWnqHDzrTfI4p3z6of12p9RJ6DV6-fPtpVV6ofqMpREmUpUrHfP4D1VrNfqop97SyDUrTfPhD_i6lf1MpWnK-5U6-fI4pVUrNf1PDl51QpV6afPspVVrtf1opRmS-DUrJfIop3U69f1PD78S-Di6UfIMpVVrtfqMpW5lTDirHfIopeVrifqGp9RAyDU6rfPDD_i60f14pWnfuDirHfIMpVz67fqspR5iuCz6hfIopVVrmf1op97fxDi6hfIMD_zrAfqopWEA-Cz6afPGD_U69f1sDlEldCirTfP0p3U69f10pWRRuDzrTfPspVV6RfqGpRmlzXU6-fPGp3zrSf1spR51aXUrOfP4D1U6RfqMpWnm2pz66fPspVU6Rf1spRmAUCz6UfPop3UrmfqMpW5fdCV62fIGpVUrmf1PD77SrpzrOfIop3U67f14pWnH2pi6hfPMpVzrmfq0pWR7yDU6UfPPD1Vr4fqopREAyCzrOfIopVVrLf10Dlj7h5z6UfPMpVU6lf12pWnidXz6rfPDD_i6Rf1MpR57UDU66fIop3VrSfq4pW8RzDz6hfPhD_i67f10pWR1a5zrOfPMpeV6lfq0pRnizDirzfP0pVz6of1ypW5jdpz66fPoD1V69f1MDljdTDirHfIopei69f12pR5SUDVrufPtp3Ur4fqspWmAB5UrOfIMpVz6Rf1PDl53yXz6-fPoD1UrLfqoD7mVdXUrzfIGp3V6of1tpRjKUCi62fP0pVi6ofqopWRKUCV6-fP0p3z69fqq
  
  // The API encoded is much longer - about 4x the page data
  // This suggests the page data is being expanded, not just transformed
  
  console.log('\nPage data length:', pageProps.data.length);
  console.log('Expected API length (4x):', pageProps.data.length * 4);
  
  // The encoding might be:
  // 1. Take each character
  // 2. Convert to some representation (maybe position-based)
  // 3. Encode that representation
  
  // Let's look at the pattern more closely
  // The API encoded has lots of 'p' characters - maybe as separators?
  const apiSample = 'fqopWnqHDzrTfI4p3z6of12p9RJ6DV6-fPtpVV6ofqMpREmUpUrHfP4D1VrNfqop97SyDUrTfPhD_i6lf1MpWnK-5U6-';
  const pCount = (apiSample.match(/p/g) || []).length;
  console.log('\n"p" count in sample:', pCount);
  console.log('Sample length:', apiSample.length);
  console.log('Ratio:', (apiSample.length / pCount).toFixed(2), 'chars per "p"');
  
  // It looks like 'p' appears roughly every 4-5 characters
  // This might be a delimiter or part of the encoding scheme
}

main().catch(console.error);
