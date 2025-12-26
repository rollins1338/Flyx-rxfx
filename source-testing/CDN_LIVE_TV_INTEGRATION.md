# CDN-Live.tv Integration

## Overview

Successfully reverse-engineered cdn-live.tv's streaming infrastructure. The service provides 628+ live TV channels from various countries.

## API Discovery

### Main Endpoints

| Endpoint | Description |
|----------|-------------|
| `https://api.cdn-live.tv/api/v1/channels/?user=cdnlivetv&plan=free` | Returns all channels (628+) |
| `https://cdn-live.tv/api/v1/channels/player/?name={channel}&code={country}&user=cdnlivetv&plan=free` | Player page with obfuscated stream URL |

### Authentication

- Uses query parameters: `user=cdnlivetv` and `plan=free`
- No API key required for basic access
- Tokens are generated server-side and embedded in player pages

## Stream URL Structure

```
https://edge.cdn-live-tv.ru/api/v1/channels/{country}-{channel}/index.m3u8?token={token}
```

### Token Format

The token is a multi-part string separated by dots:
```
{hash1}.{timestamp}.{hash2}.{hash3}.{hash4}.{hash5}
```

Example:
```
1f66ce5d8601e9e78b8d7418ee049bcfdd7a2db555c2f30e76293d98a28d2bf7.1766772785.4210e8756dcdd57fa61400d5a842cb9c.a4d8c8aa089a1b4f7ebfc1f88f3e1f13.e35a6468989493b60fe0d355d3411f7f.92a8921d4f557ba3
```

- The timestamp (second part) indicates token expiration
- Tokens are time-limited and must be refreshed by fetching a new player page

## Obfuscation Details

### JavaScript Obfuscation

The player page contains heavily obfuscated JavaScript using:

1. **Custom base conversion function** (`_0xe63c` or similar)
2. **Character substitution cipher** with custom charset
3. **eval() wrapper** that decodes and executes the payload

### Decoding Algorithm

```javascript
// Parameters extracted from the eval() call:
// ",{u},"{charset}",{base},{e},{offset})"

function decode(encodedData, charset, base, e, offset) {
  let result = '';
  let i = 0;
  
  while (i < encodedData.length) {
    let s = '';
    // Read until delimiter (charset[e])
    while (encodedData[i] !== charset[e]) {
      s += encodedData[i];
      i++;
    }
    i++; // Skip delimiter
    
    // Replace charset chars with indices
    for (let j = 0; j < charset.length; j++) {
      s = s.split(charset[j]).join(j.toString());
    }
    
    // Convert from base 'e' to base 10, subtract offset
    const charCode = baseConvert(s, e, 10) - offset;
    result += String.fromCharCode(charCode);
  }
  
  return result;
}
```

### Example Parameters

From ABC channel player:
- Charset: `qYnkafhvw`
- Base: `12`
- E (delimiter index): `5`
- Offset: `50`

## Channel Data Structure

```json
{
  "name": "ABC",
  "code": "us",
  "url": "https://cdn-live.tv/api/v1/channels/player/?name=abc&code=us&user=cdnlivetv&plan=free",
  "image": "https://api.cdn-live.tv/api/v1/channels/images6318/united-states/abc.png",
  "status": "online",
  "viewers": 3
}
```

## API Routes Created

### 1. Channels List
`GET /api/livetv/cdn-live-channels`

Returns all available channels grouped by country.

### 2. Stream Extraction
`GET /api/livetv/cdn-live-stream?name={channel}&code={country}`

Extracts the m3u8 stream URL for a specific channel.

## Implementation Notes

1. **Token Expiration**: Tokens expire, so stream URLs should be fetched fresh when needed
2. **Rate Limiting**: Unknown, but recommended to cache channel list
3. **Geo-restrictions**: Some channels may be geo-restricted
4. **PPV Events**: Special handling for pay-per-view events (pattern: `us-(nfl|nba|nhl)-league-pass`)

## CDN Infrastructure

- **Edge Server**: `edge.cdn-live-tv.ru`
- **API Server**: `api.cdn-live.tv`
- **Main Site**: `cdn-live.tv`
- **Player**: Uses OPlayer (JavaScript video player)

## Files

- `cdn-live-research.js` - Initial API discovery
- `cdn-live-eval.js` - JavaScript decoder using VM
- `cdn-decoded-eval.js` - Example decoded player script
- `cdn-player-ABC.html` - Example player page HTML
