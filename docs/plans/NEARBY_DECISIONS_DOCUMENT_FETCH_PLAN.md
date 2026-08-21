# Nearby Decisions — Automated Document Fetch Plan

**Status:** Proposal (not yet started)
**Written:** 16 July 2026
**Relates to:** Similar Schemes tab (Beta dropdown, Project View modal), LPA Decision Analysis tab

## Goal

Close the loop between finding a similar/nearby planning decision and analysing it.

Today the Similar Schemes tab searches PlanIt and returns results with a "View on PlanIt"
link. To get the actual documents (decision notice, officer report, plans) a user must
follow that link to PlanIt, then on to the council's own planning portal, find the
Documents tab, and download PDFs by hand — then upload them manually into the LPA
Decision Analysis tab.

The goal is: **search similar schemes → pick a result → the system fetches its decision
documents → they flow straight into the existing LPA Decision Analysis pipeline.**

## How the pieces fit today

- `frontend/src/lib/components/projects/SimilarSchemesTab.svelte` — search UI; renders
  `r.url` as an external "View on PlanIt" link.
- `frontend/src/lib/api/planit.js` → backend `/api/planit/...` — keyword suggestions and
  PlanIt search, already proxied through our backend.
- PlanIt (planit.org.uk) is an **aggregator**: it holds structured metadata and a link out
  to the council's portal, but does **not** host documents.
- The documents live on each council's own planning portal, behind a "Documents" tab.
- LPA Decision Analysis tab already analyses uploaded decision documents — the analysis
  side of the pipeline exists; only acquisition is manual.

## Feasibility, in layers

### Layer 1 — PlanIt (easy, plain HTTP, no agent)

PlanIt has a proper JSON API. Each record carries the onward URL to the LPA portal page
plus structured metadata (reference, decision, dates). The backend already talks to it.
Nothing to "click" — this layer is ordinary HTTP.

### Layer 2 — LPA portals (the real work, mostly scrapeable)

The onward link lands on one of a handful of portal products:

| Portal | Share of councils (approx) | Difficulty |
|---|---|---|
| Idox Public Access | ~70% | Easy: predictable URL pattern for the documents tab (`applicationDetails.do?activeTab=documents&keyVal=…`), plain HTML table of PDF links. Plenty of open-source precedent. |
| Northgate / NEC | ~15% | Moderate: session tokens, multi-step search flows. |
| Ocella, Agile, custom | ~15% | Varies: per-portal quirks; some need real browser automation. |

Complications that apply unevenly across councils:

- Some portals sit behind bot protection (Cloudflare, occasionally CAPTCHAs) that blocks
  plain HTTP and frustrates even headless browsers.
- Session/cookie handshakes before the documents list will render.
- Document lists can be paginated or lazy-loaded.

### Layer 3 — LLM browser agent (fallback tier only)

For portals where deterministic scraping fails, an LLM-driven browser agent (Claude
computer use, or the Agent SDK driving Playwright) can handle "click through whatever this
portal is and find the decision notice". It is much more resilient to portal variety, but
slower and costs per run — so it is the fallback tier, not the default path.

## Recommended architecture

A backend fetch job, not a literal clicking agent, for the common case:

1. **Resolve & detect.** Given a PlanIt result, resolve the LPA portal URL and detect the
   portal type (Idox / Northgate / other) from the URL shape and response.
2. **List documents (Idox first).** For Idox: fetch the documents tab directly, parse the
   HTML table into a structured list (title, type, date, PDF URL).
3. **User picks, server downloads.** Present a tickable list in the UI ("Decision Notice",
   "Officer Report", …). Download selected PDFs server-side and store them against the
   project (same storage pattern as existing document uploads).
4. **Pipe into analysis.** Feed downloaded documents straight into the existing LPA
   Decision Analysis flow, replacing the manual upload step.
5. **Fallback tiers.** Non-Idox or bot-protected portals: either queue for the LLM browser
   agent (if/when built) or show the portal link with a "download manually" prompt —
   the UI should degrade gracefully per result, not fail the whole feature.

### Suggested build order

1. **Phase 1 — Idox-only fetcher.** Portal detection + Idox documents-tab scraper +
   document picker UI + storage. Covers roughly 70% of councils and proves the loop.
2. **Phase 2 — wire into LPA Decision Analysis.** Fetched documents appear as analysable
   inputs with no manual upload.
3. **Phase 3 — widen coverage.** Northgate/NEC scraper next (moderate effort), then assess
   whether the remaining tail justifies an agent-based fallback or stays manual.

## Constraints and etiquette

- Council portals are public records, but some carry terms discouraging *bulk* scraping.
  Keep fetches **user-initiated and per-application** (on-demand, not crawling), with
  polite rate limits and a clear User-Agent. That keeps usage comfortably reasonable.
- Expect per-council flakiness; log failures per portal so the fallback tiering can be
  tuned with real data.
- CAPTCHAs and bot walls should trigger the manual-download fallback, never retry loops.

## Expected outcome

Roughly an **80% automated solution** via plain scraping (Idox + Northgate), with an agent
or manual fallback for the awkward remainder. Phase 1 (Idox-only, wired into Decision
Analysis) is the highest-value slice and a good test of whether the remaining 20% is worth
automating at all.
