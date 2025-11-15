# VidSrc Pro - Pure Fetch Implementation ✅

## Overview
Successfully implemented a **pure fetch-based** VidSrc Pro extractor with **NO VM** and **NO Puppeteer**. Uses only HTTP requests and Caesar cipher decoding.

## How It Works

### Step 1: Get Data Hash
- Fetch embed page: `https://vidsrc-embed.ru/embed/{type}/{tmdbId}`
- Extract `data-hash` attribute from the page

### Step 2: Get ProRCP URL
- Fetch RCP endpoint: `https://cloudnestra.com/rcp/{dataHash}`
- Extract iframe src from response

### Step 3: Get ProRCP Page
- Fetch ProRCP page: `https://cloudnestra.com{iframeSrc}`
- Find div element containing encoded URL

### Step 4: Decode URL
- The div contains a Caesar cipher encoded URL
- Apply Caesar cipher with shift +3 (letters only)
- Example: `eqqmp://` → `https://`

### Step 5: Resolve Placeholders
- Replace `{v1}`, `{v2}`, `{v3}`, `{v4}`, `{s1}` with `shadowlandschronicles.com`
- Extract first URL if multiple are present (separated by " or ")

## Files Created

### Service Layer
- `app/lib/services/vidsrc-pro-pure-fetch.ts` - Main extractor service

### API Route
- `app/api/stream/extract/route.ts` - Updated to use VidSrc Pro

## API Usage

```bash
# Movie
GET /api/stream/extract?tmdbId=550&type=movie

# TV Show
GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
```

## Response Format

```json
{
  "success": true,
  "streamUrl": "https://tmstr5.shadowlandschronicles.com/pl/H4sI.../master.m3u8",
  "url": "https://tmstr5.shadowlandschronicles.com/pl/H4sI.../master.m3u8",
  "provider": "vidsrc-pro",
  "requiresProxy": false
}
```

## Key Features

✅ **No VM** - Pure Node.js/TypeScript
✅ **No Puppeteer** - Just HTTP fetch requests
✅ **Fast** - Direct HTTP requests only
✅ **Reliable** - Simple Caesar cipher decoding
✅ **Clean** - Minimal dependencies (cheerio for HTML parsing)

## Testing

Tested with:
- Fight Club (movie, tmdbId: 550) ✅
- The Matrix (movie, tmdbId: 603) ✅

Both successfully extracted M3U8 URLs with shadowlandschronicles.com CDN.

## Technical Details

### Caesar Cipher Decoding
- Shift: +3
- Only affects letters (a-z, A-Z)
- Numbers and special characters remain unchanged
- Example transformations:
  - `e` → `h`
  - `q` → `t`
  - `m` → `p`
  - `eqqmp://` → `https://`

### Placeholder Resolution
All placeholders are replaced with `shadowlandschronicles.com`:
- `{v1}` → `shadowlandschronicles.com`
- `{v2}` → `shadowlandschronicles.com`
- `{v3}` → `shadowlandschronicles.com`
- `{v4}` → `shadowlandschronicles.com`
- `{s1}` → `shadowlandschronicles.com`

## Success! 🎉

The VidSrc Pro extractor is now fully integrated into the API and ready for production use.
