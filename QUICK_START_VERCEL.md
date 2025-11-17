# Quick Start: Vercel Deployment

## 🚀 5-Minute Setup

### 1. Get Your Neon Database URL

1. Go to https://console.neon.tech
2. Sign up or login
3. Create a new project (or select existing)
4. Click **Connection Details**
5. Copy the connection string (looks like `postgresql://user:pass@host/db?sslmode=require`)

### 2. Add Environment Variable in Vercel

**The error you're seeing means this step is missing!**

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Key**: `DATABASE_URL`
   - **Value**: Paste your Neon connection string
   - **Environments**: Check all three (Production, Preview, Development)
6. Click **Save**

### 3. Redeploy

After adding the environment variable:

**Option A - Via Dashboard:**
1. Go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**

**Option B - Via Git:**
1. Make any small change to your code
2. Commit and push to trigger new deployment

### 4. Verify Deployment

Once deployed:
1. Visit your app URL
2. Go to `/admin` and login with:
   - Username: `vynx`
   - Password: `defaultPassword`
3. **Change the password immediately!**
4. Check analytics at `/admin/analytics`

## ✅ Checklist

- [ ] Created Neon database
- [ ] Copied connection string
- [ ] Added `DATABASE_URL` to Vercel environment variables
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Redeployed the application
- [ ] Verified app loads
- [ ] Logged into admin panel
- [ ] Changed default password

## 🔧 Troubleshooting

### Still seeing "DATABASE_URL references Secret which does not exist"?

Make sure you:
1. Added the variable in the **Environment Variables** section (not Secrets)
2. Selected **all three environments** when adding
3. Clicked **Save** after entering the value
4. Triggered a new deployment after saving

### Database connection fails?

Check that your connection string:
- Includes `?sslmode=require` at the end
- Has no extra spaces or line breaks
- Is from an active Neon project (not suspended)

### Admin login doesn't work?

The admin user is created during deployment. If it fails:
1. Check deployment logs for errors
2. Verify `DATABASE_URL` is set correctly
3. Try redeploying

## 📚 More Help

- Full deployment guide: See `VERCEL_DEPLOYMENT.md`
- Analytics documentation: See `ANALYTICS_TRACKING.md`
- Environment setup: Run `npm run verify-env` locally
