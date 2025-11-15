const fs = require('fs');

/**
 * Takes the intercepted data and reproduces the decoder locally
 * This will systematically try to replicate each transformation step
 */

function reproduceDecoderLocally() {
  console.log('🔧 REPRODUCING DECODER LOCALLY');
  console.log('=' .repeat(50));

  // Load intercepted data
  if (!fs.existsSync('nuclear-intercept-data.json')) {
    console.error('❌ Run NUCLEAR-PRORCP-REVERSE-ENGINEER.js first!');
    return;
  }

  const data = JSON.parse(fs.readFileSync('nuclear-intercept-data.json', 'utf8'));
  
  console.log('\n📦 Loaded intercepted data:');
  console.log('   Div ID:', data.divId);
  console.log('   Encoded content length:', data.encodedContent?.length);
  console.log('   Transformations captured:', data.transformations?.length);
  console.log('   Final result:', data.finalResult?.url || 'Not found');

  if (!data.encodedContent) {
    console.error('❌ No encoded content found!');
    return;
  }

  const encoded = data.encodedContent;
  console.log('\n🎯 Starting decoding process...');
  console.log('   Input:', encoded.substring(0, 100) + '...');

  // Analyze the transformation sequence
  if (data.transformations && data.transformations.length > 0) {
    console.log('\n📊 Transformation sequence:');
    data.transformations.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.type}`);
    });

    // Try to reproduce the sequence
    console.log('\n🔄 Attempting to reproduce transformations...');
    reproduceTransformationSequence(encoded, data.transformations);
  }

  // Try all known decoding methods
  console.log('\n🧪 Testing all known decoding methods...');
  testAllDecodingMethods(encoded, data.divId);

  // If we have the decoder script, analyze it
  if (data.decoderScript) {
    console.log('\n🔬 Analyzing decoder script for patterns...');
    extractDecoderLogic(data.decoderScript, data.divId);
  }
}

function reproduceTransformationSequence(input, transformations) {
  let current = input;
  
  for (let i = 0; i < transformations.length; i++) {
    const t = transformations[i];
    console.log(`\n   Step ${i + 1}: ${t.type}`);
    
    try {
      switch (t.type) {
        case 'atob':
          // Base64 decode
          current = Buffer.from(current, 'base64').toString('utf8');
          console.log('      ✅ Base64 decoded');
          console.log('      Result sample:', current.substring(0, 100));
          break;
          
        case 'btoa':
          // Base64 encode
          current = Buffer.from(current).toString('base64');
          console.log('      ✅ Base64 encoded');
          break;
          
        case 'charCodeAt':
          console.log('      ℹ️  Character code operation detected');
          break;
          
        case 'fromCharCode':
          console.log('      ℹ️  Character construction detected');
          break;
      }
    } catch (e) {
      console.log('      ❌ Failed:', e.message);
    }
  }
  
  return current;
}

function testAllDecodingMethods(encoded, divId) {
  const methods = [
    {
      name: 'Direct Base64',
      fn: (s) => Buffer.from(s, 'base64').toString('utf8')
    },
    {
      name: 'URL-safe Base64',
      fn: (s) => {
        const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        return Buffer.from(padded, 'base64').toString('utf8');
      }
    },
    {
      name: 'Reverse then Base64',
      fn: (s) => {
        const reversed = s.split('').reverse().join('');
        return Buffer.from(reversed, 'base64').toString('utf8');
      }
    },
    {
      name: 'XOR with divId',
      fn: (s) => {
        const key = divId || 'default';
        let result = '';
        for (let i = 0; i < s.length; i++) {
          result += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
      }
    },
    {
      name: 'Caesar shift +3',
      fn: (s) => {
        return s.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 3)).join('');
      }
    },
    {
      name: 'Caesar shift -3',
      fn: (s) => {
        return s.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join('');
      }
    },
    {
      name: 'Hex decode',
      fn: (s) => {
        if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error('Not hex');
        return Buffer.from(s, 'hex').toString('utf8');
      }
    },
    {
      name: 'Base64 + XOR',
      fn: (s) => {
        const decoded = Buffer.from(s, 'base64').toString('utf8');
        const key = divId || 'default';
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
          result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
      }
    },
    {
      name: 'URL-safe Base64 + XOR',
      fn: (s) => {
        const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        const key = divId || 'default';
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
          result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
      }
    }
  ];

  methods.forEach(method => {
    try {
      const result = method.fn(encoded);
      
      // Check if result looks like a URL or JSON
      const looksLikeUrl = /https?:\/\//.test(result);
      const looksLikeJson = result.trim().startsWith('{') || result.trim().startsWith('[');
      const looksLikeM3u8 = /\.m3u8/.test(result);
      
      if (looksLikeUrl || looksLikeJson || looksLikeM3u8) {
        console.log(`\n   ✅ ${method.name} - LOOKS PROMISING!`);
        console.log('      Result:', result.substring(0, 200));
        
        // Save promising results
        fs.writeFileSync(`decoded-${method.name.replace(/\s+/g, '-').toLowerCase()}.txt`, result);
      } else {
        console.log(`   ❌ ${method.name} - No match`);
      }
    } catch (e) {
      console.log(`   ❌ ${method.name} - Error: ${e.message}`);
    }
  });
}

function extractDecoderLogic(script, divId) {
  console.log('\n🔍 Extracting decoder logic patterns...');
  
  // Find the main decoding logic
  const patterns = {
    xorWithConstant: script.match(/charCodeAt\([^)]+\)\s*\^\s*(\d+)/),
    xorWithVariable: script.match(/charCodeAt\([^)]+\)\s*\^\s*(\w+)/),
    addConstant: script.match(/charCodeAt\([^)]+\)\s*\+\s*(\d+)/),
    subtractConstant: script.match(/charCodeAt\([^)]+\)\s*-\s*(\d+)/),
    modulo: script.match(/charCodeAt\([^)]+\)\s*%\s*(\d+)/),
    divIdUsage: script.match(new RegExp(`getElementById\\s*\\(\\s*["']${divId}["']\\s*\\)\\s*\\.\\s*(\\w+)`, 'g'))
  };

  console.log('\n   Patterns found:');
  Object.entries(patterns).forEach(([name, match]) => {
    if (match) {
      console.log(`   ✅ ${name}:`, match[0] || match);
    }
  });

  // Try to extract the exact transformation
  if (patterns.xorWithConstant) {
    const xorValue = parseInt(patterns.xorWithConstant[1]);
    console.log(`\n   🎯 Found XOR with constant: ${xorValue}`);
    console.log('   Attempting to decode...');
    
    // This would be the actual decoder implementation
    // We'll create it based on the patterns found
  }

  // Look for character mapping arrays
  const arrayPattern = script.match(/\[["'][^"']+["']\s*(?:,\s*["'][^"']+["']\s*)*\]/g);
  if (arrayPattern) {
    console.log(`\n   ✅ Found ${arrayPattern.length} array(s) - possible character mappings`);
    arrayPattern.slice(0, 3).forEach((arr, i) => {
      console.log(`      Array ${i + 1}:`, arr.substring(0, 100));
    });
  }

  // Save extracted patterns
  fs.writeFileSync('decoder-patterns.json', JSON.stringify(patterns, null, 2));
  console.log('\n   💾 Saved patterns to decoder-patterns.json');
}

// Run it
reproduceDecoderLocally();
