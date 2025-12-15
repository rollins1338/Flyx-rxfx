/**
 * Test 1movies CDN proxy routing
 * Verifies that 1movies CDN URLs are correctly detected and routed through residential proxy
 */

// Simulate the is1moviesCdnUrl function
function is1moviesCdnUrl(url) {
  // 1movies CDN domains - Cloudflare Workers that block datacenter IPs
  // Pattern: p.XXXXX.workers.dev (e.g., p.10014.workers.dev)
  if (url.includes('.workers.dev')) {
    // Check for 1movies-specific patterns
    if (url.includes('p.') && url.match(/p\.\d+\.workers\.dev/)) {
      return true;
    }
    // Also check for other 1movies CDN patterns
    if (url.includes('dewshine') || url.includes('afc7d47f')) {
      return true;
    }
  }
  
  return false;
}

// Test URLs from the error logs
const testUrls = [
  // 1movies Alpha server CDN
  'https://p.10014.workers.dev/dewshine74.xyz/file2/itbsfrziFCxJ36DZiDwOwp18j4zvp0ZcvitXkO8XJq5gaGxb8tev5V4Ote7rsHUFRogPabPvS1v7DQJR6ueiVbLm+lkKwlBaSo~f9KWF3ad9WeSflAHkO8~Sn5F6UokWwuzZrIRIxcE0gIs+Jxoh+1jTJ7C430UJAs3Fllidoiw=/cGxheWxpc3QubTN1OA==.m3u8',
  
  // 1movies Charlie server CDN
  'https://p.10014.workers.dev/afc7d47f/uz5gyMPGU9TVujalv1-l0hGOWo2yv0pHwgeHIx8ekYbwZst7x4Mr2atrjDc9ULei1ZeVVE-i86PE55rMl-_nDOY3s_D65EFlXfFSW3E8cB3GwbyPB3HdIptT1un8EEzkPs_ONQeK6rh4F9FyFagGZUZ5VGacRJDwTVa-PAZlKV7PfU5lt6RBv35PXpm8D-BUiY3r8rFXI6i_olpPuk8Creu_NoCnSHctTDPeie_EodKkJsF8xbKchmmiMyucXW7IIoGv7dxNBDVwCcFRJ9p7iOeZ__Fn0tlAHt8v-j_tMUw9Xf0l_R7KcEk3Cy0WMDN-qwNJ7vu-QTcYszQKiE-nTfqzU3IqM9qYJgG1dobAv-HgWFCR0Hj1xi9X0i9I8oNB37FyN7wONxpfE8ZivyCmJw.m3u8',
  
  // Other workers.dev URLs (should NOT match)
  'https://one.juicy-marble.workers.dev/stormgleam42.xyz/file2/test.m3u8',
  
  // Non-1movies URLs (should NOT match)
  'https://example.com/video.m3u8',
  'https://megaup.net/video.m3u8',
];

console.log('Testing 1movies CDN URL detection:\n');

testUrls.forEach(url => {
  const is1movies = is1moviesCdnUrl(url);
  const shortUrl = url.length > 80 ? url.substring(0, 80) + '...' : url;
  console.log(`${is1movies ? '✓' : '✗'} ${is1movies ? '1movies CDN' : 'NOT 1movies'}: ${shortUrl}`);
});

console.log('\n✅ Test complete!');
console.log('\nExpected results:');
console.log('- First 2 URLs (p.10014.workers.dev) should be detected as 1movies CDN');
console.log('- Third URL (juicy-marble.workers.dev) should NOT be detected (videasy CDN)');
console.log('- Last 2 URLs should NOT be detected');
