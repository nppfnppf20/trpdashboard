# Render Deployment - Quick Fix Guide

## Issues Found & Fixed

### Issue 1: Missing Backend Dependencies ✅ FIXED
**Error:** `Cannot find package 'helmet'`

**Cause:** We installed `helmet` and `express-rate-limit` locally during development but they weren't in `package.json`

**Fix:** Updated `backend/package.json` to include:
```json
"express-rate-limit": "^7.4.1",
"express-validator": "^7.2.0",
"helmet": "^8.0.0"
```

### Issue 2: Frontend Environment Variables ✅ FIXED
**Error:** Build failed at `hooks.server.js` line 3

**Cause:** Using `$env/static/public` doesn't work for dynamic environment variables in Render

**Fix:** Changed to `$env/dynamic/public`:
```javascript
// OLD (doesn't work in Render):
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// NEW (works everywhere):
import { env } from '$env/dynamic/public';
// Then use: env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY
```

---

## Steps to Deploy Now

### 1. Commit and Push Changes
```bash
git add .
git commit -m "Fix: Add missing backend deps and fix env var imports for Render"
git push
```

### 2. Redeploy on Render
Both services will automatically redeploy from the git push.

**Or manually:**
- Go to Render dashboard
- Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## Backend Should Now Build Successfully ✅

The backend will now:
1. Install all dependencies (including helmet & express-rate-limit)
2. Start without errors
3. Respond to `/health` endpoint

## Frontend Should Now Build Successfully ✅

The frontend will now:
1. Build without environment variable errors
2. Connect to Supabase correctly
3. Start the server

---

## Next: Configure Environment Variables

Once both services deploy successfully, make sure to set:

### Backend Environment Variables:
```
NODE_ENV=production
SUPABASE_URL=<your supabase url>
SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
DATABASE_URL=<your postgres connection string>
PORT=8080
FRONTEND_URL=http://localhost:5173
PRODUCTION_FRONTEND_URL=<will update after frontend deploys>
```

### Frontend Environment Variables:
```
PUBLIC_SUPABASE_URL=<your supabase url>
PUBLIC_SUPABASE_ANON_KEY=<your anon key>
NODE_ENV=production
ORIGIN=<your frontend render url>
VITE_BACKEND_URL=<your backend render url>
```

---

## Testing After Deploy

1. **Backend:** Visit `https://your-backend.onrender.com/health`
   - Should return: `{"status":"ok",...}`

2. **Frontend:** Visit `https://your-frontend.onrender.com`
   - Should show login page

3. **Full Test:** Login and create a project

---

## Troubleshooting

### If backend still fails:
- Check logs in Render dashboard
- Verify all environment variables are set
- Check for typos in Supabase credentials

### If frontend still fails:
- Check that `VITE_BACKEND_URL` is set
- Verify Supabase credentials
- Check browser console for errors

---

**Status:** Ready to redeploy! 🚀
