# Source Testing

Testing folder for movie/TV/anime streaming sources using enc-dec.app APIs.

## Sources Available

### Databases
- **kai** - AnimeKai Database (anime - MAL/AniList IDs)
- **flix** - yFlix Database (movies/TV - TMDB/IMDB IDs)

### Website Sources
| Source | Type | Encrypt | Decrypt |
|--------|------|---------|---------|
| AnimeKai | Anime | ✓ | ✓ |
| Flix (1movies/yflix) | Movies/TV | ✓ | ✓ |
| Vidlink | Movies/TV | ✓ | - |
| Vidstack (smashystream/multimovies/cloudy) | Movies/TV | ✓ | ✓ |
| XPrime | Movies/TV | ✓ | ✓ |
| Hexa (hexa/flixer) | Movies/TV | - | ✓ |
| Videasy | Movies/TV | - | ✓ |
| Mapple | Movies/TV | ✓ | - |
| KissKH | Asian Drama | ✓ | ✓ |
| OneTouchTV | TV | - | ✓ |

### Hosters
- **MegaUp** - decrypt
- **RapidShare** - decrypt  
- **Cloudnestra** - decrypt

### Parsers
- **HTML Parser** - parse HTML responses

## Usage

```bash
# Run all tests
node source-testing/tests/test-all-sources.js

# Use in code
const extractors = require('./source-testing/extractors');

// Search anime
const results = await extractors.db.kai.search('naruto');

// Search movies
const movies = await extractors.db.flix.search('inception');

// Encrypt/decrypt
const encrypted = await extractors.animekai.encrypt('some-text');
const decrypted = await extractors.animekai.decrypt(encrypted);
```

## Structure

```
source-testing/
├── extractors/
│   ├── index.js          # Main export
│   ├── enc-dec-client.js # Base API client
│   ├── databases.js      # kai & flix databases
│   ├── sources.js        # All website sources
│   ├── hosters.js        # Hoster decryptors
│   └── parsers.js        # HTML parser
├── tests/
│   └── test-all-sources.js
├── results/
└── README.md
```

## API Reference

See: https://enc-dec.app
GitHub: https://github.com/... (check enc-dec.app for links)
