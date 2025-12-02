# Admin Panel Data Consistency Fix

## Problem
Different admin pages were showing different numbers for the same metrics (e.g., active users, total users, DAU/WAU) because each page was:
1. Making its own API calls to different endpoints
2. Calculating metrics differently (different time windows, different tables)
3. Not sharing data between pages

## Solution: Single Source of Truth

All admin pages now use the `StatsContext` which fetches data from a single unified API endpoint (`/api/admin/unified-stats`).

### Key Metrics (from unified stats)
These metrics are now consistent across ALL admin pages:
- **Live Users** - Real-time active users
- **Total Users** - All-time unique users
- **DAU (Daily Active Users)** - Users active in last 24 hours
- **WAU (Weekly Active Users)** - Users active in last 7 days
- **MAU (Monthly Active Users)** - Users active in last 30 days
- **New Users Today** - First-time users in last 24 hours
- **Returning Users** - Users who came back today
- **Total Sessions** - Watch sessions today
- **Total Watch Time** - Minutes watched today
- **Avg Session Duration** - Average session length
- **Completion Rate** - Average content completion
- **Geographic Data** - Top countries
- **Device Breakdown** - Device distribution

### How to Use in Admin Pages

```tsx
import { useStats } from '../context/StatsContext';

export default function MyAdminPage() {
  const { stats: unifiedStats, loading, refresh } = useStats();
  
  // Use unified stats for key metrics
  const totalUsers = unifiedStats.totalUsers;
  const dau = unifiedStats.activeToday;
  const wau = unifiedStats.activeThisWeek;
  const liveUsers = unifiedStats.liveUsers;
  
  // ...
}
```

### Pages Updated
- `app/admin/components/OverviewStats.tsx` - Main dashboard stats
- `app/admin/users/page.tsx` - User analytics
- `app/admin/engagement/page.tsx` - Engagement metrics
- `app/admin/live/page.tsx` - Live activity monitor
- `app/admin/geographic/page.tsx` - Geographic analytics
- `app/admin/sessions/page.tsx` - Session analytics

### Data Flow
```
StatsContext (provider in AdminLayout)
    ↓
/api/admin/unified-stats (single API call)
    ↓
All admin pages use useStats() hook
    ↓
Consistent data everywhere!
```

### Auto-Refresh
The unified stats automatically refresh every 30 seconds, keeping all pages in sync.

### Detailed Data
Pages can still fetch additional detailed data (like individual user lists, session details, etc.) from other endpoints, but the KEY METRICS shown in cards/summaries should always come from unified stats.
