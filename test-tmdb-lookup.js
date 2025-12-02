// Look up what these TMDB IDs are

const TMDB_API_KEY = 'e716f19ab4d25edc5247239a8f3494f8';

const IDS = ['118083', '110842', '421363', '123'];

async function lookupId(id) {
  // Try movie first
  let res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}`);
  if (res.ok) {
    const data = await res.json();
    return { type: 'movie', title: data.title, year: data.release_date?.split('-')[0], id };
  }
  
  // Try TV
  res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`);
  if (res.ok) {
    const data = await res.json();
    return { type: 'tv', title: data.name, year: data.first_air_date?.split('-')[0], id };
  }
  
  return { type: 'unknown', title: 'NOT FOUND', id };
}

async function main() {
  console.log('Looking up TMDB IDs...\n');
  
  for (const id of IDS) {
    const info = await lookupId(id);
    console.log(`${id}: ${info.title} (${info.year}) - ${info.type}`);
  }
}

main().catch(console.error);
