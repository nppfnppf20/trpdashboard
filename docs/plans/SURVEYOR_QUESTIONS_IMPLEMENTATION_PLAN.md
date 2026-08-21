# Surveyor Questions Log + AI Answer Assistant - Implementation Plan

## The Problem

When quote requests go out, surveyors come back with follow-up questions ("what's the panel height?", "is there site access from the north?", etc.). Today there is no record of who asked what, answers are dug out of project info manually, and outstanding items that need client input get lost.

## The Concept

A new **"Questions" tab** on the Surveyor Management page (`/surveyor-management`) combining two things:

1. **Questions Log** — a persistent, structured record: who asked, what, when, what we answered, and status. This is the durable value (audit trail, chasing clients, spotting repeat questions).
2. **AI Answer Assistant** — a chat panel attached to each question that drafts answers from project data (general project info, quotes, briefing notes).

Key rule: the AI answers **only from project data it is given** (same principle as the `[SOURCE REQUIRED]` rule in `sectionChat`). Anything it can't answer is explicitly flagged as **"Information needed from client"** — and those flags are exactly what feeds the client email in Phase 3.

---

## Phase 1: Questions Log (no AI — useful on day one)

### Database

Migration `backend/sql/migrations/111_surveyor_questions.sql`:

```sql
CREATE TABLE admin_console.surveyor_questions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id),
  quote_id          UUID REFERENCES admin_console.quotes(id),  -- gives surveyor org / contact / discipline
  asked_by_text     TEXT,          -- free-text fallback when asker isn't a quoted surveyor
  question_text     TEXT NOT NULL,
  answer_text       TEXT,
  status            TEXT NOT NULL DEFAULT 'open',
                    -- 'open' | 'needs_client_input' | 'answered' | 'sent'
  asked_date        DATE DEFAULT CURRENT_DATE,
  answered_date     DATE,
  chat_history      JSONB,         -- populated in Phase 2
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

### Backend

- `backend/src/services/surveyorQuestions.service.js` — CRUD; list query joins quotes → surveyor_organisations → contacts for attribution (same pattern as `quotes.service.js`)
- `backend/src/controllers/surveyorQuestions.controller.js`
- `backend/src/routes/surveyorQuestions.routes.js` + register in `routes/index.js`

**Endpoints:**
- `GET    /api/projects/:projectId/surveyor-questions`
- `POST   /api/projects/:projectId/surveyor-questions`
- `PATCH  /api/surveyor-questions/:id` (answer, status, edits)
- `DELETE /api/surveyor-questions/:id`

### Frontend

- `frontend/src/lib/api/surveyorQuestions.js`
- New tab on `frontend/src/routes/surveyor-management/+page.svelte`:
  `{ id: 'questions', label: 'Questions', icon: 'la-question-circle' }`
- `frontend/src/lib/components/surveyor-management/QuestionsPanel.svelte`:
  - Log table: date, surveyor/contact (from linked quote), discipline, question, answer, status badge — reuse `tables.css` / `badges.css`
  - "Add question" form: dropdown of this project's quotes (or free-text asker) + paste the question
  - Status transitions: open → needs client input → answered → sent

---

## Phase 2: AI Answer Assistant

### Backend

`POST /api/projects/:projectId/surveyor-questions/chat` — modelled directly on `backend/src/controllers/sectionChat.controller.js`:

- Server assembles a project context block:
  - `public.projects` row (name, address, development type…)
  - `admin_console.project_information` (detailed description, capacities, panel heights, access arrangements…)
  - The project's quotes summary (disciplines, statuses)
  - Briefing note for the project, if present
- System prompt: *"You are helping answer a question from a [discipline] surveyor about project X. Answer ONLY from the context below. For anything not in the context, list it under 'Information needed from client'."*
- Returns conversational `reply` + structured `suggested_answer` + `missing_info[]` (same tagged-extraction trick as `<section-draft>`)
- Uses `MODEL_SONNET` from `llm.shared.js`

### Frontend

- Split view inside the Questions tab: log on the left, chat panel for the selected question on the right
- **"Save as answer"** writes the draft to `answer_text`, persists the conversation to `chat_history`, and auto-suggests `needs_client_input` status if the AI flagged gaps

---

## Phase 3: Workflow Extras

1. **Paste a whole email** → LLM splits it into individual questions and logs each one (one endpoint, similar shape to `analyseBriefingForDisciplines` in `surveyorBriefing.service.js`)
2. **"Draft client email"** button → collects all `needs_client_input` questions for the project and generates a consolidated email ("the following queries have been raised by our surveyors…"). v1 is copy-to-clipboard; later can hook into `emailService.js` / `email_log`

---

## Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the chat lives | Inside the Questions tab (split view), not a floating widget | Keeps question and conversation tied together |
| Chat scope | One chat per question, not one endless project chat | Keeps the log clean, each conversation focused |
| AI context (v1) | Structured data only (project info + quotes + briefing) | Uploaded documents via `parser.service.js` is possible later, but adds cost/complexity |
| Attribution | Link to a quote where possible; free-text fallback | Quote link gives surveyor org, contact, and discipline for free |
| Honesty rule | Answer only from given context; gaps flagged explicitly | A confidently wrong answer sent to a surveyor is worse than "we need to ask the client" — and the gaps drive the client email |

## Build Order

1. Phase 1 — migration, backend CRUD, Questions tab with manual entry
2. Phase 2 — chat endpoint + split-view chat panel
3. Phase 3 — email question extraction + client email draft
