/**
 * Analyze the ID patterns from 1movies.bz
 */

// Known IDs
const movieId = 'c4a7-KGm';      // Movie ID
const episodeId = 'cYu_-KCi';    // Episode ID  
const linkId1 = 'doO486al6Q';    // Server 1 (sid=3)
const linkId2 = 'doO486al6A';    // Server 2 (sid=2)
const pageToken = 'ZZYdbXagjEpeaU4REYG3BZclbhHwNxnmEAkKkmSCjE07YKZIflElhxyyITZczC3b0X2bpiEg_jIQEWMlJrM2SlqIyQ77OpEB9ChcYqcWem8';
const dataMeta = 'ZZQdeGGgpgtJaU1ZTbb7UtZoOAriKGCET28dknPR-F9tY-FbIRd21FukUiFLzAaKlz_Y-yYgmkYSdRAhZMMdAg-DlSfiE50UvzEbKrAGDA5u4xMwomR7xX_9Dsf0NgNeoFYsnkjn5Sed6b_PlUMrACIfRiA9Om_q7nHSTd_zmG8crxcyzJP2Cq8zPd1LvrZFRfnEvB7M4kq3Acaqt8C18CW8hglpL6V6L7QuGfBMKE4WCw';

console.log('=== 1movies.bz ID Analysis ===\n');

// Analyze ID patterns
console.log('Movie ID:', movieId);
console.log('  Length:', movieId.length);
console.log('  Pattern: alphanumeric with dash');

console.log('\nEpisode ID:', episodeId);
console.log('  Length:', episodeId.length);
console.log('  Pattern: alphanumeric with underscore and dash');

console.log('\nLink ID 1:', linkId1);
console.log('  Length:', linkId1.length);
console.log('  Pattern: alphanumeric');

console.log('\nLink ID 2:', linkId2);
console.log('  Length:', linkId2.length);
console.log('  Difference from ID1:', linkId1.slice(0, -1) === linkId2.slice(0, -1) ? 'Only last char differs' : 'Different');

// Try to decode as base64
console.log('\n=== Base64 Decode Attempts ===');

function tryBase64(str, name) {
  try {
    // Standard base64
    const decoded = Buffer.from(str, 'base64').toString('utf8');
    if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
      console.log(`${name} (base64):`, decoded);
    }
  } catch (e) {}
  
  try {
    // URL-safe base64
    const urlSafe = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(urlSafe, 'base64').toString('utf8');
    if (decoded && /^[\x20-\x7E]+$/.test(decoded)) {
      console.log(`${name} (url-safe base64):`, decoded);
    }
  } catch (e) {}
}

tryBase64(movieId, 'Movie ID');
tryBase64(episodeId, 'Episode ID');
tryBase64(linkId1, 'Link ID 1');
tryBase64(linkId2, 'Link ID 2');
tryBase64(pageToken, 'Page Token');
tryBase64(dataMeta, 'Data Meta');

// The link IDs look like they might encode server info
console.log('\n=== Link ID Analysis ===');
console.log('Link ID 1 (sid=3):', linkId1);
console.log('Link ID 2 (sid=2):', linkId2);
console.log('Common prefix:', linkId1.substring(0, linkId1.length - 1));
console.log('ID1 suffix:', linkId1.slice(-1));
console.log('ID2 suffix:', linkId2.slice(-1));

// The IDs might be encrypted/encoded TMDB/IMDB IDs
// FNAF 2 TMDB ID is likely around 1228246 (based on common patterns)
console.log('\n=== Possible TMDB/IMDB Connection ===');
console.log('FNAF 2 is a 2025 movie');
console.log('Possible TMDB ID: 1228246 or similar');

// Check if the token structure gives hints
console.log('\n=== Token Analysis ===');
console.log('Page token length:', pageToken.length);
console.log('Data meta length:', dataMeta.length);
console.log('Both use URL-safe base64 chars (A-Za-z0-9_-)');
