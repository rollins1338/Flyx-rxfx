# Step 2: Code Structure Analysis

## Key Findings

### 1. Encrypted Data
The base64 string `ZpQw9XkLmN8c3vR3` decodes to 559 bytes of binary data - this is encrypted.

### 2. IIFE Structure
The code uses an Immediately Invoked Function Expression (IIFE):
```javascript
!function(){"use strict";
  // Obfuscated code here
}()
```

### 3. Key Classes/Functions Identified

From the minified code, I can see:

#### Event Emitter Class
```javascript
class Xe {
  constructor(){this._handlers=[]}
  on(e,t){...}
  once(e,t){...}
  off(e,t){...}
  emit(e){...}
}
```

#### Logger Class
```javascript
class t {
  constructor(e="adcsh",t=!1){
    this.tagName=e
    this.isDebugEnabled=t
  }
  debug(...e){...}
  error(...e){...}
}
```

#### Ad Format Classes
- `class i` - Base ad class
- `class ne` - Interstitial ads (atag interstitial)
- `class ce` - Pop ads (atag pop/suv5)
- `class ue` - AutoTag collective zone

### 4. Important Variables

```javascript
const F="interstitial"
const q="pop"  
const z="tabswap"
const B="utsid-send"
```

### 5. URL Construction Pattern

The code constructs URLs like:
```javascript
`${window.location.protocol}//${this.#f}/script/interstitial.php`
`${window.location.protocol}//${this.#t.adserverDomain}/script/suurl5.php`
```

### 6. VAST Ad System

The code includes a complete VAST (Video Ad Serving Template) parser:
- `class rt extends Xe` - VAST Parser
- `class dt` - URL Handler/Fetcher
- `class ct` - VAST Client

## Next Steps

1. Find where the encrypted string is decrypted
2. Locate the actual stream URL extraction
3. Identify API endpoints for getting stream data
4. Map out the player initialization
