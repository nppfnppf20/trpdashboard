# OWASP ASVS 5.0 — Level 1 Assessment

**Date:** 2026-10-02
**Standard:** OWASP ASVS 5.0.0, Level 1 (70 requirements, taken from the official CSV)
**Scope:** `backend/` (Express 5 API), `frontend/` (SvelteKit), live hosts `trpdashboard.co.uk` (frontend) and `trp-dash-dski.onrender.com` (production backend, read from the live frontend's JavaScript bundle; the `hlpv-web-app-test3.onrender.com` fallback in `frontend/src/lib/config.js` is not what production uses)
**Method:** static code review, `npm audit`, read-only HTTP checks of the live hosts, and the existing docs in `docs/deployment/`.
**Not covered:** anything that lives only in the Supabase dashboard or the Render/Cloudflare dashboards. Those rows are marked VERIFY and listed in the checklist at the end.

## Status

This document was first written before any fixes (**29 of 59 applicable requirements passing**). Most findings were then fixed on branch `security/asvs-l1-fixes`; the statuses below reflect **that branch's code**. Nothing is live until the branch is merged and deployed, so rows say "confirm live after deploy" where the check was on the live site.

| Status | Before fixes | On the branch |
|---|---|---|
| PASS | 29 | 41 |
| PARTIAL | 13 | 13 |
| FAIL | 13 | 1 |
| VERIFY | 4 | 4 |
| N/A | 11 | 11 |

Of the 59 applicable requirements, 41 now pass (69%).

## Remaining work

1. **V6.2.2 (FAIL):** there is no change-password or forgot-password flow in the app.
   **V3.4.1, V4.1.1 (PARTIAL):** static files and redirects carry no security headers. Turn on HSTS in Cloudflare to cover them.
2. **V8.2.2 (PARTIAL):** no per-project access check. Fine while every user is an admin; **must be built before signup is enabled or any non-admin role gets API access** (steps in `SECURITY_CONTROLS.md` §1).
3. **V3.3.1 (PARTIAL):** session cookies are `Secure` now but have no `__Host-`/`__Secure-` prefix and are JS-readable.
4. **V2.1.1, V2.2.1, V2.2.2 (PARTIAL):** server-side validation rules exist for the project endpoints only. Extend to quotes, conditions and meeting notes.
5. **V15.2.1 (PARTIAL):** two documented dependency exceptions remain (`@anthropic-ai/sdk`, `pptxgenjs` → `image-size`), to be reviewed by 2026-12-31.
6. **V6.1.1, V6.2.1, V6.2.4, V6.3.1 (PARTIAL / VERIFY):** Supabase Auth settings that need checking in the dashboard (see the checklist).
7. **V2.3.1 (VERIFY):** server-side ordering of multi-step flows hasn't been reviewed.
8. **V7.4.1, V7.4.2, V14.2.1 (PARTIAL):** shorten the access-token lifetime in Supabase, and prefer PKCE for invite/recovery email links.

## Matrix

Evidence paths are relative to the repo root.

### V1 Encoding and Sanitization

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V1.2.1 | Context-appropriate output encoding | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. All data-driven `{@html}` and `innerHTML` now go through DOMPurify (`frontend/src/lib/utils/sanitizeHtml.js`); `md()` escapes input. Chat/report renderers already escaped. Svelte escapes `{text}` by default, but `{@html}` is used with unsanitized data (e.g. `frontend/src/lib/components/projects/MeetingNotesTab.svelte:972`, `ProjectDocsTab.svelte:719`). `md()` in `frontend/src/lib/utils/markdown.js` doesn't escape input. `renderReply` in `chatMarkdown.js` does escape first. Review found and fixed 11 more sinks: every Leaflet `bindPopup()` (9 in `ProjectMapPanel.svelte`, 2 in `Map2.svelte`) interpolated third-party dataset fields straight into HTML and now goes through `sanitizeHtml`. | Smoke-test rich-text screens in the browser |
| V1.2.2 | Encode untrusted data in URLs; allow only safe protocols | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Every data-driven `href` uses `safeUrl()` (`frontend/src/lib/utils/safeUrl.js`: http, https, mailto only); the `mailto:` recipient in `BriefingEditor.svelte` is now encoded. | — |
| V1.2.3 | Encode when building JavaScript/JSON | PASS | Responses use `res.json`; no dynamic script construction found. | — |
| V1.2.4 | Parameterized queries | PASS | All `pool.query` calls use `$n` placeholders. Dynamic identifiers come from fixed whitelists: `lookups.service.js` `LOOKUP_CONFIGS`, `projectsApi.js` `MILESTONE_RESOLVED_COLUMNS`, constant column names in `workflow.service.js`. Dynamic `SET`/`WHERE` builders only append fixed fragments. | — |
| V1.2.5 | OS command injection | PASS | No `child_process`, `exec`, `spawn` in `backend/src`. | — |
| V1.3.1 | Sanitize WYSIWYG HTML with a known library | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. DOMPurify is applied wherever stored or LLM-generated HTML is rendered or parsed. Backend write-time sanitization still covers policies only (`policy.controller.js`). | Optional: also sanitize on write in the backend |
| V1.3.2 | No `eval` / dynamic code execution | PASS | No `eval(` or `new Function(` in `backend/src` or `frontend/src`. | — |
| V1.5.1 | Restrictive XML parser config | PASS | No direct XML parsing. `.docx` goes through `mammoth` → `@xmldom/xmldom`, which does not resolve external entities. The xmldom advisories were cleared by `npm audit fix`. | — |

### V2 Validation and Business Logic

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V2.1.1 | Documented input validation rules | PARTIAL | Rules now documented in `docs/deployment/SECURITY_CONTROLS.md` §2 (general limits, uploads, and every project field). Other endpoints are not yet covered. | Extend rules and schemas to quotes, conditions and meeting notes |
| V2.2.1 | Validate input used for business/security decisions | PARTIAL | Ad hoc checks only (required fields, column whitelists). `express-validator` is installed but never used. No length or range checks. | Add schema validation (zod or express-validator) on decision-driving inputs |
| V2.2.2 | Validation at a trusted service layer | PARTIAL | Some server-side checks exist per controller; most validation is in the UI. | As above |
| V2.3.1 | Business flows enforced in sequence | VERIFY | Multi-step flows exist (quotes, stage workflow). Server-side order enforcement not reviewed. | Review `workflow.service.js` and quote state transitions |

### V3 Web Frontend Security

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V3.2.1 | Content not rendered in the wrong context | PASS | API returns JSON with `X-Content-Type-Options: nosniff` (helmet, confirmed live). Uploads are held in memory and never served. | — |
| V3.2.2 | Text displayed as text, not HTML | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Markdown is escaped before formatting, and all `{@html}` content is sanitized. | — |
| V3.3.1 | Cookies `Secure`, with `__Host-`/`__Secure-` prefix | PARTIAL | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. The browser cookie writer now adds `Secure` on HTTPS (`frontend/src/lib/supabase.js`). The cookie names still lack a `__Host-`/`__Secure-` prefix (renaming would sign everyone out and must match on the server client), and the cookies remain JS-readable. | Decide on the prefix and a server-only session cookie |
| V3.4.1 | HSTS (≥1 year) on all responses | PARTIAL | Backend sends HSTS (1 year, includeSubDomains) on all responses (confirmed live). The frontend now sets it on pages in `frontend/src/hooks.server.js` (confirmed on a locally served build). **But static files (`/_app/*.js`, `.css`) and the 303 redirects from the auth guard bypass that hook and carry no HSTS or nosniff** (confirmed on the local build). On the live site only the Cloudflare edge can cover those. | Enable HSTS in Cloudflare (SSL/TLS → Edge Certificates), which adds it to every response including static files and redirects |
| V3.4.2 | CORS origin is fixed or allowlisted | PASS | Allowlist in `backend/src/server.js:37-61`. | — |
| V3.5.1 | Anti-forgery for requests not protected by preflight | N/A | API doesn't use cookie auth and relies on preflight; see V3.5.2. | — |
| V3.5.2 | Preflight can't be bypassed | PASS | Every API call needs the `Authorization: Bearer` header, which is not CORS-safelisted. | — |
| V3.5.3 | Sensitive actions use non-GET methods | PASS | No state-changing GET found in the routes (heuristic search). | — |

### V4 API and Web Service

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V4.1.1 | `Content-Type` matches body, with charset | PARTIAL | Backend JSON includes `charset=utf-8` (live). Frontend HTML pages now include it (hook, confirmed on a local build). Static CSS/JS/text files are served as `text/css`, `text/javascript`, `text/plain` with no charset (confirmed locally). Low practical impact: the HTML declares its own charset. | Optional: serve static files through a small custom server that adds the charset |
| V4.4.1 | WSS for WebSockets | N/A | No WebSocket usage in the app code. | — |

### V5 File Handling

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V5.2.1 | File size limits | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Every upload route now has a size limit (`backend/src/middleware/upload.js`; stage1 review gained a 20 MB limit) and `multer` is updated (advisories cleared). | — |
| V5.2.2 | Extension matches content | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Shared upload middleware checks the extension allowlist and the file signature (PDF, DOCX, DOC, text, audio) on all 17 upload routes plus the workflow routes. | — |
| V5.3.1 | Uploaded files not executable from a public folder | PASS | Memory storage only; no Supabase Storage or disk persistence of uploads. | — |
| V5.3.2 | No user filenames in file paths | PASS | `originalname` is stored only as DB metadata. The one file-path write that interpolates a value (`appealbaseDeepRead.service.js:118`) is reachable only from CLI scripts, not routes. | — |

### V6 Authentication

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V6.1.1 | Documented anti-automation / brute-force controls | PARTIAL | Documented in `SECURITY_CONTROLS.md` §3 with the real limits (the old doc quoted wrong numbers). Supabase Auth's own login limits are not yet confirmed. | Confirm Supabase Auth rate limits and record them |
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
| V8.1.1 | Documented authorization rules | PASS | Access matrix and the plan for adding roles are written down in `SECURITY_CONTROLS.md` §1. | — |
| V8.2.1 | Function-level access limited to explicit permissions | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. `authenticate` then `requireAdmin` is applied to `/api`, `/analyze`, `/save-site` and `/save-trp-edits` (`backend/src/routes/index.js`). A failed role lookup returns 503 instead of defaulting. Verified end-to-end (see Review log): 10 route families x 5 token states against the real router. | Replace with per-route roles before adding non-admin users |
| V8.2.2 | Data-level access (IDOR/BOLA) | PARTIAL | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Only admins can reach the API, and all admins may see all projects by design (documented). There is still no per-project ownership check, so this becomes a failure again if non-admin users are given API access. | Add a project-membership middleware before enabling signup or non-admin roles |
| V8.3.1 | Enforced at a trusted layer | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. The API now enforces the admin requirement itself instead of relying on the UI guard. | — |

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
| V12.1.1 | Only TLS 1.2/1.3 | PASS | TLS 1.0 and 1.1 are refused and TLS 1.2 is accepted on both live hosts. TLS 1.3 could not be tested from this machine (its Windows TLS stack does not offer it); Cloudflare enables it by default. | — |
| V12.2.1 | TLS for all external-facing connections | PASS | HTTP redirects 301 to HTTPS on both hosts. | — |
| V12.2.2 | Publicly trusted certificates | PASS | `curl` validated both certificates without `-k`. | — |

### V13 Configuration

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V13.4.1 | No source-control metadata deployed | PASS | `/.git/HEAD` returns 303 → login (frontend) and 404 (backend). | — |

### V14 Data Protection

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V14.2.1 | No sensitive data in URLs | PARTIAL | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. The backend request logger now records paths without query strings.  Invite/recovery flows put a single-use `token_hash` in the query string (`auth/callback/+server.js`) and session tokens in the URL fragment (`auth/+layout.svelte:11-20`). The backend request logger records full URLs including query strings (`requestLogger.js`). No API call found passing secrets in the URL. | Prefer PKCE for email links |
| V14.3.1 | Authenticated data cleared on logout | PASS | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Sign-out and session-expiry now clear the map screenshots held in localStorage (`clearAllStoredScreenshots`), in addition to the auth cookies and in-memory stores. | — |

### V15 Secure Coding and Architecture

| ID | Requirement (short) | Status | Evidence | Action |
|---|---|---|---|---|
| V15.1.1 | Documented remediation timeframes for vulnerable components | PASS | Remediation timeframes (critical 7 days, high 30, moderate 90) and the exceptions process are documented in `SECURITY_CONTROLS.md` §4. | — |
| V15.2.1 | No components past those timeframes | PARTIAL | Fixed on branch `security/asvs-l1-fixes`; confirm live after deploy. Frontend: 0 advisories (`jspdf` upgraded to 4.2.1; PDF generation smoke-tested). Backend: 13 → 3. The remaining three are two documented exceptions: `@anthropic-ai/sdk` (feature not used) and `pptxgenjs` → `image-size` (fix is a downgrade). | Review the exceptions by 2026-12-31 |
| V15.3.1 | Return only required fields | PARTIAL | 145 `SELECT *` / `RETURNING *` sites; `/api/users` returns only names, avatars and roles; many controllers return `details: error.message`. | Select explicit columns on user- and project-facing endpoints |

## Observations outside Level 1

Not scored above.

Fixed on the branch:
- `errorHandler.js` no longer returns internal error text for 5xx responses in production; a middleware also strips `details` from 5xx JSON; blocked CORS origins now get a clean 403 instead of a 500.
- `authenticate` no longer falls back to a role when the role lookup fails; it returns 503. A user with no role row gets no access.
- `docs/deployment/PRODUCTION_SECURITY.md` was corrected (rate limits, body-size limit, dependency status, sanitization status).

Still open:
- `backend/src/db.js:12` sets `ssl: { rejectUnauthorized: false }`, which disables certificate validation on the database connection.
- `rateLimiter.js` keys on an unverified JWT `sub`, so forged tokens each get a fresh bucket (and each still triggers a Supabase call). LLM endpoints share the general 1000 requests per 15 minutes; only `/analyze` is stricter.
- `process.on('uncaughtException')` logs and keeps running.

## Review log (2026-10-02, after the fixes)

An independent re-check of the re-scored matrix: each upgraded row was tested against the real code rather than taken on trust. Results:

**Tests run, all passing**
- **Admin gate, end to end (52 checks):** the real `routes/index.js` router, mounted against a fake local Supabase and an unreachable database, so nothing real was contacted. For `/api/projects`, `/api/users`, `/api/lookups`, `/analyze/*`, `/save-site`, `/save-trp-edits`, `/api/admin-console/*`, `/api/llm-status`, `/api/voice/*` and `/api/meeting-notes/*`: no token gives 401, a viewer gives 403, a user with no role row gives 403, a failed role lookup gives 503, and an admin gets through the gate. A forged token gives 401 and an unknown route as a viewer still gives 403.
- **Uploads through real multer (7 checks):** valid PDF/TXT accepted; a fake PDF, an `.exe` and a disallowed `.docx` get 400; a 2 MB file against a 1 MB limit gets 413; a request with no file passes through for the pasted-text path.
- **Project validation (7 checks):** the real `ProjectDetailsTab` draft shape, ISO timestamps and numeric `area` from the database are accepted; oversized or missing fields and malformed JSON get 400. I also read all five frontend create/update call sites to confirm the payload types match the schema.
- **Frontend:** `svelte-check` shows 0 new errors against the baseline, the production build passes, and headers were checked on a locally served build.
- **Helpers:** `safeUrl`, `md()`, `sanitizeHtml` (in jsdom), upload signatures, error scrubbing and `requireAdmin` unit tests pass.

**Found and fixed during the review**
- 11 Leaflet popup calls rendered third-party dataset fields as HTML (V1.2.1). Now sanitized.

**Downgraded during the review**
- V3.4.1 and V4.1.1: PASS to PARTIAL. Static files and redirects don't get the headers (see the rows).

**Re-checked and confirmed**
- Every remaining `{@html}` outside `sanitizeHtml` is a renderer that escapes its input first (`renderReply`, `render`, `renderMarkdown`, `md`).
- The remaining `innerHTML =` lines are static map legends, an empty string, or already sanitized.
- Every route file that uses `upload.single` goes through the shared middleware; the only `multer(` left is the workflow router, which adds the shared content check.
- `authLimiter` is defined but unused (documented).

**Not tested** (needs a browser or the live deployment): the rich-text editors and email-copy flows after sanitization, PDF exports on `jspdf` 4 in a browser, voice dictation, and the live headers after deploy.

## Checklist: things only you can verify

1. **Supabase → Auth → Providers → Email:** minimum password length? Leaked-password protection? OTP expiry? (Public signup: confirmed off 2026-10-02. It must be revisited before it is turned on, because the API does not yet enforce roles or project access.)
2. **Supabase → Auth → Rate limits:** sign-in and token-refresh limits.
3. **Supabase → Auth → Sessions / JWT expiry:** what is the access-token lifetime?
4. **Supabase user list:** confirmed 2026-10-02: no unexpected non-admin accounts.
5. **Migrations 151–157:** confirmed 2026-10-02: all applied.
6. **Render / Cloudflare:** can HSTS and the other security headers be added at Cloudflare for the frontend? (Production backend host confirmed as `trp-dash-dski.onrender.com`.)
