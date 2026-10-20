# Policy Library + Policy Chat (RAG) — Implementation Plan

Status: planned, not built. Global (non-project) page for company policy documents, searchable and chat-able via retrieval.

## Goal
Upload internal policy documents (PDF/Word) through the app frontend, index them, and let users search and ask questions with cited answers. Corpus is too large for the context window, so retrieval is required (unlike Project Chat, which loads ticked sources whole — see PROJECT_CHAT_IMPLEMENTATION_PLAN.md).

## Architecture summary
- Postgres (Supabase) + pgvector. No separate vector DB or RAG framework.
- Structure-aware chunking (headings/clauses), context header prepended to each chunk, near-zero overlap.
- Hybrid retrieval: vector similarity + Postgres full-text, merged with reciprocal rank fusion, optional rerank.
- Claude answers from retrieved chunks only, with citations back to document + section + page.
- Original files stay in storage; chunks are a rebuildable derived index.

## Phase 0 — Groundwork (DONE: findings below)
Inspected the production DB read-only (2026-10-19):
- `vector` 0.8.0 installed (HNSW available); `pg_trgm` installed.
- `rag.chunks` exists: 199 rows, cols `id, content, embedding vector(1536), metadata jsonb, created_at, project_id, knowledge_category`; ivfflat embedding index, FTS on content, btree indexes on metadata keys. `rag` schema has 27 tables (appeals/meetings; `rag.meeting_chunks` 871 rows). RLS/grants are mixed (some tables SELECT-granted to anon/authenticated).
- `public.generate_chunk_search` and `rag.generate_chunk_search` both read `rag.chunks` (hardwired to `metadata->>'knowledge_category'` etc.).
- Nothing in `backend/src` or `frontend` references `rag.chunks` — only migrations 155–157 and the security report.
- **Decision: do NOT reuse `rag.chunks`.** Wrong shape (no document link/section path/page/version/tsvector columns), hardwired search function, project-shaped fields, mixed grants. Create new tables instead; leave `rag.*` untouched. (The 199 rows were not sampled; could be dropped later separately if confirmed disposable.)
- **Decision: embeddings = OpenAI `text-embedding-3-small` (1536 dims, matches existing vector width).** Store `embedding_model` per chunk so a later switch (Voyage / 3-large) is a re-embed from the stored originals. Add `OPENAI_API_KEY` to backend `.env`; backend-only. Check OpenAI API data-retention terms if policies are sensitive.
- **Decision: new tables in their own schema `company_documents` (`documents`, `chunks`; not exposed via the Supabase API) with RLS enabled and NO anon/authenticated grants — backend (service connection) is the only reader/writer.** Mirrors migration 155 hardening. Any search SQL function must `SET search_path` (cf. migrations 151/155) and not be executable by anon/authenticated.
- Still to decide: permissions (who uploads/deletes; restricted policies) — see Decisions.

## Phase 1 — Document library + upload (frontend + backend) — BUILT, not yet applied/tested end to end
Built: `backend/sql/migrations/194_company_policy_library.sql` (schema `company_documents` with tables `documents` + `chunks`, RLS on, grants revoked, private `company-policies` storage bucket), `controllers/companyPolicies.controller.js`, `routes/companyPolicies.routes.js` (mounted at `/api/company-policies`, admin-only via the blanket `/api` guard), `frontend/src/lib/api/companyPolicies.js`, page `frontend/src/routes/company-policies/+page.svelte`, sidebar entry "Company Policies". Named "company policies" because `/api/lpa/policy-documents` already exists. Status `uploaded` = stored, awaiting Phase 2 indexing. Versioning = new row with `supersedes_id`, old row `is_current=false` (chunks need no superseded flag; search joins on `is_current`). Archive action dropped — delete + version history cover it. Originals in Supabase Storage (the app had no prior file storage), signed 60s download URLs.
Needs: user applies migration 194; backend restart; check the `company-policies` bucket exists after the migration.
- New sidebar entry under global pages: **Policies**.
- Upload: drag/drop PDF/DOCX. Fields: title, category, version, effective date, visibility.
- List: title, category, version, status (processing / ready / failed + reason), chunk count, uploaded date. Actions: view original, upload new version, archive, delete.
- Backend: upload endpoint saves original to storage, inserts `company_documents.documents` (status `processing`), returns immediately, kicks off ingestion.
- Tables: `company_documents.documents` (id, title, category, version, effective_date, status, error, storage_path, mime, visibility, supersedes_id, uploaded_by, timestamps).

## Phase 2 — Ingestion pipeline (backend, async) — BUILT, verified on 2 real PDFs (annual leave, sickness absence): 9 + 13 chunks, all embedded, correct top hit on 4/4 test questions
Built: `services/policyChunker.service.js` (pdf-parse per page; drops repeated header/footer lines and contents pages; joins wrapped lines; numbered-heading detection incl. wrapped headings; section-path chunks capped ~700 tokens, split only at paragraph breaks; cover page kept as "Document information"; DOCX via mammoth HTML — UNTESTED, no sample docx yet), `services/policyIndexer.service.js` (in-process queue, one doc at a time; download -> chunk -> embed -> replace chunks in a transaction; failed status with reason; interrupted jobs flagged on restart via `recoverInterruptedIndexing`), uses shared `openaiClient` from llm.shared.js (credit banner integration). Upload now sets status `processing` and queues indexing; `POST /:id/reindex`; editing title/version re-indexes (they are part of the embedded text). Frontend: Re-index button, quiet 3s polling while anything is processing, "N sections indexed".
Known gaps: scanned PDFs fail with an OCR message (no OCR); chunker heuristics tuned on two TRP documents only — add samples as new layouts appear; unnumbered-heading Word docs rely on Word heading styles or ALL CAPS lines.

1. Extract text with structure: mammoth (DOCX headings), pdf-parse (PDF; heading detection via numbering patterns like `4.2` / ALL CAPS lines). Detect scanned PDFs (no text layer) → status `failed: needs OCR`.
2. Build section tree; one chunk = one section/clause incl. short children. Cap ~500–800 tokens, split oversize sections at paragraph breaks (repeat heading; ~10–15% overlap only in this fallback). Merge tiny sections (<~100 tokens) into parent/sibling. Tables kept whole.
3. Prepend `Document (vN) > Section path` to text before embedding.
4. Embed in batches; insert into `company_documents.chunks`.
5. Mark prior version's chunks `superseded`; set document status `ready`.
- `company_documents.chunks`: id, document_id FK, chunk_index, section_path, section_ref, page_start, page_end, text, token_count, embedding vector(N), embedding_model, tsv tsvector (generated), superseded bool, category, visibility.
- Indexes: HNSW on embedding (cosine), GIN on tsv, btree on document_id/superseded.
- Re-chunk/re-embed endpoint (admin) rebuilding from stored original — needed when chunking or embedding model changes.
- Status feedback: frontend polls list until no `processing` rows.

## Phase 3 + 4 — Search and chat — BUILT together, verified on the 2 sample policies
Built: `services/policySearch.service.js` (vector top 20 + OR-ed full-text top 20, reciprocal rank fusion, current + ready docs only, visibility filter), `services/policyChat.service.js` (Haiku rewrites follow-ups into standalone queries; Sonnet answers only from numbered extracts with [n] citations; cited extracts returned as sources; process key `company_policy_chat` registered as configurable in the AI Providers console), `POST /api/company-policies/ask`, file-url `?inline=1` for viewing, `PolicyAsk.svelte` on the Policies page (thread, citation chips, source links that open the original in a new tab at `#page=N` for PDFs, 'Show passage' excerpt). Tested: exact figures, follow-up rewrite, multi-step answers, correct refusal for an uncovered topic. Not built: separate raw search box/debug view, reranker, streaming, persisted chat history, thumbs up/down, neighbour-chunk expansion. A source link opens the page a section starts on (a section can run onto the next page).

**Update — streaming, no inline citations:** `/ask` with `stream: true` sends server-sent events (`delta` text pieces, then `done` with the cleaned answer + sources, or `error`); the model no longer cites in the text, it ends with a `Sources: 1, 3` line that `TrailerFilter`/`parseTrailer` (policyChat.service.js) hide from the displayed text and turn into source links (falls back to the top 3 sections if the model omits the line). Only the Claude provider streams; OpenAI falls back to a single answer. Client disconnect aborts the model call. UI shows the answer growing with a caret, then a Sources list of links at the end. Tested: filter at chunk sizes 1-50 incl. split markers, live SSE round trip, mid-answer cancel. Known quirks: a body line that itself starts with the word 'Sources' is hidden while streaming until the final answer replaces it; production proxies that buffer would delay the stream (X-Accel-Buffering: no is set).

**Update — document viewer:** clicking a title (or the eye button) in the Policies table, or a source link in an answer, opens `PolicyViewerModal.svelte`: a Reader tab (formatted from the indexed sections via `GET /:id/content`: document-page styling, headings by level with skipped parent headings restored, bullet lists, cover details box; an answer's source scrolls to and highlights its section) and an Original tab (PDF embedded via inline signed URL at the cited page; Word files offer a download). Reader does not show tables/images. `/content` and `/file-url` do not themselves check `visibility`; the blanket admin-only `/api` guard is what protects them today — add the check if non-admin roles are ever let in.

**Update — split-view layout (chosen from four options):** library panel (24rem: filter box, document rows with status badge + icon actions, 'Show previous versions' footer) on the left, full-height chat panel on the right (scrolling thread, input pinned at the bottom with auto-grow and Enter-to-send, empty state, smart auto-scroll while streaming). Sources under an answer are collapsed behind a '2 sources' toggle (`<details>`), each source expanding to a link that opens the viewer at the cited section plus a 'Show passage' toggle. Panel height is `calc(100vh - 10rem)` with a 34rem minimum — adjust if the page shell changes; stacks below 1000px.

**Update — folders (migration 195, not yet applied by the user):** `company_documents.folders` (id, name, parent_id, sort_order; sibling names unique case-insensitively; FKs ON DELETE RESTRICT) and `documents.folder_id`; existing categories become top-level folders (both current docs -> 'General'). Rules (policyFolders.service.js, unit-tested): max 4 levels, no moving a folder into itself/its descendants, deleting a non-empty folder is refused (409). Endpoints `GET/POST /folders`, `PUT/DELETE /folders/:id`; documents take `folder_id` on upload/update (a new version inherits its predecessor's folder); `/ask` takes `folder_id` to search that folder and everything inside it. UI: folder tree above the document list in the left panel (All documents / folders / Unfiled with counts; hover icons for new sub-folder, ask about this folder, rename/move, delete; drag a document onto a folder to file it), upload/edit dialogs have a Folder picker instead of Category (category column kept in the DB, no longer shown), chat header has a 'Searching: All documents / folder' picker. Dry-run of the migration and all endpoints was done inside a rolled-back transaction (29 checks). Folders are organisation only: access is still per-document `visibility`.

**Update — Explorer-style library tree (replaces the folder-tree-above-list UI):** one tree in the left panel (`PolicyLibraryTree.svelte`) with documents nested inside their folders, like File Explorer/OneDrive: arrow to expand/collapse, folder icons with counts, PDF/Word file icons with a status dot, indent guide lines, Expand all / Collapse all / New folder toolbar, filter box that keeps matching documents and their parent folders. Folder hover actions: new sub-folder, ask about this folder, rename/move, delete (inline confirm). Document hover actions: view, download, and a menu (upload new version, re-index, edit details, delete). Clicking a document opens the viewer; dragging a document onto a folder files it, and a 'drop here to take it out of its folder' zone appears while dragging. Unfiled documents sit at the bottom of the tree. Collapsed folders are remembered in localStorage; arrow-key navigation works. The chat scope picker and `Ask about this folder` still drive the folder-scoped search.

(Original phase text below.)

## Phase 3 — Search + retrieval (with debug view)
- `POST /api/policies/search`: embed query → vector top ~20 (filtered: not superseded, visibility, optional category/document) + full-text top ~20 → RRF merge → optional rerank → top 6–8. Optional "expand" to include neighbour chunks (chunk_index ±1).
- Frontend search box on Policies page showing ranked chunks, section path, score, source link. This is the tuning surface.
- Build a ~20-question test set with known answers/clauses; tune chunking, k, rerank against it **before** Phase 4.

## Phase 4 — Policy chat
- `POST /api/policies/chat` (streaming): rewrite follow-up into standalone query (small model) → retrieve → Claude answers only from chunks, cites `[doc, section]`, says "not covered" when unsupported.
- Frontend: reuse Project Chat component patterns; replace source ticking with optional category/document filter; citation chips open original at page/section; "sources used" panel instead of context meter.
- Persist conversations (optional), thumbs up/down.

## Phase 5 — Hardening
- Chat/search logging incl. "no good answer" queries (surfaces policy gaps).
- Auth on every endpoint, retrieval-time visibility filtering, RLS on new tables (match recent security hardening migrations 151/155 conventions — set search_path on functions).
- Rate limits + cost caps on embedding/chat.
- Cleanup of chunks/storage on delete.
- Prompt-injection stance: treat chunk text as data; uploaded policies are trusted-ish but instruct model not to follow instructions inside them.

## Decisions needed
1. **Embedding model** — DECIDED: OpenAI `text-embedding-3-small` (1536 dims). Anthropic has no embeddings API. Revisit (Voyage / 3-large) only if Phase 3 test set shows poor retrieval after chunking/hybrid tuning; `embedding_model` stored per chunk makes this a cheap re-embed.
2. **Chat model** — `claude-sonnet-5-5` ($2 in / $10 out per MTok) recommended for answering; `claude-haiku-5-5` ($0.10 / $0.50) for query rewriting (and possibly answering if quality holds on the test set); `claude-opus-5-5` ($4 / $20) not needed for lookup-style Q&A. Set effort explicitly (low/medium for Q&A).
3. **Reranker** — skip initially; add (Voyage/Cohere) if Phase 3 test set shows noisy ranking.
4. **Access control** — who uploads/deletes (admin only?); are any policies restricted (HR/finance)? Add `visibility` now; costly to retrofit.
5. **Versioning** — keep history with `superseded` flag (recommended) vs replace.
6. **File types** — DOCX/PDF only? Scanned PDFs → OCR step (out of scope v1; flag as failed).
7. **Reuse vs new tables** — DECIDED: new `company_documents.documents` / `company_documents.chunks`, RLS on, backend-only access (see Phase 0).
8. **Storage** — Supabase storage bucket (check what Project docs already use and mirror it).

## Cost estimate (order of magnitude; verify provider pricing before committing)
Assumptions: ~300 documents × ~20 pages ≈ 6,000 pages ≈ 3–4M tokens; ~1,000 questions/month; each answer ≈ 8k input tokens (6–8 chunks + system prompt + history) and ~500 output tokens.

| Item | Basis | Approx cost |
|---|---|---|
| Embedding the corpus (one-off) | ~4M tokens × roughly $0.02–0.18 per MTok depending on model | well under $1 |
| Re-embedding after model/chunking change | same | well under $1 each time |
| Embedding queries | ~50 tokens each | negligible |
| Chat answer, Sonnet 5.5 | 8k in × $2/M + 0.5k out × $10/M ≈ $0.021 | **~$21 / 1,000 questions** |
| Chat answer, Haiku 5.5 | 8k × $0.10/M + 0.5k × $0.50/M ≈ $0.001 | ~$1 / 1,000 questions |
| Query rewrite (Haiku 5.5) | ~1k in, 50 out | ~$0.0001 each — negligible |
| Reranker (if added) | ~15k tokens/query × ~$0.05/MTok | < $1 / 1,000 questions |
| Prompt caching | system prompt cacheable (cache read $0.20/MTok on Sonnet 5.5); retrieved chunks vary so little caching benefit | minor |
| Storage / pgvector | 10–20k chunks × ~6 KB per vector+text | a few tens of MB; within existing Supabase plan |

Takeaway: running cost is dominated by chat generation, roughly 2p per question on Sonnet; everything else is pennies. Even at 10x usage it stays in tens of pounds/month.

## Risks
- Chunking quality on messy PDFs (headings not detectable) — mitigate with paragraph fallback + the Phase 3 debug view.
- Scanned/image PDFs silently producing nothing — explicit failed status.
- Stale answers from superseded versions — filter + show effective date in citations.
- Model hallucinating beyond sources — strict "answer only from sources / say not covered" prompt, citations required, test with out-of-scope questions.
- Embedding model change forces full re-embed — store model name per chunk, keep originals.
