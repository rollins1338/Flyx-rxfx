# VidSrc.cc Complete Deobfuscation Summary

## 📁 Files in This Directory

### Complete Deobfuscation Files
- **`FINAL-CLEAN-CODE.js`** - Full VAST ad system (5000+ lines, fully cleaned)
- **`vidsrc-page-clean-code.js`** - Player page logic, server selection, VIP system
- **`vidsrc-page-deobfuscated.md`** - Detailed HTML page analysis

### Analysis Documents
- **`vidsrc-analysis.md`** - Architecture overview
- **`COMPLETE-DEOBFUSCATION.md`** - Deobfuscation methodology
- **`README.md`** - Quick reference

## 🎯 What Was Fully Deobfuscated

### 1. Advertising System (FINAL-CLEAN-CODE.js)
✅ **VAST Ad System** - Complete video ad serving template
✅ **Pop-under Ads** - Click-triggered windows with tab-swap
✅ **Interstitial Ads** - Full-screen overlays (iframe/image/HTML)
✅ **Ad Tracking** - Impressions, clicks, quartile events
✅ **Anti-Adblock** - Domain switching and detection bypass

### 2. Player Page System (vidsrc-page-clean-code.js)
✅ **Server Selection** - 3 servers (CloudStream Pro, 2Embed, Superembed)
✅ **Hash Decoding** - MD5:Base64 encrypted format
✅ **PostMessage Relay** - Parent-iframe communication
✅ **Local Storage** - Subtitle/progress tracking
✅ **VIP Detection** - Referrer-based ad removal
✅ **Cookie Management** - Ad state persistence

### 3. Security Measures
✅ **DevTools Protection** - Disables F12, right-click, copy/paste
✅ **Code Obfuscation** - Multiple encoding layers
✅ **Dynamic Loading** - Runtime script injection
✅ **Iframe Sandboxing** - Isolated contexts
✅ **Hash Verification** - MD5 integrity checks

### 4. Analytics & Tracking
✅ **Histats Integration** - Page views and events
✅ **Custom Analytics** - Behavior monitoring
✅ **Fingerprinting** - Device identification
✅ **Session Tracking** - User session management

## 🔑 Key Discoveries

### Stream URL Format
```
cloudnestra.com/rcp/[MD5_HASH]:[BASE64_ENCRYPTED_DATA]
```

### Server Hash Structure
```javascript
// Format: MD5:Base64Encrypted
"2a04910753484976b5d6c03f543507e0:M1B4V25GU3hLVm..."
```

### Ad Server Config
```javascript
{
  adserverDomain: "wpnxiswpuyrfn.icu",
  cdnDomain: "rpyztjadsbonh.store",
  formats: ["suv5", "ippg", "atag", "interstitial", "intrn"]
}
```

### VIP System
```javascript
GET /is_vip_str.php?ref=[REFERRER]
// Returns "1" for VIP (no ads)
```

## 📊 Statistics

- **Total Lines**: ~8,000+ deobfuscated
- **Classes**: 15+ extracted
- **Functions**: 100+ documented
- **Ad Formats**: 6 types
- **Servers**: 3 providers
- **Security Layers**: 5 mechanisms

## 🛠️ Technologies Found

### Client-Side
- jQuery 3.7.1
- Blueimp MD5
- js-cookie
- VAST 4.1
- PostMessage API
- LocalStorage API

### Server-Side (Inferred)
- PHP backend
- CloudNestra CDN
- Multiple ad networks
- Stream encryption

## ⚠️ Important Notes

This deobfuscation is **educational only**. The code reveals proprietary systems that should NOT be used to:
- Bypass ad systems
- Steal streaming sources
- Clone their service
- Violate terms of service

## 🎓 What You Can Learn

1. **Ad System Architecture** - VAST implementation at scale
2. **Security Patterns** - Obfuscation techniques
3. **Browser APIs** - PostMessage, Storage, Cookies
4. **Anti-Debugging** - DevTools prevention
5. **CDN Architecture** - Multi-domain delivery
6. **Analytics** - User tracking methods

## 🚀 For Your FlyX Project

**Don't use this code.** Instead:

1. **Use Legal APIs**
   - TMDB for metadata
   - Licensed providers
   - Legitimate ad networks

2. **Build Better**
   - Custom player (Video.js/Plyr)
   - Server-side proxying
   - Proper authentication
   - Legal sources

3. **Focus on UX**
   - Better design
   - Faster loading
   - No intrusive ads
   - Mobile-first

## 📝 Conclusion

VidSrc uses sophisticated obfuscation but relies on security through obscurity. The deobfuscated code shows a complex ad system with anti-debugging measures.

**Better approach**: Build a legitimate service with proper licensing, transparent code, and great UX.
