import { callClaude } from './llm.shared.js';

const EXTRACT_PROMPT = `You are a planning application assistant. Extract information from this public consultation comment.

Return EXACTLY these XML delimiters and nothing else before or after:

<COMMENTER_NAME>name of the commenter, or "Anonymous" if not given</COMMENTER_NAME>
<DATE_RECEIVED>YYYY-MM-DD or leave blank</DATE_RECEIVED>
<POSITION>Support | Object | Neutral | Mixed | or leave blank</POSITION>
<COMMENT>summary of their main point — 500 word maximum. If short, write naturally. If many points, use one short sentence per point so nothing is missed, and end with "Further detail is contained in the full response." if condensed.</COMMENT>
<FURTHER_INFO>any additional details, secondary concerns, or specific requests — 500 word maximum, same rule applies. Leave blank if none.</FURTHER_INFO>

Position guidance:
- Support: commenter clearly supports the application
- Object: commenter opposes or raises concerns
- Neutral: informational only, no clear stance
- Mixed: both supportive and objecting elements`;

function parseXmlField(text, tag) {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : null;
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
    further_info:    parseXmlField(raw, 'FURTHER_INFO')   || null,
  };
}

export async function analysePublicComments(comments) {
  if (!comments.length) return { bulletSummary: [], themes: [] };

  const list = comments.map((c, i) =>
    `${i + 1}. [${c.position || 'No position'}] ${c.commenter_name || 'Anonymous'}: ${c.comment || ''}${c.further_info ? ' ' + c.further_info : ''}`
  ).join('\n');

  const prompt = `You are a planning application assistant analysing public consultation responses for a planning application.

${comments.length} comments received:

${list}

Provide two things:

1. BULLET_SUMMARY — a bullet-point overview of the overall public response. Cover: overall sentiment balance, the most common concerns, any notable themes of support, key issues raised. 500 word maximum total. Keep each bullet to one short sentence. If there is more to say than fits, touch on every point briefly rather than dropping any — it is better to mention something in five words than to omit it.

2. THEMES — recurring themes mentioned by multiple commenters. For each theme provide a name, how many comments mention it, the overall sentiment of comments on that theme, and a one-sentence description.

Return EXACTLY these XML delimiters:

<BULLET_SUMMARY>
- bullet one
- bullet two
</BULLET_SUMMARY>

<THEMES>
[
  { "theme": "Traffic and Transport", "count": 4, "sentiment": "negative", "summary": "Concerns about increased traffic on local roads and junction capacity." },
  { "theme": "...", "count": N, "sentiment": "positive|negative|mixed|neutral", "summary": "..." }
]
</THEMES>

Order themes by count descending. Only include themes mentioned by 2 or more commenters (or all themes if fewer than 5 comments total).`;

  const raw = await callClaude(prompt, 'Please analyse the comments above and return the XML response.', undefined, 2000);

  const summaryRaw = parseXmlField(raw, 'BULLET_SUMMARY') || '';
  const bulletSummary = summaryRaw
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  let themes = [];
  const themesRaw = parseXmlField(raw, 'THEMES') || '[]';
  try {
    themes = JSON.parse(themesRaw.trim());
  } catch {
    // best-effort parse
    themes = [];
  }

  return { bulletSummary, themes };
}
