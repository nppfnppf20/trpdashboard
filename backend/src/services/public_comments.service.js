import { callClaude } from './llm.shared.js';

const EXTRACT_PROMPT = `You are a planning application assistant. Extract information from this public consultation comment.

Return EXACTLY these XML delimiters and nothing else before or after:

<COMMENTER_NAME>name of the commenter, or "Anonymous" if not given</COMMENTER_NAME>
<DATE_RECEIVED>YYYY-MM-DD or leave blank</DATE_RECEIVED>
<POSITION>Support | Object | Neutral | Mixed | or leave blank</POSITION>
<COMMENT>summary of everything they said - their main point plus any additional details, secondary concerns, or specific requests - 500 word maximum. If short, write naturally. If many points, use one short sentence per point so nothing is missed, and end with "Further detail is contained in the full response." if condensed.</COMMENT>

Position guidance:
- Support: commenter clearly supports the application
- Object: commenter opposes or raises concerns
- Neutral: informational only, no clear stance
- Mixed: both supportive and objecting elements`;

function parseXmlField(text, tag) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : null;
}

const SPLIT_PROMPT = `You are splitting a block of pasted or uploaded text into individual public consultation comments/submissions.

The text may be ONE comment, or it may be MULTIPLE separate comments/submissions concatenated together (e.g. copied from several emails, a bundle of letters, or a list of responses pasted in one go).

Your only job is to find genuine boundaries between distinct commenters/submissions. Do NOT summarise, reword, shorten, or correct anything — reproduce each comment's text VERBATIM, including all of its original content and formatting.

Only split where there is a CLEAR, unambiguous boundary, such as:
- A new named sender (a new "From:"/"Name:" line, or a signature introducing a different person)
- A new date/subject header starting a new email or letter
- Explicit numbering or separators the source text itself uses to distinguish separate responses

If you are not confident that two parts come from different commenters, do NOT split them — keep them together. When in doubt, prefer not splitting. A single comment that happens to cover several topics or paragraphs is still ONE comment.

Return each individual comment wrapped like this, in order, with nothing else before, between, or after:

<COMMENT>
(verbatim text of comment 1, unchanged)
</COMMENT>
<COMMENT>
(verbatim text of comment 2, unchanged)
</COMMENT>

If the whole text is just one comment, return a single <COMMENT> block containing the entire original text, unchanged.`;

function estimateSplitTokens(text) {
  return Math.min(8000, Math.max(4096, Math.ceil(text.length / 3) + 1000));
}

export async function splitPublicCommentBlock(text) {
  const raw = await callClaude(SPLIT_PROMPT, text, undefined, estimateSplitTokens(text));

  const segments = [...raw.matchAll(/<COMMENT>([\s\S]*?)<\/COMMENT>/g)]
    .map(m => m[1].trim())
    .filter(Boolean);

  // Fall back to the original, unsplit text if parsing failed or produced nothing usable
  return segments.length ? segments : [text.trim()];
}

export async function processPublicComment(text, fileName, userNotes) {
  const userParts = [];
  if (fileName) userParts.push(`Document: ${fileName}`);
  if (userNotes) userParts.push(`User notes: ${userNotes}`);
  userParts.push('', 'Comment text:', text);

  const raw = await callClaude(EXTRACT_PROMPT, userParts.join('\n'));

  return {
    commenter_name:  parseXmlField(raw, 'COMMENTER_NAME') || null,
    date_received:   parseXmlField(raw, 'DATE_RECEIVED')  || null,
    position:        parseXmlField(raw, 'POSITION')       || null,
    comment:         parseXmlField(raw, 'COMMENT')        || null,
  };
}

export async function analysePublicComments(comments) {
  if (!comments.length) return { bulletSummary: [], themes: [] };

  const list = comments.map((c, i) =>
    `${i + 1}. [${c.position || 'No position'}] ${c.commenter_name || 'Anonymous'}: ${c.comment || ''}`
  ).join('\n');

  const prompt = `You are a planning application assistant analysing public consultation responses for a planning application.

${comments.length} comments received:

${list}

Provide two things:

1. BULLET_SUMMARY — a bullet-point overview of the overall public response. Structure the bullets in two sections:
   First, overall sentiment and broad observations (3-5 bullets).
   Then, specific key issues raised, each with how many times it was mentioned — e.g. "Junction capacity at the site entrance — raised by 4 commenters." Include every distinct issue mentioned by at least 2 commenters (or all issues if fewer than 5 comments total).
   500 word maximum total. Keep each bullet to one short sentence.

2. THEMES — broad recurring themes (e.g. "Traffic and Transport", "Ecology"). For each: name, count, sentiment, one-sentence description. Order by count descending. Only include themes mentioned by 2+ commenters (or all if fewer than 5 comments total).

Return EXACTLY these XML delimiters:

<BULLET_SUMMARY>
- bullet one
- bullet two
- Key issue: Junction capacity at the site entrance — raised by 4 commenters.
</BULLET_SUMMARY>

<THEMES>
[
  { "theme": "Traffic and Transport", "count": 4, "sentiment": "negative", "summary": "Concerns about increased traffic on local roads and junction capacity." }
]
</THEMES>`;

  const raw = await callClaude(prompt, 'Please analyse the comments above and return the XML response.', undefined, 2000);

  const summaryRaw = parseXmlField(raw, 'BULLET_SUMMARY') || '';
  const bulletSummary = summaryRaw
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  let themes = [];
  try { themes = JSON.parse(parseXmlField(raw, 'THEMES') || '[]'); } catch { themes = []; }

  return { bulletSummary, themes };
}
