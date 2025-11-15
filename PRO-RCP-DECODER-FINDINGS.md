# PRO.RCP Decoder Investigation - Findings

## Summary

We successfully extracted the encoded hash from PRO.RCP pages but have not yet cracked the custom encoding algorithm.

## What We Know

### 1. The Flow
```
vidsrc-embed.ru/embed/tv/{id}/{season}/{episode}
  ↓ (extract data-hash)
cloudnestra.com/rcp/{hash}
  ↓ (extract prorcp hash)
cloudnestra.com/prorcp/{hash}
  ↓ (contains encoded m3u8 URL in hidden div)
```

### 2. The Encoded Data Structure
- **Location**: Hidden `<div>` with `style="display:none;"`
- **Div ID**: Random alphanumeric (e.g., `xTyBxQyGTA`)
- **Content**: ~9800 character encoded string
- **Format**: Appears to be custom encoding (not simple base64/XOR/Caesar)

### 3. How It's Used
```html
<div id="xTyBxQyGTA" style="display:none;">ENCODED_HASH_HERE</div>

<script>
  var player = new Playerjs({
    id: "player_parent",
    file: xTyBxQyGTA,  // ← Variable name matches div ID!
    ...
  });
</script>
```

**Key Insight**: The div ID is used as a JavaScript variable name. PlayerJS must be:
1. Reading `document.getElementById(divId).textContent`
2. Decoding it with a custom algorithm
3. Assigning the result to `window[divId]`

### 4. What We Tested (All Failed)
- ✗ URL-safe base64 decode
- ✗ Standard base64 decode  
- ✗ Base64 + reverse
- ✗ Base64 + XOR with divId
- ✗ Double base64
- ✗ Caesar cipher (+3, -3)

### 5. The Decoder Location
The decoder is NOT easily found because:
- Not in inline `<script>` tags on the page
- Not obviously in PlayerJS (heavily minified, 837KB)
- Likely executed dynamically via `eval()` or `Function()` constructor
- Or deeply embedded in PlayerJS initialization code

## Files Generated
- `encoded-hash.txt` - The raw encoded hash
- `div-id.txt` - The div ID
- `player-page.html` - Full PRO.RCP player page
- `pjs_main_drv_cast.js` - PlayerJS library (same as playerjs.js)
- `decoding-results.json` - Results of all decoding attempts

## Next Steps

### Option 1: Browser-Based Interception (RECOMMENDED)
Use Puppeteer to:
1. Load the PRO.RCP page
2. Hook `atob()`, `String.prototype.replace()`, `charCodeAt()` 
3. Watch the exact decoding sequence in real-time
4. Capture input/output of each transformation

**Problem**: VidSrc has anti-bot protection that redirects Puppeteer

**Solution**: 
- Use stealth plugins
- Or manually load PRO.RCP URL directly (bypass VidSrc)
- Or use a real browser with DevTools

### Option 2: Manual Browser Inspection
1. Open PRO.RCP page in Chrome DevTools
2. Set breakpoints on:
   - `atob` function
   - `getElementById` calls
   - `window` property assignments
3. Step through PlayerJS initialization
4. Watch the decoder execute

### Option 3: Deep PlayerJS Analysis
1. Beautify/deobfuscate PlayerJS
2. Search for code that:
   - Iterates through DOM elements
   - Reads `textContent` from divs
   - Performs string transformations
   - Assigns to `window` object

### Option 4: Pattern Recognition
The encoded string has characteristics:
- Length: ~9800 chars
- Entropy: 4.48 (indicates light encryption)
- Characters: Alphanumeric + `=` (base64-like)
- Structure: Appears to have repeating patterns

Could try:
- Frequency analysis
- Looking for m3u8 URL patterns in the encoded data
- Reverse engineering from known plaintext (if we can get a working URL)

## Recommended Immediate Action

**Use a real browser with DevTools:**

1. Open: `https://cloudnestra.com/prorcp/ZmM0NDk3NGQ1YjYyZmY2YzMzODQ3MjViMmZlNmFiOWI6...` (full hash from test)
2. Open DevTools Console
3. Before page loads, paste:
```javascript
// Hook atob
const originalAtob = window.atob;
window.atob = function(input) {
  const output = originalAtob.call(this, input);
  if (output.includes('.m3u8') || output.includes('http')) {
    console.log('🎯 FOUND M3U8 URL!');
    console.log('Input:', input.substring(0, 100));
    console.log('Output:', output);
  }
  return output;
};

// Hook getElementById
const originalGetElementById = document.getElementById;
document.getElementById = function(id) {
  const el = originalGetElementById.call(document, id);
  if (el && el.textContent.length > 1000) {
    console.log('🔍 Reading large div:', id);
    console.log('Content:', el.textContent.substring(0, 100));
  }
  return el;
};

console.log('✅ Hooks installed!');
```
4. Let the page load
5. Watch console for the decoder in action

This will show us the EXACT decoding process!
