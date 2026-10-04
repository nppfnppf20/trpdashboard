# Security Controls

**Last updated:** 2026-10-02
**Purpose:** the written definitions that OWASP ASVS asks for: who can do what, what input is accepted, how abuse is limited, and how vulnerable dependencies are handled. If the code and this document disagree, fix whichever is wrong and update the date.

Related: `ASVS_LEVEL1_ASSESSMENT.md` (the scored checklist) and `PRODUCTION_SECURITY.md` (roadmap).

---

## 1. Access control

### Who can use the system

| Role | Frontend (SvelteKit pages) | Backend API (`/api/*`, `/analyze/*`, `/save-*`) |
|---|---|---|
| `admin` | Full access | Full access |
| `surveyor`, `client`, `viewer`, or no role | Redirected to `/auth/unauthorized` | Rejected with 403 |

- **Where it's enforced:** the frontend in `frontend/src/hooks.server.js` (every request, role read from `user_roles`); the API in `backend/src/routes/index.js` (`authenticate` then `requireAdmin` on every API mount).
- **Data-level access:** all admins can see and edit all projects. There is no per-project ownership check, by design, because every user is an internal admin. This must change before any non-admin role is given API access (see below).
- **Roles come from** the `user_roles` table. A user with no row is treated as `viewer` (no access). If the role lookup itself fails, the API returns 503 instead of guessing.
- **Account creation:** public signup is disabled in Supabase. Accounts are created by invitation from the Supabase dashboard.

### Before enabling signup or adding non-admin roles

1. Replace the blanket `requireAdmin` in `backend/src/routes/index.js` with per-router `requireRole(...)` calls.
2. Add a project-membership check (a shared middleware that verifies the caller may access `:projectId`) to every project-scoped route.
3. Re-run the access review in `ASVS_LEVEL1_ASSESSMENT.md` (V8).

---

## 2. Input validation rules

General rules, enforced on the server:

| Input | Rule | Where |
|---|---|---|
| JSON / form body | Max 10 MB | `server.js` |
| Uploaded file size | 20 MB by default; 25 MB for conditions and quotes; 50 MB for meeting notes, consultation, public comments, drafting issues and policy updates | `middleware/upload.js`, per route |
| Uploaded file type | Extension must be on the route's allowlist (`pdf`, `docx`, `txt`, `md`, plus `doc` for quotes and public comments; some routes allow fewer) **and** the first bytes must match the type (PDF `%PDF`, DOCX ZIP header, DOC OLE header, text files must contain no NUL bytes). Voice clips must have a webm, mp4, wav or ogg signature | `middleware/upload.js` |
| SQL | Always parameterized. Dynamic table or column names come only from fixed whitelists in code | all `pool.query` calls |
| HTML rendered in the browser | Passed through DOMPurify before `{@html}` or `innerHTML`; text rendered from markdown is escaped first | `frontend/src/lib/utils/sanitizeHtml.js`, `markdown.js` |
| Links from data | Only `http:`, `https:` and `mailto:` are allowed in `href`; anything else becomes `#` | `frontend/src/lib/utils/safeUrl.js` |

Project create/update (`POST /api/projects`, `PUT /api/projects/:id`, `PATCH /api/projects/:id/development-type`) are validated with zod in `backend/src/validation/projects.schema.js`:

| Field | Rule |
|---|---|
| `project_id` | Required on create; text (≤ 100) or number |
| `project_name` | Required on create; text ≤ 300 |
| `project_type`, `status` | Text ≤ 100 |
| `project_lead`, `project_manager`, `project_director` | Text ≤ 200 |
| `*_user_id` | Text ≤ 100 or null |
| `address` | Text ≤ 1000 |
| `client`, `client_spv_name` | Text ≤ 300 |
| `local_planning_authority` | List of up to 50 items, each ≤ 200 |
| `sectors`, `sub_sectors`, `development_types` | List of up to 100 items, each ≤ 300 |
| `designations_on_site`, `relevant_nearby_designations` | Text ≤ 20,000 or a list of up to 500 items |
| `development_description`, `comments`, `about_applicant` | Text ≤ 50,000 |
| `case_officer_name` | Text ≤ 300 |
| `case_officer_email` | Text ≤ 320 |
| `case_officer_phone_number` | Text ≤ 50 |
| `lpa_reference` | Text ≤ 200 |
| Key date fields | Text ≤ 40 (`YYYY-MM-DD`) or null |

A request that breaks a rule gets a 400 with a list of the fields and problems.

**Not yet covered:** the other write endpoints (quotes, meeting notes, conditions, tenders and others) still use ad hoc checks. Extend `validateBody` to them in priority order: quotes, conditions, meeting notes.

---

## 3. Rate limiting and anti-automation

| Control | Setting | Notes |
|---|---|---|
| General API limit | 1000 requests per 15 minutes per user (by token `sub`, otherwise by IP) | `middleware/rateLimiter.js`, mounted on `/api` |
| Analysis limit | 40 requests per 15 minutes per user | `/analyze/*` |
| Login brute-force protection | Provided by Supabase Auth (login goes straight to Supabase, not through this API). The app has no lockout of its own | Confirm the configured limits in Supabase → Auth → Rate Limits |
| Account lockout | None, which avoids letting an attacker lock real users out | |
| Public signup | Disabled | |
| Rate limits in development | Skipped when `NODE_ENV=development` only | |

Known weakness: the limiter keys on the token's `sub` claim without verifying the signature, so forged tokens each get a fresh bucket. Forged tokens still fail authentication, so this limits only the cost of a flood, not access. LLM endpoints share the general limit.

---

## 4. Dependency vulnerability handling

- **Check:** run `npm audit --omit=dev` in `backend/` and `frontend/` monthly and before each release.
- **Fix within:** critical 7 days, high 30 days, moderate 90 days, low at the next routine update.
- **Process:** `npm audit fix` first; for major-version fixes, update on a branch, run the build and smoke-test the affected feature, then merge.
- **Exceptions:** anything that can't be fixed in time is listed below with the reason and a review date.

| Package | Severity | Why not fixed | Review by |
|---|---|---|---|
| `@anthropic-ai/sdk` (backend) | Moderate | The advisory is about the SDK's local-filesystem Memory Tool, which this app doesn't use. The fix is a large major version jump; update together with a planned LLM code review | 2026-12-31 |
| `pptxgenjs` → `image-size` (backend) | High | Denial of service when parsing crafted JXL/HEIF/ICNS images. Slideshow generation only embeds images the server chooses. The only offered fix downgrades `pptxgenjs` | 2026-12-31 |

Status at 2026-10-02: backend 3 advisories (both exceptions above), frontend 0.
