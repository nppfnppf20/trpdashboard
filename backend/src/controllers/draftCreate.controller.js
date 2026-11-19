/**
 * Draft Create Controller
 * Powers the "Create" panel — turns a free-form custom prompt into a
 * complete HTML document, optionally wrapped in the practice's house style
 * (capitalisation, formatting, and anti-AI-slop rules shared with every
 * other generation prompt in the app).
 */

import { pool } from '../db.js';
import { callLLM, resolveProvider, noEmDash, HOUSE_STYLE_BLOCK, ANTI_AI_SLOP_BLOCK, client, MODEL_SONNET } from '../services/llm.shared.js';
import { assembleContext, getChatUserContext } from '../services/projectChat.service.js';
import {
  buildCreateSystemPrompt, parseCreateResponse, writeDocumentTool, editDocumentTool,
  CREATE_CHAT_MAX_TOKENS, CREATE_CONTEXT_BUDGET, EXAMPLE_MAX_CHARS, cleanImports,
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
  // 'ask': answer only (no tools, the document cannot change). Anything else is 'edit'.
  const chatMode = req.body?.mode === 'ask' ? 'ask' : 'edit';
  const imports = cleanImports(req.body?.imports);

  const history = (Array.isArray(messages) ? messages : [])
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content }));
  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'messages must end with a user message' });
  }
  while (history[0].role !== 'user') history.shift();

  // The highlighted passage goes in the user's own message, next to what they
  // ask for. In the system prompt it sat far from the request (after the
  // document, before the sources, which can be very long) and was easy to
  // overlook. The stored chat history is not changed; this is request-only.
  const highlighted = typeof selection?.quoted_text === 'string' ? selection.quoted_text.trim().slice(0, 20000) : '';
  // Block numbers (data-b) the highlight covers, so the model edits those blocks and no others.
  const blockIds = Array.isArray(selection?.block_ids)
    ? [...new Set(selection.block_ids.map(Number).filter(n => Number.isInteger(n) && n >= 0))].slice(0, 1000)
    : [];
  if (highlighted) {
    const last = history[history.length - 1];
    const where = blockIds.length ? ` (blocks numbered ${blockIds.join(', ')})` : '';
    last.content = `${last.content}\n\n---\nThe passage I have highlighted in the document${where}. My request above is about THIS text; change only these blocks, using their numbers:\n<highlighted_passage>\n${highlighted}\n</highlighted_passage>`;
  }

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
    if (contextChars > CREATE_CONTEXT_BUDGET) {
      const pct = Math.round(contextChars / CREATE_CONTEXT_BUDGET * 100);
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
      chatMode,
    });

    const callModel = msgs => client.messages.create({
      model: MODEL_SONNET,
      max_tokens: CREATE_CHAT_MAX_TOKENS,
      system,
      messages: msgs,
      // Ask mode sends no tools at all, so the document cannot be changed.
      ...(chatMode === 'ask' ? {} : { tools: [writeDocumentTool, editDocumentTool] }),
    });

    let response = await callModel(history);
    let parsed = parseCreateResponse(response);

    // Edit mode produced nothing usable: either a tool call whose edits were all invalid, or an
    // empty reply with no tool call. Left alone the user sees a bare "No changes made", so tell the
    // model what was wrong and let it try once more.
    if (chatMode === 'edit' && parsed.mode === 'none' && !parsed.truncated && (parsed.invalid || !parsed.reply)) {
      console.warn('[draftCreate] edit mode returned no usable change, retrying once:', parsed.invalid ? parsed.reasons : 'empty reply, no tool call');
      let retryMessages;
      if (parsed.invalid) {
        const why = parsed.reasons.join('; ');
        retryMessages = [
          ...history,
          { role: 'assistant', content: response.content },
          {
            role: 'user',
            content: response.content.filter(b => b.type === 'tool_use').map(b => ({
              type: 'tool_result',
              tool_use_id: b.id,
              is_error: true,
              content: `That could not be applied: ${why}. Call edit_document again with valid edits (every edit needs "id" = the data-b number of an existing block; replace needs "html" with the block's full new content, or "as"; insert_after needs "html"), or write_document if the document is empty. If you cannot make the change, say why in plain text.`,
            })),
          },
        ];
      } else {
        const last = history[history.length - 1];
        retryMessages = [
          ...history.slice(0, -1),
          { role: 'user', content: `${last.content}\n\n(Reply with the change made through edit_document or write_document, or with a short question if you need more information. An empty reply is not allowed.)` },
        ];
      }
      response = await callModel(retryMessages);
      parsed = parseCreateResponse(response);
    }

    if (chatMode === 'edit' && parsed.mode === 'none' && !parsed.reply) {
      parsed.reply = parsed.invalid
        ? `I could not turn that into a change to the document (${parsed.reasons.join('; ')}). Try saying where it should go, for example which heading it goes under.`
        : 'I did not make a change. Tell me where it should go, for example which heading it goes under, or switch to Ask if you only want an answer.';
    }
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
      // Edits the model sent that were unusable (e.g. an insert with no anchor); shown to the user.
      dropped: parsed.mode === 'edits' ? (parsed.reasons ?? []) : [],
      context_chars: contextChars,
    });
  } catch (err) {
    console.error('draftCreate.chat error:', err);
    res.status(500).json({ error: err.message });
  }
}
