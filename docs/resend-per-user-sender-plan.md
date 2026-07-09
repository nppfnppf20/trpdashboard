# Plan: Send Surveyor Briefing Emails from the Logged-in User's Address

**Date:** 2026-07-09
**Status:** Planned — not yet implemented

## Goal

Surveyor briefing emails (and other app email) currently send from a single central
address — in fact still Resend's sandbox sender `onboarding@resend.dev`, which only
delivers to our own account email. We want each email to be sent **from the address of
whichever user is logged in** (e.g. `josh@thirdrevolutionprojects.co.uk`), so surveyor
replies land in that user's real inbox and the email reads as coming from them personally.

## How it works

Resend verifies **domains, not individual mailboxes**. Once
`thirdrevolutionprojects.co.uk` is verified, the API may send from *any* address on that
domain with no per-user setup. "Send as the logged-in user" is then just passing the
authenticated user's email as the `from` field.

---

## 1. Changes on Resend (one-time, no code)

1. **Resend dashboard → Domains → Add Domain**: `thirdrevolutionprojects.co.uk`.
2. Add the DNS records Resend generates, at the DNS host for the domain:
   - **DKIM** TXT record (`resend._domainkey.…`) — lets Resend sign mail as the domain.
   - **SPF + MX on Resend's return-path subdomain** (`send.thirdrevolutionprojects.co.uk`) —
     note this does **not** touch the root SPF record, so existing Microsoft 365/Google
     mail is unaffected.
3. Wait for verification (usually under an hour).
4. **Create a new API key** scoped to:
   - *Sending access only* (not full access),
   - restricted to `thirdrevolutionprojects.co.uk`.
   Replace `RESEND_API_KEY` in the backend environment with this scoped key.
5. Optional but recommended: enable a **DMARC** record for the domain if not already
   present (`p=quarantine` or stricter). Resend's DKIM signature satisfies alignment.

**Rollback:** deleting the DNS records instantly revokes Resend's ability to send as the
domain.

---

## 2. Code changes

### `backend/src/services/emailService.js`

- Remove hardcoded `FROM_ADDRESS = 'onboarding@resend.dev'`.
- Read the central default from env: `EMAIL_FROM` (e.g.
  `TRP Dashboard <briefings@thirdrevolutionprojects.co.uk>`).
- `sendEmail({ to, subject, html, type, projectId, from, replyTo })`:
  - use `from` when provided, else fall back to `EMAIL_FROM`;
  - pass `reply_to` through to Resend when provided;
  - record the effective sender in the email log (see migration below).

### `backend/src/controllers/quoteRequests.controller.js` (`sendBriefingEmails`)

- Build the sender **server-side from the authenticated session** — never from the
  request body:
  ```js
  const senderEmail = req.user.email;
  const senderName = req.user.user_metadata?.full_name || senderEmail.split('@')[0];
  ```
- **Domain guard** (critical): only use the user's address as `from` if it ends with
  `@thirdrevolutionprojects.co.uk` (env var `EMAIL_SENDER_DOMAIN`). Otherwise fall back
  to `EMAIL_FROM` and set `reply_to` to the user's address instead. Without this guard,
  a user logged in with an address on any other domain would make Resend hard-reject the
  send and break the feature.
- Route already sits behind `requireAdmin` (`/api/admin-console` mount) — keep it there.

### `backend/sql/migrations/1xx_email_log_sender.sql`

```sql
ALTER TABLE admin_console.email_log
  ADD COLUMN IF NOT EXISTS sender_email TEXT;
```

So the log answers "who sent what to whom" per email, not just what was sent.

### Environment variables (backend)

| Variable | Example | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `re_…` (new scoped key) | Sending-only, domain-restricted |
| `EMAIL_FROM` | `TRP Dashboard <briefings@thirdrevolutionprojects.co.uk>` | Central fallback sender |
| `EMAIL_SENDER_DOMAIN` | `thirdrevolutionprojects.co.uk` | Domain guard for per-user from |

Backend restart required after changes.

---

## 3. Risks and measures

Verifying the domain delegates to Resend the ability to send authenticated mail **as any
address on the domain**. Whoever holds the API key inherits that power. Risks ranked:

| # | Risk | Severity | Measure |
|---|---|---|---|
| 1 | **API key leak → perfect phishing as the company.** Any holder of `RESEND_API_KEY` can send SPF/DKIM-passing mail as any company address. | High | Key lives in backend env only, never frontend or git (repo verified clean as of today). Use a *sending-only, domain-restricted* key. Rotate immediately on any suspicion. |
| 2 | **Compromised app account sends real email.** | Medium | Sending stays behind `requireAdmin`. `from` is derived from the verified Supabase JWT (`req.user`), never client-supplied. Every send logged to `email_log` with sender. |
| 3 | **Sender impersonation between users.** An admin could send as another admin if `from` were accepted from the request. | Medium | Same measure as #2: `from` comes only from `req.user.email`. |
| 4 | **Domain email reputation is shared.** Spam complaints via Resend can hurt deliverability of normal company Outlook mail. | Low (low volume, known recipients) | Volume is a handful of fee-quote emails to known surveyors. If volume ever grows or bulk email is added, revisit: move bulk sending to a verified subdomain (`send.…`), keeping the root domain for personal-from sends. |
| 5 | **Resend itself breached** (supply-chain). | Low | Accepted risk with any email service provider. Rollback is instant via DNS record removal. |

### Deliberate trade-offs

- **Not** using a subdomain (`send.…`) for the from address, because the whole point is
  `from = the user's real mailbox address`. Acceptable at current volume.
- Emails sent via Resend **do not appear in the user's Outlook "Sent" folder** — the app's
  `email_log` table is the audit trail. If sent-folder visibility becomes a requirement,
  the alternative is per-user OAuth via Microsoft Graph (much bigger lift, out of scope).
- Replies work naturally: `from` is the user's real address, so surveyor replies arrive
  in their normal inbox with no extra configuration.

### Preconditions to confirm before implementing

- [ ] All app users log in with `@thirdrevolutionprojects.co.uk` addresses (the domain
      guard handles stragglers gracefully, but confirm the expectation).
- [ ] Access to the domain's DNS host to add the Resend records.
- [ ] Decide the central fallback mailbox (`briefings@`?) — it should exist as a real
      mailbox or alias so bounces/replies to it aren't lost.
