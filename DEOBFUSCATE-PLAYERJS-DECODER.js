const https = require('https');
const fs = require('fs');

/**
 * DEOBFUSCATE PLAYERJS DECODER
 * 
 * Download PlayerJS and systematically find the decoder function
 */

function downloadPlayerJS() {
  return new Promise((resolve, reject) => {
    const url = 'https://pro.rcp.best/playerjs/playerjs.js';
    console.log(`📥 Downloading PlayerJS from: ${url}\n`);

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fs.writeFileSync('playerjs-downloaded.js', data);
        console.log(`✅ Downloaded ${data.length} bytes\n`);
        resolve(data);
      });
    }).on('error', reject);
  });
}

function findDecoderPatterns(code) {
  console.log('🔍 Searching for decoder patterns in PlayerJS...\n');

  const patterns = {
    // Pattern 1: Functions that use atob + charCodeAt + XOR
    atobXor: [],
    // Pattern 2: Functions that reverse strings
    reverseString: [],
    // Pattern 3: Functions that process pjsdiv
    pjsdivProcessor: [],
    // Pattern 4: Base64 URL-safe conversions
    urlSafeBase64: [],
    // Pattern 5: Functions with bitwise XOR (^)
    bitwiseXor: []
  };

  // Split into functions
  const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{[^}]+}/g;
  let match;
  let functionCount = 0;

  while ((match = functionRegex.exec(code)) !== null) {
    functionCount++;
    const funcName = match[1];
    const funcBody = match[0];

    // Check for atob + charCodeAt pattern
    if (funcBody.includes('atob') && funcBody.includes('charCodeAt')) {
      patterns.atobXor.push({ name: funcName, code: funcBody });
    }

    // Check for reverse pattern
    if (funcBody.includes('reverse') || (funcBody.includes('split') && funcBody.includes('join'))) {
      patterns.reverseString.push({ name: funcName, code: funcBody });
    }

    // Check for pjsdiv processing
    if (funcBody.includes('pjsdiv') || funcBody.includes('getElementById')) {
      patterns.pjsdivProcessor.push({ name: funcName, code: funcBody });
    }

    // Check for URL-safe base64
    if (funcBody.includes('replace') && (funcBody.includes('-') || funcBody.includes('_'))) {
      patterns.urlSafeBase64.push({ name: funcName, code: funcBody });
    }

    // Check for XOR operations
    if (funcBody.includes('^') && funcBody.includes('charCodeAt')) {
      patterns.bitwiseXor.push({ name: funcName, code: funcBody });
    }
  }

  console.log(`📊 Analyzed ${functionCount} functions\n`);
  console.log('Pattern matches:');
  console.log(`- atob + charCodeAt: ${patterns.atobXor.length}`);
  console.log(`- String reverse: ${patterns.reverseString.length}`);
  console.log(`- pjsdiv processor: ${patterns.pjsdivProcessor.length}`);
  console.log(`- URL-safe base64: ${patterns.urlSafeBase64.length}`);
  console.log(`- Bitwise XOR: ${patterns.bitwiseXor.length}\n`);

  return patterns;
}

function extractLikelyDecoder(patterns) {
  console.log('🎯 Extracting most likely decoder function...\n');

  // The decoder likely combines multiple patterns
  const candidates = [];

  // Look for functions that have multiple decoder characteristics
  const allFunctions = [
    ...patterns.atobXor,
    ...patterns.bitwiseXor,
    ...patterns.urlSafeBase64
  ];

  // Count occurrences of each function
  const functionCounts = {};
  allFunctions.forEach(func => {
    functionCounts[func.name] = (functionCounts[func.name] || 0) + 1;
  });

  // Functions that appear in multiple patterns are likely decoders
  Object.entries(functionCounts).forEach(([name, count]) => {
    if (count >= 2) {
      const func = allFunctions.find(f => f.name === name);
      candidates.push({ name, score: count, code: func.code });
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  console.log(`Found ${candidates.length} high-confidence decoder candidates:\n`);
  candidates.forEach((candidate, i) => {
    console.log(`${i + 1}. ${candidate.name} (score: ${candidate.score})`);
  });

  return candidates;
}

function searchForSBXDecoder(code) {
  console.log('\n🔍 Searching specifically for SBX decoder...\n');

  // Look for "sbx" or "SBX" in the code
  const sbxMatches = [];
  const sbxRegex = /(\w+)\s*=\s*function\s*\([^)]*\)\s*{[^}]*(?:atob|charCodeAt|fromCharCode)[^}]*}/gi;
  
  let match;
  while ((match = sbxRegex.exec(code)) !== null) {
    const varName = match[1];
    if (varName.toLowerCase().includes('sbx') || 
        varName.toLowerCase().includes('decode') ||
        varName.toLowerCase().includes('decrypt')) {
      sbxMatches.push({
        name: varName,
        code: match[0]
      });
    }
  }

  console.log(`Found ${sbxMatches.length} SBX-related functions\n`);
  return sbxMatches;
}

function extractInitializationCode(code) {
  console.log('\n🔍 Extracting initialization code...\n');

  // Look for code that runs on page load
  const initPatterns = [
    /document\.addEventListener\(['"]DOMContentLoaded['"][^}]+}/g,
    /window\.onload\s*=\s*function[^}]+}/g,
    /\(function\s*\(\)\s*{[^}]+}\)\(\)/g  // IIFE
  ];

  const initCode = [];
  initPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      initCode.push(match[0]);
    }
  });

  console.log(`Found ${initCode.length} initialization blocks\n`);
  return initCode;
}

async function main() {
  try {
    // Load existing PlayerJS
    console.log('📂 Loading existing PlayerJS file...\n');
    const playerJSCode = fs.readFileSync('deobfuscation/playerjs.js', 'utf8');
    console.log(`✅ Loaded ${playerJSCode.length} bytes\n`);

    // Find decoder patterns
    const patterns = findDecoderPatterns(playerJSCode);

    // Extract likely decoders
    const candidates = extractLikelyDecoder(patterns);

    // Search for SBX specifically
    const sbxDecoders = searchForSBXDecoder(playerJSCode);

    // Extract initialization code
    const initCode = extractInitializationCode(playerJSCode);

    // Save detailed analysis
    const analysis = {
      patterns,
      candidates,
      sbxDecoders,
      initCode
    };

    fs.writeFileSync('playerjs-decoder-analysis.json', JSON.stringify(analysis, null, 2));
    console.log('💾 Analysis saved to playerjs-decoder-analysis.json\n');

    // Print the most promising candidates
    console.log('\n🎯 TOP DECODER CANDIDATES:\n');
    console.log('='.repeat(80));
    
    if (candidates.length > 0) {
      candidates.slice(0, 3).forEach((candidate, i) => {
        console.log(`\n${i + 1}. ${candidate.name} (confidence: ${candidate.score}/3)`);
        console.log('-'.repeat(80));
        console.log(candidate.code);
      });
    }

    if (sbxDecoders.length > 0) {
      console.log('\n\n🔍 SBX-SPECIFIC DECODERS:\n');
      console.log('='.repeat(80));
      sbxDecoders.forEach((decoder, i) => {
        console.log(`\n${i + 1}. ${decoder.name}`);
        console.log('-'.repeat(80));
        console.log(decoder.code);
      });
    }

    console.log('\n\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
