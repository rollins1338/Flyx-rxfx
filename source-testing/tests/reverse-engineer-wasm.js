/**
 * Comprehensive WASM Reverse Engineering
 * 
 * This script will:
 * 1. Parse the WASM binary structure
 * 2. Extract all functions and their signatures
 * 3. Find the key derivation and encryption functions
 * 4. Extract embedded constants and keys
 * 5. Analyze the control flow
 */

const fs = require('fs');
const path = require('path');

const WASM_PATH = 'source-testing/tests/wasm-analysis/img_data_bg.wasm';
const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

// LEB128 decoder
function readLEB128(buffer, offset) {
  let result = 0;
  let shift = 0;
  let byte;
  let bytesRead = 0;
  
  do {
    byte = buffer[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    bytesRead++;
  } while (byte & 0x80);
  
  return { value: result, bytesRead };
}

// Signed LEB128 decoder
function readSignedLEB128(buffer, offset) {
  let result = 0;
  let shift = 0;
  let byte;
  let bytesRead = 0;
  
  do {
    byte = buffer[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    bytesRead++;
  } while (byte & 0x80);
  
  // Sign extend
  if (shift < 32 && (byte & 0x40)) {
    result |= (~0 << shift);
  }
  
  return { value: result, bytesRead };
}

function parseWasm(buffer) {
  console.log('=== WASM Binary Parser ===\n');
  
  // Verify magic number
  const magic = buffer.slice(0, 4);
  if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
    throw new Error('Invalid WASM magic number');
  }
  
  const version = buffer.readUInt32LE(4);
  console.log(`WASM Version: ${version}`);
  console.log(`File Size: ${buffer.length} bytes\n`);
  
  // Parse sections
  let offset = 8;
  const sections = {};
  
  const sectionNames = {
    0: 'custom',
    1: 'type',
    2: 'import',
    3: 'function',
    4: 'table',
    5: 'memory',
    6: 'global',
    7: 'export',
    8: 'start',
    9: 'element',
    10: 'code',
    11: 'data',
    12: 'data_count',
  };
  
  while (offset < buffer.length) {
    const sectionId = buffer[offset];
    offset++;
    
    const { value: size, bytesRead } = readLEB128(buffer, offset);
    offset += bytesRead;
    
    const sectionName = sectionNames[sectionId] || `unknown_${sectionId}`;
    const sectionData = buffer.slice(offset, offset + size);
    
    if (!sections[sectionName]) {
      sections[sectionName] = [];
    }
    sections[sectionName].push({
      id: sectionId,
      offset: offset,
      size: size,
      data: sectionData,
    });
    
    console.log(`Section: ${sectionName} (id=${sectionId}), offset=${offset}, size=${size}`);
    
    offset += size;
  }
  
  return sections;
}

function parseTypeSection(data) {
  console.log('\n=== Type Section (Function Signatures) ===\n');
  
  let offset = 0;
  const { value: numTypes, bytesRead } = readLEB128(data, offset);
  offset += bytesRead;
  
  console.log(`Number of types: ${numTypes}`);
  
  const types = [];
  
  for (let i = 0; i < numTypes; i++) {
    const form = data[offset++]; // Should be 0x60 for func
    
    const { value: numParams, bytesRead: pb } = readLEB128(data, offset);
    offset += pb;
    
    const params = [];
    for (let j = 0; j < numParams; j++) {
      params.push(data[offset++]);
    }
    
    const { value: numResults, bytesRead: rb } = readLEB128(data, offset);
    offset += rb;
    
    const results = [];
    for (let j = 0; j < numResults; j++) {
      results.push(data[offset++]);
    }
    
    const typeNames = { 0x7f: 'i32', 0x7e: 'i64', 0x7d: 'f32', 0x7c: 'f64' };
    const paramStr = params.map(p => typeNames[p] || `0x${p.toString(16)}`).join(', ');
    const resultStr = results.map(r => typeNames[r] || `0x${r.toString(16)}`).join(', ');
    
    types.push({ params, results });
    
    if (i < 20) {
      console.log(`  Type ${i}: (${paramStr}) -> (${resultStr})`);
    }
  }
  
  if (numTypes > 20) {
    console.log(`  ... and ${numTypes - 20} more types`);
  }
  
  return types;
}

function parseImportSection(data) {
  console.log('\n=== Import Section ===\n');
  
  let offset = 0;
  const { value: numImports, bytesRead } = readLEB128(data, offset);
  offset += bytesRead;
  
  console.log(`Number of imports: ${numImports}`);
  
  const imports = [];
  
  for (let i = 0; i < numImports; i++) {
    const { value: moduleLen, bytesRead: mb } = readLEB128(data, offset);
    offset += mb;
    const moduleName = data.slice(offset, offset + moduleLen).toString('utf8');
    offset += moduleLen;
    
    const { value: fieldLen, bytesRead: fb } = readLEB128(data, offset);
    offset += fb;
    const fieldName = data.slice(offset, offset + fieldLen).toString('utf8');
    offset += fieldLen;
    
    const kind = data[offset++];
    let typeIndex = null;
    
    if (kind === 0) { // Function
      const { value: idx, bytesRead: ib } = readLEB128(data, offset);
      offset += ib;
      typeIndex = idx;
    } else if (kind === 1) { // Table
      offset += 3; // Skip table type
    } else if (kind === 2) { // Memory
      const flags = data[offset++];
      const { value: initial, bytesRead: ib } = readLEB128(data, offset);
      offset += ib;
      if (flags & 1) {
        const { value: max, bytesRead: mb } = readLEB128(data, offset);
        offset += mb;
      }
    } else if (kind === 3) { // Global
      offset += 2; // Skip global type
    }
    
    imports.push({ module: moduleName, field: fieldName, kind, typeIndex });
    
    const kindNames = { 0: 'func', 1: 'table', 2: 'memory', 3: 'global' };
    console.log(`  ${i}: ${moduleName}.${fieldName} (${kindNames[kind] || kind})`);
  }
  
  return imports;
}

function parseExportSection(data) {
  console.log('\n=== Export Section ===\n');
  
  let offset = 0;
  const { value: numExports, bytesRead } = readLEB128(data, offset);
  offset += bytesRead;
  
  console.log(`Number of exports: ${numExports}`);
  
  const exports = [];
  
  for (let i = 0; i < numExports; i++) {
    const { value: nameLen, bytesRead: nb } = readLEB128(data, offset);
    offset += nb;
    const name = data.slice(offset, offset + nameLen).toString('utf8');
    offset += nameLen;
    
    const kind = data[offset++];
    const { value: index, bytesRead: ib } = readLEB128(data, offset);
    offset += ib;
    
    exports.push({ name, kind, index });
    
    const kindNames = { 0: 'func', 1: 'table', 2: 'memory', 3: 'global' };
    console.log(`  ${name}: ${kindNames[kind] || kind} index=${index}`);
  }
  
  return exports;
}

function parseFunctionSection(data) {
  console.log('\n=== Function Section ===\n');
  
  let offset = 0;
  const { value: numFuncs, bytesRead } = readLEB128(data, offset);
  offset += bytesRead;
  
  console.log(`Number of functions: ${numFuncs}`);
  
  const functions = [];
  
  for (let i = 0; i < numFuncs; i++) {
    const { value: typeIndex, bytesRead: tb } = readLEB128(data, offset);
    offset += tb;
    functions.push(typeIndex);
  }
  
  return functions;
}

function parseCodeSection(data, numImports) {
  console.log('\n=== Code Section (Function Bodies) ===\n');
  
  let offset = 0;
  const { value: numBodies, bytesRead } = readLEB128(data, offset);
  offset += bytesRead;
  
  console.log(`Number of function bodies: ${numBodies}`);
  
  const bodies = [];
  
  for (let i = 0; i < numBodies; i++) {
    const { value: bodySize, bytesRead: sb } = readLEB128(data, offset);
    offset += sb;
    
    const bodyStart = offset;
    const bodyData = data.slice(offset, offset + bodySize);
    
    // Parse locals
    let localOffset = 0;
    const { value: numLocalDecls, bytesRead: lb } = readLEB128(bodyData, localOffset);
    localOffset += lb;
    
    let totalLocals = 0;
    for (let j = 0; j < numLocalDecls; j++) {
      const { value: count, bytesRead: cb } = readLEB128(bodyData, localOffset);
      localOffset += cb;
      const type = bodyData[localOffset++];
      totalLocals += count;
    }
    
    const codeStart = localOffset;
    const codeSize = bodySize - codeStart;
    
    bodies.push({
      funcIndex: numImports + i,
      bodySize,
      totalLocals,
      codeSize,
      codeOffset: bodyStart + codeStart,
    });
    
    if (i < 10 || codeSize > 1000) {
      console.log(`  Func ${numImports + i}: size=${bodySize}, locals=${totalLocals}, code=${codeSize} bytes`);
    }
    
    offset += bodySize;
  }
  
  // Find largest functions (likely contain main logic)
  const sortedBySize = [...bodies].sort((a, b) => b.codeSize - a.codeSize);
  console.log('\nLargest functions:');
  for (const body of sortedBySize.slice(0, 10)) {
    console.log(`  Func ${body.funcIndex}: ${body.codeSize} bytes`);
  }
  
  return bodies;
}

function parseDataSection(data) {
  console.log('\n=== Data Section ===\n');
  
  let offset = 0;
  const { value: numSegments, bytesRead } = readLEB128(data, offset);
  offset += bytesRead;
  
  console.log(`Number of data segments: ${numSegments}`);
  
  const segments = [];
  
  for (let i = 0; i < numSegments; i++) {
    const flags = data[offset++];
    
    let memIndex = 0;
    if (flags & 2) {
      const { value: idx, bytesRead: ib } = readLEB128(data, offset);
      offset += ib;
      memIndex = idx;
    }
    
    // Parse init expression (for active segments)
    let initOffset = 0;
    if (!(flags & 1)) {
      // Active segment - has init expression
      const opcode = data[offset++];
      if (opcode === 0x41) { // i32.const
        const { value: val, bytesRead: vb } = readSignedLEB128(data, offset);
        offset += vb;
        initOffset = val;
      }
      const end = data[offset++]; // Should be 0x0b (end)
    }
    
    const { value: dataLen, bytesRead: db } = readLEB128(data, offset);
    offset += db;
    
    const segmentData = data.slice(offset, offset + dataLen);
    offset += dataLen;
    
    segments.push({
      flags,
      memIndex,
      initOffset,
      dataLen,
      data: segmentData,
    });
    
    console.log(`  Segment ${i}: offset=${initOffset}, size=${dataLen}`);
  }
  
  return segments;
}

function extractStrings(segments) {
  console.log('\n=== Extracted Strings ===\n');
  
  const allStrings = [];
  
  for (const segment of segments) {
    const data = segment.data;
    let currentString = '';
    let stringStart = -1;
    
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      if (byte >= 32 && byte < 127) {
        if (stringStart === -1) stringStart = i;
        currentString += String.fromCharCode(byte);
      } else {
        if (currentString.length >= 4) {
          allStrings.push({
            offset: segment.initOffset + stringStart,
            value: currentString,
          });
        }
        currentString = '';
        stringStart = -1;
      }
    }
  }
  
  // Filter and categorize strings
  const cryptoStrings = allStrings.filter(s =>
    /aes|ctr|hmac|cipher|encrypt|decrypt|hash|sha|key|nonce|iv|salt|derive|pbkdf|hkdf|random|seed|block|fixslice/i.test(s.value)
  );
  
  const rustStrings = allStrings.filter(s =>
    s.value.includes('crates.io') || s.value.includes('registry') || s.value.includes('.rs')
  );
  
  const hexStrings = allStrings.filter(s =>
    /^[0-9a-f]{32,}$/i.test(s.value)
  );
  
  console.log('Crypto-related strings:');
  for (const s of cryptoStrings.slice(0, 30)) {
    console.log(`  [${s.offset}] ${s.value.slice(0, 100)}`);
  }
  
  console.log('\nRust crate paths:');
  for (const s of rustStrings.slice(0, 20)) {
    console.log(`  ${s.value.slice(0, 120)}`);
  }
  
  console.log('\nPotential hex keys:');
  for (const s of hexStrings) {
    console.log(`  [${s.offset}] ${s.value}`);
  }
  
  return { allStrings, cryptoStrings, rustStrings, hexStrings };
}

function findEmbeddedKeys(segments) {
  console.log('\n=== Searching for Embedded Keys ===\n');
  
  const potentialKeys = [];
  
  for (const segment of segments) {
    const data = segment.data;
    
    for (let i = 0; i <= data.length - 32; i++) {
      const seq = data.slice(i, i + 32);
      
      // Calculate entropy
      const counts = new Array(256).fill(0);
      for (const byte of seq) counts[byte]++;
      
      let entropy = 0;
      for (const count of counts) {
        if (count > 0) {
          const p = count / 32;
          entropy -= p * Math.log2(p);
        }
      }
      
      // High entropy sequences
      if (entropy > 4.0 && new Set(seq).size > 16) {
        potentialKeys.push({
          offset: segment.initOffset + i,
          entropy,
          hex: seq.toString('hex'),
        });
      }
    }
  }
  
  // Deduplicate
  const seen = new Set();
  const uniqueKeys = potentialKeys.filter(k => {
    if (seen.has(k.hex)) return false;
    seen.add(k.hex);
    return true;
  }).sort((a, b) => b.entropy - a.entropy);
  
  console.log('High-entropy 32-byte sequences (potential keys):');
  for (const key of uniqueKeys.slice(0, 30)) {
    console.log(`  [${key.offset}] entropy=${key.entropy.toFixed(2)} ${key.hex}`);
  }
  
  return uniqueKeys;
}

async function main() {
  console.log('=== Comprehensive WASM Reverse Engineering ===\n');
  
  const buffer = fs.readFileSync(WASM_PATH);
  
  const sections = parseWasm(buffer);
  
  let types = [];
  let imports = [];
  let exports = [];
  let functions = [];
  let bodies = [];
  let dataSegments = [];
  
  if (sections.type && sections.type[0]) {
    types = parseTypeSection(sections.type[0].data);
  }
  
  if (sections.import && sections.import[0]) {
    imports = parseImportSection(sections.import[0].data);
  }
  
  if (sections.export && sections.export[0]) {
    exports = parseExportSection(sections.export[0].data);
  }
  
  if (sections.function && sections.function[0]) {
    functions = parseFunctionSection(sections.function[0].data);
  }
  
  if (sections.code && sections.code[0]) {
    bodies = parseCodeSection(sections.code[0].data, imports.length);
  }
  
  if (sections.data && sections.data[0]) {
    dataSegments = parseDataSection(sections.data[0].data);
  }
  
  // Extract strings and keys
  const strings = extractStrings(dataSegments);
  const keys = findEmbeddedKeys(dataSegments);
  
  // Map exports to functions
  console.log('\n=== Export to Function Mapping ===\n');
  
  for (const exp of exports) {
    if (exp.kind === 0) { // Function
      const funcIndex = exp.index;
      const body = bodies.find(b => b.funcIndex === funcIndex);
      
      if (body) {
        console.log(`${exp.name}: func ${funcIndex}, code size ${body.codeSize} bytes`);
      } else if (funcIndex < imports.length) {
        const imp = imports[funcIndex];
        console.log(`${exp.name}: imported from ${imp.module}.${imp.field}`);
      }
    }
  }
  
  // Save analysis
  const analysis = {
    wasmSize: buffer.length,
    numTypes: types.length,
    numImports: imports.length,
    numExports: exports.length,
    numFunctions: functions.length,
    imports: imports.map(i => `${i.module}.${i.field}`),
    exports: exports.map(e => ({ name: e.name, kind: e.kind, index: e.index })),
    largestFunctions: bodies.sort((a, b) => b.codeSize - a.codeSize).slice(0, 20),
    cryptoStrings: strings.cryptoStrings.slice(0, 50),
    potentialKeys: keys.slice(0, 30),
  };
  
  const analysisPath = path.join(OUTPUT_DIR, 'full-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`\nFull analysis saved to ${analysisPath}`);
  
  // Summary
  console.log('\n=== Summary ===\n');
  console.log(`Total functions: ${imports.length + functions.length}`);
  console.log(`  - Imported: ${imports.length}`);
  console.log(`  - Defined: ${functions.length}`);
  console.log(`Exports: ${exports.length}`);
  console.log(`Data segments: ${dataSegments.length}`);
  console.log(`Potential embedded keys: ${keys.length}`);
}

main().catch(console.error);
