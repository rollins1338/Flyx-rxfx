# Step 3: Player Logic Analysis

## External Scripts Loaded

1. **JW Player**: `https://content.jwplatform.com/libraries/KB5zFt7A.js`
   - This is the actual video player
   - KB5zFt7A is the player ID

2. **jQuery**: `https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js`

3. **Bootstrap**: `https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.2/js/bootstrap.bundle.min.js`

4. **Axios**: `https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js`

## Key Insight: The Stream URL Logic

The obfuscated code is **NOT** for stream extraction - it's for **AD SERVING**!

The actual stream URL must be loaded via:
1. JW Player configuration
2. AJAX/Axios call to VidSrc API
3. Dynamic script injection

## What to Look For

Since this is an embed page, the stream URL is likely:
1. Loaded via API call using the `movieId` variable
2. Configured in JW Player setup
3. Hidden in another script tag or loaded dynamically

## VidSrc API Pattern

Based on the variables, the likely API endpoint is:
```
https://vidsrc.cc/api/source/{movieId}
or
https://vidsrc.xyz/api/source/{movieId}
```

## Recommendation

To find the actual stream extraction:
1. Monitor network requests when the page loads
2. Look for API calls to vidsrc domains
3. Check JW Player configuration
4. The stream URL is likely fetched dynamically, not embedded in the HTML

The obfuscated code we see is primarily for:
- Ad injection
- Pop-under/pop-up ads
- Interstitial ads
- VAST video ads
- Not for stream URL extraction
