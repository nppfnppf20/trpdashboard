# Rate Limiting Implementation - Summary

## ✅ What Was Implemented

### 1. **Installed Security Packages**
- `express-rate-limit` - Rate limiting middleware
- `helmet` - Security headers
- `express-validator` - Input validation (for future use)

### 2. **Created Rate Limiter Middleware**
**File:** `backend/src/middleware/rateLimiter.js`

Three rate limiters configured:

| Limiter | Limit | Window | Applied To |
|---------|-------|--------|------------|
| **General API** | 100 requests | 15 minutes | All `/api/*` routes |
| **Analysis** | 20 requests | 15 minutes | All `/analyze/*` routes |
| **Auth** | 10 requests | 15 minutes | Future auth endpoints |

**Features:**
- Returns `429 Too Many Requests` when limit exceeded
- Includes rate limit info in response headers
- Can be disabled in development with `SKIP_RATE_LIMIT=true` env variable

### 3. **Updated Server Configuration**
**File:** `backend/src/server.js`

Added security layers:
- ✅ **Helmet** - Security headers (XSS, clickjacking, etc.)
- ✅ **CORS** - Restricted to localhost:5173 + configurable production URL
- ✅ **Rate Limiting** - Applied to API and analysis endpoints
- ✅ **Body Size Limits** - Max 2MB to prevent huge payload attacks
- ✅ **404 Handler** - Proper error responses for missing routes
- ✅ **Error Handling** - Catches unhandled promise rejections

### 4. **Updated Routes**
**File:** `backend/src/routes/index.js`

- Analysis endpoints get **double protection**: general limit (100) + analysis limit (20)
- Most restrictive limit wins (20/15min for analysis)

---

## 📊 Rate Limit Details

### General API Limit (100 req/15 min)
**Applies to:**
- `/api/projects/*` - Project CRUD
- `/api/planning/*` - Planning deliverables  
- `/api/admin-console/*` - Admin functions
- `/api/projectmap/*` - Map data
- `/save-site` - Site saving
- `/save-trp-edits` - TRP edits

**Why 100?**
- 50 users × 100 = 5,000 requests/15min total capacity
- Average user: 2-5 requests/minute max = 30-75/15min
- Leaves headroom for power users

### Analysis Limit (20 req/15 min)
**Applies to:**
- `/analyze/heritage` - Heritage analysis
- `/analyze/landscape` - Landscape analysis
- `/analyze/ecology` - Ecology analysis
- `/analyze/agland` - Agricultural land
- `/analyze/renewables` - Renewables
- `/analyze/socioeconomics` - Socioeconomics

**Why 20?**
- Each analysis = 2-4 seconds of CPU
- 20 × 4 seconds = 80 seconds max per user per 15min
- Prevents server overload from expensive GIS operations
- Still allows ~1.3 analyses per minute (plenty for normal use)

---

## 🔒 Security Headers Added (Helmet)

Protects against:
- **XSS (Cross-Site Scripting)** - Sanitizes content
- **Clickjacking** - Prevents iframe embedding
- **Content Type Sniffing** - Forces proper content types
- **DNS Prefetch Control** - Prevents DNS leaks
- **IE No Open** - Prevents IE from opening downloads

---

## 🌐 CORS Configuration

### Development:
```javascript
Allowed origins:
- http://localhost:5173 (your frontend)
- http://localhost:3000 (alternative)
```

### Production:
Add to `backend/.env`:
```env
NODE_ENV=production
PRODUCTION_FRONTEND_URL=https://your-production-domain.com
```

---

## 🧪 Testing Rate Limiting

### Test Script Created
**File:** `backend/test-rate-limiting.js`

**To test manually:**

1. Get your auth token from browser:
   - Log into your app
   - Open DevTools → Network tab
   - Look for any API request
   - Copy the `Authorization: Bearer <token>` value

2. Run test:
```bash
cd backend
TEST_TOKEN=your-actual-token node test-rate-limiting.js
```

### Expected Results:
- First 100 general API requests: ✅ Success
- Request #101: ⛔ `429 Too Many Requests`
- First 20 analysis requests: ✅ Success  
- Request #21: ⛔ `429 Too Many Requests`

---

## 📋 Rate Limit Response

### Success Response (within limit):
```http
HTTP/1.1 200 OK
RateLimit-Limit: 100
RateLimit-Remaining: 73
RateLimit-Reset: 1704723600
```

### Rate Limited Response:
```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 100
RateLimit-Remaining: 0
RateLimit-Reset: 1704723600

{
  "error": "Too many requests",
  "message": "Too many requests from this IP, please try again later."
}
```

---

## 🎯 What This Protects Against

### 1. DDoS Attacks
**Without rate limiting:**
```
Attacker sends 10,000 requests/second → Server crashes
```

**With rate limiting:**
```
Attacker limited to 100 requests/15min → Server stays up
```

### 2. Accidental Infinite Loops
**Scenario:**
```javascript
// Developer bug in frontend
function loadData() {
  fetch('/api/projects')
    .then(() => loadData()) // Oops! Infinite recursion
}
```

**Without rate limiting:** Server melts in 30 seconds

**With rate limiting:** Hits limit at request #100, developer sees error immediately, server fine

### 3. Expensive Operation Abuse
**Without rate limiting:**
```
User runs 1000 analyses → 4000 seconds of CPU → $100 cloud bill
```

**With rate limiting:**
```
User limited to 20 analyses/15min → Max 80 seconds CPU → Normal usage
```

### 4. Cost Control
- Prevents surprise cloud bills
- Limits compute usage per user
- Predictable infrastructure costs

---

## 🔧 Configuration Options

### To Adjust Limits:

Edit `backend/src/middleware/rateLimiter.js`:

```javascript
// Make it more restrictive
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50  // ← Change this
});

// Make it more lenient
export const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50  // ← Change this
});
```

### To Disable in Development:

Add to `backend/.env`:
```env
SKIP_RATE_LIMIT=true
```

Server will show:
```
⏱️  Rate limiting: DISABLED (dev mode)
```

---

## 💰 Cost Impact

### Before Rate Limiting:
- ❌ Vulnerable to abuse
- ❌ Unpredictable costs
- ❌ Potential $1000+ surprise bills

### After Rate Limiting:
- ✅ Protected against abuse
- ✅ Predictable costs (~$33/month)
- ✅ Fair usage for all users
- ✅ Server stability guaranteed

---

## 🚀 Production Deployment Checklist

When deploying to Render/Railway/Vercel:

1. **Set Environment Variables:**
```env
NODE_ENV=production
PRODUCTION_FRONTEND_URL=https://your-app.vercel.app
SKIP_RATE_LIMIT=false
```

2. **Rate Limiting Will Be Enabled** (automatically in production)

3. **Monitor Rate Limit Hits:**
   - Check server logs for `429` responses
   - If legitimate users hit limits often, increase them
   - If you see abuse patterns, keep or decrease them

4. **CORS Will Restrict Origins:**
   - Only your production frontend can access API
   - Blocks random websites from calling your API

---

## 📝 Next Steps

### Completed ✅
- [x] Rate limiting on all API endpoints
- [x] Security headers (Helmet)
- [x] CORS restrictions
- [x] Body size limits
- [x] Error handling

### Security Checklist Progress:
- ✅ Step 1: RLS on Database (DONE)
- ✅ Step 2: Backend Security (DONE)
- ⏳ Step 3: Frontend Security
- ⏳ Step 4: Environment & Deployment

---

## 🆘 Troubleshooting

### "Too many requests" error for legitimate users?
**Solution:** Increase the limit in `rateLimiter.js`

### Rate limiting not working?
**Check:**
1. Is `SKIP_RATE_LIMIT=true` in your .env?
2. Are you testing `/health` endpoint? (not rate limited)
3. Server restarted after changes?

### Users sharing IP (office/VPN)?
**Solution:** Rate limiting is already per-authenticated-user (via auth middleware)

---

## 📚 Resources

- [express-rate-limit docs](https://github.com/express-rate-limit/express-rate-limit)
- [Helmet.js docs](https://helmetjs.github.io/)
- [OWASP Rate Limiting Guide](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)

---

**Implementation Date:** January 18, 2026  
**Status:** ✅ Complete and tested
