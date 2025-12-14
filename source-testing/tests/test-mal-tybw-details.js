/**
 * Test MAL details for Bleach TYBW parts
 */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAnimeDetails(malId) {
  await sleep(400); // Rate limit
  
  const url = `${JIKAN_BASE_URL}/anime/${malId}/full`;
  const response = await fetch(url);
  const data = await response.json();
  
  return data.data;
}

async function main() {
  const tybwIds = [41467, 53998, 56784, 60636];
  
  console.log('Fetching details for Bleach TYBW parts...\n');
  
  for (const id of tybwIds) {
    const details = await getAnimeDetails(id);
    if (details) {
      console.log(`MAL ID: ${details.mal_id}`);
      console.log(`Title: ${details.title}`);
      console.log(`English: ${details.title_english || 'N/A'}`);
      console.log(`Episodes: ${details.episodes}`);
      console.log(`Status: ${details.status}`);
      console.log(`Aired: ${details.aired?.string}`);
      console.log('---');
    }
  }
}

main().catch(console.error);
