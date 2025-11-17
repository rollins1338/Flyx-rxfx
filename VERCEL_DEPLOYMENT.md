# Vercel Deployment Guide

## Prerequisites

1. A Vercel account
2. A Neon PostgreSQL database (free tier available at https://neon.tech)
3. TMDB API credentials

## Step 1: Set Up Neon Database

1. Go to https://console.neon.tech
2. Create a new project (or use existing)
3. Copy your connection string from the dashboard
   - It should look like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`

## Step 2: Configure Vercel Environment Variables

In your Vercel project settings (Settings → Environment Variables), add the following:

### Required Variables

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string | PostgreSQL database for analytics and admin |
| `TMDB_API_KEY` | Your TMDB Bearer token | TMDB API Read Access Token |
| `NEXT_PUBLIC_TMDB_API_KEY` | Your TMDB API key | Public TMDB API key |

### Optional Variables

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `IP_SALT` | Random string | Salt for IP address hashing (privacy) |
| `DATABASE_URL_UNPOOLED` | Unpooled connection string | For migrations (optional) |

### How to Add Environment Variables in Vercel

1. Go to your project in Vercel dashboard
2. Click **Settings** → **Environment Variables**
3. For each variable:
   - Enter the **Key** (e.g., `DATABASE_URL`)
   - Enter the **Value** (your actual connection string)
   - Select environments: **Production**, **Preview**, **Development**
   - Click **Save**

## Step 3: Initialize Database

The database tables will be automatically created on first deployment when the app connects to your Neon database. The schema includes:

- `analytics_events` - General analytics events
- `watch_sessions` - Detailed watch session tracking
- `content_stats` - Content statistics
- `admin_users` - Admin authentication
- `metrics_daily` - Daily aggregated metrics
- `schema_migrations` - Database version tracking

## Step 4: Create Admin User

After deployment, the admin user will be automatically created with:
- **Username**: `vynx`
- **Password**: `defaultPassword`

**⚠️ IMPORTANT**: Change this password immediately after first login!

To change the admin password:
1. Go to `https://your-app.vercel.app/admin`
2. Login with the default credentials
3. Change your password in the admin settings

## Step 5: Deploy

### Option 1: Deploy via Git (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically deploy on every push to main branch

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

## Troubleshooting

### Error: "DATABASE_URL references Secret which does not exist"

This means the environment variable isn't set in Vercel. To fix:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `DATABASE_URL` with your Neon connection string
3. Make sure to select all environments (Production, Preview, Development)
4. Redeploy your application

### Error: "Database connection failed"

Check that:
1. Your Neon database is active (not suspended)
2. The connection string is correct and includes `?sslmode=require`
3. Your Neon project allows connections from Vercel's IP ranges (usually automatic)

### Error: "Admin user creation failed"

The admin user is created during the build process. If it fails:
1. Check that `DATABASE_URL` is set correctly
2. Verify the database tables were created
3. Check the deployment logs in Vercel for specific errors

### Database Tables Not Created

If tables aren't automatically created:
1. Check the deployment logs for errors
2. Manually run the initialization:
   ```bash
   npm run db:init
   ```
3. Or connect to your Neon database and run the SQL from `app/lib/db/neon-connection.ts`

## Vercel Configuration

Your `vercel.json` is configured to:
- Run the build command: `npm run build`
- Create the admin user after build: `npm run vercel:setup-admin`
- Use the `DATABASE_URL` environment variable

## Post-Deployment Checklist

- [ ] Verify the app loads at your Vercel URL
- [ ] Test video playback
- [ ] Login to admin panel at `/admin`
- [ ] Change the default admin password
- [ ] Check analytics dashboard at `/admin/analytics`
- [ ] Verify watch sessions are being tracked

## Monitoring

### Check Analytics

Visit `https://your-app.vercel.app/admin/analytics` to see:
- Total watch sessions
- Watch time statistics
- Completion rates
- Device and quality breakdowns

### Check Logs

In Vercel Dashboard:
1. Go to your project
2. Click **Deployments**
3. Click on a deployment
4. View **Functions** logs to see analytics tracking

## Security Best Practices

1. **Change Default Password**: Immediately change the admin password after first deployment
2. **Rotate Secrets**: Periodically rotate your database credentials
3. **Use Environment Variables**: Never commit secrets to your repository
4. **Enable 2FA**: Enable two-factor authentication on your Vercel account
5. **Monitor Access**: Regularly check admin access logs

## Scaling Considerations

### Neon Database Limits

Free tier includes:
- 0.5 GB storage
- 1 compute unit
- Automatic scaling

For production with high traffic, consider upgrading to:
- Pro plan for more storage and compute
- Connection pooling (already enabled via Neon)

### Vercel Limits

Free tier includes:
- 100 GB bandwidth
- Unlimited deployments
- Serverless function execution

For production, consider:
- Pro plan for more bandwidth
- Analytics add-on for detailed metrics

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Neon database logs
3. Review the `ANALYTICS_TRACKING.md` documentation
4. Check the GitHub repository issues

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TMDB API Documentation](https://developers.themoviedb.org/3)
