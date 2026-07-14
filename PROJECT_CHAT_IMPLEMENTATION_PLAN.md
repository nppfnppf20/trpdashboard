# Project Chat (Ask the Project) - Implementation Plan

## The Concept

A chatbot interface inside the Project View Modal where you ask questions about a project ("what did the pre-app response say about landscaping?", "who raised the drainage objection?", "what's outstanding on condition 4?") and the AI answers **only from project data you have pointed it at**, citing exactly where each fact came from.

Two halves:

1. **Source picker** — a checkbox tree of everything the project knows: project details, project docs (by type or individually), meeting notes, key issues, consultation responses, conditions, actions, planning history, etc. "Select all", per-group select, or tick individual documents/tables.
2. **Chat panel** — multi-turn conversation. Every claim in an answer carries a citation chip (`[D3 · Pre-app Response · Section 4.2]`) that expands to show the verbatim quote. If the answer isn't in the selected sources, the AI says so explicitly (and can suggest which unticked source might have it) — never invents.

This is RAG in spirit, but **without a vector database**: per-project content volume is modest, the codebase has no embedding infra, and the existing `chunkText` / `checkDocumentSize` machinery (`llm.shared.js`) plus an optional Haiku relevance pre-pass covers retrieval well enough. pgvector is a later phase if scale demands it.

---

## Where Project Information Lives (audit)

From `ProjectViewModal.svelte` and the migrations, the searchable corpus per project:

| Source | Table(s) | Content | Full text? |
|---|---|---|---|
| Project details | `public.projects` | ~40 structured fields: name, client, LPA, description, key dates, case officer, designations, comments | n/a (structured) |
| Project docs | `planning_applications.document_summaries` | Per-doc `summary_html` **and** `transcript_text` (full text, added in migration 107). Typed: briefing_transcript, pre_app, eia_response, sci, about_applicant, proposed_development, site_surroundings, meeting_notes, other | ✅ |
| Meeting notes | `planning_applications.meeting_transcripts` / `meeting_summaries` / `meeting_actions` | Full transcript text, AI summary HTML, actions with owner/status | ✅ |
| Key issues | `admin_console.project_key_issues`, `project_issue_tracks`, `project_issue_stage_entries` | Issue labels, risk levels, per-stage notes | — |
| Consultation tracker | `planning_applications.consultation_responses` (+ `consultation_tracker_meta`) | Consultee, position, summary of response | — |
| Conditions tracker | `planning_applications.conditions` / `condition_requirements` / `condition_advancements` | Condition full_text, requirements, dated advancement log | ✅ |
| Action tracker | `planning_applications.tracker_actions` / `action_updates` | Action full_text + dated updates | ✅ |
| Planning history | `planning_applications.planning_history`, `project_planning_history` | Past applications on/near the site | — |
| Public comments | `planning_applications.public_comments` (+ `public_comment_analysis`) | Individual comments + AI theme analysis | ✅ |
| Surveyor management | `admin_console.quotes`, `quote_actions`, `sent_quote_requests` | Quotes, instruction status, dated progress log (now with `stage`) | — |
| Relevant policies | `planning_applications.policy_track_relevance` + lpaAnalysis tables | Linked policies with wording per issue | ✅ |
| Appeals (if appeal project) | `appeals.*`, `public.appeal_*` | Arguments, issue notes, document log | ✅ |

Existing plumbing to reuse:
- **`llm.shared.js`** — Anthropic client, `MODEL_FAST` (Haiku) / `MODEL_SONNET`, `callClaude`, `parseJSON`, `chunkText`, `buildFullDocumentBlock`, citation prompt patterns (para_ref + verbatim quote ≤150 chars) already proven in `extractPointsFromDocument`.
- **`sectionChat.controller.js`** — the multi-turn chat precedent: frontend holds `messages[]`, backend assembles system prompt + context, tagged-block extraction (`<section-draft>`) for structured output alongside conversational reply. Project Chat copies this shape with `<citations>` instead.
- **`ProjectViewModal.svelte`** — tab navigation is a flat button list + a Beta dropdown (`betaTabs` array). New feature lands as a Beta dropdown item first, promoted to a top-level tab once stable.

---

## Phase 1: Backend — source catalogue + grounded chat endpoint

### Files
- `backend/src/services/projectChat.service.js`
- `backend/src/controllers/projectChat.controller.js`
- `backend/src/routes/projectChat.routes.js` + register in `routes/index.js` as `/api/project-chat`

No migration needed for v1 (chat is ephemeral; persistence is Phase 4).

### `GET /api/project-chat/:projectId/sources`

Returns the checkbox tree the UI renders — one cheap COUNT/metadata query per source group:

```json
{
  "groups": [
    { "key": "project_details", "label": "Project Details", "count": 1 },
    { "key": "documents", "label": "Project Docs", "items": [
        { "id": 12, "label": "Pre-app Response — LPA letter Mar 2026", "doc_type": "pre_app", "has_full_text": true, "approx_chars": 48000 }
    ]},
    { "key": "meetings", "label": "Meeting Notes", "items": [ { "id": 4, "label": "Client kick-off — 02 Jan 2026" } ] },
    { "key": "key_issues", "label": "Key Issues & Stage Notes", "count": 6 },
    { "key": "consultation", "label": "Consultation Tracker", "count": 14 },
    { "key": "conditions", "label": "Conditions Tracker", "count": 9 },
    { "key": "actions", "label": "Action Tracker", "count": 11 },
    { "key": "planning_history", "label": "Planning History", "count": 3 },
    { "key": "public_comments", "label": "Public Comments", "count": 42 },
    { "key": "surveyor", "label": "Surveyor Management", "count": 8 }
  ]
}
```

Documents and meetings are individually tickable (`items`); table-shaped groups are all-or-nothing per group in v1 (a whole tracker is small once serialised).

### `POST /api/project-chat/:projectId/chat`

Request:
```json
{
  "messages": [{ "role": "user", "content": "What did the pre-app say about landscaping?" }],
  "sources": {
    "project_details": true,
    "document_ids": [12, 15],
    "meeting_ids": [4],
    "groups": ["consultation", "conditions"]
  }
}
```

**Context assembly** (`projectChat.service.js`):
1. Fetch each selected source; serialise to plain text. Structured tables become labelled line-item blocks (e.g. each consultation response: consultee, date, position, summary).
2. Assign every block a stable source ID: `[P]` project details, `[D12]` document, `[M4]` meeting, `[C]` consultation, `[K]` key issues, `[COND]` conditions, `[A]` actions, `[H]` history, `[PC]` public comments, `[S]` surveyor.
3. **Budget**: ~100k chars total. Small sources go in whole. For documents with large `transcript_text`, use `chunkText`; if the assembled context exceeds budget, run a **Haiku pre-pass** (`MODEL_FAST`): question + one-line preview of each chunk → returns the relevant chunk indices per document (LLM-as-retriever — the RAG step, no embeddings). Include selected chunks with their chunk index in the label (`[D12 · chunk 3]`) so citations stay traceable.

**System prompt** (grounding rules, mirroring the `[SOURCE REQUIRED]` discipline in sectionChat and the citation rules in `extractPointsFromDocument`):
- You may ONLY use facts from the numbered source blocks below. Never use outside knowledge for project-specific claims.
- Every factual claim must cite its source inline as `[D12]` (with section/para ref where the source shows one).
- If the answer is not in the sources: say so plainly, and if an unselected source group is listed in the catalogue summary as likely relevant, suggest ticking it.
- End every response with a `<citations>` JSON block: `[{ "source_id": "D12", "ref": "Section 4.2", "quote": "verbatim ≤150 chars", "claim": "short restatement" }]`.

Backend strips the `<citations>` block from the reply (same regex trick as `<section-draft>`), parses it with `parseJSON`, and returns:
```json
{ "reply": "…answer with inline [D12] markers…", "citations": [...], "sources_used": ["D12", "C"], "context_truncated": false }
```

Model: `MODEL_SONNET`, `max_tokens: 4096`, retry via `callClaude` patterns.

---

## Phase 2: Frontend — chat tab with source picker

### Files
- `frontend/src/lib/api/projectChat.js` — `getChatSources(projectId)`, `sendChatMessage(projectId, messages, sources)`
- `frontend/src/lib/components/projects/ProjectChatTab.svelte`
- `ProjectViewModal.svelte` — add `'project_chat'` to `betaTabs` + dropdown item **"Project Chat"** (promote to top-level tab later)

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ SOURCES (left, 260px)     │  CHAT (right, flex)            │
│ ☑ Select all              │  ┌──────────────────────────┐  │
│ ▸ ☑ Project Details       │  │ user: what did the       │  │
│ ▾ ☑ Project Docs (4)      │  │ pre-app say about        │  │
│   ☑ Briefing Transcript   │  │ landscaping?             │  │
│   ☑ Pre-app Response      │  │                          │  │
│   ☐ EIA Response          │  │ ai: The LPA advised a    │  │
│ ▸ ☑ Meeting Notes (2)     │  │ 15m buffer… [D12 §4.2]   │  │
│ ▸ ☐ Consultation (14)     │  │ ┌ [D12 · Pre-app · §4.2]┐│  │
│ ▸ ☑ Conditions (9)        │  │ │ "a landscape buffer of ││  │
│ ▸ ☐ Public Comments (42)  │  │ │  no less than 15m…"    ││  │
│   …                       │  │ └────────────────────────┘│  │
│                           │  [ Ask a question…      ][→] │  │
└────────────────────────────────────────────────────────────┘
```

- Source tree: group checkboxes with indeterminate state; doc/meeting items individually tickable; counts shown per group. Selection persists for the modal session.
- Messages: client-side `messages[]` history (sectionChat pattern), sent whole each turn with the current source selection — so you can retick sources mid-conversation.
- Citations: inline `[D12]` markers rendered as clickable chips (regex over the reply); the `citations` array drives an expandable panel under each AI message showing ref + verbatim quote. "Not found in selected sources" answers styled distinctly (amber).
- Loading/error states copied from existing tabs (spinner, retry).

---

## Phase 3: Retrieval hardening + remaining sources

- Wire in the lower-priority groups: planning history, public comments (send the AI theme analysis rather than all raw comments when count is high), surveyor management, policies, appeals tables (only offered when the project has appeal data).
- Haiku chunk-selection pre-pass (if not needed in Phase 1, it becomes necessary here as ticked corpora grow).
- `context_truncated` warning surfaced in the UI ("Some selected content didn't fit — narrow your selection for better coverage").
- Per-doc-type default selections (e.g. always pre-tick briefing transcript + project details).

## Phase 4 (later, optional)
- **Persist conversations** — `planning_applications.project_chat_sessions` / `project_chat_messages` (JSONB source selection per message) so Q&A history becomes a project record.
- **Cross-project mode** — "all projects" scope from the source picker. Different beast: needs a first-stage project-selection pass (or pgvector) before per-project assembly; keep out of v1.
- **pgvector embeddings** — only if per-project corpora outgrow the Haiku pre-pass.

---

## Build Order

1. Backend service + `GET /sources` + `POST /chat` with project details + documents + meetings only — testable via curl.
2. `ProjectChatTab.svelte` + API wrapper + Beta dropdown entry; citation chips.
3. Add remaining source groups + truncation handling.
4. Promote to top-level tab when happy; then Phase 4 items as needed.
