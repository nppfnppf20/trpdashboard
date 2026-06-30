import { callClaude } from './llm.shared.js';

const SYSTEM_PROMPT = `You are a planning consultant assistant processing a policy document, guidance note, or industry update.

The user has provided context notes about why this is relevant — use these to shape your analysis and focus the summary on what matters for their work.

Return your response using EXACTLY these delimiters — nothing before <POLICY_TITLE> and nothing after </IMPLICATIONS_HTML>:

<POLICY_TITLE>concise title for this policy or update</POLICY_TITLE>
<SUMMARY_HTML>
2-3 paragraph HTML summary of what this policy/update says and means. Use only <p>, <strong>, <ul>, <li> tags.
</SUMMARY_HTML>
<KEY_POINTS>
A <ul> list of 4-6 key bullet points. Use <ul><li>...</li></ul> tags only.
</KEY_POINTS>
<IMPLICATIONS_HTML>
1-2 paragraphs on practical implications for planning work, shaped specifically by the user's context notes. What does this mean in practice? What should consultants be aware of?
</IMPLICATIONS_HTML>`;

function extractTag(text, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

export async function processPolicyDocument(rawText, userNotes = null) {
  const parts = [];

  if (userNotes?.trim()) {
    parts.push(`CONTEXT (why this is relevant — shape the summary around this):\n${userNotes.trim()}`);
  }

  parts.push(`Policy document:\n\n${rawText.slice(0, 80000)}`);

  const raw = await callClaude(SYSTEM_PROMPT, parts.join('\n\n'), undefined, 4096);

  const title        = extractTag(raw, 'POLICY_TITLE');
  const summary_html = extractTag(raw, 'SUMMARY_HTML');
  const key_points   = extractTag(raw, 'KEY_POINTS');
  const implications = extractTag(raw, 'IMPLICATIONS_HTML');

  if (!summary_html) {
    console.error('[policy.service] Missing SUMMARY_HTML. Raw (first 400):', raw.slice(0, 400));
    throw new Error('LLM returned unexpected format for policy document');
  }

  return { title: title || 'Policy Update', summary_html, key_points, implications };
}
