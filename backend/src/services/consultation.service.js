import { callClaude } from './llm.shared.js';
import { getGuidingBrief } from '../controllers/guidingBriefs.controller.js';

const PROMPT_PREFIX = `You are a planning consultant assistant. Extract key information from a statutory consultation response document.

Return your response using EXACTLY these XML delimiters — nothing before <CONSULTEE_NAME> and nothing after </COMMENTS>:

<CONSULTEE_NAME>name of the consultee organisation or body</CONSULTEE_NAME>
<DATE_RECEIVED>YYYY-MM-DD or leave blank</DATE_RECEIVED>
<POSITION>Objection | Support | Conditional Support | No Comment | or short free text</POSITION>
<COMMENTS>
• Issue / concern / requirement — one concise headline sentence
• Issue / concern / requirement — one concise headline sentence
</COMMENTS>

════════════════════════════════════════
FIELD GUIDANCE
════════════════════════════════════════

CONSULTEE_NAME
- The full name of the statutory consultee (e.g. "Natural England", "Environment Agency", "Historic England").
- If multiple consultees are in one document, use the primary respondent.
- Leave blank if not determinable.

DATE_RECEIVED
- The date the response was issued or received, as YYYY-MM-DD.
- Look for phrases like "dated", "issued", "response date", letter date at the top of the document.
- Leave blank if not determinable.

POSITION
- Choose from: Objection | Support | Conditional Support | No Comment
- "Objection" if the consultee raises concerns that must be resolved before consent.
- "Conditional Support" if support is offered subject to conditions or further information.
- "Support" if no objections are raised and the application is supported.
- "No Comment" if the consultee has no observations.
- Use short free text only if none of the above fit.

════════════════════════════════════════
COMMENTS — CRITICAL RULES
════════════════════════════════════════

The COMMENTS field is a bullet list. Each bullet must be a single concise headline sentence capturing ONE distinct issue, concern, requirement, or request from the consultee.

MANDATORY:
- Every single issue in the document MUST appear as its own bullet. Nothing may be omitted.
- If the document raises 15 issues, there must be 15 bullets. Volume is expected and correct.
- Do NOT merge separate issues into one bullet.
- Do NOT summarise groups of issues into a single vague bullet.

STYLE:
- Each bullet: one sentence, plain language, no jargon.
- Concise but complete — the headline must be specific enough that the planning consultant knows exactly what the issue is.
- Do NOT quote verbatim paragraphs. Extract the essence.
- Do NOT add commentary, assessment, or your own views.
- Do NOT include preamble, introductory paragraphs, or closing remarks in the bullets.

FORMAT:
• [Issue headline sentence]
• [Issue headline sentence]`;

async function buildSystemPrompt(developmentType) {
  const brief = await getGuidingBrief('consultation_response', developmentType).catch(() => null);

  const extraSection = brief?.guidance_content?.trim()
    ? `\n\n════════════════════════════════════════\nADDITIONAL GUIDANCE\n════════════════════════════════════════\n\n${brief.guidance_content.trim()}`
    : '';

  const styleSection = brief?.style_example?.trim()
    ? `\n\n════════════════════════════════════════\nSTYLE EXAMPLE\n════════════════════════════════════════\n\nThe following is an example of the required bullet format. Match its level of detail exactly:\n\n${brief.style_example.trim()}`
    : '';

  return PROMPT_PREFIX + extraSection + styleSection;
}

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function processConsultationResponse(text, fileName, developmentType = null) {
  const systemPrompt = await buildSystemPrompt(developmentType);

  const content = `Consultation response document${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`;

  const raw = await callClaude(systemPrompt, content, undefined, 8000);

  const comments = extractTag(raw, 'COMMENTS');
  if (!comments) {
    console.error('[consultation.service] Missing COMMENTS. Raw (first 400):', raw.slice(0, 400));
    throw new Error('LLM returned unexpected format for consultation response');
  }

  return {
    consultee_name: extractTag(raw, 'CONSULTEE_NAME') || null,
    date_received:  extractTag(raw, 'DATE_RECEIVED') || null,
    position:       extractTag(raw, 'POSITION') || null,
    comments,
  };
}
