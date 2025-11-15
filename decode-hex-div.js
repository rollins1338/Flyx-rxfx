const hexData = '946844e7f35848:7d7g325252525f596:627:768:41696966765442866d5568786362724566484f55464e746366';

console.log('Hex data:', hexData);
console.log('\nSplitting by colon:');

const parts = hexData.split(':');
parts.forEach((part, i) => {
  console.log(`\nPart ${i}: ${part}`);
  
  // Try hex decode
  try {
    const decoded = Buffer.from(part, 'hex').toString('utf8');
    console.log(`  Hex decoded: ${decoded}`);
  } catch (e) {
    console.log(`  Hex decode failed: ${e.message}`);
  }
});
