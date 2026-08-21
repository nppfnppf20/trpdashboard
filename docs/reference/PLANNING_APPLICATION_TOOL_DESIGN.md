# Planning Application Tool — Design Plan

## What This Tool Is For

The Planning Application Tool is for preparing a **planning statement** — a document that makes the case for a planning application. It is fundamentally different from the Appeal Drafting tool:

| | Appeal Tool | Planning Application Tool |
|---|---|---|
| Purpose | Rebut a refusal, make the case on appeal | Make the case for the application |
| Issues | Reasons for refusal / inspector questions | Planning assessment issues (e.g. design, heritage, housing) |
| Argument structure | For vs Against the appellant's case | Policy assessment (national / local / neighbourhood / SPD) |
| Output | Appeal statement / proof of evidence | Planning statement |

---

## Planning Statement Structure

A planning statement typically has sections like:

1. **Introduction** — site, applicant, scope of document
2. **The Proposal** — description of development
3. **Planning History** — relevant consents / refusals
4. **Planning Policy** — the policy framework (national, local, neighbourhood)
5. **Planning Assessment** — issue-by-issue assessment against policy
6. **Conclusion** — planning balance / recommendation

For each assessment issue (e.g. design, heritage, housing numbers), the argument is built around policy tiers:

- **National Policy** — NPPF provisions, PPG guidance
- **Local Policy** — adopted local plan policies
- **Neighbourhood Policy** — neighbourhood plan policies (if applicable)
- **Supplementary** — SPDs, design guides, local guidance notes

---

## What Is Changing — Argument Structure Tab

### Current (appeal-inherited, wrong for planning)
Each key issue has:
- `argument_against` — refusal reason / opposing position
- `argument_for` — our response

### New (planning statement model)
Each key issue has 4 policy-tier note fields:
- `policy_national` — national policy position (NPPF etc.)
- `policy_local` — local plan policy position
- `policy_neighbourhood` — neighbourhood plan position
- `policy_supplementary` — SPDs / supplementary guidance

The rationale: a planning statement doesn't "argue against" anything. It assesses the proposal against each policy tier and explains compliance / acceptability. The notes become a structured policy assessment for each issue.

---

## Immediate UI Change (no DB yet)

Replace the 2-field note layout in `PlanningWorkspace.svelte` argument tab with 4 fields using new field keys. These will be sent to the existing notes API but using the new field names — the backend won't store them correctly until the DB migration is done. This is fine for UI prototyping.

**Fields to show per issue:**
1. National Policy — placeholder: "Key NPPF provisions / national guidance relevant to this issue..."
2. Local Policy — placeholder: "Local plan policies and their requirements..."
3. Neighbourhood Policy — placeholder: "Neighbourhood plan policies (if applicable)..."
4. Supplementary — placeholder: "SPDs, design guides, or other supplementary guidance..."

**Visual layout:** 2 fields per row (2×2 grid), or stacked — to be decided on seeing it.

---

## DB Changes Needed Later

1. **`planning_issue_notes` table** (new, separate from appeal `issue_notes`):
   - `project_id`, `issue_id`
   - `policy_national TEXT`
   - `policy_local TEXT`
   - `policy_neighbourhood TEXT`
   - `policy_supplementary TEXT`
   - (replaces `argument_for` / `argument_against`)

2. **Local policy linkage** — you have an existing local policy DB table. Later we can wire a lookup/selector so the Local Policy field can reference specific policies by code rather than free text.

3. **Analysis result field mapping** — the AI analysis currently extracts points tagged as `argument_for` or `argument_against`. For planning statements, extracted points should be tagged to a policy tier instead (or at least mapped: "for" → `policy_national` / `policy_local` as a start).

---

## Open Questions (clarify before proceeding)

1. **Layout of 4 fields** — stacked (one below the other) or 2×2 grid? Stacked is simpler and works better for longer notes.
2. **"Relevant to" issue selection on document upload** — still valid, keep as-is?
3. **"Document is in favour / against" toggle** — not really applicable for planning statements. Replace with something like "Document is" → "Supporting the proposal" / "Consultee objection" / "Technical report"?
4. **Planning statement sections vs key issues** — right now "key issues" are shared project-level issues. For a planning statement the sections (Introduction, The Proposal, etc.) are different from issues. Do the "Key Issues" in this tool represent the planning assessment issues only, or the full document sections? Recommend: key issues = planning assessment issues (design, heritage etc.), and the document sections (Intro, Proposal etc.) live in the Draft Document tab as draft sections.

---

## Scope of First Implementation

**Just the Argument Structure tab, UI only:**
- [ ] Replace 2-field layout with 4 policy-tier fields in `PlanningWorkspace.svelte`
- [ ] Update `planning-notes.js` store to use the 4 new field keys
- [ ] Update the analysis results panel field tags (currently "For"/"Against" labels) to show "Policy note" or similar
- [ ] Leave DB wiring for later

Everything else (sections, local policy linkage, document direction label) to follow once the layout is confirmed.
