# OWASP ASVS 5.0 — Level 1 Assessment

**Date:** 2026-10-02
**Standard:** OWASP ASVS 5.0.0, Level 1 (70 requirements, taken from the official CSV)
**Scope:** `backend/` (Express 5 API), `frontend/` (SvelteKit), live hosts `trpdashboard.co.uk` (frontend) and `trp-dash-dski.onrender.com` (production backend, read from the live frontend's JavaScript bundle; the `hlpv-web-app-test3.onrender.com` fallback in `frontend/src/lib/config.js` is not what production uses)
**Method:** static code review, `npm audit`, read-only HTTP checks of the live hosts, and the existing docs in `docs/deployment/`. No code was changed.
**Not covered:** anything that lives only in the Supabase dashboard or the Render/Cloudflare dashboards. Those rows are marked VERIFY and listed in the checklist at the end.

## Result

| Status | Count | Meaning |
|---|---|---|
| PASS | 29 | Met, with evidence |
| PARTIAL | 13 | Some of the requirement is met |
| FAIL | 13 | Not met |
| VERIFY | 4 | Depends on a setting or process I couldn't see |
| N/A | 11 | Doesn't apply to this architecture |

Of the 59 applicable requirements, 29 pass outright (49%). The failures cluster in four areas: authorization (V8), HTML rendering and sanitization (V1/V3), dependency hygiene (V15), and security documentation.

## Fix first

1. **V8.2.1 / V8.2.2 / V8.3.1 — authorization lives only in the UI.** `frontend/src/hooks.server.js` sends any non-admin to `/auth/unauthorized`, so the UI is admin-only. The Express API doesn't repeat that check: only `/api/admin-console` uses `requireAdmin` (`backend/src/routes/index.js:103`). Every other `/api` route accepts any valid Supabase token, and controllers never check a project against the caller. Anyone holding a valid non-admin token (an invited surveyor or client, or a self-signup if public signup is on) can call the API directly. Per `SUPABASE_SECURITY_ADVISOR_REPORT.md`, several `SECURITY DEFINER` write functions were also callable with just the public anon key; check migrations 156 and 157 are applied.
2. **V1.3.1 / V1.2.1 / V3.2.2 — stored XSS.** About 30 `{@html}` / `innerHTML` uses, no DOMPurify, and `md()` doesn't escape HTML. `sanitizeRichText` is applied only in `policy.controller.js`. LLM output derived from uploaded documents is stored and rendered unsanitized. The Supabase session lives in JS-readable cookies, so an XSS means account takeover.
3. **V15.2.1 — vulnerable dependencies.** Backend: 13 advisories (8 high), including `multer`, `path-to-regexp`, `@xmldom/xmldom`, `lodash`. Frontend: 8 (1 critical, 4 high), including `jspdf`. `npm audit fix` resolves several without major bumps.
4. **V3.3.1 / V3.4.1 — frontend transport and cookie hardening.** `trpdashboard.co.uk` sends no `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` or CSP header. Session cookies have no `__Host-`/`__Secure-` prefix.
5. **V6.2.2 — no way to change or reset a password in the app.** There is no change-password UI and no "forgot password" link; password setting only happens through an invite or recovery email link.

## Matrix

Evidence paths are relative to the repo root.

### V1 Encoding and Sanitization

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V1.2.1 | Context-appropriate output encoding | FAIL | Svelte escapes `{text}` by default, but `{@html}` is used with unsanitized data (e.g. `frontend/src/lib/components/projects/MeetingNotesTab.svelte:972`, `ProjectDocsTab.svelte:719`). `md()` in `frontend/src/lib/utils/markdown.js` doesn't escape input. `renderReply` in `chatMarkdown.js` does escape first. | Sanitize or escape before every `{@html}`; escape inside `md()` |
| V1.2.2 | Encode untrusted data in URLs; allow only safe protocols | FAIL | `href={item.url}`, `href={project.sharepoint_link}`, `href={r.pins_url}` etc. with no protocol allowlist (`EditableGeneralInfo.svelte:744`, `NoticesTab.svelte:253`). `mailto:${to}` is unencoded in `BriefingEditor.svelte:283`. Already noted in `PRODUCTION_SECURITY.md` §5D. | Add a shared `safeUrl()` that permits only `http(s):` and `mailto:` |
| V1.2.3 | Encode when building JavaScript/JSON | PASS | Responses use `res.json`; no dynamic script construction found. | — |
| V1.2.4 | Parameterized queries | PASS | All `pool.query` calls use `$n` placeholders. Dynamic identifiers come from fixed whitelists: `lookups.service.js` `LOOKUP_CONFIGS`, `projectsApi.js` `MILESTONE_RESOLVED_COLUMNS`, constant column names in `workflow.service.js`. Dynamic `SET`/`WHERE` builders only append fixed fragments. | — |
| V1.2.5 | OS command injection | PASS | No `child_process`, `exec`, `spawn` in `backend/src`. | — |
| V1.3.1 | Sanitize WYSIWYG HTML with a known library | FAIL | `sanitize-html` is used only in `backend/src/controllers/policy.controller.js`. Rich-text editor output (`RichTextEditor.svelte`, briefings, deliverables, meeting-note summaries) is stored and rendered raw. | Sanitize on write in the backend and on render in the frontend |
| V1.3.2 | No `eval` / dynamic code execution | PASS | No `eval(` or `new Function(` in `backend/src` or `frontend/src`. | — |
| V1.5.1 | Restrictive XML parser config | PARTIAL | No direct XML parsing. `.docx` goes through `mammoth` → `@xmldom/xmldom`, which doesn't resolve external entities, but the installed version has 14 advisories (DoS, injection). | Update `mammoth` / `@xmldom/xmldom` |

### V2 Validation and Business Logic

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V2.1.1 | Documented input validation rules | FAIL | No validation rules documented. `PRODUCTION_SECURITY.md` §5 lists them as not yet implemented. | Write the rules (max lengths, ranges, formats) |
| V2.2.1 | Validate input used for business/security decisions | PARTIAL | Ad hoc checks only (required fields, column whitelists). `express-validator` is installed but never used. No length or range checks. | Add schema validation (zod or express-validator) on decision-driving inputs |
| V2.2.2 | Validation at a trusted service layer | PARTIAL | Some server-side checks exist per controller; most validation is in the UI. | As above |
| V2.3.1 | Business flows enforced in sequence | VERIFY | Multi-step flows exist (quotes, stage workflow). Server-side order enforcement not reviewed. | Review `workflow.service.js` and quote state transitions |

### V3 Web Frontend Security

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V3.2.1 | Content not rendered in the wrong context | PASS | API returns JSON with `X-Content-Type-Options: nosniff` (helmet, confirmed live). Uploads are held in memory and never served. | — |
| V3.2.2 | Text displayed as text, not HTML | FAIL | `{@html}` is used for content that is plain text or markdown (`md(...)`, `renderMarkdown(analysis.full_report)`). | See V1.2.1 |
| V3.3.1 | Cookies `Secure`, with `__Host-`/`__Secure-` prefix | FAIL | Auth cookies are the Supabase defaults (`sb-<ref>-auth-token`), no prefix. The browser client writes them via `document.cookie` and adds `Secure` only if the library passes it (`frontend/src/lib/supabase.js:33-44`). Cookies are also JS-readable. | Set cookie options explicitly; consider a prefix and HttpOnly via server-side session handling |
| V3.4.1 | HSTS (≥1 year) on all responses | PARTIAL | Backend sends `max-age=31536000; includeSubDomains` (helmet, confirmed live). **Frontend sends no HSTS header** (confirmed live on `trpdashboard.co.uk`). | Enable HSTS in `hooks.server.js` or at Cloudflare |
| V3.4.2 | CORS origin is fixed or allowlisted | PASS | Allowlist in `backend/src/server.js:37-61`. | — |
| V3.5.1 | Anti-forgery for requests not protected by preflight | N/A | API doesn't use cookie auth and relies on preflight; see V3.5.2. | — |
| V3.5.2 | Preflight can't be bypassed | PASS | Every API call needs the `Authorization: Bearer` header, which is not CORS-safelisted. | — |
| V3.5.3 | Sensitive actions use non-GET methods | PASS | No state-changing GET found in the routes (heuristic search). | — |

### V4 API and Web Service

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V4.1.1 | `Content-Type` matches body, with charset | PARTIAL | Backend JSON: `application/json; charset=utf-8` (live). Frontend HTML: `Content-Type: text/html` with no charset. | Add `; charset=utf-8` at the frontend |
| V4.4.1 | WSS for WebSockets | N/A | No WebSocket usage in the app code. | — |

### V5 File Handling

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V5.2.1 | File size limits | PARTIAL | Limits of 20–50 MB on all upload routes **except** `backend/src/routes/stage1Review.routes.js:10`, which has none. Files are buffered in memory. `multer` ≤ 2.2.0 has DoS and size-limit-bypass advisories. | Add `limits`; update multer |
| V5.2.2 | Extension matches content | PARTIAL | `fileFilter` extension allowlists on about half the routes. Others (meeting notes, consultation, public comments, conditions, quotes, policy updates, voice, stage1) accept any extension. `parseFile` decides type by extension only; no magic-byte check. | Shared upload filter with extension + magic-byte checks |
| V5.3.1 | Uploaded files not executable from a public folder | PASS | Memory storage only; no Supabase Storage or disk persistence of uploads. | — |
| V5.3.2 | No user filenames in file paths | PASS | `originalname` is stored only as DB metadata. The one file-path write that interpolates a value (`appealbaseDeepRead.service.js:118`) is reachable only from CLI scripts, not routes. | — |

### V6 Authentication

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V6.1.1 | Documented anti-automation / brute-force controls | FAIL | Not documented. `PRODUCTION_SECURITY.md` quotes limits (100 / 20 / 10 per 15 min, 2 MB body) that no longer match the code (1000 / 40 / 20, 10 MB). | Document actual controls, including Supabase Auth's own limits |
| V6.2.1 | Password length ≥ 8 | VERIFY | Client enforces ≥ 8 only on the set-password page (`reset-password/+page.svelte:20`). The real policy is the Supabase Auth setting (default is 6). | Set minimum length (15 recommended) in Supabase |
| V6.2.2 | Users can change their password | FAIL | No change-password UI; no `resetPasswordForEmail` call and no "forgot password" link. | Add forgot-password and change-password flows |
| V6.2.3 | Change requires current + new password | N/A | No change feature yet. Required when V6.2.2 is built. | — |
| V6.2.4 | Check against top 3000 passwords | VERIFY | Supabase "leaked password protection" (paid-plan setting) not visible from code. | Enable if available |
| V6.2.5 | No composition rules | PASS | No composition rules in app code. Confirm Supabase doesn't add any. | — |
| V6.2.6 | Password fields use `type=password` | PASS | `login/+page.svelte:69`, `reset-password/+page.svelte:60,73`. | — |
| V6.2.7 | Paste and password managers allowed | PASS | No paste blocking on auth forms. | — |
| V6.2.8 | Password used exactly as entered | PASS | Passed unchanged to Supabase (`supabase.js:82`). | — |
| V6.3.1 | Credential-stuffing and brute-force controls | VERIFY | App has no login limiter (login goes straight to Supabase). Relies on Supabase Auth rate limits. | Check Supabase Auth rate-limit settings |
| V6.3.2 | No default accounts | PASS | No seeded users or passwords in `backend/src`, `scripts`, `sql`. Confirm in the Supabase user list. | — |
| V6.4.1 | Initial secrets random, short-lived, single-use | PASS | App never generates passwords; accounts use Supabase invite links (`auth/callback/+server.js`). Confirm OTP expiry in Supabase. | — |
| V6.4.2 | No security questions or hints | PASS | None present. | — |

### V7 Session Management

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V7.2.1 | Session tokens verified by a trusted backend | PASS | `backend/src/middleware/auth.js` calls `supabaseAdmin.auth.getUser(token)` on every request. Note: `hooks.server.js` uses `getSession()` (unverified cookie) but its role lookup goes through PostgREST, which rejects forged JWTs. | Prefer `getUser()` in `hooks.server.js` |
| V7.2.2 | Dynamic tokens, not static secrets | PASS | Supabase-issued JWTs and refresh tokens. | — |
| V7.2.3 | Reference tokens: CSPRNG, ≥ 128 bits | N/A | Self-contained JWTs; refresh tokens are managed by Supabase. | — |
| V7.2.4 | New token on authentication | PASS | Supabase issues a fresh session on each sign-in. | — |
| V7.4.1 | Logout/expiry fully ends the session | PARTIAL | `signOut()` revokes the session and the backend re-validates against the Auth server. But the access JWT still passes signature checks on direct PostgREST calls until it expires. | Shorten JWT expiry (Supabase setting) |
| V7.4.2 | Disabled/deleted accounts lose all sessions | PARTIAL | Backend `getUser()` fails for deleted/banned users, and role is read per request. Same JWT-lifetime caveat for direct data API calls. | As above |

### V8 Authorization

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V8.1.1 | Documented authorization rules | FAIL | Roles (admin, surveyor, client, viewer) exist in code only. No document says who may access which functions or data. | Write an access matrix |
| V8.2.1 | Function-level access limited to explicit permissions | FAIL | Only `/api/admin-console` is role-gated. All other API routes accept any authenticated user, including the default `viewer`. `/api/users` returns every profile to any authenticated user. | Gate by role at the router level |
| V8.2.2 | Data-level access (IDOR/BOLA) | FAIL | Controllers take `projectId` from the URL with no membership check; only 8 of ~60 controllers reference `req.user`. The backend queries with the owner role (`DATABASE_URL`), so RLS doesn't apply. Mitigated today only by the admin-only UI and small user base. | Decide the project-access model, then enforce in a shared middleware |
| V8.3.1 | Enforced at a trusted layer | PARTIAL | Admin-console API and UI page guard are server-side. The rest of the API trusts that the UI is admin-only. | See V8.2.1 |

### V9 Self-contained Tokens

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V9.1.1 | Signature/MAC verified | PASS | Verified by Supabase Auth via `getUser()`; the app never trusts token contents itself. (The rate limiter decodes `sub` unverified, for bucketing only.) | — |
| V9.1.2 | Algorithm allowlist | PASS | Handled by Supabase Auth; the app doesn't verify JWTs locally. | — |
| V9.1.3 | Trusted key sources | PASS | Same; no `jku`/`jwk` handling in the app. | — |
| V9.2.1 | `exp`/`nbf` enforced | PASS | Enforced by Supabase Auth. | — |

### V10 OAuth and OIDC

| ID | Status | Reason |
|---|---|---|
| V10.4.1 – V10.4.5 | N/A | The app is not an OAuth/OIDC authorization server. Supabase Auth is the identity provider, used through its own password sign-in. Becomes applicable only if you enable Supabase's OAuth server or add third-party OAuth clients. |

### V11 Cryptography

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V11.3.1 | No insecure block modes/padding | N/A | No application-level encryption in the code. | — |
| V11.3.2 | Approved ciphers only | N/A | Same. | — |
| V11.4.1 | Approved hash functions only | PASS | The only hash is SHA-1 as a cache-file key (`appealbase.service.js:42`), not a security use. | Switch to SHA-256 anyway to avoid scanner noise |

### V12 Secure Communication

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V12.1.1 | Only TLS 1.2/1.3 | PASS | TLS 1.1 handshake refused on both live hosts. TLS 1.0 not tested separately; both sit behind Cloudflare. | — |
| V12.2.1 | TLS for all external-facing connections | PASS | HTTP redirects 301 to HTTPS on both hosts. | — |
| V12.2.2 | Publicly trusted certificates | PASS | `curl` validated both certificates without `-k`. | — |

### V13 Configuration

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V13.4.1 | No source-control metadata deployed | PASS | `/.git/HEAD` returns 303 → login (frontend) and 404 (backend). | — |

### V14 Data Protection

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V14.2.1 | No sensitive data in URLs | PARTIAL | Invite/recovery flows put a single-use `token_hash` in the query string (`auth/callback/+server.js`) and session tokens in the URL fragment (`auth/+layout.svelte:11-20`). The backend request logger records full URLs including query strings (`requestLogger.js`). No API call found passing secrets in the URL. | Prefer PKCE for email links; strip query strings in logs |
| V14.3.1 | Authenticated data cleared on logout | PARTIAL | Auth cookies and in-memory stores are cleared. Map screenshots in `localStorage` (`screenshotManager.js`) are not, and no `Clear-Site-Data` header is sent. | Clear app storage in `signOut()` |

### V15 Secure Coding and Architecture

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V15.1.1 | Documented remediation timeframes for vulnerable components | FAIL | None. `PRODUCTION_SECURITY.md` says "no critical vulnerabilities, checked Jan 2026", which is now out of date. | Set a policy (e.g. high within 30 days) |
| V15.2.1 | No components past those timeframes | FAIL | Backend: 13 advisories (8 high): multer, path-to-regexp, @xmldom/xmldom, lodash, image-size, ws, pptxgenjs, ag-grid-community. Frontend: 8 (1 critical `jspdf`, 4 high). | `npm audit fix`; plan the major bumps (`jspdf` 4.2.1, `pptxgenjs`) |
| V15.3.1 | Return only required fields | PARTIAL | 145 `SELECT *` / `RETURNING *` sites; `/api/users` returns full profiles to any authenticated user; many controllers return `details: error.message`. | Select explicit columns on user- and project-facing endpoints |

## Observations outside Level 1

Not scored above, but worth fixing:

- `backend/src/db.js:12` sets `ssl: { rejectUnauthorized: false }`, which disables certificate validation on the database connection.
- `backend/src/middleware/errorHandler.js` returns `err.message` to clients in production.
- `rateLimiter.js` keys on an unverified JWT `sub`, so forged tokens each get a fresh bucket (and each still triggers a Supabase call). LLM endpoints share the general 1000 requests per 15 minutes; only `/analyze` is stricter.
- `authenticate` falls back to the `viewer` role if the role lookup errors. Harmless today only because viewers aren't restricted anywhere.
- `process.on('uncaughtException')` logs and keeps running.
- `docs/deployment/PRODUCTION_SECURITY.md` is out of date: its rate limits, body-size limit and "no stack traces exposed" claims don't match the code.

## Checklist: things only you can verify

1. **Supabase → Auth → Providers → Email:** minimum password length? Leaked-password protection? OTP expiry? (Public signup: confirmed off 2026-10-02. It must be revisited before it is turned on, because the API does not yet enforce roles or project access.)
2. **Supabase → Auth → Rate limits:** sign-in and token-refresh limits.
3. **Supabase → Auth → Sessions / JWT expiry:** what is the access-token lifetime?
4. **Supabase user list:** confirmed 2026-10-02: no unexpected non-admin accounts.
5. **Migrations 151–157:** confirmed 2026-10-02: all applied.
6. **Render / Cloudflare:** can HSTS and the other security headers be added at Cloudflare for the frontend? (Production backend host confirmed as `trp-dash-dski.onrender.com`.)
