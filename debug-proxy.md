# Live TV Provider Differentiation Guide

## **PROVIDER SPECIALIZATIONS & CHANNEL OFFERINGS**

### **1. DLHD (Primary Provider)**
- **Route**: `/tv/?channel=<id>`
- **Channel Format**: Numeric IDs (1-850)
- **Total Channels**: 850+
- **Specialization**: General live TV channels
- **Categories**: Sports, Entertainment, News, Movies, Documentary, Kids, Music
- **Countries**: USA, UK, Canada, International
- **Examples**: 
  - Channel 51: ABC USA
  - Channel 325: ESPN
  - Channel 100: FOX Sports
  - Channel 200: CNN

### **2. CDN-Live.tv (Sports Events)**
- **Route**: `/cdn-live/stream?eventId=<id>`
- **Channel Format**: Event ID strings
- **Total Channels**: 200+
- **Specialization**: Live sports events and breaking news
- **Categories**: Sports, Entertainment, News
- **Countries**: USA, UK, International
- **Examples**:
  - `ufc-301`: UFC Fight Night
  - `nfl-game-123`: NFL Game
  - `premier-league-live`: Premier League Match
  - `espn-live`: ESPN Live Event

### **3. PPV.to (Pay-Per-View)**
- **Route**: `/ppv/stream?uri=<id>`
- **Channel Format**: URI name strings
- **Total Channels**: 100+
- **Specialization**: Pay-per-view events and premium content
- **Categories**: Sports, Movies, Entertainment
- **Countries**: USA, International
- **Examples**:
  - `boxing-event-1`: Boxing PPV
  - `ufc-fight-night`: UFC PPV
  - `premium-movie`: Premium Movie
  - `special-event`: Special Event

## **CHANNEL ROUTING LOGIC**

### **Automatic Provider Selection**
1. **Numeric Channel ID (1-850)** → **DLHD**
   ```bash
   curl "https://media-proxy.workers.dev/tv/?channel=51"
   ```

2. **Event ID String** → **CDN-Live.tv**
   ```bash
   curl "https://media-proxy.workers.dev/cdn-live/stream?eventId=ufc-301"
   ```

3. **URI Name String** → **PPV.to**
   ```bash
   curl "https://media-proxy.workers.dev/ppv/stream?uri=boxing-event-1"
   ```

### **Channel Information API**
```bash
# Get channel info and provider mapping
curl "https://your-domain.com/api/livetv/channel-info?id=51"

# Search channels by name
curl "https://your-domain.com/api/livetv/channel-info?search=ESPN"

# Get channels by provider
curl "https://your-domain.com/api/livetv/channel-info?provider=dlhd"

# Get provider statistics
curl "https://your-domain.com/api/livetv/channel-info?stats=true"
```

### **Intelligent Channel Routing**
```bash
# Route channel to optimal provider
curl -X POST "https://your-domain.com/api/livetv/route-channel" \
  -H "Content-Type: application/json" \
  -d '{"channelId": "51"}'

# Route with preferred provider
curl -X POST "https://your-domain.com/api/livetv/route-channel" \
  -H "Content-Type: application/json" \
  -d '{"channelId": "espn", "preferredProvider": "cdnlive"}'
```

## **ERROR PATTERNS BY PROVIDER**

### **DLHD Errors** (`/tv/*`)
- **"Failed to fetch M3U8" (502)**: All DLHD servers failed
- **"E2: Session not established"**: DLHD auth session invalid
- **"E3: Token expired"**: DLHD auth token expired
- **"Invalid DLHD channel format"**: Non-numeric channel ID provided
- **"DLHD channel out of range"**: Channel ID not in 1-850 range

### **CDN-Live.tv Errors** (`/cdn-live/*`)
- **"Invalid URL domain" (400)**: URL not from cdn-live-tv.ru
- **"Upstream error" (502)**: CDN-Live.tv server error
- **"Event not found" (404)**: Event ID doesn't exist

### **PPV.to Errors** (`/ppv/*`)
- **"Invalid domain" (400)**: URL not from poocloud.in
- **"RPI proxy failed"**: Residential IP proxy needed
- **"Direct fetch failed"**: Datacenter IP blocked

## **MONITORING BY PROVIDER**

### **Real-time Logs**
```bash
# Monitor all providers
npx wrangler tail media-proxy

# Monitor DLHD only
npx wrangler tail media-proxy | grep "/tv/"

# Monitor CDN-Live only
npx wrangler tail media-proxy | grep "/cdn-live/"

# Monitor PPV only
npx wrangler tail media-proxy | grep "/ppv/"
```

### **Health Checks**
```bash
# DLHD health (via main health endpoint)
curl "https://media-proxy.workers.dev/health"

# CDN-Live health
curl "https://media-proxy.workers.dev/cdn-live/health"

# PPV health
curl "https://media-proxy.workers.dev/ppv/health"
```

## **NO IPTV/STALKER PROVIDERS**
- **`/iptv/*`** routes are NOT used for live TV
- Only DLHD, CDN-Live.tv, and PPV.to are approved
- Any MAG/STB/Portal references should be ignored
- Stalker middleware is completely separate from live TV

## **PROVIDER PRIORITY ORDER**
1. **DLHD** - Primary for general channels (highest priority)
2. **CDN-Live.tv** - Secondary for sports events
3. **PPV.to** - Tertiary for premium/PPV content

## **CHANNEL MAPPING EXAMPLES**

### **Multi-Provider Channels**
```json
{
  "espn": {
    "name": "ESPN",
    "providers": {
      "dlhd": "325",
      "cdnlive": "espn-live",
      "ppv": null
    },
    "priority": ["dlhd", "cdnlive"]
  }
}
```

### **Provider-Specific Channels**
```json
{
  "ufc-ppv": {
    "name": "UFC Pay-Per-View",
    "providers": {
      "dlhd": null,
      "cdnlive": "ufc-event",
      "ppv": "ufc-fight-night"
    },
    "priority": ["ppv", "cdnlive"]
  }
}
```