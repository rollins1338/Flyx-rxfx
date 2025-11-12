# Stream Proxy Enhanced Debugging Guide

## Overview
The stream-proxy route now has comprehensive debugging that logs every step of the request/response lifecycle with detailed information.

## New Debugging Features

### 1. Enhanced Logger Functions
- **`logger.success()`** - Logs successful operations with green checkmark
- **`logger.step()`** - Logs numbered steps in the process flow
- **`logger.memory()`** - Logs current memory usage (RSS, Heap, External)

### 2. Request Lifecycle Tracking

#### Step 0: Request Initialization
- Request ID, timestamp, client IP
- Full URL and all request headers
- Range header detection
- Memory snapshot

#### Step 1-3: Fetch Preparation
- URL parsing and validation
- Fetch options configuration
- Timeout and keepalive settings
- Shadowlands detection
- Header strategy selection

#### Step 4: Response Analysis
- Complete response headers
- Content type, length, encoding
- Server information
- Cache control headers
- Accept-ranges support
- Memory snapshot

#### Step 5: Content Type Detection
- M3U8 playlist detection
- TS segment detection
- Subtitle file detection
- Detection method used
- Processing strategy selected

#### Step 6-9: Content Processing
**For M3U8 Playlists:**
- Content reading duration
- Line count and structure analysis
- URL rewriting process
- Buffer creation
- Final response assembly

**For Subtitles:**
- Content reading duration
- WebVTT/SRT detection
- Content type correction
- Buffer creation

**For TS Segments:**
- Content type fixing (image → video/mp2t)
- Lightningbolt URL handling
- Direct streaming setup

**For Other Content:**
- Direct streaming setup
- Header preparation

### 3. Error Tracking

#### Fetch Exceptions
- Error name, message, code, cause
- Full stack trace (first 10 lines)
- Error categorization:
  - Timeout errors
  - Network errors
  - DNS errors
  - Connection refused/reset
  - SSL/TLS errors
- Retry attempt logging

#### Processing Errors
- M3U8 processing failures with fallback
- Subtitle processing failures with fallback
- Error body reading attempts
- Memory state at error time

### 4. Performance Metrics
- Individual operation timing
- Total request duration
- Fetch duration
- Processing duration (M3U8, subtitle, TS)
- Memory usage at key points

### 5. Visual Indicators
```
🚨 Request incoming
🌐 Making fetch request
📡 Response received
✅ Success
🔴 Error
🟡 Warning
🔵 Info
🔍 Debug
⏱️  Timing
💾 Memory
📍 Step markers
💥 Exception caught
💀 Fatal error
```

## Log Output Format

### Standard Log Entry
```
🔵 [2024-11-11T10:30:45.123Z] [proxy_1699701045123] INFO: Message
📊 Data: {
  "key": "value"
}
────────────────────────────────────────────────────────────────────────────────
```

### Step Log Entry
```
📍 [2024-11-11T10:30:45.123Z] [proxy_1699701045123] STEP 1: FETCH PREPARATION
📝 Step Data: {
  "targetUrl": "https://example.com/stream.m3u8",
  "method": "GET"
}
────────────────────────────────────────────────────────────────────────────────
```

### Memory Log Entry
```
💾 [2024-11-11T10:30:45.123Z] [proxy_1699701045123] MEMORY USAGE:
   RSS: 145MB
   Heap Used: 89MB
   Heap Total: 120MB
   External: 12MB
────────────────────────────────────────────────────────────────────────────────
```

## Debugging Workflow

### For Successful Requests
1. Look for "REQUEST INCOMING" banner
2. Follow numbered steps (0-9)
3. Check memory usage at key points
4. Verify "SUCCESS" messages
5. Review total duration

### For Failed Requests
1. Look for "FATAL ERROR" banner
2. Check error category (TIMEOUT, NETWORK, DNS, etc.)
3. Review error stack trace
4. Check retry attempts
5. Verify error response body
6. Review memory state at failure

### For Performance Issues
1. Check individual step durations
2. Review fetch duration
3. Check processing durations (M3U8, subtitle)
4. Monitor memory usage trends
5. Look for retry attempts

## Key Data Points Logged

### Request Phase
- Client IP and user agent
- Full URL and parameters
- All request headers
- Range requests
- Source parameter

### Fetch Phase
- Target URL and host
- Request method and options
- Timeout configuration
- Header strategy used
- Retry attempts

### Response Phase
- Status code and text
- All response headers
- Content type and length
- Encoding information
- Range support

### Processing Phase
- Content type detection
- Processing method selected
- Content reading duration
- Buffer sizes
- URL rewriting (M3U8)
- Content type fixing (TS)

### Error Phase
- Error type and category
- Error message and code
- Stack trace
- Retry information
- Fallback attempts
- Suggestions for resolution

## Monitoring Tips

1. **Search for specific request IDs** to trace a single request through the entire lifecycle
2. **Filter by error categories** to identify patterns in failures
3. **Monitor memory usage** to detect memory leaks
4. **Track fetch durations** to identify slow upstream sources
5. **Review retry patterns** to optimize retry configuration
6. **Check content type detection** to ensure proper handling

## Common Issues and Log Patterns

### Timeout Issues
```
🔴 ERROR: FETCH EXCEPTION
errorName: "AbortError"
errorCategory: "TIMEOUT"
```

### Network Issues
```
🔴 ERROR: FETCH EXCEPTION
errorName: "TypeError"
errorCategory: "NETWORK"
```

### DNS Issues
```
🔴 ERROR: FETCH EXCEPTION
errorCode: "ENOTFOUND"
errorCategory: "DNS"
```

### M3U8 Processing Issues
```
🔴 ERROR: M3U8 PROCESSING FAILED - USING FALLBACK
🟡 WARN: Attempting to read original M3U8 content as fallback
```

### Content Type Issues
```
📍 STEP 6: STARTING TS SEGMENT PROCESSING
hasWrongContentType: true
contentTypeFixed: true
```
