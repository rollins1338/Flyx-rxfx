/**
 * Decode the fresh content using the discovered algorithm
 */

async function main() {
  const content = await Bun.file('debug-content-fresh.txt').text();
  
  console.log('Content length:', content.length);
  console.log('Content start:', content.substring(0, 50));
  
  // Reverse + base64 + subtract 3
  let reversed = content.trim().split('').reverse().join('');
  reversed = reversed.replace(/-/g, '+').replace(/_/g, '/');
  while (reversed.length % 4 !== 0) reversed += '=';
  
  const decoded = Buffer.from(reversed, 'base64').toString('binary');
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) - 3);
  }
  
  console.log('\nDecoded length:', result.length);
  console.log('Has https:', result.includes('https'));
  console.log('Has m3u8:', result.includes('m3u8'));
  
  // Extract URLs
  const urls = result.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g) || [];
  console.log('\nFound', urls.length, 'm3u8 URLs:');
  urls.slice(0, 5).forEach((url, i) => console.log((i+1) + '.', url.substring(0, 120)));
  
  // Save decoded content
  await Bun.write('debug-decoded-fresh.txt', result);
  console.log('\nSaved decoded content to debug-decoded-fresh.txt');
}

main().catch(console.error);
