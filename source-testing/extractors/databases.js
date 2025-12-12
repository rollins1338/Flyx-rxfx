/**
 * Database APIs from enc-dec.app
 * - kai: AnimeKai Database (anime)
 * - flix: yFlix Database (movies/tv)
 */

const { get } = require('./enc-dec-client');

// ============ KAI (Anime) Database ============

async function kaiStats() {
  return get('/db/kai/');
}

async function kaiFindById(id, idType = 'mal_id') {
  // idType: mal_id, anilist_id, or kai_id
  return get('/db/kai/find', { [idType]: id });
}

async function kaiSearch(query, type = null, year = null) {
  return get('/db/kai/search', { query, type, year });
}

// ============ FLIX (Movies/TV) Database ============

async function flixStats() {
  return get('/db/flix/');
}

async function flixFindById(id, idType = 'tmdb_id', type = null) {
  // idType: tmdb_id, imdb_id, or flix_id
  // type: movie or tv (optional)
  return get('/db/flix/find', { [idType]: id, type });
}

async function flixSearch(query, type = null, year = null) {
  return get('/db/flix/search', { query, type, year });
}

module.exports = {
  kai: { stats: kaiStats, find: kaiFindById, search: kaiSearch },
  flix: { stats: flixStats, find: flixFindById, search: flixSearch },
};
