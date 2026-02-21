# Anime Playback Fix - BOTH Providers Now Tried

## What Was Wrong

The API route (`/api/anime/stream`) was using a **sequential fallback** approach:
1. Try HiAnime first
2. If HiAnime succeeds → return immediately (never try AnimeKai)
3. If HiAnime fails → try AnimeKai as fallback

**Result:** Users only got sources from ONE provider, not both.

## What I Fixed

Changed to **parallel extraction** from BOTH providers:
1. Try HiAnime AND AnimeKai **simultaneously** (Promise.allSettled)
2. Collect ALL sources from BOTH providers
3. Return combined results with sources labeled by provider

**Result:** Users now get sources from BOTH providers (sub + dub from each).

## Code Changes

### File: `app/api/anime/stream/route.ts`

**Before:**
```typescript
// Try requested provider first, then fallback
const providerOrder: Provider[] = requestedProvider === 'hianime'
  ? ['hianime', 'animekai']
  : ['animekai', 'hianime'];

for (const provider of providerOrder) {
  const result = await extractFromProvider(provider, ...);
  if (result && result.success && result.sources.length > 0) {
    return NextResponse.json({ sources: result.sources, provider });
  }
}
```

**After:**
```typescript
// TRY BOTH PROVIDERS IN PARALLEL
const [hianimeResult, animekaiResult] = await Promise.allSettled([
  extractFromProvider('hianime', ...),
  extractFromProvider('animekai', ...),
]);

// Collect ALL sources from both providers
const allSources = [];
if (hianimeResult.status === 'fulfilled' && hianimeResult.value?.success) {
  allSources.push(...hianimeResult.value.sources.map(s => ({
    ...s,
    title: `${s.title} [HiAnime]`
  })));
}
if (animekaiResult.status === 'fulfilled' && animekaiResult.value?.success) {
  allSources.push(...animekaiResult.value.sources.map(s => ({
    ...s,
    url: getAnimeKaiProxyUrl(s.url),
    title: `${s.title} [AnimeKai]`
  })));
}

return NextResponse.json({ 
  sources: allSources, 
  providers: ['hianime', 'animekai'] 
});
```

## Expected Results

### Before Fix
```json
{
  "success": true,
  "sources": [
    { "title": "HiAnime (Sub)", "language": "sub" },
    { "title": "HiAnime (Dub)", "language": "dub" }
  ],
  "provider": "hianime"
}
```

### After Fix
```json
{
  "success": true,
  "sources": [
    { "title": "HiAnime (Sub) [HiAnime]", "language": "sub" },
    { "title": "HiAnime (Dub) [HiAnime]", "language": "dub" },
    { "title": "AnimeKai (Sub) [AnimeKai]", "language": "sub" },
    { "title": "AnimeKai (Dub) [AnimeKai]", "language": "dub" }
  ],
  "providers": ["hianime", "animekai"]
}
```

## Benefits

1. **More sources** - Users get 4 sources instead of 2 (sub + dub from each provider)
2. **Better reliability** - If one provider is down, the other still works
3. **Faster** - Parallel extraction is faster than sequential
4. **User choice** - Users can choose which provider to use

## Remaining Issues

1. **Stream playback still fails with 502** - This is a separate issue with the MegaCloud CDN proxy
2. **AnimeKai native extractor** - Currently uses native implementation, not the worker endpoint

## Next Steps

1. ✅ **Fix API to try both providers** - DONE
2. ⏳ **Fix stream proxy 502 error** - Increase timeout + add retry logic
3. ⏳ **Test with dev server** - Run `npm run dev` and test in browser
4. ⏳ **Verify both providers return sources** - Check browser network tab

## Testing

Run the diagnostic script:
```bash
node scripts/test-anime-playback-full.js
```

Or test the API directly:
```bash
curl "http://localhost:3000/api/anime/stream?malId=57658&episode=1"
```

Expected: Sources from BOTH HiAnime and AnimeKai providers.
