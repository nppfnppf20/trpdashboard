import { callClaude } from './llm.shared.js';
import { getGuidingBrief } from '../controllers/guidingBriefs.controller.js';

const PROMPT_PREFIX = `You are a planning consultant assistant. Extract key information from a statutory consultation response document.

Return your response using EXACTLY these XML delimiters — nothing before <CONSULTEE_NAME> and nothing after </COMMENTS>:

<CONSULTEE_NAME>name of the consultee organisation or body</CONSULTEE_NAME>
<DATE_RECEIVED>YYYY-MM-DD or leave blank</DATE_RECEIVED>
<POSITION>Objection | Support | Conditional Support | No Comment | or short free text</POSITION>
<COMMENTS>
Summary of the consultee's response here
</COMMENTS>

CONSULTEE_NAME: Full name of the statutory consultee (e.g. "Natural England", "Environment Agency"). Leave blank if not determinable.

DATE_RECEIVED: Date the response was issued, as YYYY-MM-DD. Leave blank if not determinable.

POSITION:
- Objection — raises concerns that must be resolved before consent
- Conditional Support — support subject to conditions or further information
- Support — no objections raised
- No Comment — no observations
- Use short free text only if none of the above fit.

COMMENTS: Summarise the consultee's response, covering all of their issues and points. Do not miss anything out. Write in plain text only — no markdown, no bold, no headings, no bullet symbols.

Word limit: 500 words maximum.
- If the response is short, write it naturally in prose.
- If covering all points would exceed 500 words, switch to a brief bullet-point-style list (one short sentence per issue, no elaboration) so every point is still represented.
- If detail has been condensed in this way, add the sentence "Further detail is contained in the full response." at the very end.`;

async function buildSystemPrompt(developmentType) {
  const brief = await getGuidingBrief('consultation_response', developmentType).catch(() => null);

  const extraSection = brief?.guidance_content?.trim()
    ? `\n\n════════════════════════════════════════\nADDITIONAL GUIDANCE\n════════════════════════════════════════\n\n${brief.guidance_content.trim()}`
    : '';

  const styleSection = brief?.style_example?.trim()
    ? `\n\n════════════════════════════════════════\nSTYLE EXAMPLE\n════════════════════════════════════════\n\nThe following is an example of the expected summary style and level of detail:\n\n${brief.style_example.trim()}`
    : '';

  return PROMPT_PREFIX + extraSection + styleSection;
}

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function processConsultationResponse(text, fileName, developmentType = null, userNotes = null) {
  const systemPrompt = await buildSystemPrompt(developmentType);

  const parts = [];

  if (userNotes) {
    parts.push(`CONSULTANT NOTES:\n${userNotes}\n\nThe above notes highlight issues the consultant considers important. Make sure these are captured in your summary. Do not treat them as a replacement for the document — still extract everything else the consultee raises.`);
  }

  parts.push(`Consultation response document${fileName ? ` (${fileName})` : ''}:\n\n${text.slice(0, 80000)}`);

  const content = parts.join('\n\n');

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
