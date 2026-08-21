# Tenders Tool — Status

## What this is

A pipeline that pulls UK public procurement notices, filters them down to work
relevant to the business (planning, regeneration, socio-economic consultancy),
and surfaces them with council-level activity stats — the first building block
toward answering: which councils commission relevant work, what's live right
now, and who to build a relationship with there. Scoring, contacts, and Scoro
integration are future phases; this phase is data collection and triage.

## What's built and working

**Two data sources, one pipeline.** Both Find a Tender (FTS) and Contracts
Finder (CF) are UK government OCDS APIs with an identical shape — same
pagination, same date filters, same rate-limit behaviour. A shared client
factory (`backend/src/services/tenders/ocdsClient.js`) handles fetching for
both; a `source` column throughout the schema keeps their data separate where
it matters (sync windows, concurrency locks) and combined where it doesn't
(council activity stats).

**Pipeline stages, per sync run:**
1. Fetch every notice published in a date window (no server-side relevance
   filtering exists on either API — this step always pulls everything).
2. **Rules pass** (free, instant): keep only notices matching a CPV code
   prefix or keyword, minus anything hitting an exclusion keyword. Discarded
   notices are counted but not stored.
3. **Buyer matching**: match each kept notice's buyer name against 387 UK
   councils (seeded from ONS data). Unmatched buyers queue for manual review
   — many legitimately aren't councils (NHS trusts, universities, government
   departments).
4. **AI pass** (Claude Haiku, batched): reviews notices that passed the rules
   and marks them relevant/irrelevant with a one-line reason, using an
   editable prompt.
5. Everything is upsertable — re-running a sync over the same window never
   duplicates rows, and never overwrites a status you or the AI already set.

**Frontend**: a Tenders card on the homepage opens `/tenders`, with four tabs
— Notices (browse/filter/override), Council Activity (ranked by relevant
procurement volume), Buyer Matching (link unmatched buyers to councils), and
Settings (edit rules, the AI prompt, and see recent sync runs).

**Verified live**, not just built:
- FTS: one day (16 July) → 477 notices scanned, 36 stored, 7 marked relevant
  by AI, buyer-matched to real councils (Oxford, Canterbury, South
  Staffordshire, etc). Re-syncing the same window produced zero duplicates
  and preserved all AI/human decisions.
- Contracts Finder: one day → **10,000 notices scanned, 1,456 stored.**
  Notice URLs, values, CPV codes and buyer contacts all normalise correctly
  in the database.

## The open question: Contracts Finder volume

Contracts Finder runs at roughly **20x the volume** of Find a Tender — it
carries every below-threshold notice from every public body, not just
councils' larger procurements. This wasn't obvious until the live test above.
It means:

- A full historic backfill of CF would be large (order of millions of notices
  scanned, tens of thousands stored) and slow — the API rate-limited the
  single-day test four times, each triggering an automatic ~2-minute backoff.
- The AI review cost scales with what's stored — CF alone could mean
  reviewing over a thousand notices a day if backfilled broadly, versus
  FTS's few dozen.
- The current backfill chunking (30-day windows) was tuned for FTS's volume
  and would overrun CF's per-run page cap and silently truncate — this needs
  adjusting (smaller windows, or a page-cap warning surfaced to the UI)
  before a CF backfill is run.

**Decision needed before backfilling Contracts Finder:** either scope it down
(sync going forward only, not historic; or tighten the rules first so less
gets stored) or accept the larger cost and adjust the backfill chunking to
match. Nothing has been backfilled yet — the only CF data in the database is
that one verification day.

## Also worth knowing: Find a Tender's own history gap

FTS only became the single home for *all* UK procurement notices in
**February 2025** (Procurement Act). Before that, FTS carried only
above-threshold notices — sub-threshold council work (a lot of the target
range, e.g. a £15k–£100k consultancy commission) lived on Contracts Finder
instead. So an FTS-only backfill before Feb 2025 would understate historic
council activity. Recommendation from earlier discussion: backfill FTS back
to Feb 2025 (~17 months, complete data), and treat anything older as a
Contracts Finder question, not an FTS one.

## Not built yet

- Any historic backfill (FTS or CF) — only live/recent-day data exists so far.
- A scheduled daily sync (currently manual, via the "Sync now" button or a
  direct API call). Straightforward to add as a cron hitting `POST
  /api/tenders/sync` once the backfill strategy is settled.
- A source filter/tab in the frontend distinguishing FTS vs CF notices (the
  API supports filtering by `source`; the UI doesn't expose it yet).
- Everything downstream of this phase: authority/opportunity/contact scoring,
  Scoro integration, strategic contact research, weekly engagement lists —
  all deferred per the original phased plan.

## Key files

- `backend/src/services/tenders/` — `ocdsClient.js` (shared fetch/pagination),
  `ftsClient.js` / `contractsFinderClient.js` (per-source config),
  `normalise.js` (OCDS → row), `authorityMatcher.js` (buyer → council),
  `relevance.js` (rules + AI filtering), `sync.js` (orchestrator)
- `backend/src/controllers/tenders.controller.js` +
  `backend/src/routes/tenders.routes.js` — mounted at `/api/tenders`, open to
  any logged-in user
- `backend/sql/migrations/116–118_*.sql` — schema, council seed data (387
  authorities from ONS), starter filter rules
- `backend/scripts/generate-authority-seed.js` — regenerates the council
  seed if local government reorganises again
- `frontend/src/routes/tenders/+page.svelte` +
  `frontend/src/lib/components/tenders/` — the four-tab UI
- `frontend/src/lib/api/tenders.js` — frontend API wrapper

## Picking this back up

Next conversation, the natural entry point is: decide the Contracts Finder
backfill scope (question above), then either run it directly or via the API,
then set up a daily scheduled sync once both sources are in a steady state.
