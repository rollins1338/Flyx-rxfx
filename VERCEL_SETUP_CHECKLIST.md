# Vercel Setup Checklist

## 🎯 Your Current Issue

**Error**: "Environment Variable 'DATABASE_URL' references Secret 'database_url', which does not exist."

**Solution**: Add DATABASE_URL to Vercel environment variables (not as a secret, as a regular environment variable)

---

## ✅ Step-by-Step Fix

### Step 1: Get Your Neon Database URL

- [ ] Go to https://console.neon.tech
- [ ] Login or create account
- [ ] Create new project or select existing
- [ ] Click "Connection Details" or "Dashboard"
- [ ] Copy the connection string
  - Should look like: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require`

### Step 2: Add to Vercel

- [ ] Go to https://vercel.com/dashboard
- [ ] Click on your project (Flyx-main)
- [ ] Click "Settings" tab
- [ ] Click "Environment Variables" in left sidebar
- [ ] Click "Add New" button
- [ ] Fill in:
  - **Key**: `DATABASE_URL`
  - **Value**: [Paste your Neon connection string]
  - **Environments**: ✅ Production ✅ Preview ✅ Development
- [ ] Click "Save"

### Step 3: Redeploy

**Option A - Via Dashboard:**
- [ ] Go to "Deployments" tab
- [ ] Find latest deployment
- [ ] Click three dots (•••)
- [ ] Click "Redeploy"
- [ ] Wait for deployment to complete

**Option B - Via Git:**
- [ ] Make a small change (add a space somewhere)
- [ ] Commit: `git commit -am "trigger redeploy"`
- [ ] Push: `git push`
- [ ] Wait for auto-deployment

### Step 4: Verify Deployment

- [ ] Deployment shows "Ready" status
- [ ] Visit your app URL
- [ ] App loads without errors
- [ ] No error messages in browser console

### Step 5: Test Admin Access

- [ ] Go to `https://your-app.vercel.app/admin`
- [ ] Login with:
  - Username: `vynx`
  - Password: `defaultPassword`
- [ ] Login succeeds
- [ ] **IMPORTANT**: Change password immediately!

### Step 6: Test Analytics

- [ ] Go to `https://your-app.vercel.app/admin/analytics`
- [ ] Dashboard loads
- [ ] Watch some content on your site
- [ ] Refresh analytics page
- [ ] Verify session appears in table

---

## 📋 Additional Environment Variables (Optional)

If you want to add more variables:

### TMDB API (If not already set)

- [ ] Key: `TMDB_API_KEY`
- [ ] Value: Your TMDB Bearer token
- [ ] Environments: All three

- [ ] Key: `NEXT_PUBLIC_TMDB_API_KEY`
- [ ] Value: Your TMDB API key
- [ ] Environments: All three

### IP Salt (For Privacy)

- [ ] Key: `IP_SALT`
- [ ] Value: Any random string (e.g., `my-random-salt-12345`)
- [ ] Environments: All three

---

## 🔍 Verification

After completing all steps:

### Deployment Check
- [ ] No errors in Vercel deployment logs
- [ ] Build completed successfully
- [ ] Functions deployed successfully

### App Check
- [ ] Homepage loads
- [ ] Search works
- [ ] Video player loads
- [ ] Videos play

### Admin Check
- [ ] Can access `/admin`
- [ ] Can login
- [ ] Can change password
- [ ] Can access `/admin/analytics`

### Analytics Check
- [ ] Dashboard shows stats
- [ ] Can filter by time range
- [ ] Sessions table populates after watching
- [ ] Device breakdown shows data

---

## ❌ Common Mistakes

### ❌ Adding as Secret Instead of Environment Variable
**Wrong**: Settings → Secrets → Add Secret
**Right**: Settings → Environment Variables → Add New

### ❌ Not Selecting All Environments
**Wrong**: Only checking "Production"
**Right**: Check all three: Production, Preview, Development

### ❌ Not Redeploying After Adding Variable
**Wrong**: Just saving and expecting it to work
**Right**: Must redeploy after adding variables

### ❌ Using Wrong Connection String Format
**Wrong**: `postgres://...` or missing `?sslmode=require`
**Right**: `postgresql://...?sslmode=require`

---

## 🆘 Still Having Issues?

### Check Deployment Logs

1. Go to Vercel Dashboard
2. Click "Deployments"
3. Click on latest deployment
4. Click "Functions" tab
5. Look for error messages

### Check Environment Variables

1. Go to Settings → Environment Variables
2. Verify `DATABASE_URL` is listed
3. Verify it's enabled for all environments
4. Click "Edit" to verify the value is correct

### Test Database Connection

1. Go to Neon dashboard
2. Verify project is active (not suspended)
3. Test connection with their SQL editor
4. Check for any connection limits

### Contact Support

If still stuck:
- Check Vercel status: https://www.vercel-status.com
- Check Neon status: https://neon.tech/status
- Review error logs carefully
- Try creating a new Neon project

---

## 📚 Reference Documents

- **Quick Start**: `QUICK_START_VERCEL.md`
- **Full Guide**: `VERCEL_DEPLOYMENT.md`
- **Analytics**: `ANALYTICS_TRACKING.md`
- **Admin Guide**: `ADMIN_ANALYTICS_GUIDE.md`
- **Summary**: `DEPLOYMENT_SUMMARY.md`

---

## ✨ Success Criteria

You'll know everything is working when:

1. ✅ Deployment completes without errors
2. ✅ App loads at your Vercel URL
3. ✅ Can login to admin panel
4. ✅ Analytics dashboard shows data
5. ✅ Watch sessions are tracked
6. ✅ No errors in browser console

---

## 🎉 After Success

Once everything works:

1. **Security**
   - Change admin password
   - Review environment variables
   - Enable 2FA on Vercel

2. **Monitoring**
   - Check analytics regularly
   - Monitor Vercel logs
   - Watch Neon database usage

3. **Optimization**
   - Review performance metrics
   - Optimize slow queries
   - Consider upgrading plans if needed

---

**Good luck! You're almost there! 🚀**
