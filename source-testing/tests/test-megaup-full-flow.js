// Test full MegaUp HLS flow - master playlist -> variant playlist -> segment
const masterUrl = 'https://rrr.app28base.site/prjp/c5/h6a90f70b8d237f94866b6cfc2c7906afdb8423c6639e9e32ed74333737fd2eb5ef039b8cb9be75c7c50ae72297d2e407621d79152e890fea1284d59d53a146e35d/list,Ktm0Vt9-cJyXbGG_O3gV_5vGK-kpiQ.m3u8';

async function test() {
  console.log('=== Step 1: Fetch master playlist ===');
  
  const masterRes = await fetch(masterUrl);
  console.log('Status:', masterRes.status);
  console.log('CORS:', masterRes.headers.get('access-control-allow-origin'));
  
  const masterContent = await masterRes.text();
  console.log('\nMaster playlist:');
  console.log(masterContent);
  
  // Parse variant playlist URLs
  const lines = masterContent.split('\n');
  const variantUrls = lines.filter(l => l.trim() && !l.startsWith('#'));
  
  if (variantUrls.length === 0) {
    console.log('No variant playlists found!');
    return;
  }
  
  // Build absolute URL for first variant
  const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  const variantPath = variantUrls[0].trim();
  const variantUrl = variantPath.startsWith('http') ? variantPath : baseUrl + variantPath;
  
  console.log('\n=== Step 2: Fetch variant playlist ===');
  console.log('URL:', variantUrl);
  
  const variantRes = await fetch(variantUrl);
  console.log('Status:', variantRes.status);
  console.log('CORS:', variantRes.headers.get('access-control-allow-origin'));
  
  if (!variantRes.ok) {
    console.log('Failed to fetch variant playlist!');
    const text = await variantRes.text();
    console.log('Response:', text.substring(0, 500));
    return;
  }
  
  const variantContent = await variantRes.text();
  console.log('\nVariant playlist (first 500 chars):');
  console.log(variantContent.substring(0, 500));
  
  // Find first segment
  const segmentLines = variantContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (segmentLines.length === 0) {
    console.log('No segments found!');
    return;
  }
  
  const variantBase = variantUrl.substring(0, variantUrl.lastIndexOf('/') + 1);
  const segmentPath = segmentLines[0].trim();
  const segmentUrl = segmentPath.startsWith('http') ? segmentPath : variantBase + segmentPath;
  
  console.log('\n=== Step 3: Fetch first segment ===');
  console.log('URL:', segmentUrl);
  
  const segmentRes = await fetch(segmentUrl, { method: 'HEAD' });
  console.log('Status:', segmentRes.status);
  console.log('CORS:', segmentRes.headers.get('access-control-allow-origin'));
  console.log('Content-Type:', segmentRes.headers.get('content-type'));
  
  if (segmentRes.ok) {
    console.log('\n✓ Full HLS flow works! Browser can fetch directly.');
  } else {
    console.log('\n✗ Segment fetch failed - may need proxy');
  }
}

test().catch(e => console.log('Error:', e.message));
