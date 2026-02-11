#!/usr/bin/env node
/**
 * Test Flixer variant stream (the actual video segments playlist)
 */

const CF_WORKER = 'https://media-proxy.vynx.workers.dev';

async function main() {
  // Extract Fight Club
  const r = await fetch(`${CF_WORKER}/flixer/extract?tmdbId=550&type=movie&server=alpha`, { signal: AbortSignal.timeout(20000) });
  const d = await r.json();
  if (!d.success) { console.log('Extract failed:', d.error); return; }
  
  const masterUrl = d.sources[0].url;
  console.log('Master URL:', masterUrl.substring(0, 80));
  
  // Fetch master via /animekai proxy
  const masterResp = await fetch(`${CF_WORKER}/animekai?url=${encodeURIComponent(masterUrl)}`, { signal: AbortSignal.timeout(10000) });
  const masterBody = await masterResp.text();
  console.log('\nMaster playlist:');
  console.log(masterBody);
  
  // Extract variant URL from master
  const lines = masterBody.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length === 0) { console.log('No variant URLs found'); return; }
  
  const variantUrl = lines[0].trim();
  console.log('\nVariant URL:', variantUrl.substring(0, 120));
  
  // Fetch variant playlist
  const variantResp = await fetch(variantUrl, { signal: AbortSignal.timeout(10000) });
  console.log(`Variant status: ${variantResp.status} ${variantResp.headers.get('content-type')}`);
  if (variantResp.ok) {
    const variantBody = await variantResp.text();
    console.log(`Variant length: ${variantBody.length}`);
    console.log('First 500 chars:');
    console.log(variantBody.substring(0, 500));
  }
}

main().catch(console.error);
