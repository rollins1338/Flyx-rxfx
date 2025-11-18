# Live Activity Troubleshooting Guide

## Issue: No Live Users Showing in Admin Panel

### Quick Diagnosis

1. **Go to Debug Page**: `/admin/live/debug`
   - This will show you session info and test the system
   - Check browser console for logs

2. **Check Console Logs**:
   - Look for `[Analytics]` logs
   - Should see "Starting live activity heartbeat"
   - Should see "Sending live activity heartbeat"

3. **Check Network Tab**:
   - Look for POST requests to `/api/analytics/live-activity`
   - Should happen every 30 seconds
   - Check response status (should be 200)

### Common Issues & Solutions

#### 1. Analytics Not Initializing

**Symptoms**:
- No console logs
- No session info in debug page
- No network requests

**Solutions**:
- Check that `AnalyticsProvider` wraps your app
- Verify it's in `app/layout.tsx`
- Check browser console for errors

**Fix**:
```tsx
// In app/layout.tsx
import AnalyticsProvider from './components/analytics/AnalyticsProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AnalyticsProvider>
          {children}
        </AnalyticsProvider>
      </body>
    </html>
  )
}
```

#### 2. Database Not Set Up

**Symptoms**:
- API returns empty array
- Console shows database errors
- 500 errors in network tab

**Solutions**:
- Verify `DATABASE_URL` is set
- Check database tables exist
- Run database initialization

**Fix**:
```bash
# Check environment variable
echo $DATABASE_URL

# Or in Vercel dashboard:
# Settings → Environment Variables → DATABASE_URL
```

#### 3. Activities Expiring Too Fast

**Symptoms**:
- Activities appear briefly then disappear
- Empty state shows even with active users

**Solutions**:
- Check `maxAge` parameter (default 5 minutes)
- Verify heartbeats are being sent
- Check server time vs client time

**Fix**:
```typescript
// In /admin/live/page.tsx
// Increase maxAge if needed
const response = await fetch('/api/analytics/live-activity?maxAge=10');
```

#### 4. Heartbeats Not Sending

**Symptoms**:
- No POST requests in network tab
- Console shows "Cannot send heartbeat"
- Session exists but no activity

**Solutions**:
- Check if page is visible (heartbeats pause when hidden)
- Verify no JavaScript errors
- Check network connectivity

**Debug**:
```javascript
// In browser console
// Check if analytics is initialized
window.analyticsService

// Manually trigger heartbeat
// (if you expose it for debugging)
```

#### 5. CORS or Network Errors

**Symptoms**:
- Network requests fail
- CORS errors in console
- 403 or 401 responses

**Solutions**:
- Check API route is accessible
- Verify no authentication blocking requests
- Check Vercel deployment logs

### Debug Checklist

Run through this checklist:

- [ ] Open `/admin/live/debug`
- [ ] Check "Session Info" shows data
- [ ] Click "Send Browsing Activity"
- [ ] Check browser console for logs
- [ ] Check Network tab for POST request
- [ ] Verify API returns success
- [ ] Click "Refresh API Test"
- [ ] Check "API Test Results" shows activities
- [ ] Go to `/admin/live`
- [ ] Verify activity appears in list

### Console Log Reference

**Expected Logs**:
```
[Analytics] Starting live activity heartbeat
[Analytics] Sending live activity heartbeat: { userId: "abc12345", type: "browsing" }
[Analytics] Heartbeat sent successfully
```

**Error Logs**:
```
[Analytics] Cannot send heartbeat - missing session or activity
[Analytics] Heartbeat failed: 500 ...
[Analytics] Failed to send live activity heartbeat: ...
```

### API Endpoint Testing

Test the API directly:

```bash
# Test GET (retrieve activities)
curl https://your-app.vercel.app/api/analytics/live-activity?maxAge=5

# Test POST (send activity)
curl -X POST https://your-app.vercel.app/api/analytics/live-activity \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "sessionId": "test-session",
    "activityType": "browsing"
  }'
```

### Database Verification

Check if table exists:

```sql
-- In your database console
SELECT * FROM live_activity ORDER BY last_heartbeat DESC LIMIT 10;

-- Check for recent activities
SELECT COUNT(*) FROM live_activity 
WHERE is_active = TRUE 
AND last_heartbeat > (EXTRACT(EPOCH FROM NOW()) * 1000) - 300000;
```

### Server Logs

Check Vercel deployment logs:

1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments"
4. Click on latest deployment
5. Click "Functions" tab
6. Look for logs from `/api/analytics/live-activity`

**Expected logs**:
```
[Live Activity] Received heartbeat: { userId: "abc12345", ... }
[Live Activity] Activity saved: live_abc12345_xyz789
[Live Activity] Fetching activities, maxAge: 5
[Live Activity] Found 3 active users
```

### Quick Fixes

#### Force Refresh Analytics

```javascript
// In browser console
location.reload();
```

#### Clear Cache

```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

#### Manual Activity Test

```javascript
// In browser console
fetch('/api/analytics/live-activity', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'test-' + Date.now(),
    sessionId: 'session-' + Date.now(),
    activityType: 'browsing'
  })
}).then(r => r.json()).then(console.log);
```

### Still Not Working?

1. **Check Debug Page**: `/admin/live/debug`
   - Follow all instructions
   - Check all sections

2. **Check Browser Console**:
   - Look for any errors
   - Check network tab
   - Verify requests are sent

3. **Check Server Logs**:
   - Vercel deployment logs
   - Look for errors
   - Check database connection

4. **Verify Database**:
   - Table exists
   - Can write data
   - Can read data

5. **Test Locally**:
   - Run `npm run dev`
   - Test on localhost
   - Check if it works locally

### Contact Support

If still having issues, provide:
- Browser console logs
- Network tab screenshot
- Debug page screenshot
- Server logs
- Database query results

---

**Most Common Fix**: Just visit `/admin/live/debug` and click the test buttons. This will show you exactly what's wrong!
