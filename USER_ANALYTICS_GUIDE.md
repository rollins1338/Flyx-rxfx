## User Analytics & Tracking

## Overview

The enhanced analytics system now tracks comprehensive user metrics including Daily Active Users (DAU), Weekly Active Users (WAU), Monthly Active Users (MAU), new user acquisition, retention rates, and engagement metrics.

## Key Metrics

### Active Users

- **DAU (Daily Active Users)**: Unique users active in the last 24 hours
- **WAU (Weekly Active Users)**: Unique users active in the last 7 days
- **MAU (Monthly Active Users)**: Unique users active in the last 30 days
- **Total Active Users**: All unique users in the selected time period

### User Growth

- **New Users**: Users who first appeared in the time period
- **Returning Users**: Users who were active before and returned
- **Retention Rate**: Percentage of returning users vs total active users
- **Growth Rate**: Percentage change compared to previous period

### Engagement Metrics

- **Total Sessions**: Number of watch sessions
- **Avg Sessions per User**: Average sessions per active user
- **Avg Session Duration**: Average time spent per session
- **DAU/MAU Ratio**: Stickiness metric (higher is better)

## Database Schema

### user_activity Table

Tracks individual user activity over time:

```sql
CREATE TABLE user_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  first_seen BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  total_sessions INTEGER DEFAULT 1,
  total_watch_time INTEGER DEFAULT 0,
  device_type TEXT,
  user_agent TEXT,
  country TEXT,
  created_at BIGINT,
  updated_at BIGINT
)
```

### daily_user_metrics Table

Stores pre-calculated daily metrics:

```sql
CREATE TABLE daily_user_metrics (
  date TEXT PRIMARY KEY,
  daily_active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  returning_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_watch_time INTEGER DEFAULT 0,
  avg_session_duration REAL DEFAULT 0,
  unique_content_views INTEGER DEFAULT 0,
  updated_at BIGINT
)
```

## API Endpoints

### GET /api/analytics/user-metrics

Retrieve user metrics for a specified time period.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)
- `includeDaily` (optional): Include daily breakdown (true/false)

**Response:**
```json
{
  "success": true,
  "metrics": {
    "dau": 150,
    "wau": 450,
    "mau": 1200,
    "newUsers": 300,
    "returningUsers": 900,
    "totalSessions": 3500,
    "avgSessionDuration": 1800,
    "retentionRate": 75,
    "avgSessionsPerUser": 2.9,
    "totalActiveUsers": 1200
  },
  "growth": {
    "dau": 15,
    "wau": 12,
    "mau": 8,
    "newUsers": 25,
    "sessions": 18
  },
  "dailyMetrics": [...],
  "period": {
    "days": 30,
    "start": 1700000000000,
    "end": 1702592000000
  }
}
```

### POST /api/analytics/user-metrics

Manually trigger daily metrics calculation.

**Request Body:**
```json
{
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Daily metrics updated for 2024-01-15"
}
```

### GET /api/cron/update-metrics

Automated endpoint for daily metrics updates (called by Vercel Cron).

**Headers:**
- `Authorization: Bearer YOUR_CRON_SECRET`

**Response:**
```json
{
  "success": true,
  "message": "Daily metrics updated successfully",
  "dates": ["2024-01-15", "2024-01-14"]
}
```

## Admin Dashboard

### Accessing User Analytics

Navigate to `/admin/users` to view comprehensive user analytics.

### Dashboard Sections

#### 1. Active Users
- DAU, WAU, MAU metrics
- Growth indicators
- Total active users

#### 2. User Growth
- New user acquisition
- Returning user count
- Retention rate
- New vs Returning ratio

#### 3. Engagement
- Total sessions
- Average sessions per user
- Average session duration
- DAU/MAU stickiness ratio

#### 4. Daily Breakdown
- Table showing daily metrics
- Last 30 days of data
- Sortable columns

#### 5. Insights
- Automated insights based on metrics
- Growth analysis
- Retention analysis
- Engagement recommendations
- Stickiness evaluation

### Time Range Filters

- **7 Days**: Last week's activity
- **30 Days**: Last month (default)
- **90 Days**: Last quarter

## Automated Metrics Updates

### Vercel Cron Job

The system automatically updates daily metrics at midnight UTC using Vercel Cron.

**Configuration** (in `vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/update-metrics",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Manual Updates

You can manually trigger metrics updates:

```bash
curl -X POST https://your-app.vercel.app/api/cron/update-metrics \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Or via the API:

```bash
curl -X POST https://your-app.vercel.app/api/analytics/user-metrics \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}'
```

## Understanding the Metrics

### DAU/MAU Ratio (Stickiness)

This ratio indicates how "sticky" your app is:

- **>20%**: Excellent - Users return frequently
- **10-20%**: Good - Moderate engagement
- **<10%**: Needs improvement - Low daily usage

### Retention Rate

Percentage of users who return after their first visit:

- **>60%**: Excellent retention
- **40-60%**: Good retention
- **<40%**: Needs improvement

### Average Sessions per User

How many times users engage:

- **>3**: High engagement
- **1.5-3**: Moderate engagement
- **<1.5**: Low engagement

## User Tracking Flow

### 1. User Activity Tracking

When a user interacts with the app:
1. Analytics service tracks the event
2. User activity is recorded/updated in `user_activity` table
3. Session information is stored
4. Device and location data captured

### 2. Daily Aggregation

Every day at midnight:
1. Cron job triggers `/api/cron/update-metrics`
2. System calculates metrics for yesterday and today
3. Results stored in `daily_user_metrics` table
4. Historical data preserved for trending

### 3. Dashboard Display

When admin views `/admin/users`:
1. Fetches metrics for selected time range
2. Calculates growth rates
3. Generates insights
4. Displays daily breakdown

## Privacy & Compliance

### Data Collection

- **User IDs**: Anonymized, no PII
- **IP Addresses**: Hashed with salt
- **Device Info**: Generic device type only
- **Location**: Country-level only

### Data Retention

- User activity: Indefinite (for analytics)
- Daily metrics: Indefinite (aggregated)
- Individual sessions: Can be purged after 90 days

### GDPR Compliance

- No personal data collected
- Users are anonymized
- Data can be deleted on request
- Transparent data usage

## Performance Optimization

### Indexes

Optimized indexes for fast queries:
- `user_id` for user lookups
- `first_seen` for new user queries
- `last_seen` for active user queries
- `date` for daily metrics

### Query Optimization

- Pre-calculated daily metrics
- Efficient date range queries
- Indexed timestamp fields
- Minimal joins

### Caching Strategy

Consider implementing:
- Redis cache for current day metrics
- CDN caching for historical data
- In-memory cache for frequently accessed data

## Troubleshooting

### No User Data Showing

**Possible causes:**
1. No users have visited yet
2. Analytics not initialized
3. Database connection issue

**Solutions:**
- Check if analytics service is initialized
- Verify DATABASE_URL is set
- Check browser console for errors

### Metrics Not Updating

**Possible causes:**
1. Cron job not running
2. CRON_SECRET not set
3. Database write permissions

**Solutions:**
- Check Vercel Cron logs
- Verify CRON_SECRET environment variable
- Test manual update endpoint
- Check database permissions

### Incorrect Growth Rates

**Possible causes:**
1. Insufficient historical data
2. Time zone issues
3. Calculation errors

**Solutions:**
- Wait for more data to accumulate
- Verify server time zone settings
- Check daily metrics table for gaps

## Best Practices

### 1. Regular Monitoring

- Check metrics daily
- Look for unusual patterns
- Track growth trends
- Monitor retention rates

### 2. Data-Driven Decisions

- Use metrics to guide features
- A/B test based on engagement
- Focus on retention improvements
- Optimize for stickiness

### 3. Performance Monitoring

- Watch query performance
- Monitor database size
- Optimize slow queries
- Archive old data if needed

### 4. Privacy First

- Never collect PII
- Hash sensitive data
- Provide data deletion
- Be transparent

## Future Enhancements

Potential additions:

- **Cohort Analysis**: Track user cohorts over time
- **Funnel Analysis**: Conversion funnels
- **User Segmentation**: Group users by behavior
- **Predictive Analytics**: Churn prediction
- **Real-time Metrics**: Live DAU/MAU updates
- **Custom Events**: Track specific user actions
- **Export Functionality**: CSV/Excel exports
- **Alerts**: Automated alerts for metric changes
- **Comparative Analysis**: Compare time periods
- **Geographic Analysis**: Regional breakdowns

## API Integration Examples

### Fetch Current Metrics

```typescript
const response = await fetch('/api/analytics/user-metrics?days=30&includeDaily=true');
const data = await response.json();

console.log(`DAU: ${data.metrics.dau}`);
console.log(`MAU: ${data.metrics.mau}`);
console.log(`Retention: ${data.metrics.retentionRate}%`);
```

### Update Daily Metrics

```typescript
const response = await fetch('/api/analytics/user-metrics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ date: '2024-01-15' })
});

const data = await response.json();
console.log(data.message);
```

### Schedule Custom Updates

```typescript
// Update metrics for last 7 days
const dates = [];
for (let i = 0; i < 7; i++) {
  const date = new Date();
  date.setDate(date.getDate() - i);
  dates.push(date.toISOString().split('T')[0]);
}

for (const date of dates) {
  await fetch('/api/analytics/user-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date })
  });
}
```

## Support

For issues or questions:
1. Check Vercel deployment logs
2. Review database query logs
3. Verify environment variables
4. Test API endpoints manually
5. Check browser console for errors
