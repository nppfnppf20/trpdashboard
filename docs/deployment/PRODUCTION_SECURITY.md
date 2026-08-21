# Production Security Roadmap

**Last Updated:** January 18, 2026  
**Current Status:** Trial-ready (2-person deployment)  
**Target:** Production-ready (50+ users)

---

## **Executive Summary**

This document tracks the security posture of the HLPV web application as it evolves from a 2-person trial to a production system with 50+ users.

**Current Security Level:** ⭐⭐⭐⭐ (4/5 - Trial Ready)
- Strong backend security (auth, RLS, rate limiting)
- Minimal frontend validation (sufficient for trusted users)
- Not yet hardened for untrusted/malicious users

---

## **✅ IMPLEMENTED (Current Security)**

### **1. Database Security** ⚠️ WAS COMPLETE — NOW STALE, RE-AUDIT IN PROGRESS
**Status:** Claim below was accurate January 18, 2026 only. Do not trust the checkmarks
without reading the update.  
**Implemented:** January 18, 2026 · **Re-audited:** August 19, 2026

**⚠️ Update (2026-08-19):** the "RLS enabled on ALL tables" claim was true when written,
but the schema has grown substantially since (the `analysis_*`, `chat_*`, `ingestion_*`
tables, and the entire `rag`/`admin_console`/`scraper` schemas — none of which existed in
January) and RLS was not consistently applied as those were added. A fresh audit found
19 views bypassing RLS entirely, several tables with RLS "on" but policies of
`USING (true)` (equivalent to no protection), 23+ tables with RLS disabled outright
(including `system_config` and, in other schemas, tables holding real application data),
and 29+ `SECURITY DEFINER` functions with an unpinned `search_path`. Full findings and
remediation: see `SUPABASE_SECURITY_ADVISOR_REPORT.md` and
`backend/sql/migrations/151_security_hardening_search_path_and_system_config.sql` through
`155_security_hardening_rag_admin_console_schemas.sql` (additional migration(s) pending
from a broader cross-schema sweep). None of these have been applied yet as of this update.
**Once applied, come back and update this section's checkmarks to match reality** — don't
let this document go stale again as new tables/schemas get added.

**What we have (original Jan 18 claims, now only partially accurate — see above):**
- ⚠️ Row-Level Security (RLS) — enabled on tables that existed as of January; gaps found in
  tables/schemas added since
- ✅ User-based policies (users can only see their own data) — for the original table set
- ✅ Admin policies (admins can manage all data)
- ✅ `is_admin()` function to prevent RLS recursion
- ✅ All reference tables (heritage, ecology, landscape) protected

**Protection level:** ⭐⭐⭐ (was ⭐⭐⭐⭐⭐ — downgraded pending the pending migrations above)
- Users cannot access other users' projects (for tables covered by RLS)
- SQL injection attacks blocked by Supabase parameterized queries
- Direct database access via `anon`/`authenticated` was broader than intended on
  newer tables/views — see the security advisor report

**Files:**
- `backend/sql/migrations/007_create_user_roles.sql`
- `backend/sql/migrations/008_enable_rls_all_tables.sql`
- `backend/sql/migrations/151_security_hardening_search_path_and_system_config.sql` — `155_...` (pending)

**Documentation:**
- See `backend/PRODUCTION_RATE_LIMITING.md` for RLS details
- See `SUPABASE_SECURITY_ADVISOR_REPORT.md` for the full 2026-08-19 audit and remediation status

---

### **2. Backend API Security** ✅ COMPLETE
**Status:** Production-ready  
**Implemented:** January 18, 2026

**What we have:**
- ✅ JWT authentication on all endpoints
- ✅ Rate limiting (user-based):
  - General API: 100 requests/15 minutes per user
  - Analysis: 20 requests/15 minutes per user
  - Auth: 10 requests/15 minutes per IP
- ✅ Trust proxy enabled (works on Render/Railway/Heroku)
- ✅ Security headers (Helmet)
- ✅ CORS restrictions (only frontend allowed)
- ✅ Body size limits (2MB max)
- ✅ Error handling (no stack traces exposed)

**Protection level:** ⭐⭐⭐⭐⭐
- Prevents DDoS attacks
- Prevents brute force
- Limits cost overruns
- Each user gets individual rate limits (office workers don't block each other)

**Files:**
- `backend/src/middleware/auth.js`
- `backend/src/middleware/rateLimiter.js`
- `backend/src/server.js`

**Documentation:**
- See `backend/PRODUCTION_RATE_LIMITING.md`

---

### **3. Authentication & Authorization** ✅ COMPLETE
**Status:** Production-ready  
**Implemented:** January 15, 2026

**What we have:**
- ✅ Supabase Auth (industry-standard)
- ✅ Session management (secure cookies)
- ✅ Role-based access control (admin, surveyor, client, viewer)
- ✅ Protected routes (server-side checks in `hooks.server.js`)
- ✅ Logout functionality (properly invalidates sessions)
- ✅ Auto-redirect on unauthorized access

**Protection level:** ⭐⭐⭐⭐⭐
- Only authenticated users can access app
- Users must have valid session tokens
- Tokens expire automatically
- Logout properly clears sessions

**Files:**
- `frontend/src/hooks.server.js`
- `frontend/src/lib/stores/auth.js`
- `frontend/src/routes/+layout.svelte`

---

### **4. Frontend Input Validation (Minimal)** ⚠️ PARTIAL
**Status:** Trial-ready (sufficient for 2 trusted users)  
**Implemented:** January 18, 2026

**What we have:**
- ✅ Polygon complexity check (max 1000 points)
- ✅ Svelte auto-escaping (XSS protection by default)
- ✅ Some numeric parsing (`parseFloat(cost) || 0`)
- ✅ HTML5 input types (`type="number"`, `type="email"`)

**Protection level:** ⭐⭐⭐ (3/5)
- Prevents accidental performance issues (polygon bomb)
- Prevents basic XSS (as long as `{@html}` not used)
- Does NOT prevent malicious input (but 2 trusted users won't attack themselves)

**Files:**
- `frontend/src/lib/components/projects/AddProjectModal.svelte` (polygon check)

**Limitations:**
- No validation on text field length
- No sanitization of rich text HTML
- No validation on numeric ranges
- No URL validation (javascript: URLs possible)

---

## **⏳ NOT YET IMPLEMENTED (Future Security)**

### **5. Comprehensive Input Validation** ⏳ RECOMMENDED BEFORE 10+ USERS
**Priority:** HIGH  
**Effort:** 5-6 hours  
**Should implement when:** Adding 10+ users, or inviting non-technical users

**What needs to be added:**

#### **A. Polygon Validation (Enhanced)**
**Current:** Max 1000 points ✅  
**Add:**
- [ ] Max area check (e.g., 100 km²)
- [ ] Self-intersection check (invalid polygons)
- [ ] GeoJSON structure validation
- [ ] Coordinate range validation (-180 to 180 lng, -90 to 90 lat)

**Risk if not done:**
- ⚠️ User draws entire UK → 10-minute query, database locks
- ⚠️ Invalid GeoJSON → backend parsing errors
- ⚠️ Self-intersecting polygon → incorrect analysis results

**Tool:** `@turf/turf` for GeoJSON validation

---

#### **B. Text Input Validation**
**Current:** None ❌  
**Add:**
- [ ] Max length validation on all text fields
  - `project_name`: 200 chars
  - `detailed_description`: 5,000 chars
  - `additional_notes`: 5,000 chars
  - All other text: 500 chars
- [ ] Sanitize special characters
- [ ] Prevent extremely long strings (DoS)

**Risk if not done:**
- ⚠️ User pastes entire document → database bloat
- ⚠️ Display issues (long strings break UI)
- ⚠️ Potential XSS if display method changes

**Tool:** `zod` for schema validation

---

#### **C. Rich Text HTML Sanitization** ⚠️ HIGH RISK
**Current:** None ❌  
**Add:**
- [ ] Sanitize HTML from rich text editor
- [ ] Allow only safe tags: `<p>`, `<strong>`, `<em>`, `<u>`, `<h1-h3>`, `<ul>`, `<ol>`, `<li>`, `<br>`
- [ ] Strip all attributes
- [ ] Block `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers

**Risk if not done:**
- 🔴 **CRITICAL:** Stored XSS vulnerability
- Malicious user can inject JavaScript that executes when anyone views planning deliverable
- Can steal auth tokens, access all user's projects, impersonate user

**Current mitigation:** Only 2 trusted users (won't attack selves)

**Tool:** `isomorphic-dompurify` for HTML sanitization

**Location:** `frontend/src/lib/components/planning/RichTextEditor.svelte`

---

#### **D. URL Validation**
**Current:** None ❌  
**Add:**
- [ ] Validate SharePoint/external links
- [ ] Block `javascript:` URLs
- [ ] Block `data:` URLs
- [ ] Require `http://` or `https://`

**Risk if not done:**
- ⚠️ `javascript:alert('XSS')` links execute code when clicked
- ⚠️ `data:text/html,<script>...</script>` URLs bypass CSP

**Tool:** Simple regex validation

**Location:** `frontend/src/lib/components/admin-console/EditableGeneralInfo.svelte`

---

#### **E. Numeric Input Validation**
**Current:** HTML5 `type="number"` only ✅  
**Add:**
- [ ] Range validation:
  - `proposed_use_duration`: 1-100 years
  - `solar_export_capacity`: 0.1-1000 MW
  - `pv_max_panel_height`: 0.1-10 meters
  - `fence_height`: 0.5-5 meters
  - `number_of_solar_panels`: 1-1,000,000
  - `panel_tilt`: 0-90 degrees
  - Quote costs: 0-1,000,000 GBP
- [ ] Integer vs decimal validation
- [ ] Prevent negative numbers (where inappropriate)

**Risk if not done:**
- ⚠️ Nonsensical data (negative panels, 370° tilt)
- ⚠️ Display issues (huge numbers overflow UI)
- ⚠️ Calculation errors (divide by zero, NaN propagation)

**Tool:** `zod` schemas

---

#### **F. Array/List Validation**
**Current:** None ❌  
**Add:**
- [ ] Max array size (e.g., max 10 LPAs, max 50 line items)
- [ ] Validate each array item

**Risk if not done:**
- ⚠️ User adds 10,000 line items → database bloat
- ⚠️ UI breaks trying to render huge lists

**Tool:** `zod` array schemas

---

### **6. Content Security Policy (CSP)** ⏳ RECOMMENDED BEFORE PRODUCTION
**Priority:** MEDIUM  
**Effort:** 2 hours  
**Should implement when:** Going to production with real users

**What needs to be added:**
- [ ] Add CSP headers to prevent inline scripts
- [ ] Whitelist trusted domains
- [ ] Block `eval()`, `Function()` constructor
- [ ] Restrict image sources
- [ ] Restrict style sources

**Implementation:**
```javascript
// In backend/src/server.js (Helmet config)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Svelte needs unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
```

**Risk if not done:**
- ⚠️ XSS attacks easier to exploit
- ⚠️ Third-party scripts can be injected

**Protection level without CSP:** ⭐⭐⭐ (Svelte auto-escape still protects)  
**Protection level with CSP:** ⭐⭐⭐⭐⭐

---

### **7. Error Handling & Logging** ⏳ RECOMMENDED BEFORE PRODUCTION
**Priority:** MEDIUM  
**Effort:** 1 hour  
**Should implement when:** Going to production

**What needs to be added:**
- [ ] Remove `console.log()` statements in production
- [ ] Generic error messages for users
- [ ] Detailed error logging (server-side only)
- [ ] Error monitoring service (Sentry, LogRocket, etc.)

**Current issues:**
- ⚠️ Some `console.log()` statements expose data
- ⚠️ Error messages sometimes too detailed

**Example fix:**
```javascript
// ❌ Current (development)
catch (error) {
  console.error('Error:', error);
  alert(error.message); // Shows technical details
}

// ✅ Production
catch (error) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }
  // Log to monitoring service
  Sentry.captureException(error);
  // Show generic message to user
  showToast('An error occurred. Please try again or contact support.');
}
```

---

### **8. Dependency Security** ⏳ ONGOING
**Priority:** LOW (but regular maintenance needed)  
**Effort:** 15 minutes per month  
**Should implement when:** Ongoing

**What needs to be done:**
- [ ] Run `npm audit` monthly
- [ ] Update vulnerable dependencies
- [ ] Remove unused dependencies
- [ ] Pin major versions (prevent breaking changes)

**How to do it:**
```bash
# Check for vulnerabilities
cd frontend && npm audit
cd backend && npm audit

# Fix automatically (if possible)
npm audit fix

# Manual fixes for major updates
npm install package@latest
```

**Risk if not done:**
- ⚠️ Known vulnerabilities in dependencies
- ⚠️ Supply chain attacks (malicious packages)

**Current status:** ✅ Checked January 18, 2026 - No critical vulnerabilities

---

### **9. HTTPS & SSL** ✅ HANDLED BY RENDER
**Priority:** CRITICAL (but automatic)  
**Status:** Automatic when deployed to Render

**What Render does:**
- ✅ Automatically provisions SSL certificates
- ✅ Enforces HTTPS
- ✅ Redirects HTTP → HTTPS
- ✅ Renews certificates automatically

**No action needed** ✅

---

### **10. Environment Variable Security** ✅ MOSTLY DONE
**Priority:** CRITICAL  
**Status:** Good, but needs production config

**Current status:**
- ✅ `.env` files in `.gitignore` (not committed)
- ✅ Supabase keys use public (anon) key on frontend
- ✅ Service role key only on backend
- ✅ No hardcoded secrets

**Production checklist:**
- [ ] Set `NODE_ENV=production` on Render
- [ ] Set `PRODUCTION_FRONTEND_URL` to your domain
- [ ] Rotate Supabase keys after trial (if needed)
- [ ] Use Render's environment variable management (not .env file)

---

## **🔴 KNOWN RISKS (Current Trial)**

### **1. Rich Text XSS (HIGH - but mitigated by trust)**
**Risk:** Malicious HTML can be stored in planning deliverables  
**Likelihood:** LOW (only 2 trusted users)  
**Impact:** HIGH (if exploited, can steal auth tokens)  
**Mitigation:** You won't attack yourselves  
**Action:** Implement HTML sanitization before inviting more users

---

### **2. Text Field Length (LOW)**
**Risk:** Extremely long text can be entered  
**Likelihood:** LOW (accidental paste)  
**Impact:** LOW (database bloat, UI display issues)  
**Mitigation:** Database has reasonable limits, you'll notice and fix  
**Action:** Add max length validation before production

---

### **3. Numeric Ranges (LOW)**
**Risk:** Nonsensical numbers (negative, huge, zero where invalid)  
**Likelihood:** MEDIUM (typos)  
**Impact:** LOW (data quality, but easy to spot and fix)  
**Mitigation:** You'll notice in UI and correct  
**Action:** Add range validation before production

---

### **4. Polygon Area (LOW)**
**Risk:** User draws entire country  
**Likelihood:** LOW (accidental)  
**Impact:** MEDIUM (slow query, but rate limited)  
**Mitigation:** Rate limiter prevents cost runaway (max 20 analyses/15min)  
**Action:** Add area validation before production

---

### **5. URL Injection (LOW)**
**Risk:** `javascript:` URLs could execute code  
**Likelihood:** LOW (you won't enter malicious URLs)  
**Impact:** MEDIUM (if clicked, can run JS)  
**Mitigation:** You're both technical, won't click suspicious links  
**Action:** Add URL validation before production

---

## **📊 Security Maturity Timeline**

### **Phase 1: Trial (2 Users) - CURRENT** ✅
**Timeline:** Now - 4 weeks  
**Security Level:** ⭐⭐⭐⭐ (4/5)

**What's in place:**
- ✅ Auth, RLS, rate limiting
- ✅ Basic polygon validation
- ✅ Svelte auto-escape

**What's accepted:**
- ⚠️ No comprehensive input validation
- ⚠️ No HTML sanitization
- ⚠️ No CSP

**Why it's OK:**
- Only 2 trusted users
- No financial transactions
- Easy to fix bad data
- Rate limiting prevents cost runaway

---

### **Phase 2: Beta (10-20 Users)** ⏳ FUTURE
**Timeline:** Month 2-3  
**Security Level Target:** ⭐⭐⭐⭐ (4.5/5)

**Must add before this phase:**
- [ ] Text field length validation (2 hours)
- [ ] HTML sanitization (1 hour)
- [ ] URL validation (30 min)
- [ ] Numeric range validation (1 hour)
- [ ] Enhanced polygon validation (1 hour)

**Total effort:** ~6 hours

---

### **Phase 3: Production (50+ Users)** ⏳ FUTURE
**Timeline:** Month 4+  
**Security Level Target:** ⭐⭐⭐⭐⭐ (5/5)

**Must add before this phase:**
- [ ] Content Security Policy (2 hours)
- [ ] Error logging/monitoring (2 hours)
- [ ] Backend input validation (mirror frontend) (3 hours)
- [ ] Regular dependency audits (15 min/month)
- [ ] Security testing/penetration testing (external)

**Total effort:** ~8 hours + ongoing maintenance

---

## **🛠️ Implementation Priority**

### **NOW (Trial Phase):**
- ✅ Nothing more needed for trial!
- ✅ Polygon check is sufficient

### **BEFORE 10 USERS:**
1. HTML sanitization (RichTextEditor) - 1 hour
2. Text length validation - 1 hour
3. URL validation - 30 min

### **BEFORE 50 USERS:**
4. Numeric range validation - 1 hour
5. Enhanced polygon validation - 1 hour
6. Content Security Policy - 2 hours
7. Backend validation (mirror frontend) - 3 hours
8. Error logging/monitoring - 2 hours

### **ONGOING:**
- Monthly `npm audit` - 15 min/month
- Review error logs - as needed
- Update dependencies - quarterly

---

## **💰 Cost Analysis**

### **Security vs Development Time:**

| Phase | Security Added | Time Investment | Risk Reduced |
|-------|---------------|-----------------|--------------|
| **Phase 1 (Now)** | Polygon check | 30 min | 90% of accidental issues |
| **Phase 2 (Beta)** | Input validation | 6 hours | 95% of user issues |
| **Phase 3 (Production)** | Full hardening | 8 hours | 99% of security issues |

**ROI:**
- Phase 1: ⭐⭐⭐⭐⭐ (Minimal time, huge benefit)
- Phase 2: ⭐⭐⭐⭐ (Good time/benefit ratio)
- Phase 3: ⭐⭐⭐ (Necessary for production, but diminishing returns)

---

## **📋 Pre-Production Checklist**

Use this when you're ready to go from trial → production:

### **Database:**
- [x] RLS enabled on all tables
- [x] User policies configured
- [x] Admin function created
- [x] All reference data protected

### **Backend:**
- [x] Authentication on all endpoints
- [x] Rate limiting (user-based)
- [x] Trust proxy enabled
- [x] Security headers (Helmet)
- [x] CORS configured
- [x] Error handling
- [ ] Input validation (mirrors frontend)
- [ ] Logging/monitoring service

### **Frontend:**
- [x] Polygon complexity check
- [ ] Text length validation
- [ ] HTML sanitization
- [ ] URL validation
- [ ] Numeric range validation
- [ ] Error boundaries
- [ ] Remove console.logs

### **Infrastructure:**
- [ ] HTTPS enabled (automatic on Render)
- [ ] Environment variables set
- [ ] NODE_ENV=production
- [ ] PRODUCTION_FRONTEND_URL configured
- [ ] Database backups configured
- [ ] Monitoring/alerting set up

### **Testing:**
- [ ] Security audit performed
- [ ] Penetration testing (optional but recommended)
- [ ] Load testing
- [ ] Error handling tested
- [ ] Rate limiting tested

---

## **📚 Resources**

### **Documentation:**
- `backend/PRODUCTION_RATE_LIMITING.md` - Rate limiting implementation
- `backend/RATE_LIMITING_IMPLEMENTATION.md` - Original rate limiting design
- This file - Overall security roadmap

### **Tools:**
- **Zod** - Input validation: https://zod.dev
- **DOMPurify** - HTML sanitization: https://github.com/cure53/DOMPurify
- **Helmet** - Security headers: https://helmetjs.github.io
- **Sentry** - Error monitoring: https://sentry.io

### **Security Best Practices:**
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Supabase Security: https://supabase.com/docs/guides/auth/managing-user-data
- SvelteKit Security: https://kit.svelte.dev/docs/security

---

## **🔄 Version History**

**v1.0 - January 18, 2026**
- Initial security roadmap
- Trial phase complete (auth, RLS, rate limiting, basic polygon validation)
- Documented future security enhancements

---

**Status:** ✅ Trial-ready, 🏗️ Production roadmap defined  
**Next Review:** When adding 10+ users (estimated 4-6 weeks)
