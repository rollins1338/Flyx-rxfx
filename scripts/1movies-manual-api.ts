/**
 * 1movies.bz - Manual API testing without browser
 * 
 * Known endpoints:
 * - /ajax/episodes/list?id={movieId}&_={token}
 * - /ajax/links/list?eid={episodeId}&_={token}
 * - /ajax/links/view?lid={linkId}&_={token} (guessed)
 * 
 * Known IDs:
 * - Movie ID: c4a7-KGm
 * - Episode ID: cYu_-KCi  
 * - Link IDs: doO486al6Q (server 1), doO486al6A (server 2)
 * - Token from page: ZZYdbXagjEpeaU4REYG3BZclbhHwNxnmEAkKkmSCjE07YKZIflElhxyyITZczC3b0X2bpiEg_jIQEWMlJrM2SlqIyQ77OpEB9ChcYqcWem8
 */

const BASE_URL = 'https://1movies.bz';

// Token from window.__$ on the page
const TOKEN = 'ZZYdbXagjEpeaU4REYG3BZclbhHwNxnmEAkKkmSCjE07YKZIflElhxyyITZczC3b0X2bpiEg_jIQEWMlJrM2SlqIyQ77OpEB9ChcYqcWem8';

// IDs we captured
const MOVIE_ID = 'c4a7-KGm';
const EPISODE_ID = 'cYu_-KCi';
const LINK_ID_1 = 'doO486al6Q';
const LINK_ID_2 = 'doO486al6A';

async function fetchAPI(endpoint: string) {
  console.log(`\nFetching: ${endpoint}`);
  
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://1movies.bz/watch/movie-five-nights-at-freddys-2-xrbnrp',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 500)}`);
    return text;
  } catch (error: any) {
    console.log(`Error: ${error.message}`);
    return null;
  }
}

async function testAPIs() {
  console.log('=== 1movies.bz API Testing ===\n');
  
  // The _ parameter seems to be derived from window.__$
  
  // Test various possible endpoints for getting the embed URL
  const endpoints = [
    // Known working endpoints
    `/ajax/episodes/list?id=${MOVIE_ID}&_=${TOKEN}`,
    `/ajax/links/list?eid=${EPISODE_ID}&_=${TOKEN}`,
    
    // Guessed endpoints for getting embed
    `/ajax/links/view?lid=${LINK_ID_1}&_=${TOKEN}`,
    `/ajax/links/view?id=${LINK_ID_1}&_=${TOKEN}`,
    `/ajax/embed?lid=${LINK_ID_1}&_=${TOKEN}`,
    `/ajax/embed/view?lid=${LINK_ID_1}&_=${TOKEN}`,
    `/ajax/source?lid=${LINK_ID_1}&_=${TOKEN}`,
    `/ajax/sources?lid=${LINK_ID_1}&_=${TOKEN}`,
    `/ajax/player?lid=${LINK_ID_1}&_=${TOKEN}`,
    
    // Try without token
    `/ajax/links/view?lid=${LINK_ID_1}`,
    
    // Try with different parameter names
    `/ajax/links/view?id=${LINK_ID_1}`,
    `/ajax/links/get?lid=${LINK_ID_1}`,
  ];
  
  for (const endpoint of endpoints) {
    await fetchAPI(endpoint);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }
}

testAPIs();
