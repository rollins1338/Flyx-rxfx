/**
 * Test MAL scoring logic
 */

const results = [
  { title: 'Bleach', title_english: 'Bleach', mal_id: 269, episodes: 366, type: 'TV', score: 8.5 },
  { title: 'Owari no Seraph: Nagoya Kessen-hen', title_english: 'Seraph of the End: Battle in Nagoya', mal_id: 28927, episodes: 12, type: 'TV', score: 7.8 },
  { title: 'Bleach: Sennen Kessen-hen', title_english: 'Bleach: Thousand-Year Blood War', mal_id: 41467, episodes: 13, type: 'TV', score: 9.0 },
  { title: 'Tokyo Revengers: Seiya Kessen-hen', title_english: 'Tokyo Revengers: Christmas Showdown', mal_id: 50608, episodes: 13, type: 'TV', score: 7.5 },
  { title: 'Bleach: Sennen Kessen-hen - Ketsubetsu-tan', title_english: 'Bleach: Thousand-Year Blood War - The Separation', mal_id: 53998, episodes: 13, type: 'TV', score: 8.7 },
];

const cleanTitle = 'Bleach Sennen Kessen';
const titleLower = cleanTitle.toLowerCase();
const tmdbType = 'tv';

const keywords = ['thousand-year', 'blood war', 'sennen kessen', 'tybw'];

const scoredResults = results.map(result => {
  let score = 0;
  const resultTitleLower = result.title.toLowerCase();
  const resultEnglishLower = result.title_english?.toLowerCase() || '';
  
  // Exact match
  if (resultTitleLower === titleLower || resultEnglishLower === titleLower) {
    score += 100;
    console.log(`  [${result.title}] Exact match: +100`);
  } 
  // Check if search title contains result title or vice versa
  else if (resultTitleLower.includes(titleLower) || resultEnglishLower.includes(titleLower)) {
    score += 50;
    console.log(`  [${result.title}] Result contains search: +50`);
  } else if (titleLower.includes(resultTitleLower) || (resultEnglishLower && titleLower.includes(resultEnglishLower))) {
    score += 30;
    console.log(`  [${result.title}] Search contains result: +30`);
  }
  
  // Special handling for specific keywords
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      if (resultTitleLower.includes(keyword) || resultEnglishLower.includes(keyword)) {
        score += 50;
        console.log(`  [${result.title}] Keyword "${keyword}" match: +50`);
      } else {
        score -= 30;
        console.log(`  [${result.title}] Keyword "${keyword}" missing: -30`);
      }
    }
  }
  
  // Type match
  if (tmdbType === 'tv' && result.type === 'TV') {
    score += 20;
    console.log(`  [${result.title}] Type match: +20`);
  }
  
  // Popularity bonus
  const popBonus = Math.min(result.score || 0, 10);
  score += popBonus;
  console.log(`  [${result.title}] Popularity: +${popBonus}`);
  
  console.log(`  [${result.title}] TOTAL: ${score}\n`);
  
  return { result, score };
});

scoredResults.sort((a, b) => b.score - a.score);

console.log('\n=== FINAL RANKING ===');
scoredResults.forEach((r, i) => {
  console.log(`${i + 1}. ${r.result.title} (MAL ID: ${r.result.mal_id}) - Score: ${r.score}`);
});
