# Anti-AI-Slop System

_Added 2026-09-14._

## What it is

`ANTI_AI_SLOP_BLOCK` is a single shared instruction string exported from `backend/src/services/llm.shared.js` (alongside `HOUSE_STYLE_BLOCK` and `TONE_EXAMPLE_BLOCK`, which it's usually concatenated next to). It bans the tells of AI-generated prose — stock phrases ("delve into", "underscores", "robust", "boasts", "in today's [x]", "it is important to note that"), hedge-then-state throat-clearing, sentence-length monotony, restate-what-I-just-said paragraph endings, and manufactured "on the one hand / on the other" false balance.

There is exactly one copy of the text. Every call site that uses it imports the same constant and appends it — nobody gets a customised or watered-down version.

```js
export const ANTI_AI_SLOP_BLOCK = `\n\nAVOID AI-GENERATED-SOUNDING LANGUAGE — this is written by a human planning consultant and must read that way throughout:
- Never use: "delve into", "underscores", ...
...`;
```

## How it's applied

Not centralised — there's no interceptor on `callClaude`/`callLLM` that auto-appends it. Each prose-generating call site imports `ANTI_AI_SLOP_BLOCK` and appends it to its own `system` prompt, the same way existing call sites already appended `HOUSE_STYLE_BLOCK`. That means:

- **New call sites don't get it automatically.** Anyone adding a fresh LLM prompt has to remember to import and append it themselves.
- **It was applied selectively, by judgement**, not blanket-injected into every LLM call in the codebase. Pure JSON/classification prompts with no prose output were deliberately left out (see below).

If stricter, can't-forget-it enforcement is ever wanted, the fix would be to bake the append into `callClaude`/`callLLM` in `llm.shared.js` itself — with an opt-out for the classification-only call sites that shouldn't carry it.

## Where it's wired in (as of 2026-09-14)

**Planning deliverables**
- `appeal.service.js` — appeal argument generation, draft section/document generation, document incorporation, argument evolve/refine chat, argument-suggestion chat (~12 call sites)
- `planningStatement.service.js` — assessment/section/template generation, document summarisation, briefing-driven issue/argument drafting (~9 call sites)
- `stage1Review.controller.js` — Stage 1 Review document generation
- `hlpvV3.controller.js` — HLPV v3 document generation
- `draftCheck.controller.js` — Check Draft (brief coverage / consistency / grammar)

**Advancements**
- `consultation.service.js` — advancement summaries + candidate-matching
- `conditionsTracker.service.js` — advancement summaries, candidate-matching, client progress-summary email
- `progressTracker.service.js` — advancement summaries, candidate-matching, meeting-draft proposals
- `quoteActions.service.js` — actions-tracker log entries

**Meeting notes**
- `meeting.service.js` — transcript summary (`buildSystemPrompt`)

**Chat**
- `projectChat.controller.js`, `crossProjectChat.controller.js`, `sectionChat.controller.js`

**Other prose generation**
- `hlpv.service.js` — HLPV narrative (pre-v3)
- `marketing.controller.js` — LinkedIn/newsletter copy
- `surveyorBriefing.service.js` — briefing email edits
- `ingestion.service.js` — document summary + topic-summary merge

## Deliberately left out

Pure JSON/classification prompts with no prose output for a human reader:
- `tenders/relevance.js` — true/false relevance filter
- `scraperFilters.controller.js` — true/false relevance filter
- A handful of extraction-only prompts inside the tracker services above (date-only scans, discipline-picking, status-only checks)

## Side fix made in the same pass

`draftCheck.controller.js` called `callClaude(...)` without importing it — a pre-existing bug that would have thrown `ReferenceError` at runtime on every draft-check call. Fixed alongside wiring in the anti-slop block (see `backend/src/controllers/draftCheck.controller.js` import line).
