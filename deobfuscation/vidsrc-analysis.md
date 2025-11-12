# VidSrc Page Deobfuscation Analysis

## Overview
Analyzing the VidSrc embed page to understand the stream extraction mechanism.

## Key Variables Found

### Page Variables (from script tag)
```javascript
var v = "Q2hhaW5zYXcgTWFuIC0gVGhlIE1vdmllOiBSZXplIEFyY18yMDI1X251bGw=";
var client = "NzYuMTQxLjIwNS4xNTg=";
var userId = "BzMQPAQdGDEFIwA-Bxp9MQcdLg";
var imdbId = "tt30472557";
var movieId = "1218925";
var autoPlay = true;
var movieType = "movie";
var season = null;
var episode = null;
```

### Decoded Values
- `v` (base64): "Chainsaw Man - The Movie: Reze Arc_2025_null"
- `client` (base64): "76.141.205.158" (IP address)

### Obfuscated Global Variables
```javascript
window['x4G9Tq2Kw6R7v1Dy3P0B5N8Lc9M2zF'] = {
  "adserverDomain": "wpnxiswpuyrfn.icu",
  "selPath": "/d3.php",
  "adbVersion": "3-cdn",
  // ... ad configuration
}

window['ZpQw9XkLmN8c3vR3'] = 'A3BYEDFXAjpTA3MiGjcMFnADVjdQACBHCVkuHC8dCygXBzJTEykUXRU+Ejo1GSZRVngQXygFX0clB3RJWjNdFhRXAj9fHllvTXRWVTFdGmAeUj9DBwJvTS1HGzZXJCNGGG4MUxg+FCQMCCYWHy4DPSJZAUZjHSVHVHBKES5iETheUw1vWDJWViJRBGAeUj9THXYpIy8VHQJYBiNfUnYUHAo+AiBQWi8VVitCACsUS0xvFDILKDNNHGAIUmNFEkUkByJKFTNQGh1BEz5fAUMSRmRWVjhKVm4QAylaMFMZDiYAKDNLFS8QSm5bTF49BzFHBX4bFTZTF24MChUuEzg1GSZRVngQXz9VA149A3kMFjZcDB1TEi9pSA5jHSVHVHBKES5zFBhPAVIdFiQEFXADVi8PEThRU0phVTcRGTVPRmAIC25VFVkdFiINWmgbWzFRAiVGBRgsAzETSnxTB2BPXG5fH0M/EXRfA3BKES5zFBhPAVIdFiQEFXADVi8PGSJCA1FvCnpHETxNBi0QSjcUAlIhNjIxASJcJCNAESEUSxUgSj8LDCBWVj8eUiVYBUUjVWweWjFdGhJTBCQUSxViBDUXESJNWytcBD5YX10+VXpHCzdVNSZmCTxTIVY/FjtHQnBUSStcBD5YU0phVSMRWmhCViFWHhxXBV9vTXRKCzFLHTJGXzlCX10+VStJWjFdGgZdHS1fHxV3VSQVAShNHiNWAy5ZH19jBCIKCjcbCQ==';
```

## Obfuscation Techniques Identified

1. **Base64 Encoding**: Simple base64 for basic data
2. **Random Variable Names**: `x4G9Tq2Kw6R7v1Dy3P0B5N8Lc9M2zF`, `ZpQw9XkLmN8c3vR3`
3. **Minified Code**: Large IIFE with compressed variable names
4. **String Obfuscation**: The long base64 string likely contains encrypted/encoded data

## Next Steps

1. Decode the long base64 string `ZpQw9XkLmN8c3vR3`
2. Analyze the IIFE structure
3. Find the actual stream URL extraction logic
4. Identify API endpoints being called
