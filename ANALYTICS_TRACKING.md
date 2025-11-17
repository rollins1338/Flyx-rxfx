# Enhanced Watch Session Analytics

## Overview

The analytics system now tracks detailed watch sessions including what content was watched, how long users watched, session duration, pause/seek behavior, device types, and quality settings.

## Features

### Watch Session Tracking

Each watch session captures:
- **Content Information**: Title, ID, type (movie/TV), season/episode numbers
- **Timing Data**: Start time, end time, total watch time, last position
- **Completion Metrics**: Duration, completion percentage, completed status
- **User Behavior**: Pause count, seek count
- **Technical Details**: Quality setting, device type
- **Session Context**: User ID, session ID

### Database Schema

New `watch_sessions` table with the following fields:

```sql
CREATE TABLE watch_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_title TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  total_watch_time INTEGER DEFAULT 0,
  last_position INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,
  completion_percentage REAL DEFAULT 0,
  quality TEXT,
  device_type TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  pause_count INTEGER DEFAULT 0,
  seek_count INTEGER DEFAULT 0,
  created_at BIGINT,
  updated_at BIGINT
)
```

### API Endpoints

#### POST /api/analytics/watch-session
Track or update a watch session.

**Request Body:**
```json
{
  "id": "ws_123456789_abc",
  "sessionId": "session_xyz",
  "userId": "user_abc",
  "contentId": "12345",
  "contentType": "movie",
  "contentTitle": "Example Movie",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "startedAt": 1700000000000,
  "endedAt": 1700003600000,
  "totalWatchTime": 3420,
  "lastPosition": 3500,
  "duration": 3600,
  "completionPercentage": 95,
  "quality": "1080p",
  "isCompleted": true,
  "pauseCount": 3,
  "seekCount": 5
}
```

**Response:**
```json
{
  "success": true
}
```

#### GET /api/analytics/watch-session
Retrieve watch sessions with optional filters.

**Query Parameters:**
- `userId` - Filter by user ID
- `contentId` - Filter by content ID
- `startDate` - Filter sessions started after this timestamp
- `endDate` - Filter sessions started before this timestamp
- `limit` - Maximum number of sessions to return

**Response:**
```json
{
  "success": true,
  "sessions": [...],
  "analytics": {
    "totalSessions": 150,
    "totalWatchTime": 450000,
    "averageWatchTime": 3000,
    "averageCompletionRate": 75.5,
    "totalPauses": 450,
    "totalSeeks": 300,
    "completedSessions": 100,
    "completionRate": 67,
    "deviceBreakdown": {
      "desktop": 80,
      "mobile": 50,
      "tablet": 20
    },
    "qualityBreakdown": {
      "1080p": 100,
      "720p": 40,
      "auto": 10
    }
  }
}
```

## Client-Side Integration

### Analytics Service

The `analyticsService` automatically tracks watch events:

```typescript
import { analyticsService } from '@/lib/services/analytics';

// Track watch event
analyticsService.trackWatchEvent({
  contentId: '12345',
  contentType: 'movie',
  contentTitle: 'Example Movie',
  action: 'start', // 'start' | 'pause' | 'resume' | 'progress' | 'complete'
  currentTime: 0,
  duration: 3600,
  quality: '1080p',
  seasonNumber: 1,
  episodeNumber: 1,
});
```

### Watch Progress Hook

The `useWatchProgress` hook integrates with the analytics system:

```typescript
import { useWatchProgress } from '@/lib/hooks/useWatchProgress';

const { handleProgress, handleWatchStart, handleWatchPause } = useWatchProgress({
  contentId: '12345',
  contentType: 'movie',
  contentTitle: 'Example Movie',
  seasonNumber: 1,
  episodeNumber: 1,
  onProgress: (time, duration) => {
    // Called on progress updates
  },
  onComplete: () => {
    // Called when content is completed
  },
});
```

## Admin Dashboard

Access the analytics dashboard at `/admin/analytics` to view:

- **Summary Statistics**: Total sessions, watch time, completion rates
- **Device Breakdown**: Sessions by device type (desktop, mobile, tablet, TV)
- **Quality Breakdown**: Sessions by quality setting
- **Recent Sessions**: Detailed table of recent watch sessions

### Time Range Filters

- 24 Hours
- 7 Days
- 30 Days
- All Time

## Automatic Tracking

The system automatically tracks:

1. **Session Start**: When video playback begins
2. **Progress Updates**: Every 5 seconds during playback
3. **Pause Events**: When user pauses the video
4. **Resume Events**: When user resumes playback
5. **Seek Events**: When user jumps to a different position
6. **Completion**: When user reaches 90% or completes the video

## Session Management

Watch sessions are:
- Created on first play
- Updated during playback every 30 seconds
- Synced to server on completion or periodically
- Stored in sessionStorage for persistence across page refreshes
- Automatically cleaned up on session end

## Privacy & Data

- User IDs are anonymized
- IP addresses are hashed
- Sessions expire after 30 days
- No personally identifiable information is stored

## Performance

- Minimal overhead with batched updates
- Efficient database queries with proper indexing
- Automatic cleanup of old sessions
- Optimized for both PostgreSQL (Neon) and SQLite

## Future Enhancements

Potential improvements:
- Real-time analytics dashboard
- Content recommendation based on watch patterns
- A/B testing for player features
- Engagement heatmaps
- Watch party analytics
- Bandwidth usage tracking
