# Live Activity Tracking Guide

## Overview

The live activity tracking system provides real-time monitoring of user activity on your platform. See who's watching what, right now!

## Features

### Real-Time Monitoring
- Live user count
- Current watching activity
- Browsing activity
- Device distribution
- Geographic distribution
- Most watched content

### Auto-Refresh
- Updates every 5 seconds
- Pause/resume functionality
- Manual refresh option
- Stale activity cleanup

### Detailed Activity Cards
- User activity type (watching/browsing)
- Content being watched
- Playback progress
- Quality settings
- Device type
- Country
- Time since last activity

## Database Schema

### live_activity Table

```sql
CREATE TABLE live_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  content_id TEXT,
  content_title TEXT,
  content_type TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  current_position INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  quality TEXT,
  device_type TEXT,
  country TEXT,
  started_at BIGINT NOT NULL,
  last_heartbeat BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at BIGINT,
  updated_at BIGINT
)
```

**Indexes:**
- `user_id` - Fast user lookups
- `session_id` - Session tracking
- `last_heartbeat` - Recent activity queries
- `is_active, last_heartbeat` - Active users composite index

## API Endpoints

### POST /api/analytics/live-activity

Update or create live activity heartbeat.

**Request Body:**
```json
{
  "userId": "user_abc123",
  "sessionId": "session_xyz789",
  "activityType": "watching",
  "contentId": "12345",
  "contentTitle": "Example Movie",
  "contentType": "movie",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "currentPosition": 1800,
  "duration": 3600,
  "quality": "1080p",
  "country": "US"
}
```

**Response:**
```json
{
  "success": true,
  "activityId": "live_user_abc123_session_xyz789"
}
```

### GET /api/analytics/live-activity

Retrieve current live activities.

**Query Parameters:**
- `maxAge` (optional): Maximum age in minutes (default: 5)

**Response:**
```json
{
  "success": true,
  "activities": [...],
  "stats": {
    "totalActive": 25,
    "watching": 18,
    "browsing": 7,
    "byDevice": {
      "desktop": 15,
      "mobile": 8,
      "tablet": 2
    },
    "byCountry": {
      "US": 10,
      "UK": 5,
      "CA": 3
    },
    "topContent": [
      {
        "contentId": "12345",
        "contentTitle": "Popular Movie",
        "contentType": "movie",
        "count": 5
      }
    ]
  }
}
```

### DELETE /api/analytics/live-activity

Deactivate a live activity.

**Query Parameters:**
- `id` (required): Activity ID to deactivate

**Response:**
```json
{
  "success": true
}
```

## Client-Side Integration

### Automatic Heartbeats

The analytics service automatically sends heartbeats every 30 seconds:

```typescript
// Automatically initialized
analyticsService.initialize();

// Heartbeats sent automatically
// - Every 30 seconds while page is active
// - Stops when page is hidden
// - Resumes when page becomes visible
// - Deactivates on page unload
```

### Manual Activity Updates

Update activity when user starts watching:

```typescript
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

const { updateActivity } = useAnalytics();

// When user starts watching
updateActivity({
  type: 'watching',
  contentId: '12345',
  contentTitle: 'Movie Title',
  contentType: 'movie',
  currentPosition: 0,
  duration: 3600,
  quality: '1080p',
});

// When user stops watching
updateActivity({
  type: 'browsing',
});
```

### Integrated with Video Player

The video player automatically updates live activity:

```typescript
// In useWatchProgress hook
handleWatchStart(currentTime, duration);
// Automatically calls updateActivity with watching status

handleProgress(currentTime, duration);
// Automatically updates current position every 5 seconds
```

## Admin Dashboard

### Accessing Live Activity

Navigate to `/admin/live` to view the live activity dashboard.

### Dashboard Sections

#### 1. Summary Stats
- **Active Users**: Total users currently active
- **Watching Now**: Users currently watching content
- **Browsing**: Users browsing the site
- **Device Types**: Number of different device types

#### 2. Device Breakdown
- Visual bar chart
- Percentage distribution
- Real-time counts

#### 3. Country Breakdown
- Top 5 countries
- Visual bar chart
- Percentage distribution

#### 4. Most Watched Right Now
- Content currently being watched
- Number of viewers per content
- Content type indicators

#### 5. Active Sessions List
- Detailed activity cards
- Real-time progress bars
- Time since last activity
- Device and quality info
- Geographic location

### Auto-Refresh

- **Enabled by default**: Updates every 5 seconds
- **Pause button**: Stop auto-refresh
- **Resume button**: Restart auto-refresh
- **Manual refresh**: Force immediate update

## Activity Types

### Watching
- User is actively watching content
- Shows content title and progress
- Updates position every 5 seconds
- Includes quality and device info

### Browsing
- User is on the site but not watching
- No content information
- Basic device and location info
- Heartbeat every 30 seconds

## Stale Activity Cleanup

### Automatic Cleanup

Activities are automatically marked as inactive if:
- No heartbeat received for 10 minutes
- User closes browser/tab
- User navigates away
- Page becomes hidden

### Manual Cleanup

The system runs cleanup on every GET request:
- Deactivates activities older than 2x maxAge
- Removes from active list
- Preserves in database for analytics

## Performance Considerations

### Heartbeat Frequency

- **30 seconds**: Balance between real-time and server load
- **5 seconds**: Progress updates during playback
- **Configurable**: Can be adjusted per use case

### Database Optimization

- Indexed queries for fast lookups
- Composite indexes for active users
- Efficient UPDATE operations
- Automatic cleanup of stale data

### Client-Side Optimization

- Batched updates
- Debounced progress updates
- Minimal payload size
- keepalive for page unload

## Privacy & Security

### Data Collection

- **Anonymous user IDs**: No PII
- **Hashed IPs**: Privacy-first
- **Country-level location**: No precise geolocation
- **Generic device types**: No fingerprinting

### Data Retention

- **Active data**: Last 10 minutes
- **Historical data**: Can be archived
- **Cleanup**: Automatic stale removal
- **GDPR compliant**: No personal data

## Use Cases

### Content Popularity

**Question**: What's trending right now?

**Look at**:
- Most Watched Right Now section
- Number of viewers per content
- Real-time popularity

### Peak Usage Times

**Question**: When are users most active?

**Look at**:
- Active Users count over time
- Time-based patterns
- Geographic distribution

### Device Insights

**Question**: What devices are users using?

**Look at**:
- Device breakdown
- Desktop vs mobile ratio
- Tablet usage

### Geographic Distribution

**Question**: Where are users watching from?

**Look at**:
- Country breakdown
- Regional patterns
- Time zone considerations

### Engagement Monitoring

**Question**: Are users actually watching?

**Look at**:
- Watching vs Browsing ratio
- Progress percentages
- Session durations

## Troubleshooting

### No Live Activity Showing

**Possible causes**:
1. No users currently active
2. Heartbeats not being sent
3. Database connection issue

**Solutions**:
- Wait for users to visit
- Check browser console for errors
- Verify DATABASE_URL is set
- Check analytics initialization

### Stale Data

**Possible causes**:
1. Auto-refresh paused
2. Network issues
3. Server errors

**Solutions**:
- Click "Resume Auto-refresh"
- Click "Refresh Now"
- Check network tab
- Check server logs

### Incorrect Counts

**Possible causes**:
1. Cleanup not running
2. Duplicate activities
3. Time zone issues

**Solutions**:
- Adjust maxAge parameter
- Check for duplicate heartbeats
- Verify server time

## Best Practices

### 1. Monitor Regularly

- Check during peak hours
- Identify usage patterns
- Track content popularity
- Monitor device trends

### 2. Use for Content Strategy

- Promote popular content
- Schedule releases for peak times
- Optimize for popular devices
- Target geographic regions

### 3. Performance Monitoring

- Watch active user counts
- Monitor server load
- Optimize heartbeat frequency
- Clean up stale data

### 4. Privacy First

- Never collect PII
- Hash sensitive data
- Aggregate statistics
- Be transparent

## Integration Examples

### Custom Activity Tracking

```typescript
// Track custom activity
analyticsService.updateActivity({
  type: 'browsing',
  // Add custom fields as needed
});
```

### Progress Updates

```typescript
// Update progress during playback
const updateProgress = (position: number, duration: number) => {
  analyticsService.updateActivity({
    type: 'watching',
    contentId: currentContent.id,
    contentTitle: currentContent.title,
    currentPosition: Math.round(position),
    duration: Math.round(duration),
    quality: currentQuality,
  });
};
```

### Activity Deactivation

```typescript
// Manually deactivate on logout
const handleLogout = async () => {
  const session = analyticsService.getUserSession();
  if (session) {
    const activityId = `live_${session.userId}_${session.sessionId}`;
    await fetch(`/api/analytics/live-activity?id=${activityId}`, {
      method: 'DELETE',
    });
  }
};
```

## Future Enhancements

Potential additions:

- **Real-time Charts**: Live graphs of activity
- **Alerts**: Notifications for milestones
- **Heatmaps**: Visual activity patterns
- **Session Recording**: Playback user sessions
- **A/B Testing**: Live experiment monitoring
- **Chat Integration**: Live user chat
- **Admin Actions**: Kick/ban users
- **Broadcast Messages**: Send to active users
- **Quality Monitoring**: Track buffering/errors
- **Bandwidth Usage**: Real-time bandwidth stats

## Support

For issues or questions:
1. Check browser console for errors
2. Verify analytics initialization
3. Check server logs
4. Test API endpoints manually
5. Review database queries

---

**You now have real-time activity monitoring! 🎉**

See exactly who's watching what, right now, with automatic updates every 5 seconds.
