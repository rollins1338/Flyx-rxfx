# Admin Panel Setup Guide

This guide will help you set up the admin panel for your FlyX streaming platform with analytics tracking.

## Features

- **Admin Authentication**: Secure login system for site administrators
- **Analytics Dashboard**: Real-time analytics and user behavior tracking
- **Anonymous Data Collection**: Privacy-focused analytics that collect:
  - Geographic data (Country/State/Region)
  - Content viewing statistics
  - Watch time and completion rates
  - Device type information
  - Session analytics

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
bun install
```

### 2. Environment Variables

Add these to your `.env.local` file:

```env
# JWT Secret for admin authentication
JWT_SECRET=your-super-secret-jwt-key-here

# Optional: Salt for IP hashing (for privacy)
IP_SALT=your-ip-salt-here
```

### 3. Initialize Database

The database will be automatically created when you first run the application. The SQLite database will be stored at `server/db/analytics.db`.

### 4. Create Admin User

Run the admin creation script:

```bash
npm run admin:create admin your-password
```

Replace `admin` and `your-password` with your desired username and password.

### 5. Start the Application

```bash
npm run dev
```

### 6. Access Admin Panel

Navigate to `/admin` in your browser and log in with the credentials you created.

## Admin Panel Features

### Dashboard Overview
- Total views and watch time
- Unique sessions count
- Average session duration
- Real-time statistics

### Analytics Charts
- Daily metrics visualization
- View trends over time
- Watch time analytics

### Content Statistics
- Top performing content
- Completion rates
- Content-specific analytics

### User Activity
- Geographic distribution of users
- Device type breakdown
- Anonymous session tracking

## Privacy & Data Collection

The analytics system is designed with privacy in mind:

- **No Personal Data**: No personally identifiable information is collected
- **IP Hashing**: IP addresses are hashed for geographic data only
- **Anonymous Sessions**: Users are tracked by anonymous session IDs
- **No Cookies for Tracking**: Only essential session cookies are used

### Data Collected:
- Geographic location (country/region level)
- Content viewing behavior
- Watch time and progress
- Device type (mobile/desktop/tablet)
- Session duration
- Content completion rates

## Database Schema

The system uses SQLite with the following main tables:

- `analytics_events`: Raw event data
- `content_stats`: Aggregated content statistics
- `metrics_daily`: Daily aggregated metrics
- `admin_users`: Admin user accounts

## API Endpoints

### Public Analytics API
- `POST /api/analytics/track` - Track user events

### Admin APIs (Authentication Required)
- `POST /api/admin/auth` - Admin login
- `DELETE /api/admin/auth` - Admin logout
- `GET /api/admin/me` - Get current admin user
- `GET /api/admin/analytics` - Get analytics data

## Troubleshooting

### Database Issues
If you encounter database issues, you can manually initialize it:

```bash
npm run db:init
```

### Admin Login Issues
If you can't log in, recreate the admin user:

```bash
npm run admin:create admin new-password
```

### Analytics Not Working
Check that:
1. The AnalyticsProvider is properly wrapped around your app
2. The database is initialized
3. The analytics API endpoints are accessible

## Security Considerations

- Change the default JWT_SECRET in production
- Use HTTPS in production
- Regularly update admin passwords
- Monitor admin access logs
- Consider rate limiting for admin endpoints

## Performance

The analytics system is designed to be lightweight:
- Events are batched and sent asynchronously
- Database uses WAL mode for better concurrency
- Automatic cleanup of old analytics data
- Optimized queries for dashboard performance