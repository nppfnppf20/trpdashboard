# LLM App — Integration Spec

> **Purpose of this document:** You are building the LLM/AI app in a separate repo. When it is ready, everything you build will be moved directly into the **trpdashboard** monorepo — same domain, same server. This doc tells you exactly how to structure your code so that move is a clean copy-paste with no rework.

---

## What trpdashboard looks like

- **Frontend:** SvelteKit 5 (uses runes — `$props()`, `$state()`, `$derived()`)
- **Backend:** Express (Node.js, ESM `import/export`), PostgreSQL via `pg`, Supabase for auth
- **Auth:** Supabase JWT. Every protected API call sends `Authorization: Bearer <token>`. The backend has a middleware called `authenticate` that validates the token and attaches `req.user` (with `req.user.id`, `req.user.email`, `req.user.role`).
- **Folder structure:**
  ```
  trpdashboard/
    backend/
      src/
        controllers/     ← one file per feature
        services/        ← business logic, DB queries
        routes/          ← Express routers, registered in src/routes/index.js
        middleware/      ← auth.js, errorHandler.js, rateLimiter.js
    frontend/
      src/
        routes/          ← SvelteKit pages (e.g. /hlpv, /planning, /socioeconomics)
        lib/
          components/    ← Svelte components, grouped by feature
          stores/        ← Svelte stores (auth.js etc.)
          services/      ← frontend JS helpers (API calls, exports)
  ```

---

## What you are building

A new **AI/LLM section** that will become the `/ai` route in trpdashboard. It should include at minimum:

1. **Chat** — conversational interface backed by Claude (Anthropic API), with conversation history persisted per user
2. **Generate Document** — takes a template type + context and produces a draft document (markdown)

You can add more features (e.g. summarise analysis results, Q&A over project data) but chat and document generation are the core.

---

## How to structure your code for the move

### Backend — match this pattern exactly

**File layout to produce:**

```
your-repo/
  backend-ai/
    src/
      controllers/
        ai.controller.js
      services/
        ai.service.js
        conversations.service.js
      routes/
        ai.routes.js
```

**`ai.routes.js`** must export a default Express `Router` (no `app.listen`, no port binding):

```js
import express from 'express';
import * as aiController from '../controllers/ai.controller.js';

const router = express.Router();

router.post('/chat', aiController.chat);
router.get('/conversations', aiController.getConversations);
router.get('/conversations/:id/messages', aiController.getMessages);
router.delete('/conversations/:id', aiController.deleteConversation);
router.post('/generate-document', aiController.generateDocument);

export default router;
```

When moved in, this router gets registered in trpdashboard's `backend/src/routes/index.js` like:

```js
router.use('/api/ai', aiRoutes);  // auth middleware already applied to /api/*
```

**Auth:** Do NOT implement your own auth. All `/api/*` routes in trpdashboard have `authenticate` middleware applied globally. When your code runs there, `req.user` will already be populated with `{ id, email, role }`. Just use `req.user.id` to scope data to the logged-in user.

**Database:** Use the same PostgreSQL connection pattern trpdashboard uses — a `pg` Pool, configured via `DATABASE_URL` env var. Create your own tables (prefixed `ai_`) via a migration script at `backend-ai/scripts/migrate.js`.

Tables you'll need:

```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  project_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Error responses** must match the shape already used in trpdashboard:

```json
{ "error": "Short message", "message": "More detail" }
```

---

### Frontend — match this pattern exactly

**File layout to produce:**

```
your-repo/
  frontend-ai/
    src/
      routes/
        ai/
          +page.svelte          ← main AI hub / nav
          chat/
            +page.svelte
          generate/
            +page.svelte
      lib/
        components/
          ai/
            ChatInterface.svelte
            ConversationList.svelte
            MessageBubble.svelte
            DocumentGenerator.svelte
        services/
          ai.js                 ← all fetch calls to /api/ai/*
```

**SvelteKit version:** Use runes syntax (SvelteKit 5):
- `let foo = $state(...)` not `let foo = ...` with reactivity
- `$props()` not `export let`
- No `$:` reactive statements — use `$derived()` or `$effect()`

**Auth:** Import from `$lib/stores/auth.js` (already exists in trpdashboard):

```js
import { session } from '$lib/stores/auth.js';
import { get } from 'svelte/store';

const token = get(session)?.access_token;
```

Use this token as `Authorization: Bearer <token>` on every fetch to `/api/ai/*`.

**API base URL:** Use relative paths — `/api/ai/chat` not `http://localhost:3001/api/ai/chat`. When moved in, the frontend and backend share the same origin.

**Styling:** Don't bring in any new CSS frameworks. trpdashboard uses plain CSS with scoped `<style>` blocks per component. Match the existing design tokens where you can (dark cards, button styles etc.) but the specific AI styles can be scoped to your components.

---

## API contract

### `POST /api/ai/chat`

```json
// Request
{
  "conversationId": "uuid | null",
  "message": "string",
  "context": {
    "projectId": "uuid | null",
    "projectName": "string | null",
    "analysisResults": "object | null"
  }
}

// Response — streaming (text/event-stream, SSE)
data: {"delta": "chunk of text"}
data: {"delta": "more text"}
data: {"done": true, "conversationId": "uuid", "messageId": "uuid"}
```

### `GET /api/ai/conversations`

```json
[
  { "id": "uuid", "title": "string", "projectId": "uuid|null", "createdAt": "ISO8601", "updatedAt": "ISO8601" }
]
```

### `GET /api/ai/conversations/:id/messages`

```json
[
  { "id": "uuid", "role": "user|assistant", "content": "string", "createdAt": "ISO8601" }
]
```

### `DELETE /api/ai/conversations/:id`

```json
{ "success": true }
```

### `POST /api/ai/generate-document`

```json
// Request
{
  "templateType": "string",
  "context": {
    "projectId": "uuid | null",
    "projectName": "string | null",
    "analysisResults": "object | null",
    "additionalInstructions": "string | null"
  }
}

// Response
{
  "documentId": "uuid",
  "content": "markdown string"
}
```

---

## Environment variables

The existing trpdashboard already has `DATABASE_URL` and Supabase vars. You just need to add one new one:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

Use `claude-sonnet-4-6` as the default model (`claude-opus-4-6` for document generation if quality needs to be higher).

---

## Checklist before handing over for the move

- [ ] Backend is a plain Express Router — no `app.listen`, no port, no auth middleware of its own
- [ ] All DB queries use `req.user.id` (not session from Supabase client) to scope data
- [ ] Migration script creates `ai_conversations` and `ai_messages` tables
- [ ] Frontend uses relative API paths (`/api/ai/...`)
- [ ] Frontend uses `$lib/stores/auth.js` for the token (no Supabase client initialised again)
- [ ] SvelteKit 5 runes syntax throughout
- [ ] No new CSS frameworks introduced
- [ ] Error responses shape: `{ "error": "...", "message": "..." }`
- [ ] Streaming works via SSE on `/api/ai/chat`
- [ ] No `.env` files committed — document required vars above

---

## How the move will work (for reference)

When you hand over:

1. Copy `backend-ai/src/controllers/ai.controller.js` → `trpdashboard/backend/src/controllers/`
2. Copy `backend-ai/src/services/` files → `trpdashboard/backend/src/services/`
3. Copy `backend-ai/src/routes/ai.routes.js` → `trpdashboard/backend/src/routes/`
4. Register route in `trpdashboard/backend/src/routes/index.js`: `router.use('/api/ai', aiRoutes)`
5. Copy `frontend-ai/src/routes/ai/` → `trpdashboard/frontend/src/routes/ai/`
6. Copy `frontend-ai/src/lib/components/ai/` → `trpdashboard/frontend/src/lib/components/ai/`
7. Copy `frontend-ai/src/lib/services/ai.js` → `trpdashboard/frontend/src/lib/services/`
8. Run migration script against the shared DB
9. Add `ANTHROPIC_API_KEY` to the backend `.env`
10. Add the AI tool card to `HomePage.svelte`
