/**
 * enc-dec.app Extractors
 * 
 * All sources from https://enc-dec.app
 */

const databases = require('./databases');
const sources = require('./sources');
const hosters = require('./hosters');
const parsers = require('./parsers');
const animeMapper = require('./anime-id-mapper');

module.exports = {
  // Databases
  db: databases,
  
  // Website Sources
  ...sources,
  
  // Hosters
  hosters,
  
  // Parsers
  parsers,
  
  // Anime ID Mapper (TMDB → MAL/AniList)
  animeMapper,
};
