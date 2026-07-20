/**
 * Pure OCDS release -> scraper.tender_notices row mapping.
 * Shared by all source adapters (Find a Tender, Contracts Finder).
 */

const FTS_NOTICE_URL_BASE = 'https://www.find-tender.service.gov.uk/Notice';
const CONTRACTS_FINDER_NOTICE_URL_PREFIX = 'https://www.contractsfinder.service.gov.uk/Notice/';

// Release tags can include variants like 'tenderUpdate', 'awardUpdate' — match by prefix.
// Precedence: a release tagged both counts as its most advanced stage.
function stageFromTags(tags = []) {
  const has = (prefix) => tags.some((t) => typeof t === 'string' && t.startsWith(prefix));
  if (has('award')) return 'award';
  if (has('tender')) return 'tender';
  if (has('planning')) return 'planning';
  return null;
}

function findBuyerParty(release) {
  return (release.parties || []).find((p) => (p.roles || []).includes('buyer')) || null;
}

function collectAdditionalCpvs(release) {
  const seen = new Set();
  const out = [];
  const add = (c) => {
    if (!c || c.scheme !== 'CPV' || !c.id || seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ id: c.id, description: c.description || null });
  };
  const tender = release.tender || {};
  (tender.additionalClassifications || []).forEach(add);
  (tender.items || []).forEach((item) => (item.additionalClassifications || []).forEach(add));
  (tender.lots || []).forEach((lot) => (lot.additionalClassifications || []).forEach(add));
  return out;
}

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * FTS notice ids (nnnnnn-yyyy) map directly to a URL. Contracts Finder release
 * ids are a UUID+suffix that isn't a valid notice path — the real notice URL
 * has to be read from a document entry instead.
 */
function findNoticeUrl(release, source) {
  if (source === 'find_a_tender') return `${FTS_NOTICE_URL_BASE}/${release.id}`;

  const documents = [
    ...(release.tender?.documents || []),
    ...(release.awards || []).flatMap((a) => a.documents || []),
  ];
  const canonical = documents.find((d) => d.url?.startsWith(CONTRACTS_FINDER_NOTICE_URL_PREFIX));
  return canonical?.url || documents[0]?.url || null;
}

/** Returns a row object keyed by tender_notices columns, or null if the release is unusable. */
export function normaliseRelease(release, source = 'find_a_tender') {
  if (!release || !release.id) return null;

  const tender = release.tender || {};
  const award = (release.awards || [])[0] || null;
  const buyerParty = findBuyerParty(release);
  const contact = buyerParty?.contactPoint || {};

  const classification = tender.classification?.scheme === 'CPV' ? tender.classification : null;
  const value = tender.value || award?.value || null;
  const contractPeriod = award?.contractPeriod || tender.contractPeriod || {};

  return {
    source,
    source_notice_id: String(release.id),
    ocid: release.ocid || null,
    stage: stageFromTags(release.tag),
    publication_date: release.date || null,
    title: tender.title || null,
    description: tender.description || release.description || null,
    buyer_name: buyerParty?.name || release.buyer?.name || null,
    value_amount: value?.amount ?? null,
    value_currency: value?.currency || null,
    deadline: tender.tenderPeriod?.endDate || null,
    contract_start: toDateOnly(contractPeriod.startDate),
    contract_end: toDateOnly(contractPeriod.endDate),
    procurement_method: tender.procurementMethodDetails || tender.procurementMethod || null,
    is_framework: tender.techniques?.hasFrameworkAgreement === true,
    cpv_code: classification?.id || null,
    cpv_description: classification?.description || null,
    additional_cpv_codes: collectAdditionalCpvs(release),
    contact_name: contact.name || null,
    contact_email: contact.email || null,
    contact_phone: contact.telephone || null,
    notice_url: findNoticeUrl(release, source),
    submission_url: tender.submissionMethodDetails || contact.url || null,
    raw_json: release,
  };
}
