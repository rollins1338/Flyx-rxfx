/**
 * Website Source Extractors using enc-dec.app
 * 
 * Sources:
 * - AnimeKai (anime)
 * - Flix/1movies/yflix (movies/tv)
 * - Vidlink
 * - Vidstack (smashystream/multimovies/cloudy)
 * - XPrime
 * - Hexa (hexa/flixer)
 * - Videasy
 * - Mapple
 * - KissKH (asian drama)
 * - OneTouchTV
 */

const { get, post } = require('./enc-dec-client');

// ============ ANIMEKAI ============
const animekai = {
  encrypt: (text) => get('/api/enc-kai', { text }),
  decrypt: (text) => post('/api/dec-kai', { text }),
};

// ============ FLIX (1movies/yflix) ============
const flix = {
  encrypt: (text) => get('/api/enc-movies-flix', { text }),
  decrypt: (text) => post('/api/dec-movies-flix', { text }),
};

// ============ VIDLINK ============
const vidlink = {
  encrypt: (text) => get('/api/enc-vidlink', { text }),
};

// ============ VIDSTACK (smashystream/multimovies/cloudy) ============
const vidstack = {
  encrypt: () => get('/api/enc-vidstack'),
  decrypt: (text, type) => post('/api/dec-vidstack', { text, type }),
};

// ============ XPRIME ============
const xprime = {
  encrypt: () => get('/api/enc-xprime'),
  decrypt: (text) => post('/api/dec-xprime', { text }),
};

// ============ HEXA (hexa/flixer) ============
const hexa = {
  decrypt: (text, key) => post('/api/dec-hexa', { text, key }),
};

// ============ VIDEASY ============
const videasy = {
  decrypt: (text, id) => post('/api/dec-videasy', { text, id }),
};

// ============ MAPPLE ============
const mapple = {
  encrypt: () => get('/api/enc-mapple'),
};

// ============ KISSKH (Asian Drama) ============
const kisskh = {
  encrypt: (text, type) => get('/api/enc-kisskh', { text, type }),
  decrypt: (text) => get('/api/dec-kisskh', { text }),
};

// ============ ONETOUCHTV ============
const onetouchtv = {
  decrypt: (text) => post('/api/dec-onetouchtv', { text }),
};

module.exports = {
  animekai,
  flix,
  vidlink,
  vidstack,
  xprime,
  hexa,
  videasy,
  mapple,
  kisskh,
  onetouchtv,
};
