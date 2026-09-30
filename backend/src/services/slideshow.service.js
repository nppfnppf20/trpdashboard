import pptxgen from 'pptxgenjs';
import { callLLM, parseJSON, MODEL_SONNET, ANTI_AI_SLOP_BLOCK, noEmDash } from './llm.shared.js';

/**
 * Slideshow generation: notes + guidance -> strict JSON outline (LLM) -> .pptx
 * (pptxgenjs, fixed template). Design is deliberately code-controlled so every
 * deck looks the same; to add a branded template, register it in TEMPLATES.
 */

// Slide colours are hex without '#', as pptxgenjs expects. These are the
// document's colours (not app CSS), so they live here rather than in app.css.
const TEMPLATES = {
  trp_standard: {
    label: 'TRP standard',
    font: 'Calibri',
    background: 'FFFFFF',
    titleBarBg: '1E3A8A',
    titleBarText: 'FFFFFF',
    text: '1E293B',
    muted: '64748B',
    accent: '2563EB',
  },
};

export const DEFAULT_TEMPLATE = 'trp_standard';
export const TEMPLATE_OPTIONS = Object.entries(TEMPLATES).map(([id, t]) => ({ id, label: t.label }));

const stripHtml = html => (html ?? '')
  .replace(/<\/(p|li|h[1-6]|div|br)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n\s*\n+/g, '\n')
  .trim();

const clean = s => noEmDash(String(s ?? '')).trim();

/**
 * Ask the model for the slide outline.
 * @returns {Promise<{ deck_title: string, slides: Array<{ title: string, bullets: string[], notes?: string }> }>}
 */
export async function generateOutline({ projectName, clientName, sourceText, guidance, maxSlides = 12 }) {
  const system = `You build slide decks for a planning consultancy from meeting and briefing notes.

Rules:
- Use ONLY facts stated in the source notes. Never invent figures, dates, names, decisions or commitments. If the guidance asks for something the notes do not cover, leave it out rather than guess.
- Follow the user's guidance on audience, length, tone and emphasis. If it gives no slide count, aim for 6 to 10 slides. Never exceed ${maxSlides} slides.
- Slide 1 is a title slide: "title" is the deck title, and "bullets" holds at most one short subtitle line.
- Every other slide has a short, specific title (not a generic label) and 3 to 5 concise bullets. Each bullet is a fragment or one short sentence, under 20 words.
- Put anything longer (context, caveats, who said what) in "notes", which becomes speaker notes.
- Plain text only in every field: no markdown, no asterisks, no numbering in titles.

Return ONLY valid JSON, no commentary, in exactly this shape:
{ "deck_title": "string", "slides": [ { "title": "string", "bullets": ["string"], "notes": "string" } ] }`
    + ANTI_AI_SLOP_BLOCK;

  const prompt = `Project: ${projectName}${clientName ? ` (client: ${clientName})` : ''}

User guidance for the deck:
${guidance?.trim() || '(none given - produce a clear summary deck of the notes)'}

Source notes:
${sourceText}`;

  const raw = await callLLM({ model: MODEL_SONNET, system, prompt, maxTokens: 8000, stream: true });
  const parsed = parseJSON(raw);

  const slides = (Array.isArray(parsed?.slides) ? parsed.slides : [])
    .slice(0, maxSlides)
    .map(s => ({
      title: clean(s?.title),
      bullets: (Array.isArray(s?.bullets) ? s.bullets : []).map(clean).filter(Boolean).slice(0, 6),
      notes: clean(s?.notes),
    }))
    .filter(s => s.title);

  if (!slides.length) throw new Error('The model did not return any slides. Try adding more guidance.');

  return { deck_title: clean(parsed.deck_title) || slides[0].title, slides };
}

/** Render an outline to a .pptx Buffer. */
export async function buildPptxBuffer(outline, templateId = DEFAULT_TEMPLATE, { projectName } = {}) {
  const t = TEMPLATES[templateId] ?? TEMPLATES[DEFAULT_TEMPLATE];
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5in
  pptx.title = outline.deck_title;
  if (projectName) pptx.subject = projectName;

  outline.slides.forEach((slide, i) => {
    const s = pptx.addSlide();

    if (i === 0) {
      s.background = { color: t.titleBarBg };
      s.addText(slide.title, {
        x: 0.9, y: 2.3, w: 11.5, h: 1.6,
        fontFace: t.font, fontSize: 40, bold: true, color: t.titleBarText, valign: 'bottom',
      });
      const subtitle = slide.bullets[0] || projectName || '';
      if (subtitle) {
        s.addText(subtitle, {
          x: 0.9, y: 4.0, w: 11.5, h: 0.8,
          fontFace: t.font, fontSize: 20, color: t.titleBarText, transparency: 15, valign: 'top',
        });
      }
    } else {
      s.background = { color: t.background };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.2, fill: { color: t.titleBarBg }, line: { color: t.titleBarBg } });
      s.addText(slide.title, {
        x: 0.6, y: 0.1, w: 12.1, h: 1.0,
        fontFace: t.font, fontSize: 28, bold: true, color: t.titleBarText, valign: 'middle', fit: 'shrink',
      });
      if (slide.bullets.length) {
        s.addText(
          slide.bullets.map(b => ({ text: b, options: { bullet: { indent: 22 }, breakLine: true, paraSpaceAfter: 10 } })),
          { x: 0.8, y: 1.6, w: 11.7, h: 5.0, fontFace: t.font, fontSize: 22, color: t.text, valign: 'top', fit: 'shrink' }
        );
      }
      s.addText(String(i + 1), { x: 12.2, y: 6.95, w: 0.7, h: 0.35, fontFace: t.font, fontSize: 11, color: t.muted, align: 'right' });
    }

    if (slide.notes) s.addNotes(slide.notes);
  });

  return pptx.write({ outputType: 'nodebuffer' });
}
