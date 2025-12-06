/**
 * Test the VidSrc extractor end-to-end
 */

// Import the extractor
import { extractVidSrcStreams, VIDSRC_ENABLED } from '../app/lib/services/vidsrc-extractor';

async function main() {
  console.log('='.repeat(70));
  console.log('VIDSRC EXTRACTOR TEST');
  console.log('='.repeat(70));
  
  console.log(`\nVIDSRC_ENABLED: ${VIDSRC_ENABLED}`);
  
  if (!VIDSRC_ENABLED) {
    console.log('\n⚠️  VidSrc is disabled. Set ENABLE_VIDSRC_PROVIDER=true to test.');
    console.log('Running with env override...\n');
    process.env.ENABLE_VIDSRC_PROVIDER = 'true';
  }
  
  // Test with FNAF 2 (movie)
  const tmdbId = '1228246';
  console.log(`\nTesting movie extraction for TMDB ID: ${tmdbId}`);
  
  const result = await extractVidSrcStreams(tmdbId, 'movie');
  
  console.log('\n' + '='.repeat(70));
  console.log('RESULT');
  console.log('='.repeat(70));
  console.log(`Success: ${result.success}`);
  console.log(`Sources: ${result.sources.length}`);
  
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  
  if (result.sources.length > 0) {
    console.log('\nSources:');
    result.sources.forEach((source, i) => {
      console.log(`\n[${i + 1}] ${source.title}`);
      console.log(`    Quality: ${source.quality}`);
      console.log(`    Status: ${source.status}`);
      console.log(`    URL: ${source.url.substring(0, 100)}...`);
    });
  }
  
  // Test with a TV show
  console.log('\n' + '='.repeat(70));
  console.log('Testing TV show extraction...');
  console.log('='.repeat(70));
  
  const tvResult = await extractVidSrcStreams('1396', 'tv', 1, 1); // Breaking Bad S01E01
  
  console.log(`\nTV Show Result:`);
  console.log(`Success: ${tvResult.success}`);
  console.log(`Sources: ${tvResult.sources.length}`);
  
  if (tvResult.error) {
    console.log(`Error: ${tvResult.error}`);
  }
  
  if (tvResult.sources.length > 0) {
    console.log('\nFirst source:');
    const source = tvResult.sources[0];
    console.log(`  Title: ${source.title}`);
    console.log(`  Status: ${source.status}`);
    console.log(`  URL: ${source.url.substring(0, 100)}...`);
  }
}

main().catch(console.error);
