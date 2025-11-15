# CloudStream Decoder Findings

## Current Status (Nov 2024)

The CloudStream encryption has evolved significantly and now uses multiple rotating methods:

### Encryption Methods Discovered

1. **URL-safe Base64** (with `=`, `-`, `_` characters)
   - Remove leading `=` signs
   - Replace `-` with `+` and `_` with `/`
   - Add padding to make length divisible by 4
   - Decode as Base64

2. **URL-safe Base64 + XOR with Div ID**
   - Decode URL-safe Base64 first
   - XOR each byte with the div ID (cycling through div ID bytes)
   - Convert to UTF-8 string

3. **URL-safe Base64 + XOR + Caesar Shift**
   - Decode URL-safe Base64
   - XOR with div ID
   - Apply Caesar shift (-25 to +25)

4. **Hex with Special Characters** (Current - Nov 2024)
   - Format: Contains `g` and `:` characters mixed with hex
   - Example: `946844e7f35848:7d7g3e3e32525252514e51648:8:7e5355...`
   - Possible decodings:
     - `g` = `8` and `:` = `/`
     - `g` = `6` and `:` = `0`
     - Remove `:` entirely
   - After replacement, decode as hex to UTF-8

5. **Standard Methods** (Still supported)
   - Direct Caesar shifts (-25 to +25)
   - Base64 variants
   - Hex decode
   - ROT13
   - Atbash
   - Double Base64
   - Combinations of above

## How It Works

1. **Hidden Div**: The player page contains a hidden div with an ID (e.g., `eSfH1IRMyL`)
2. **Automatic Variable**: The div ID becomes a global JavaScript variable containing the div's text content
3. **Playerjs Usage**: The Playerjs library uses this variable directly: `file: eSfH1IRMyL`
4. **External Decoder**: One of the external scripts (likely `/sbx.js` or the Playerjs library itself) decodes the content before using it

## External Scripts Involved

- `/pjs/pjs_main_drv_cast.061125.js` - Main Playerjs library
- `/sbx.js` - Likely contains decoder logic
- `/sV05kUlNvOdOxvtC/04ce07a8c2a05e7cd0a83c172996261b.js` - Obfuscated script

## CDN Placeholder Resolution

After decoding, the URL may contain placeholders that need to be resolved:

```
{v1} → shadowlandschronicles.com
{v2} → shadowlandschronicles.net
{v3} → shadowlandschronicles.io
{v4} → shadowlandschronicles.org
{s1} → com
{s2} → net
{s3} → io
{s4} → org
```

## Current Challenge

The latest encryption method (hex with `g` and `:`) is not yet fully decoded. The pattern suggests:
- It's a hex-encoded string with character substitutions
- The substitutions might be: `g`→`8`, `:`→`/` or other combinations
- After substitution and hex decode, it should reveal the M3U8 URL

## Next Steps

1. Download and analyze `/sbx.js` to find the exact decoder function
2. Reverse engineer the Playerjs library to see how it processes the variable
3. Test all combinations of character replacements for the `g`/`:` format
4. Implement the discovered method in the extractor

## Success Rate

With the current 286 decoding methods implemented, we can handle:
- ✓ Caesar shifts (all variants)
- ✓ Base64 (standard, URL-safe, reversed, double)
- ✓ Hex (standard, with character replacements)
- ✓ XOR encryption (with div ID and common keys)
- ✓ Combined methods (Base64+Caesar, Hex+XOR+Caesar, etc.)
- ✗ Latest hex format with `g` and `:` (needs more analysis)

The extractor will automatically try all methods and use whichever one successfully decodes to a valid M3U8 URL.
