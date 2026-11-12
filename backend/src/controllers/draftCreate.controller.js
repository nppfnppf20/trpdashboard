/**
 * Draft Create Controller
 * Powers the "Create" panel — turns a free-form custom prompt into a
 * complete HTML document, optionally wrapped in the practice's house style
 * (capitalisation, formatting, and anti-AI-slop rules shared with every
 * other generation prompt in the app).
 */

import { pool } from '../db.js';
import { callLLM, resolveProvider, noEmDash, HOUSE_STYLE_BLOCK, ANTI_AI_SLOP_BLOCK, client, MODEL_SONNET } from '../services/llm.shared.js';
import { assembleContext, CONTEXT_BUDGET, getChatUserContext } from '../services/projectChat.service.js';
import {
  buildCreateSystemPrompt, parseCreateResponse, writeDocumentTool, editDocumentTool,
  CREATE_CHAT_MAX_TOKENS, EXAMPLE_MAX_CHARS, cleanImports,
} from '../services/createChat.service.js';

const BASE_SYSTEM_PROMPT = `You are a specialist UK planning consultant producing a professional document exactly as instructed by the brief below.

Output format — clean HTML only:
- <h2> for main section headings
- <h3> for sub-section headings
- <p> for body paragraphs
- <ul>/<li> for bullet points
- <table>/<thead>/<tbody>/<tr>/<th>/<td> for tables
- No markdown characters (**, *, #, ---) and no em dashes (—)
- Do not include a document title unless the brief below asks for one`;

export async function generateCustomDraft(req, res) {
  const { prompt, provider, use_house_style } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const resolvedProvider = await resolveProvider('draft_create', provider);
    const styleBlock = use_house_style === false ? '' : `${HOUSE_STYLE_BLOCK}${ANTI_AI_SLOP_BLOCK}`;

    const raw = await callLLM({
      provider: resolvedProvider,
      maxTokens: 8000,
      system: `${BASE_SYSTEM_PROMPT}${styleBlock}`,
      prompt: prompt.trim(),
    });

    const html = noEmDash(raw.trim().replace(/^```(?:html)?\n?/i, '').replace(/\n?```$/i, '').trim());
    res.json({ html });
  } catch (err) {
    console.error('draftCreate.generate error:', err);
    res.status(500).json({ error: 'Failed to generate document' });
  }
}

/**
 * POST /api/draft-create/projects/:projectId/chat
 * One turn of the Create card conversation. The client holds the message
 * history and the document, and sends them whole each turn (so ticking more
 * sources or editing by hand between turns just works).
 *
 * body: {
 *   messages: [{ role: 'user'|'assistant', content: string }],  // last one is the user's new message
 *   sources: { project_details?, document_ids?, meeting_ids?, groups? },  // same shape as Project Chat; optional
 *   doc_type_id?: number,
 *   document_html?: string,          // the document as it is now ('' if empty)
 *   selection?: { quoted_text: string },  // passage the user has highlighted
 *   imports?: [{ title, prompt }],   // prompts that produced text imported into the document
 *   use_house_style?: boolean        // default true
 * }
 * returns: { reply, mode: 'full'|'edits'|'none', html, edits, context_chars }
 *   mode 'edits' -> apply `edits` with applyEdits (frontend/src/lib/utils/documentEdits.js)
 *   mode 'full'  -> `html` is the complete document
 */
export async function createChat(req, res) {
  const { projectId } = req.params;
  const { messages, sources, doc_type_id, document_html, selection, use_house_style } = req.body ?? {};
  const imports = cleanImports(req.body?.imports);

  const history = (Array.isArray(messages) ? messages : [])
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content }));
  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'messages must end with a user message' });
  }
  while (history[0].role !== 'user') history.shift();

  try {
    const { rows: projectRows } = await pool.query(
      `SELECT project_name, client FROM public.projects WHERE id = $1`,
      [projectId]
    );
    if (!projectRows.length) return res.status(404).json({ error: 'Project not found' });

    let docType = null;
    if (doc_type_id) {
      const { rows } = await pool.query(
        `SELECT id, name, slug, word_template, example_text, structure_notes
           FROM admin_console.create_doc_types WHERE id = $1`,
        [doc_type_id]
      );
      docType = rows[0] ?? null;
    }

    const userCtx = await getChatUserContext(req.user?.id);
    const { blocks, totalChars } = await assembleContext(projectId, sources ?? {}, userCtx);

    // Sources, the example document and the document being written all share
    // the one context window, so all three count against the same budget the
    // frontend meter shows.
    const documentHtml = typeof document_html === 'string' ? document_html : '';
    const contextChars =
      totalChars + documentHtml.length + Math.min(docType?.example_text?.length ?? 0, EXAMPLE_MAX_CHARS)
      + imports.reduce((n, i) => n + i.prompt.length, 0);
    if (contextChars > CONTEXT_BUDGET) {
      const pct = Math.round(contextChars / CONTEXT_BUDGET * 100);
      return res.status(400).json({
        error: `The selected sources, document and example exceed the context budget (~${pct}%). Untick some sources and try again.`,
      });
    }

    const system = buildCreateSystemPrompt({
      projectName: projectRows[0].project_name,
      clientName: projectRows[0].client,
      docType,
      blocks,
      documentHtml,
      selection: selection ?? null,
      imports,
      useHouseStyle: use_house_style !== false,
    });

    const response = await client.messages.create({
      model: MODEL_SONNET,
      max_tokens: CREATE_CHAT_MAX_TOKENS,
      system,
      messages: history,
      tools: [writeDocumentTool, editDocumentTool],
    });

    const parsed = parseCreateResponse(response);
    if (parsed.truncated) {
      return res.status(422).json({
        error: 'That was too long to write in one go. Ask for it in parts (for example one section at a time).',
      });
    }

    res.json({
      reply: parsed.reply || (parsed.mode === 'none' ? '' : 'Done.'),
      mode: parsed.mode,
      html: parsed.html,
      edits: parsed.edits,
      context_chars: contextChars,
    });
  } catch (err) {
    console.error('draftCreate.chat error:', err);
    res.status(500).json({ error: err.message });
  }
}
