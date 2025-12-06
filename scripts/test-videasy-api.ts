/**
 * Test script for Videasy API integration
 * Tests the /api/stream/extract endpoint with provider=videasy
 * 
 * Run with: npx tsx scripts/test-videasy-api.ts
 */

// Test the extractor directly (not through API)
import { extractVideasyStreams } from '../app/lib/services/videasy-extractor';

async function testExtractor() {
  console.log('='.repeat(60));
  console.log('Testing Videasy Extractor Integration');
  console.log('='.repeat(60));

  // Test 1: Five Nights at Freddy's (2023) - Movie
  console.log('\n[Test 1] Five Nights at Freddy\'s (2023) - Movie');
  console.log('-'.repeat(40));
  
  try {
    const result1 = await extractVideasyStreams('507089', 'movie');
    
    if (result1.success) {
      const workingSources = result1.sources.filter(s => s.status === 'working');
      const unknownSources = result1.sources.filter(s => s.status === 'unknown');
      console.log(`✓ Success! Found ${workingSources.length} working + ${unknownSources.length} available sources`);
      
      // Show working sources
      workingSources.forEach((src, i) => {
        console.log(`  [${i + 1}] ${src.title} - WORKING`);
        console.log(`      URL: ${src.url.substring(0, 60)}...`);
      });
      
      // Show available sources (first 5)
      console.log(`  Other available sources (${unknownSources.length}):`);
      unknownSources.slice(0, 5).forEach((src) => {
        console.log(`    - ${src.title}`);
      });
      if (unknownSources.length > 5) {
        console.log(`    ... and ${unknownSources.length - 5} more`);
      }
      
      if (result1.subtitles && result1.subtitles.length > 0) {
        console.log(`  Subtitles: ${result1.subtitles.length} tracks`);
      }
    } else {
      console.log(`✗ Failed: ${result1.error}`);
    }
  } catch (error: any) {
    console.log(`✗ Error: ${error.message}`);
  }

  // Test 2: Breaking Bad S1E1 - TV Show
  console.log('\n[Test 2] Breaking Bad S1E1 - TV Show');
  console.log('-'.repeat(40));
  
  try {
    const result2 = await extractVideasyStreams('1396', 'tv', 1, 1);
    
    if (result2.success) {
      const working = result2.sources.filter(s => s.status === 'working');
      const unknown = result2.sources.filter(s => s.status === 'unknown');
      console.log(`✓ Success! ${working.length} working + ${unknown.length} available`);
      working.forEach(src => console.log(`  Working: ${src.title}`));
      if (result2.subtitles) console.log(`  Subtitles: ${result2.subtitles.length} tracks`);
    } else {
      console.log(`✗ Failed: ${result2.error}`);
    }
  } catch (error: any) {
    console.log(`✗ Error: ${error.message}`);
  }

  // Test 3: The Office S1E1 - TV Show
  console.log('\n[Test 3] The Office S1E1 - TV Show');
  console.log('-'.repeat(40));
  
  try {
    const result3 = await extractVideasyStreams('2316', 'tv', 1, 1);
    
    if (result3.success) {
      const working = result3.sources.filter(s => s.status === 'working');
      const unknown = result3.sources.filter(s => s.status === 'unknown');
      console.log(`✓ Success! ${working.length} working + ${unknown.length} available`);
      working.forEach(src => console.log(`  Working: ${src.title}`));
      if (result3.subtitles) console.log(`  Subtitles: ${result3.subtitles.length} tracks`);
    } else {
      console.log(`✗ Failed: ${result3.error}`);
    }
  } catch (error: any) {
    console.log(`✗ Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Tests Complete');
  console.log('='.repeat(60));
}

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

testExtractor().catch(console.error);
