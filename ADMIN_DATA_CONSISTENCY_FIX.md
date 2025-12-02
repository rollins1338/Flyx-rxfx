# Admin Panel - Single Source of Truth (FIXED)

## Issues Fixed

### 1. Multiple Data Sources → Single Source
- **Before**: Each page made its own API calls, calculated metrics differently
- **After**: ALL pages use `useStats()` hook which calls `/api/admin/unified-stats`

### 2. Duplicate Users → Unique Users Only
- **Before**: Same user could appear multiple times in lists
- **After**: SQL uses `DISTINCT ON` (PostgreSQL) or `GROUP BY` to ensure unique users

### 3. Invalid Timestamps → Validated Timestamps
- **Before**: Dates like "Jan 1, 1970" or future dates could appear
- **After**: All timestamps validated to be within reasonable range (10 years ago to now)

### 4. Fake/Inflated Data → Accurate Counts
- **Before**: Metrics could be inflated by counting same user multiple times
- **After**: Single SQL query calculates all user metrics with proper DISTINCT counts

## Architecture

### Single Source of Truth: `/api/admin/unified-stats`

```
┌─────────────────────────────────────────────────────────┐
│                    StatsContext                          │
│              (auto-refreshes every 30s)                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              /api/admin/unified-stats                    │
│                                                          │
│  • Real-time: live_activity (5 min heartbeat)           │
│  • Users: user_activity (DISTINCT counts)               │
│  • Content: watch_sessions (validated timestamps)       │
│  • Geographic: user_activity (valid country codes)      │
│  • Devices: user_activity (grouped by type)             │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      Dashboard        Users Page      All Pages
      (same #s)        (same #s)       (same #s)
```

### Timestamp Validation

All timestamps are validated:
```typescript
function isValidTimestamp(ts: number): boolean {
  if (!ts || ts <= 0) return false;
  const now = Date.now();
  const tenYearsAgo = now - (10 * 365 * 24 * 60 * 60 * 1000);
  return ts >= tenYearsAgo && ts <= now + 60000;
}
```

### User Deduplication

SQL ensures unique users:
```sql
-- PostgreSQL
SELECT DISTINCT ON (user_id) ...
ORDER BY user_id, last_seen DESC

-- SQLite
SELECT ... GROUP BY user_id
ORDER BY last_seen DESC
```

### Metrics Calculation (Single Query)

All user metrics calculated in ONE query to ensure consistency:
```sql
SELECT 
  COUNT(DISTINCT user_id) as total,
  COUNT(DISTINCT CASE WHEN last_seen >= $oneDayAgo THEN user_id END) as dau,
  COUNT(DISTINCT CASE WHEN last_seen >= $oneWeekAgo THEN user_id END) as wau,
  COUNT(DISTINCT CASE WHEN last_seen >= $oneMonthAgo THEN user_id END) as mau,
  COUNT(DISTINCT CASE WHEN first_seen >= $oneDayAgo THEN user_id END) as new_today
FROM user_activity
WHERE first_seen > 0 AND last_seen > 0
```

## How to Use

### In Admin Pages

```tsx
import { useStats } from '../context/StatsContext';

export default function MyAdminPage() {
  const { stats: unifiedStats } = useStats();
  
  // These are THE numbers - same everywhere
  const totalUsers = unifiedStats.totalUsers;
  const dau = unifiedStats.activeToday;
  const wau = unifiedStats.activeThisWeek;
  const mau = unifiedStats.activeThisMonth;
  const liveUsers = unifiedStats.liveUsers;
}
```

### For User Lists

Use `/api/admin/users` which:
- Returns unique users only (no duplicates)
- Validates all timestamps
- Filters out invalid data
- Provides consistent counts

## Files Updated

- `app/api/admin/unified-stats/route.ts` - Single source API
- `app/api/admin/users/route.ts` - User list with deduplication
- `app/admin/users/page.tsx` - User profiles with validation
- `app/admin/components/OverviewStats.tsx` - Uses unified stats
- `app/admin/engagement/page.tsx` - Uses unified stats
- `app/admin/live/page.tsx` - Uses unified stats
- `app/admin/geographic/page.tsx` - Uses unified stats
- `app/admin/sessions/page.tsx` - Uses unified stats
