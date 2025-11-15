/**
 * ANALYZE THE RCP REQUEST FLOW
 * Extract and decode the hash that's sent to cloudnestra.com/rcp/
 */

const fs = require('fs');

// Read the trace data
const traceData = JSON.parse(fs.readFileSync('divid-to-m3u8-trace.json', 'utf8'));

console.log('🔍 Analyzing RCP request flow...\n');

// Find the RCP request
const rcpRequests = traceData.networkRequests.filter(req => 
  req.url && req.url.includes('cloudnestra.com/rcp/')
);

if (rcpRequests.length === 0) {
  console.log('❌ No RCP requests found!');
  process.exit(1);
}

console.log(`✅ Found ${rcpRequests.length} RCP request(s)\n`);

rcpRequests.forEach((req, index) => {
  console.log(`\n[${index + 1}] RCP Request:`);
  console.log('URL:', req.url);
  
  // Extract the hash from the URL
  const urlParts = req.url.split('/rcp/');
  if (urlParts.length > 1) {
    const encodedHash = urlParts[1];
    console.log('\n📦 Encoded Hash:');
    console.log('Length:', encodedHash.length);
    console.log('First 100 chars:', encodedHash.substring(0, 100));
    console.log('Last 100 chars:', encodedHash.substring(encodedHash.length - 100));
    
    // Try to decode it
    console.log('\n🔓 Attempting to decode...');
    
    try {
      // It looks like URL-safe base64
      const base64 = encodedHash.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      
      console.log('\n✅ Decoded (first 200 chars):');
      console.log(decoded.substring(0, 200));
      
      console.log('\n✅ Decoded (last 200 chars):');
      console.log(decoded.substring(decoded.length - 200));
      
      // Save the full decoded content
      fs.writeFileSync('rcp-hash-decoded.txt', decoded);
      console.log('\n💾 Full decoded content saved to rcp-hash-decoded.txt');
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(decoded);
        console.log('\n✅ Decoded content is valid JSON:');
        console.log(JSON.stringify(json, null, 2));
        fs.writeFileSync('rcp-hash-decoded.json', JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('\n❌ Decoded content is not JSON');
        
        // Check if it contains a colon (key:value format)
        if (decoded.includes(':')) {
          console.log('\n🔍 Found colon-separated data');
          const parts = decoded.split(':');
          console.log(`Parts: ${parts.length}`);
          parts.forEach((part, i) => {
            console.log(`  [${i}] ${part.substring(0, 50)}...`);
          });
        }
      }
      
    } catch (e) {
      console.log('❌ Failed to decode:', e.message);
    }
  }
});

// Now let's look for the div that contains this hash
console.log('\n\n🔍 Looking for the source div...');
if (traceData.divId && traceData.divContent) {
  console.log(`\n✅ Found div: ${traceData.divId}`);
  console.log(`Content length: ${traceData.divContent.length}`);
  console.log(`Content preview: ${traceData.divContent.substring(0, 200)}...`);
  
  fs.writeFileSync('div-content.txt', traceData.divContent);
  console.log('💾 Div content saved to div-content.txt');
  
  // Check if the div content matches the RCP hash
  const rcpHash = rcpRequests[0].url.split('/rcp/')[1];
  if (traceData.divContent.includes(rcpHash.substring(0, 50))) {
    console.log('\n✅ Div content contains the RCP hash!');
  } else {
    console.log('\n❌ Div content does NOT directly contain the RCP hash');
    console.log('   This means the hash is generated/transformed from the div content');
  }
} else {
  console.log('❌ No hidden div found in trace');
}

console.log('\n\n📊 Summary:');
console.log('1. Page loads with a hidden div containing encoded data');
console.log('2. JavaScript processes this div content');
console.log('3. A request is made to cloudnestra.com/rcp/ with a hash');
console.log('4. The hash appears to be base64-encoded');
console.log('5. Need to find the JavaScript that transforms div content -> RCP hash');
