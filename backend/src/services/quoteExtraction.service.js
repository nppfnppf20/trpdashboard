import { callClaude, parseJSON } from './llm.shared.js';

// Extracts a structured fee quote from an uploaded surveyor quote document
// (PDF/Word) to prefill the Add Quote modal. The user reviews everything
// before saving; organisation and contact are always chosen manually.

const SYSTEM = `You are a planning consultant assistant. You will be given the text of a fee quote document from a specialist surveyor or consultant. Extract the quote into structured JSON so it can prefill a quote form.

VERBATIM RULE — this is the most important instruction: the "item" and "description" of every line item, and the "stage" label where the document groups fees by stage or phase, must be copied WORD-FOR-WORD from the document. Do not paraphrase, shorten, retitle, correct grammar, or merge lines. If the document has no separate description for a line, use null rather than inventing one.

Field rules:
- discipline: the surveying discipline this quote covers (e.g. "Ecology", "Heritage", "Landscape and Visual", "Noise", "Transport"). Use your judgement from the document content. Null if unclear.
- organisation_name: the name of the organisation issuing the quote, exactly as written. This is shown to the user as a hint only.
- quote_date: the date of the quote as YYYY-MM-DD, or null.
- line_items: one entry per priced line in the fee schedule, in document order:
  - stage: the stage/phase heading the line sits under, verbatim, or null if the document has no stage grouping.
  - item: the line's title or service name, verbatim.
  - description: the line's fuller description, verbatim, or null if none.
  - cost: the fee for this line EXCLUDING VAT, as a plain number (no currency symbols or commas). If the document only states a VAT-inclusive figure, put that figure here, set vat_included to false, and flag it in notes.
  - vat_included: true if the document indicates VAT applies to this line (e.g. "plus VAT", "excl. VAT" pricing with VAT payable), otherwise false.
  - is_optional: true only if the document marks the line as optional, provisional, contingent, or "if required".
  - is_tbc: true only if the fee is stated as TBC, to be confirmed, or is left blank/POA.
- notes: a brief plain-text note of anything the user must know that does not fit the fields above: exclusions, assumptions, validity period, payment terms, VAT ambiguities. Null if nothing notable. Never use an em dash or en dash.

Do not include totals rows, VAT rows, or grand totals as line items — only the individual priced lines.

Respond with JSON only — no markdown, no explanation:
{
  "discipline": string | null,
  "organisation_name": string | null,
  "quote_date": "YYYY-MM-DD" | null,
  "line_items": [
    { "stage": string | null, "item": string, "description": string | null, "cost": number | null, "vat_included": boolean, "is_optional": boolean, "is_tbc": boolean }
  ],
  "notes": string | null
}`;

/**
 * Extract quote fields from parsed document text.
 * @param {string} text - Parsed document text
 * @param {string|null} fileName - Original file name, for context
 * @returns {Promise<object|null>} extraction JSON, or null if unparseable
 */
export async function extractQuoteFromText(text, fileName = null) {
  const user = `Fee quote document${fileName ? ` (${fileName})` : ''}:

${(text || '').slice(0, 60000)}`;

  const raw = await callClaude(SYSTEM, user, undefined, 4096);
  const parsed = parseJSON(raw);
  if (!parsed || !Array.isArray(parsed.line_items)) return null;

  parsed.line_items = parsed.line_items
    .filter(li => li && (li.item || li.description))
    .map(li => ({
      stage: typeof li.stage === 'string' && li.stage.trim() ? li.stage.trim() : null,
      item: typeof li.item === 'string' ? li.item.trim() : '',
      description: typeof li.description === 'string' && li.description.trim() ? li.description.trim() : null,
      cost: Number.isFinite(Number(li.cost)) && li.cost !== null && li.cost !== '' ? Number(li.cost) : null,
      vat_included: li.vat_included === true,
      is_optional: li.is_optional === true,
      is_tbc: li.is_tbc === true,
    }));

  return parsed;
}
