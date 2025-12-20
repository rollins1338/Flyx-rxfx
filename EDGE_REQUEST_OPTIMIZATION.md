# Edge Request Optimization Summary

## Changes Made (December 2024)

### 1. Presence Heartbeat Optimization
- **Interval**: 30s → 60s (50% reduction)
- **Min gap**: 5s → 10s (better throttling)
- **Inactivity timeout**: 2min → 3min

### 2. Analytics Service Optimization
- **Page view sync**: 30s → 60s (50% reduction)
- **Watch time sync**: 15s → 30s (50% reduction)

### 3. Deduplication Optimization
- **Heartbeat expiry**: 2min → 3min
- **Rate limit gap**: 5s → 10s

## Estimated Impact
- ~50% reduction in analytics API calls
- Real-time analytics still accurate (60s is sufficient for "live" counts)

## Further Optimizations (If Needed)

### Option A: Disable Non-Critical Analytics
If edge requests are still too high, consider disabling some analytics:

```typescript
// In PresenceProvider.tsx - add at top
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';

// Then wrap heartbeat calls:
if (ANALYTICS_ENABLED) {
  sendHeartbeat(true);
}
```

### Option B: Batch Multiple Analytics into Single Request
Create a unified `/api/analytics/batch` endpoint that accepts:
- Presence heartbeat
- Page view data
- Watch session data
- User engagement

This reduces 4 separate requests to 1.

### Option C: Use Vercel Edge Config for Feature Flags
Store analytics settings in Edge Config to dynamically enable/disable features.

### Option D: Move Analytics to External Service
Consider using a dedicated analytics service like:
- Plausible (privacy-focused)
- PostHog (self-hostable)
- Mixpanel

This offloads all analytics requests from Vercel.

## Current Analytics Endpoints
1. `/api/analytics/presence` - Real-time presence (60s interval)
2. `/api/analytics/page-view` - Page metrics (60s interval)
3. `/api/analytics/track` - Event batching (on-demand)
4. `/api/analytics/watch-session` - Watch progress (30s interval)
5. `/api/analytics/user-engagement` - Session metrics (on exit)
6. `/api/analytics/user-metrics` - User stats (with watch time)
7. `/api/analytics/live-activity` - Live activity (admin only)
8. `/api/analytics/livetv-session` - Live TV stats (admin only)
9. `/api/analytics/server-hit` - Server-side tracking

## Non-Analytics High-Traffic Routes
1. `/api/content/*` - Content fetching (cached)
2. `/api/tmdb/*` - TMDB proxy (cached)
3. `/api/stream/extract` - Stream extraction (per video)
4. `/api/livetv/*` - Live TV (per channel)
