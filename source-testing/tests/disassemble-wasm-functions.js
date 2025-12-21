/**
 * Disassemble Key WASM Functions
 * 
 * Focus on:
 * - Function 52 (largest - likely main decryption)
 * - Function 57 (get_img_key)
 * - Function 132 (process_img_data wrapper)
 * - Functions called by these
 */

const fs = require('fs');
const path = require('path');

const WASM_PATH = 'source-testing/tests/wasm-analysis/img_data_bg.wasm';
const OUTPUT_DIR = 'source-testing/tests/wasm-analysis';

// WASM opcodes
const OPCODES = {
  0x00: 'unreachable',
  0x01: 'nop',
  0x02: 'block',
  0x03: 'loop',
  0x04: 'if',
  0x05: 'else',
  0x0b: 'end',
  0x0c: 'br',
  0x0d: 'br_if',
  0x0e: 'br_table',
  0x0f: 'return',
  0x10: 'call',
  0x11: 'call_indirect',
  0x1a: 'drop',
  0x1b: 'select',
  0x20: 'local.get',
  0x21: 'local.set',
  0x22: 'local.tee',
  0x23: 'global.get',
  0x24: 'global.set',
  0x28: 'i32.load',
  0x29: 'i64.load',
  0x2a: 'f32.load',
  0x2b: 'f64.load',
  0x2c: 'i32.load8_s',
  0x2d: 'i32.load8_u',
  0x2e: 'i32.load16_s',
  0x2f: 'i32.load16_u',
  0x30: 'i64.load8_s',
  0x31: 'i64.load8_u',
  0x32: 'i64.load16_s',
  0x33: 'i64.load16_u',
  0x34: 'i64.load32_s',
  0x35: 'i64.load32_u',
  0x36: 'i32.store',
  0x37: 'i64.store',
  0x38: 'f32.store',
  0x39: 'f64.store',
  0x3a: 'i32.store8',
  0x3b: 'i32.store16',
  0x3c: 'i64.store8',
  0x3d: 'i64.store16',
  0x3e: 'i64.store32',
  0x3f: 'memory.size',
  0x40: 'memory.grow',
  0x41: 'i32.const',
  0x42: 'i64.const',
  0x43: 'f32.const',
  0x44: 'f64.const',
  0x45: 'i32.eqz',
  0x46: 'i32.eq',
  0x47: 'i32.ne',
  0x48: 'i32.lt_s',
  0x49: 'i32.lt_u',
  0x4a: 'i32.gt_s',
  0x4b: 'i32.gt_u',
  0x4c: 'i32.le_s',
  0x4d: 'i32.le_u',
  0x4e: 'i32.ge_s',
  0x4f: 'i32.ge_u',
  0x50: 'i64.eqz',
  0x51: 'i64.eq',
  0x52: 'i64.ne',
  0x53: 'i64.lt_s',
  0x54: 'i64.lt_u',
  0x55: 'i64.gt_s',
  0x56: 'i64.gt_u',
  0x57: 'i64.le_s',
  0x58: 'i64.le_u',
  0x59: 'i64.ge_s',
  0x5a: 'i64.ge_u',
  0x67: 'i32.clz',
  0x68: 'i32.ctz',
  0x69: 'i32.popcnt',
  0x6a: 'i32.add',
  0x6b: 'i32.sub',
  0x6c: 'i32.mul',
  0x6d: 'i32.div_s',
  0x6e: 'i32.div_u',
  0x6f: 'i32.rem_s',
  0x70: 'i32.rem_u',
  0x71: 'i32.and',
  0x72: 'i32.or',
  0x73: 'i32.xor',
  0x74: 'i32.shl',
  0x75: 'i32.shr_s',
  0x76: 'i32.shr_u',
  0x77: 'i32.rotl',
  0x78: 'i32.rotr',
  0x79: 'i64.clz',
  0x7a: 'i64.ctz',
  0x7b: 'i64.popcnt',
  0x7c: 'i64.add',
  0x7d: 'i64.sub',
  0x7e: 'i64.mul',
  0x7f: 'i64.div_s',
  0x80: 'i64.div_u',
  0x81: 'i64.rem_s',
  0x82: 'i64.rem_u',
  0x83: 'i64.and',
  0x84: 'i64.or',
  0x85: 'i64.xor',
  0x86: 'i64.shl',
  0x87: 'i64.shr_s',
  0x88: 'i64.shr_u',
  0x89: 'i64.rotl',
  0x8a: 'i64.rotr',
  0xa7: 'i32.wrap_i64',
  0xac: 'i64.extend_i32_s',
  0xad: 'i64.extend_i32_u',
};

function readLEB128(buffer, offset) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  let byte;
  
  do {
    byte = buffer[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    bytesRead++;
  } while (byte & 0x80);
  
  return { value: result, bytesRead };
}

function readSignedLEB128(buffer, offset) {
  let result = 0;
  let shift = 0;
  let bytesRead = 0;
  let byte;
  
  do {
    byte = buffer[offset + bytesRead];
    result |= (byte & 0x7f) << shift;
    shift += 7;
    bytesRead++;
  } while (byte & 0x80);
  
  if (shift < 32 && (byte & 0x40)) {
    result |= (~0 << shift);
  }
  
  return { value: result, bytesRead };
}

function disassembleFunction(code, funcIndex, imports) {
  const instructions = [];
  let offset = 0;
  let depth = 0;
  const callTargets = new Set();
  
  while (offset < code.length) {
    const opcode = code[offset];
    const startOffset = offset;
    offset++;
    
    let instruction = OPCODES[opcode] || `unknown_0x${opcode.toString(16)}`;
    let operand = null;
    
    // Handle operands
    if (opcode === 0x02 || opcode === 0x03 || opcode === 0x04) {
      // block, loop, if - have block type
      const blockType = code[offset++];
      operand = blockType === 0x40 ? 'void' : `type_${blockType}`;
      depth++;
    } else if (opcode === 0x05) {
      // else
    } else if (opcode === 0x0b) {
      // end
      depth = Math.max(0, depth - 1);
    } else if (opcode === 0x0c || opcode === 0x0d) {
      // br, br_if
      const { value, bytesRead } = readLEB128(code, offset);
      offset += bytesRead;
      operand = value;
    } else if (opcode === 0x0e) {
      // br_table
      const { value: count, bytesRead: cb } = readLEB128(code, offset);
      offset += cb;
      const targets = [];
      for (let i = 0; i <= count; i++) {
        const { value: target, bytesRead: tb } = readLEB128(code, offset);
        offset += tb;
        targets.push(target);
      }
      operand = targets;
    } else if (opcode === 0x10) {
      // call
      const { value, bytesRead } = readLEB128(code, offset);
      offset += bytesRead;
      operand = value;
      callTargets.add(value);
      
      // Add function name if it's an import
      if (value < imports.length) {
        instruction += ` ; ${imports[value]}`;
      }
    } else if (opcode === 0x11) {
      // call_indirect
      const { value: typeIdx, bytesRead: tb } = readLEB128(code, offset);
      offset += tb;
      const { value: tableIdx, bytesRead: tib } = readLEB128(code, offset);
      offset += tib;
      operand = { type: typeIdx, table: tableIdx };
    } else if (opcode >= 0x20 && opcode <= 0x24) {
      // local.get, local.set, local.tee, global.get, global.set
      const { value, bytesRead } = readLEB128(code, offset);
      offset += bytesRead;
      operand = value;
    } else if (opcode >= 0x28 && opcode <= 0x3e) {
      // memory instructions
      const { value: align, bytesRead: ab } = readLEB128(code, offset);
      offset += ab;
      const { value: memOffset, bytesRead: ob } = readLEB128(code, offset);
      offset += ob;
      operand = { align, offset: memOffset };
    } else if (opcode === 0x3f || opcode === 0x40) {
      // memory.size, memory.grow
      offset++; // memory index (always 0)
    } else if (opcode === 0x41) {
      // i32.const
      const { value, bytesRead } = readSignedLEB128(code, offset);
      offset += bytesRead;
      operand = value;
    } else if (opcode === 0x42) {
      // i64.const
      const { value, bytesRead } = readSignedLEB128(code, offset);
      offset += bytesRead;
      operand = value;
    } else if (opcode === 0x43) {
      // f32.const
      operand = code.readFloatLE(offset);
      offset += 4;
    } else if (opcode === 0x44) {
      // f64.const
      operand = code.readDoubleLE(offset);
      offset += 8;
    }
    
    instructions.push({
      offset: startOffset,
      opcode,
      instruction,
      operand,
      depth,
    });
  }
  
  return { instructions, callTargets: Array.from(callTargets) };
}

function analyzeCallGraph(funcIndex, allFunctions, imports, visited = new Set()) {
  if (visited.has(funcIndex)) return [];
  visited.add(funcIndex);
  
  const func = allFunctions.get(funcIndex);
  if (!func) return [];
  
  const calls = [];
  for (const target of func.callTargets) {
    const targetName = target < imports.length 
      ? imports[target] 
      : `func_${target}`;
    
    calls.push({
      from: funcIndex,
      to: target,
      name: targetName,
    });
    
    // Recursively analyze called functions (limit depth)
    if (target >= imports.length && visited.size < 50) {
      calls.push(...analyzeCallGraph(target, allFunctions, imports, visited));
    }
  }
  
  return calls;
}

async function main() {
  console.log('=== WASM Function Disassembly ===\n');
  
  const buffer = fs.readFileSync(WASM_PATH);
  
  // Parse sections to find code
  let offset = 8;
  let codeSection = null;
  let importSection = null;
  
  while (offset < buffer.length) {
    const sectionId = buffer[offset++];
    const { value: size, bytesRead } = readLEB128(buffer, offset);
    offset += bytesRead;
    
    if (sectionId === 2) {
      importSection = buffer.slice(offset, offset + size);
    } else if (sectionId === 10) {
      codeSection = buffer.slice(offset, offset + size);
    }
    
    offset += size;
  }
  
  // Parse imports
  const imports = [];
  if (importSection) {
    let ioff = 0;
    const { value: numImports, bytesRead: ib } = readLEB128(importSection, ioff);
    ioff += ib;
    
    for (let i = 0; i < numImports; i++) {
      const { value: moduleLen, bytesRead: mb } = readLEB128(importSection, ioff);
      ioff += mb;
      const moduleName = importSection.slice(ioff, ioff + moduleLen).toString('utf8');
      ioff += moduleLen;
      
      const { value: fieldLen, bytesRead: fb } = readLEB128(importSection, ioff);
      ioff += fb;
      const fieldName = importSection.slice(ioff, ioff + fieldLen).toString('utf8');
      ioff += fieldLen;
      
      const kind = importSection[ioff++];
      if (kind === 0) {
        const { value: typeIdx, bytesRead: tb } = readLEB128(importSection, ioff);
        ioff += tb;
      } else if (kind === 1) {
        ioff += 3;
      } else if (kind === 2) {
        const flags = importSection[ioff++];
        const { value: initial, bytesRead: inb } = readLEB128(importSection, ioff);
        ioff += inb;
        if (flags & 1) {
          const { value: max, bytesRead: maxb } = readLEB128(importSection, ioff);
          ioff += maxb;
        }
      } else if (kind === 3) {
        ioff += 2;
      }
      
      imports.push(`${moduleName}.${fieldName}`);
    }
  }
  
  console.log(`Imports: ${imports.length}`);
  
  // Parse code section
  const allFunctions = new Map();
  
  if (codeSection) {
    let coff = 0;
    const { value: numBodies, bytesRead: nb } = readLEB128(codeSection, coff);
    coff += nb;
    
    console.log(`Function bodies: ${numBodies}\n`);
    
    for (let i = 0; i < numBodies; i++) {
      const funcIndex = imports.length + i;
      const { value: bodySize, bytesRead: sb } = readLEB128(codeSection, coff);
      coff += sb;
      
      const bodyData = codeSection.slice(coff, coff + bodySize);
      
      // Skip locals
      let localOff = 0;
      const { value: numLocalDecls, bytesRead: lb } = readLEB128(bodyData, localOff);
      localOff += lb;
      
      for (let j = 0; j < numLocalDecls; j++) {
        const { value: count, bytesRead: cb } = readLEB128(bodyData, localOff);
        localOff += cb;
        localOff++; // type
      }
      
      const code = bodyData.slice(localOff);
      const { instructions, callTargets } = disassembleFunction(code, funcIndex, imports);
      
      allFunctions.set(funcIndex, {
        index: funcIndex,
        size: bodySize,
        codeSize: code.length,
        instructions,
        callTargets,
      });
      
      coff += bodySize;
    }
  }
  
  // Analyze key functions
  const keyFunctions = [52, 57, 132]; // Main decryption, get_img_key, process_img_data
  
  for (const funcIdx of keyFunctions) {
    const func = allFunctions.get(funcIdx);
    if (!func) continue;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Function ${funcIdx} (${func.codeSize} bytes)`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Show call targets
    console.log('Calls to:');
    for (const target of func.callTargets) {
      const name = target < imports.length ? imports[target] : `func_${target}`;
      console.log(`  ${target}: ${name}`);
    }
    
    // Show first 100 instructions
    console.log('\nFirst 100 instructions:');
    for (const inst of func.instructions.slice(0, 100)) {
      const indent = '  '.repeat(inst.depth);
      const operandStr = inst.operand !== null 
        ? ` ${typeof inst.operand === 'object' ? JSON.stringify(inst.operand) : inst.operand}`
        : '';
      console.log(`  ${inst.offset.toString().padStart(4)}: ${indent}${inst.instruction}${operandStr}`);
    }
    
    if (func.instructions.length > 100) {
      console.log(`  ... and ${func.instructions.length - 100} more instructions`);
    }
  }
  
  // Analyze call graph from process_img_data
  console.log('\n=== Call Graph from process_img_data (func 132) ===\n');
  
  const callGraph = analyzeCallGraph(132, allFunctions, imports);
  const uniqueCalls = new Map();
  for (const call of callGraph) {
    const key = `${call.from}->${call.to}`;
    if (!uniqueCalls.has(key)) {
      uniqueCalls.set(key, call);
    }
  }
  
  for (const call of uniqueCalls.values()) {
    console.log(`  func_${call.from} -> ${call.name}`);
  }
  
  // Find functions that look like AES operations
  console.log('\n=== Functions with XOR operations (potential crypto) ===\n');
  
  for (const [idx, func] of allFunctions) {
    const xorCount = func.instructions.filter(i => 
      i.instruction === 'i32.xor' || i.instruction === 'i64.xor'
    ).length;
    
    if (xorCount > 20) {
      console.log(`  func_${idx}: ${xorCount} XOR operations, ${func.codeSize} bytes`);
    }
  }
  
  // Find functions with many memory operations (likely data processing)
  console.log('\n=== Functions with heavy memory access ===\n');
  
  for (const [idx, func] of allFunctions) {
    const loadCount = func.instructions.filter(i => 
      i.instruction.includes('load')
    ).length;
    const storeCount = func.instructions.filter(i => 
      i.instruction.includes('store')
    ).length;
    
    if (loadCount + storeCount > 100) {
      console.log(`  func_${idx}: ${loadCount} loads, ${storeCount} stores, ${func.codeSize} bytes`);
    }
  }
  
  // Save detailed analysis
  const detailedAnalysis = {
    imports,
    keyFunctions: keyFunctions.map(idx => {
      const func = allFunctions.get(idx);
      return {
        index: idx,
        size: func?.codeSize,
        callTargets: func?.callTargets,
        instructionCount: func?.instructions.length,
      };
    }),
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'disassembly-analysis.json'),
    JSON.stringify(detailedAnalysis, null, 2)
  );
  
  console.log('\nAnalysis complete.');
}

main().catch(console.error);
