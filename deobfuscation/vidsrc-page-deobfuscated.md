# VidSrc Page Complete Deobfuscation

## Overview
This is the main player page that loads the actual video stream through an iframe.

## Key Components

### 1. Page Metadata
```javascript
// Page data attributes
data-i="30472557"  // IMDB ID for Chainsaw Man movie
```

### 2. Main Player Iframe
```javascript
// The actual player is loaded in an iframe from cloudnestra.com
// URL: //cloudnestra.com/rcp/[BASE64_ENCODED_DATA]

// Decoded iframe src structure:
// cloudnestra.com/rcp/ + Base64 encoded parameters
```

### 3. Server Selection System
The page has 3 different streaming servers:

#### Server 1: CloudStream Pro
```
Hash: MmEwNDkxMDc1MzQ4NDk3NmI1ZDZjMDNmNTQzNTA3ZTA:...
(Very long base64 encoded string)
```

#### Server 2: 2Embed
```
Hash: MDNkNzdlMDRlMjAzNDEzM2NhNjUyNjhkMGE3Nzk4YWU:...
```

#### Server 3: Superembed
```
Hash: M2U5MmM3Y2VhMGQ2ZjhiNTBiOGM5YWZmYzM2MjdlM2U:...
```

### 4. Local Storage System
```javascript
// Stores subtitle/progress data
current_sub_name = "sub_" + imdb_id;
// If TV show: "sub_" + imdb_id + "_" + season + "x" + episode

// Sub hash for verification
sub_hash = '52ca5c1eadf6b07b0b0506793c0e06fa';
```

### 5. PostMessage Communication
```javascript
// Parent-iframe communication system
window.addEventListener('message', message => {
    // Message types:
    // - "PLAYER_EVENT": Player state changes
    // - "reload_page": Reload the page
    // - "tvfull": Adjust UI for TV mode
    
    // Relays messages between parent window and iframe
    if (message.source == window.parent) {
        // Forward to iframe
        the_iframe.contentWindow.postMessage(message.data, '*');
    } else {
        // Forward to parent
        window.parent.postMessage(message.data, '*');
    }
});
```

### 6. Cookie-based Ad Control
```javascript
// Ad720 banner control
$("#ad720 #close").click(function(){
    $(this).parent().parent().hide();
    $.cookie("ad720", "1", { 
        expires: 0.001,  // Very short expiry
        path: "/;SameSite=None", 
        secure: true
    });
});
```

### 7. VIP Detection System
```javascript
// Checks if user is VIP via referrer
if (window.frameElement !== null) {
    var ref = window.frameElement.getAttribute('data-ref');
    if (ref != null && ref.length > 3) {
        $.get("/is_vip_str.php?ref=" + encodeURIComponent(ref), 
            function(data, status) {
                if (data == "1") {
                    $("#top_buttons_parent").hide();  // Hide ads for VIP
                } else {
                    $("#top_buttons_parent").show();
                }
            }
        );
    }
}
```

### 8. Analytics Tracking
```javascript
// Histats.com tracking
_Hasync.push(['Histats.start', '1,4873540,4,511,95,18,00000000']);
_Hasync.push(['Histats.fasi', '1']);
_Hasync.push(['Histats.track_hits', '']);
_Hasync.push(['Histats.framed_page', '']);
```

### 9. DevTools Protection
```javascript
// Disables developer tools
DisableDevtool({
    clearLog: true,           // Clear console logs
    disableSelect: true,      // Disable text selection
    disableCopy: true,        // Disable copy
    disableCut: true,         // Disable cut
    disablePaste: true,       // Disable paste
    disableIframeParents: false
});
```

### 10. External Scripts Loaded
```javascript
// Core libraries
- jQuery 3.7.1
- Blueimp MD5 (for hashing)
- js-cookie (cookie management)
- jquery-cookie

// Custom scripts
- /base64.js          // Base64 encoding/decoding
- /sources.js         // Source selection logic
- /reporting.js       // Analytics/reporting
- //cloudnestra.com/asdf.js  // Additional ad/tracking
- /sbx.js             // Sandbox/security
- /f59d610a61063c7ef3ccdc1fd40d2ae6.js  // Obfuscated main script
```

## Decoded Server Hashes

### CloudStream Pro Hash Breakdown
```
First part (MD5): 2a04910753484976b5d6c03f543507e0
Second part (Base64): [Encrypted stream parameters]
```

The hash format is: `MD5_HASH:BASE64_ENCODED_ENCRYPTED_DATA`

## How the System Works

### Flow:
1. **Page loads** with IMDB ID in data attribute
2. **Default server** (CloudStream Pro) loads in iframe
3. **User can switch servers** by clicking server buttons
4. **Each server hash** contains:
   - MD5 verification hash
   - Base64 encoded encrypted stream URL
5. **PostMessage** handles communication between:
   - Parent page ↔ Player iframe
   - Player iframe ↔ Actual video source
6. **Local storage** saves:
   - Watch progress
   - Subtitle preferences
   - Last watched position
7. **VIP check** determines if ads should show
8. **DevTools protection** prevents inspection

## Security Measures

1. **Hash verification**: MD5 + Base64 encoding
2. **DevTools blocking**: Prevents code inspection
3. **Right-click disabled**: Via disableSelect/Copy/Cut
4. **Iframe sandboxing**: Isolates player code
5. **Dynamic script loading**: Obfuscated script names
6. **Cookie-based tracking**: Monitors user behavior

## Ad System

1. **Ad720 banner**: Bottom banner ad with close button
2. **Cookie control**: Short-lived cookie to hide ads temporarily
3. **VIP bypass**: Referrer-based ad removal
4. **Histats tracking**: Analytics for ad impressions
5. **CloudNestra ads**: Additional ad network integration

## Key URLs

- **Player source**: `cloudnestra.com/rcp/[HASH]`
- **VIP check**: `/is_vip_str.php?ref=[REFERRER]`
- **Analytics**: `s10.histats.com/js15_as.js`
- **DevTools blocker**: `unpkg.com/disable-devtool@0.3.9`

