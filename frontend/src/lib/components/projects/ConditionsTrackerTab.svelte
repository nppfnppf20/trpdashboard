<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import { exportConditionsPdf, exportConditionsWithExtras } from '$lib/services/conditionsPdfExport.js';
  import AddConditionsModal from '$lib/components/projects/AddConditionsModal.svelte';
  import AddAdvancementModal from '$lib/components/projects/AddAdvancementModal.svelte';
  import ConditionEmailModal from '$lib/components/projects/ConditionEmailModal.svelte';
  import BulkFeeQuoteModal from '$lib/components/projects/BulkFeeQuoteModal.svelte';
  import ExportConditionsModal from '$lib/components/projects/ExportConditionsModal.svelte';
  import SelectSurveyorModal from '$lib/components/surveyor-briefings/SelectSurveyorModal.svelte';
  import { cleanPastedText } from '$lib/utils/pdfText.js';
  import { getQuotes, getProgrammeEvents, getQuoteKeyDates } from '$lib/api/quotes.js';
  import { getSentRequestsForProject } from '$lib/api/quoteRequests.js';
  import { getQuoteActions } from '$lib/api/quoteActions.js';
  import {
    getConditionsData,
    updateCondition,
    deleteCondition,
    createConditionRequirement,
    updateConditionRequirement,
    deleteConditionRequirement,
    createConditionAdvancements,
    suggestConditionAdvancementSummaries,
    updateConditionAdvancement,
    deleteConditionAdvancement,
    getProjectQuotesForConditions,
    linkConditionQuote,
    unlinkConditionQuote,
    markConditionsExported,
    markConditionsIssuedToClient,
  } from '$lib/api/conditions.js';

  export let project;
  $: projectId = project?.id;

  // ── Data ──────────────────────────────────────────────────────────────────
  let conditions = [];
  let meta = { last_exported_at: null, last_issued_to_client_at: null };
  let loading = true;
  let error = null;

  const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Submitted', 'Discharged', 'N/A'];
  const TYPE_OPTIONS = [
    'Pre-Commencement',
    'Pre-Beneficial Use',
    'Action Required (not Pre-Commencement)',
    'Compliance',
    'Informative',
  ];

  function conditionNumberValue(num) {
    const digits = (num || '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 999999;
  }

  // ── Sorting (click column headers) ────────────────────────────────────────
  let sortKey = 'number';   // 'number' | 'title' | 'type'
  let sortDir = 'asc';

  // Type ordering: pre-commencement top, action required second,
  // compliance and informative at the bottom; untyped rows last of all
  const TYPE_PRIORITY = {
    'Pre-Commencement': 1,
    'Action Required (not Pre-Commencement)': 2,
    'Pre-Beneficial Use': 3,
    'Compliance': 4,
    'Informative': 5,
  };
  function typePriority(t) { return TYPE_PRIORITY[t] || 6; }

  function setSort(key) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
  }

  function sortList(arr, key, dir) {
    const sorted = [...arr].sort((a, b) => {
      let cmp = 0;
      if (key === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      } else if (key === 'type') {
        cmp = typePriority(a.condition_type) - typePriority(b.condition_type);
      }
      if (cmp === 0) cmp = conditionNumberValue(a.condition_number) - conditionNumberValue(b.condition_number);
      if (cmp === 0) cmp = a.id - b.id;
      return dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  $: sortedConditions = sortList(conditions, sortKey, sortDir);

  // ── Top scrollbar mirror ──────────────────────────────────────────────────
  let scrollTopEl, tableWrapperEl, tableEl;
  let _mirrorCleanup = null;

  $: if (scrollTopEl && tableWrapperEl && tableEl) {
    if (_mirrorCleanup) { _mirrorCleanup(); _mirrorCleanup = null; }

    const inner = scrollTopEl.querySelector('.ct-scroll-top-inner');
    const updateWidth = () => { inner.style.width = tableEl.scrollWidth + 'px'; };
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(tableEl);

    let _syncing = false;
    const syncFromTop     = () => { if (_syncing) return; _syncing = true; tableWrapperEl.scrollLeft = scrollTopEl.scrollLeft;  _syncing = false; };
    const syncFromWrapper = () => { if (_syncing) return; _syncing = true; scrollTopEl.scrollLeft    = tableWrapperEl.scrollLeft; _syncing = false; };

    scrollTopEl.addEventListener('scroll', syncFromTop);
    tableWrapperEl.addEventListener('scroll', syncFromWrapper);

    _mirrorCleanup = () => {
      ro.disconnect();
      scrollTopEl.removeEventListener('scroll', syncFromTop);
      tableWrapperEl.removeEventListener('scroll', syncFromWrapper);
    };
  }

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  async function load() {
    loading = true; error = null;
    try {
      const data = await getConditionsData(projectId);
      conditions = data.conditions;
      meta = data.meta;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateTime(d) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function statusClass(status) {
    const s = (status || 'Not Started').toLowerCase();
    if (s === 'discharged')   return 'ct-status-discharged';
    if (s === 'submitted')    return 'ct-status-submitted';
    if (s === 'in progress')  return 'ct-status-inprogress';
    if (s === 'n/a' || s === 'not required') return 'ct-status-notrequired';
    return 'ct-status-notstarted';
  }

  // Compliance / informative conditions have nothing to discharge
  function typeImpliesNA(t) {
    return t === 'Compliance' || t === 'Informative';
  }

  // ── Full screen view ──────────────────────────────────────────────────────
  let isFullscreen = false;

  function handleFullscreenKeydown(e) {
    if (e.key === 'Escape' && isFullscreen) isFullscreen = false;
  }

  // ── Add conditions modal ──────────────────────────────────────────────────
  let showAddConditions = false;

  // Next condition number: one past the highest number already in the tracker
  $: nextConditionNumber = conditions.reduce((max, c) => {
    const n = parseInt((c.condition_number || '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;

  function handleAddDone(e) {
    conditions = [...conditions, ...e.detail.rows];
  }

  // ── Inline edit ───────────────────────────────────────────────────────────
  let editingId = null;
  let editForm = {};

  function startEdit(c) {
    editingId = c.id;
    editForm = {
      condition_number: c.condition_number ?? '',
      title:            c.title ?? '',
      condition_type:   c.condition_type ?? '',
      wording:          c.wording ?? '',
      reason:           c.reason ?? '',
      initial_actions:  c.initial_actions ?? '',
      original_consultant:       c.original_consultant ?? '',
      original_consultant_email: c.original_consultant_email ?? '',
      status:           c.status ?? 'Not Started',
    };
  }

  async function saveEdit(id) {
    try {
      const updated = await updateCondition(id, {
        condition_number: editForm.condition_number || null,
        title:            editForm.title            || null,
        condition_type:   editForm.condition_type   || null,
        wording:          cleanPastedText(editForm.wording)         || null,
        reason:           cleanPastedText(editForm.reason)          || null,
        initial_actions:  cleanPastedText(editForm.initial_actions) || null,
        original_consultant:       editForm.original_consultant       || null,
        original_consultant_email: editForm.original_consultant_email || null,
        status:           editForm.status           || 'Not Started',
      });
      conditions = conditions.map(c => c.id === id ? { ...c, ...updated, requirements: c.requirements } : c);
      editingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function updateStatus(c, newStatus) {
    try {
      const updated = await updateCondition(c.id, { status: newStatus });
      conditions = conditions.map(x => x.id === c.id ? { ...x, ...updated, requirements: x.requirements } : x);
    } catch (err) {
      alert(err.message);
    }
  }

  async function updateType(c, newType) {
    try {
      const updated = await updateCondition(c.id, {
        condition_type: newType || null,
        ...(typeImpliesNA(newType) ? { status: 'N/A' } : {}),
      });
      conditions = conditions.map(x => x.id === c.id ? { ...x, ...updated, requirements: x.requirements } : x);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeCondition(id) {
    if (!confirm('Delete this condition? Its requirements will also be deleted.')) return;
    try {
      await deleteCondition(id);
      conditions = conditions.filter(c => c.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Expand/collapse long text ─────────────────────────────────────────────
  let expandedKeys = new Set();

  function toggleExpand(key) {
    const next = new Set(expandedKeys);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    expandedKeys = next;
  }

  // ── Requirements (always interactive, independent of row edit) ───────────
  let reqEditingId = null;
  let reqEditText = '';
  let reqAddingFor = null;   // condition id currently showing the add input
  let reqAddText = '';

  function patchRequirement(conditionId, updated) {
    conditions = conditions.map(c => c.id === conditionId
      ? { ...c, requirements: c.requirements.map(r => r.id === updated.id ? updated : r) }
      : c
    );
  }

  const REQ_STATUS_OPTIONS = ['Outstanding', 'Complete'];

  async function setRequirementType(conditionId, r, newType) {
    try {
      const updated = await updateConditionRequirement(r.id, { requirement_type: newType || null });
      patchRequirement(conditionId, updated);
    } catch (err) {
      alert(err.message);
    }
  }

  async function setRequirementStatus(conditionId, r, newStatus) {
    try {
      const updated = await updateConditionRequirement(r.id, { status: newStatus });
      patchRequirement(conditionId, updated);
    } catch (err) {
      alert(err.message);
    }
  }

  function startReqEdit(r) {
    reqEditingId = r.id;
    reqEditText = r.requirement_text;
  }

  async function saveReqEdit(conditionId) {
    if (!reqEditText.trim()) return;
    try {
      const updated = await updateConditionRequirement(reqEditingId, { requirement_text: reqEditText.trim() });
      patchRequirement(conditionId, updated);
      reqEditingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeRequirement(conditionId, requirementId) {
    if (!confirm('Delete this requirement?')) return;
    try {
      await deleteConditionRequirement(requirementId);
      conditions = conditions.map(c => c.id === conditionId
        ? { ...c, requirements: c.requirements.filter(r => r.id !== requirementId) }
        : c
      );
    } catch (err) {
      alert(err.message);
    }
  }

  function startReqAdd(conditionId) {
    reqAddingFor = conditionId;
    reqAddText = '';
  }

  async function saveReqAdd(conditionId) {
    if (!reqAddText.trim()) { reqAddingFor = null; return; }
    try {
      const created = await createConditionRequirement(conditionId, { requirement_text: reqAddText.trim() });
      conditions = conditions.map(c => c.id === conditionId
        ? { ...c, requirements: [...c.requirements, created] }
        : c
      );
      reqAddText = '';
      reqAddingFor = null;
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Advancements ──────────────────────────────────────────────────────────
  let showAddAdvancement = false;
  let advPreselectId = null;

  function sortAdvancements(arr) {
    return [...arr].sort((a, b) =>
      (b.advancement_date || '').localeCompare(a.advancement_date || '') || b.id - a.id
    );
  }

  function openAddAdvancement(conditionId = null) {
    advPreselectId = conditionId;
    showAddAdvancement = true;
  }

  function handleAdvancementsDone(e) {
    for (const row of e.detail.rows) {
      conditions = conditions.map(c => c.id === row.condition_id
        ? { ...c, advancements: sortAdvancements([...(c.advancements || []), row]) }
        : c
      );
    }
  }

  // ── Surveyor picker for the Original Consultant field ─────────────────────
  // Opens from a row directly (saves immediately) or from edit mode (fills the form)
  let showSurveyorPicker = false;
  let pickerForConditionId = null;   // null = picking for the edit form

  function openSurveyorPicker(conditionId = null) {
    pickerForConditionId = conditionId;
    showSurveyorPicker = true;
  }

  async function handleSurveyorPick(e) {
    const s = e.detail;
    const name = s.contactName || s.surveyorOrganisation || '';
    const email = s.contactEmail || '';
    if (pickerForConditionId != null) {
      try {
        const updated = await updateCondition(pickerForConditionId, {
          original_consultant: name || null,
          original_consultant_email: email || null,
        });
        conditions = conditions.map(x => x.id === pickerForConditionId
          ? { ...x, ...updated, requirements: x.requirements, advancements: x.advancements }
          : x
        );
      } catch (err) {
        alert(err.message);
      }
    } else {
      editForm.original_consultant = name;
      editForm.original_consultant_email = email;
    }
    pickerForConditionId = null;
    showSurveyorPicker = false;
  }

  // ── Fee quote email ───────────────────────────────────────────────────────
  let emailCondition = null;
  let showEmailModal = false;
  let showBulkFeeQuote = false;

  function openEmailCompose(c) {
    emailCondition = c;
    showEmailModal = true;
  }

  // ── Fee quote sent (confirmed from the email modals) ──────────────────────
  function handleFeeQuoteSent(e) {
    const { condition: updated, advancements: advRows } = e.detail;
    conditions = conditions.map(x => x.id === updated.id
      ? { ...x, ...updated, requirements: x.requirements, advancements: x.advancements }
      : x
    );
    if (advRows?.length) handleAdvancementsDone({ detail: { rows: advRows } });
  }

  // ── Timeline drawer ───────────────────────────────────────────────────────
  let timelineConditionId = null;
  $: timelineCondition = conditions.find(c => c.id === timelineConditionId) || null;

  function openTimeline(c) { timelineConditionId = c.id; }

  // ── Linked quotes (from surveyor management) ──────────────────────────────
  // Quote actions, key dates and instruction-status changes all interleave
  // with the condition's own advancements, read-only — each merged live from
  // its own source rather than duplicated into condition_advancements.
  function mergedTimeline(c) {
    const own = (c.advancements || []).map(a => ({ ...a, _kind: 'condition' }));
    const fromQuotes = (c.linked_quotes || []).flatMap(q =>
      (q.actions || []).map(a => ({
        id: `q-${a.id}`,
        advancement_date: a.action_date,
        summary: a.summary,
        full_text: a.full_text,
        source_type: a.source_type,
        _kind: 'quote',
        _org: q.organisation || 'Quote',
      }))
    );
    const fromKeyDates = (c.linked_quotes || []).flatMap(q =>
      (q.key_dates || []).map(kd => ({
        id: `kd-${kd.id}`,
        advancement_date: kd.date,
        summary: kd.title,
        full_text: null,
        _kind: 'key_date',
        _org: q.organisation || 'Quote',
      }))
    );
    const fromInstructionStatus = (c.linked_quotes || [])
      .filter(q => q.instruction_status_changed_at)
      .map(q => ({
        id: `is-${q.quote_id}`,
        advancement_date: String(q.instruction_status_changed_at).slice(0, 10),
        summary: `Instruction status: ${q.instruction_status}`,
        full_text: null,
        _kind: 'instruction_status',
        _org: q.organisation || 'Quote',
      }));
    return [...own, ...fromQuotes, ...fromKeyDates, ...fromInstructionStatus].sort((a, b) =>
      String(b.advancement_date || '').localeCompare(String(a.advancement_date || ''))
      || String(b.id).localeCompare(String(a.id))
    );
  }

  $: tlMerged = timelineCondition ? mergedTimeline(timelineCondition) : [];

  let showQuotePicker = false;
  let projectQuotes = [];
  let quotesLoading = false;
  let quotesLoaded = false;

  async function toggleQuotePicker() {
    showQuotePicker = !showQuotePicker;
    if (showQuotePicker && !quotesLoaded) {
      quotesLoading = true;
      try {
        const data = await getProjectQuotesForConditions(projectId);
        projectQuotes = data.quotes;
        quotesLoaded = true;
      } catch (err) {
        alert(err.message);
      } finally {
        quotesLoading = false;
      }
    }
  }

  function quoteMatchesConsultant(q, c) {
    const name = (c?.original_consultant || '').trim().toLowerCase();
    if (!name) return false;
    const org = (q.organisation || '').trim().toLowerCase();
    const contact = (q.contact_name || '').trim().toLowerCase();
    return (org && (org.includes(name) || name.includes(org)))
        || (contact && (contact.includes(name) || name.includes(contact)));
  }

  // Likely matches (same org/contact as the condition's consultant) float to the top
  $: pickerQuotes = timelineCondition
    ? [...projectQuotes].sort((a, b) =>
        (quoteMatchesConsultant(b, timelineCondition) ? 1 : 0) - (quoteMatchesConsultant(a, timelineCondition) ? 1 : 0))
    : projectQuotes;

  function isQuoteLinked(quoteId) {
    return (timelineCondition?.linked_quotes || []).some(q => q.quote_id === quoteId);
  }

  // Reload without the loading spinner (keeps the drawer open and fresh)
  async function refreshData() {
    try {
      const data = await getConditionsData(projectId);
      conditions = data.conditions;
      meta = data.meta;
    } catch (err) {
      console.error('conditions refresh failed:', err);
    }
  }

  async function handleLinkQuote(quoteId) {
    try {
      await linkConditionQuote(timelineConditionId, quoteId);
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleUnlinkQuote(quoteId) {
    try {
      await unlinkConditionQuote(timelineConditionId, quoteId);
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  }

  function formatQuoteTotal(total) {
    const n = Number(total);
    return Number.isFinite(n) && n > 0 ? `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : null;
  }
  function closeTimeline() {
    timelineConditionId = null;
    tlEditingId = null;
    showTlAdd = false;
    showQuotePicker = false;
  }

  // Add form inside the drawer
  let showTlAdd = false;
  let tlAddForm = { advancement_date: '', source_type: 'note', summary: '', full_text: '', quote_id: null };
  let tlAddReqIds = {};   // requirement_id -> bool, for the drawer add form
  let tlAddSaving = false;
  let tlAddGenerating = false;
  let tlAddGenerated = false;
  let tlAddError = null;

  function openTlAdd() {
    // Default the "relevant quote" tag: auto-select when there's exactly one
    // linked quote, otherwise leave untagged and let the picker force a choice.
    const linked = timelineCondition?.linked_quotes || [];
    tlAddForm = {
      advancement_date: new Date().toISOString().slice(0, 10),
      source_type: 'note',
      summary: '',
      full_text: '',
      quote_id: linked.length === 1 ? linked[0].quote_id : null,
    };
    tlAddReqIds = {};
    tlAddError = null;
    tlAddGenerated = false;
    showTlAdd = true;
  }

  function tlSelectedReqIds() {
    return Object.entries(tlAddReqIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10));
  }

  $: tlCanGenerate = !tlAddForm.summary.trim() && tlAddForm.full_text.trim().length > 0;
  $: tlCanSave = tlAddForm.summary.trim().length > 0;

  // Fill the blank summary from the source text (wording, reason and previous
  // advancements are read server-side). No-ops once a summary is typed.
  async function generateTlSummary() {
    if (tlAddForm.summary.trim() || !tlAddForm.full_text.trim()) return;
    tlAddGenerating = true;
    tlAddError = null;
    try {
      const { suggestions } = await suggestConditionAdvancementSummaries(projectId, {
        full_text: tlAddForm.full_text,
        items: [{ condition_id: timelineConditionId, user_summary: null, requirement_ids: tlSelectedReqIds() }],
      });
      if (suggestions[0]?.summary) {
        tlAddForm = { ...tlAddForm, summary: suggestions[0].summary };
        tlAddGenerated = true;
      } else {
        tlAddError = 'Could not generate a summary - please type one.';
      }
    } catch (err) {
      tlAddError = err.message;
    } finally {
      tlAddGenerating = false;
    }
  }

  async function saveTlAdd() {
    if (!tlAddForm.summary.trim()) {
      tlAddError = 'Type a summary, or use Generate & Fill Summary below.';
      return;
    }

    tlAddSaving = true;
    tlAddError = null;
    try {
      const rows = await createConditionAdvancements(projectId, {
        advancement_date: tlAddForm.advancement_date,
        full_text: tlAddForm.full_text.trim() || null,
        source_type: tlAddForm.source_type,
        items: [{ condition_id: timelineConditionId, summary: tlAddForm.summary.trim(), requirement_ids: tlSelectedReqIds(), quote_id: tlAddForm.quote_id || null }],
      });
      handleAdvancementsDone({ detail: { rows } });
      showTlAdd = false;
    } catch (err) {
      tlAddError = err.message;
    } finally {
      tlAddSaving = false;
    }
  }

  // Inline edit of a timeline entry
  let tlEditingId = null;
  let tlEditForm = {};

  function startTlEdit(a) {
    tlEditingId = a.id;
    const reqIds = {};
    for (const id of a.requirement_ids || []) reqIds[id] = true;
    tlEditForm = {
      advancement_date: a.advancement_date ? a.advancement_date.split('T')[0] : '',
      source_type: a.source_type || 'note',
      summary: a.summary || '',
      full_text: a.full_text || '',
      quote_id: a.quote_id || null,
      reqIds,
    };
  }

  async function saveTlEdit(conditionId) {
    try {
      const updated = await updateConditionAdvancement(tlEditingId, {
        advancement_date: tlEditForm.advancement_date || null,
        summary: tlEditForm.summary || null,
        full_text: tlEditForm.full_text || null,
        source_type: tlEditForm.source_type || null,
        quote_id: tlEditForm.quote_id || null,
        requirement_ids: Object.entries(tlEditForm.reqIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10)),
      });
      conditions = conditions.map(c => c.id === conditionId
        ? { ...c, advancements: sortAdvancements(c.advancements.map(a => a.id === updated.id ? updated : a)) }
        : c
      );
      tlEditingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeAdvancement(conditionId, advancementId) {
    if (!confirm('Delete this advancement?')) return;
    try {
      await deleteConditionAdvancement(advancementId);
      conditions = conditions.map(c => c.id === conditionId
        ? { ...c, advancements: c.advancements.filter(a => a.id !== advancementId) }
        : c
      );
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Copy for Excel ────────────────────────────────────────────────────────
  // Grid matching the user's Excel template (paste at A9):
  // A Number | B Title | C Wording | D Reason | E Separated Requirement |
  // F Initial actions/notes | G Proposed Discharge Programme (blank) | H Progress (blank)
  // One row per requirement; condition cells only on the first row of each group.
  async function handleCopyForExcel() {
    if (!conditions.length) { alert('No conditions to copy.'); return; }

    const esc = (t) => String(t ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // mso-data-placement keeps in-cell line breaks inside ONE Excel cell
    const cellHtml = (t, { fill = null, bold = false } = {}) =>
      `<td style="vertical-align:top;border:0.5pt solid #000;${fill ? `background:${fill};` : ''}${bold ? 'font-weight:bold;' : ''}">${esc(t).replace(/\n/g, '<br style="mso-data-placement:same-cell;">')}</td>`;
    const tsvCell = (t) => {
      const s = String(t ?? '');
      return /[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    // Basic solid fills for the Condition Wording cell, keyed to type
    const WORDING_FILLS = {
      'Pre-Commencement': '#FF0000',
      'Pre-Beneficial Use': '#00B0F0',
      'Action Required (not Pre-Commencement)': '#FFC000',
      'Compliance': '#92D050',
      'Informative': '#92D050',
    };

    const HEADERS = [
      'Number',
      'Title',
      'Condition Wording',
      'Reason',
      'Separated Condition Requirements (where applicable)',
      'Req. Type',
      'Initial Actions/Notes',
      'Proposed Discharge Programme',
      'Progress',
    ];

    const htmlRows = [`<tr>${HEADERS.map(h => cellHtml(h, { bold: true })).join('')}</tr>`];
    const tsvRows = [HEADERS.map(tsvCell).join('\t')];
    for (const c of sortedConditions) {
      const wordingFill = WORDING_FILLS[c.condition_type] || null;
      const reqs = c.requirements?.length ? c.requirements : [null];
      reqs.forEach((r, i) => {
        const first = i === 0;
        const vals = [
          first ? (c.condition_number || '') : '',
          first ? (c.title || '') : '',
          first ? (c.wording || '') : '',
          first ? (c.reason || '') : '',
          r ? r.requirement_text : '',
          r ? (r.requirement_type || '') : '',
          first ? (c.initial_actions || '') : '',
          '',   // Proposed Discharge Programme — left blank
          '',   // Progress — left blank
        ];
        const reqTypeFill = r ? WORDING_FILLS[r.requirement_type] || null : null;
        const cells = vals.map((v, col) => cellHtml(v, {
          bold: col === 1 && first,                          // Title cell bold
          fill: col === 2 && first ? wordingFill             // Wording cell coloured by condition type
              : col === 5 ? reqTypeFill                      // Req. Type cell coloured by requirement type
              : null,
        }));
        htmlRows.push(`<tr>${cells.join('')}</tr>`);
        tsvRows.push(vals.map(tsvCell).join('\t'));
      });
    }

    const html = `<table>${htmlRows.join('')}</table>`;
    const tsv = tsvRows.join('\r\n');

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      alert('Copied (header row included). In your Excel template, click the cell where the header row should sit and paste (Ctrl+V).');
    } catch (err) {
      alert('Failed to copy: ' + err.message);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExportPdf() {
    if (!conditions.length) { alert('No conditions to export.'); return; }
    // Progress column includes linked quote actions, interleaved by date
    exportConditionsPdf(project, sortedConditions.map(c => ({ ...c, advancements: mergedTimeline(c) })));
    try {
      const updated = await markConditionsExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

  // ── PDF export options modal (Conditions Tracker + optional surveyor
  // management sections bundled into the same document) ─────────────────────
  let showExportModal = false;

  async function handleExportModalSubmit(event) {
    const { includeQuotes, includeInstructed, includeProgramme } = event.detail;
    showExportModal = false;
    if (!conditions.length) { alert('No conditions to export.'); return; }

    const conditionsWithProgress = sortedConditions.map(c => ({ ...c, advancements: mergedTimeline(c) }));

    if (!includeQuotes && !includeInstructed && !includeProgramme) {
      exportConditionsPdf(project, conditionsWithProgress);
    } else {
      const pid = project?.unique_id;
      const needsQuotes = includeQuotes || includeInstructed || includeProgramme;
      try {
        const [quotesData, sentRequestsData, actionsData, programmeEventsData, quoteKeyDatesData] = await Promise.all([
          needsQuotes ? getQuotes({ projectId: pid }) : Promise.resolve([]),
          includeQuotes ? getSentRequestsForProject(pid) : Promise.resolve([]),
          includeInstructed ? getQuoteActions(pid) : Promise.resolve([]),
          includeProgramme ? getProgrammeEvents(pid) : Promise.resolve([]),
          (includeInstructed || includeProgramme) ? getQuoteKeyDates(pid) : Promise.resolve([]),
        ]);

        const instructedQuotes = quotesData.filter(
          q => q.instruction_status === 'instructed' || q.instruction_status === 'partially instructed'
        );
        const actionsByQuote = {};
        for (const a of actionsData) (actionsByQuote[a.quote_id] ||= []).push(a);

        exportConditionsWithExtras(
          project,
          conditionsWithProgress,
          { quotes: quotesData, sentRequests: sentRequestsData, instructedQuotes, actionsByQuote, programmeEvents: programmeEventsData, quoteKeyDates: quoteKeyDatesData },
          { includeQuotes, includeInstructed, includeProgramme }
        );
      } catch (err) {
        console.error('Failed to export combined PDF:', err);
        alert('Failed to export PDF: ' + err.message);
        return;
      }
    }

    try {
      const updated = await markConditionsExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

  async function handleExport() {
    if (!conditions.length) { alert('No conditions to export.'); return; }
    const html = buildExportHtml();
    await exportHtmlToWord(html, buildExportFilename(project, 'Conditions Tracker'));
    try {
      const updated = await markConditionsExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

  function buildExportHtml() {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t, span = 1) => `<td${span > 1 ? ` rowspan="${span}"` : ''} style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
    const rows = sortedConditions.map(c => {
      const reqs = c.requirements || [];
      const span = Math.max(1, reqs.length);
      const reqCells = (r) => r
        ? `${td(r.requirement_text)}${td(r.requirement_type || '')}${td(r.status || 'Outstanding')}`
        : `${td('')}${td('')}${td('')}`;
      const first = `<tr>
        ${td(c.condition_number, span)}
        ${td(c.title, span)}
        ${td(c.condition_type || '', span)}
        ${td((c.wording || '').replace(/\n/g, '<br>'), span)}
        ${td((c.reason || '').replace(/\n/g, '<br>'), span)}
        ${reqCells(reqs[0])}
        ${td([c.original_consultant, c.original_consultant_email].filter(Boolean).join('<br>'), span)}
        ${td(c.status || '', span)}
      </tr>`;
      const rest = reqs.slice(1).map(r => `<tr>${reqCells(r)}</tr>`).join('');
      return first + rest;
    }).join('');

    return `<h2>Conditions Tracker</h2>
<p>Project: ${project?.site_name || ''} | Exported: ${formatDate(new Date().toISOString())}</p>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('No.')}${th('Title')}${th('Type')}${th('Condition Wording')}${th('Reason')}${th('Separated Condition Requirements')}${th('Req. Type')}${th('Req. Status')}${th('Original Consultant')}${th('Status')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  async function handleIssueToClient() {
    try {
      const updated = await markConditionsIssuedToClient(projectId);
      meta = { ...meta, ...updated };
      alert('Marked as issued to client. (Email integration coming soon.)');
    } catch (err) {
      alert(err.message);
    }
  }
</script>

<ExportConditionsModal
  show={showExportModal}
  on:export={handleExportModalSubmit}
  on:close={() => showExportModal = false}
/>

<AddConditionsModal
  bind:show={showAddConditions}
  {projectId}
  startNumber={nextConditionNumber}
  on:done={handleAddDone}
  on:close={() => showAddConditions = false}
/>

<AddAdvancementModal
  bind:show={showAddAdvancement}
  {projectId}
  {conditions}
  preselectedConditionId={advPreselectId}
  on:done={handleAdvancementsDone}
  on:close={() => { showAddAdvancement = false; advPreselectId = null; }}
/>

<ConditionEmailModal
  bind:show={showEmailModal}
  {project}
  condition={emailCondition}
  on:sent={handleFeeQuoteSent}
  on:close={() => { showEmailModal = false; emailCondition = null; }}
/>

<BulkFeeQuoteModal
  bind:show={showBulkFeeQuote}
  {projectId}
  {project}
  conditions={sortedConditions}
  on:sent={handleFeeQuoteSent}
  on:close={() => showBulkFeeQuote = false}
/>

<SelectSurveyorModal
  show={showSurveyorPicker}
  selectedSurveyors={[]}
  on:select={handleSurveyorPick}
  on:close={() => { showSurveyorPicker = false; pickerForConditionId = null; }}
/>

<!-- ── Progress timeline drawer ───────────────────────────────────────────── -->
{#if timelineCondition}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="tl-overlay" on:click|self={closeTimeline}>
    <div class="tl-drawer">
      <div class="tl-header">
        <div class="tl-header-text">
          <h3 class="tl-title">
            {timelineCondition.condition_number ? `Condition ${timelineCondition.condition_number}: ` : ''}{timelineCondition.title}
          </h3>
          <p class="tl-subtitle">
            {tlMerged.length} progress entr{tlMerged.length !== 1 ? 'ies' : 'y'}
            {#if timelineCondition.condition_type}· {timelineCondition.condition_type}{/if}
          </p>
        </div>
        <button class="btn btn-icon btn-ghost" on:click={closeTimeline}><i class="las la-times"></i></button>
      </div>

      <div class="tl-body">
        <!-- Linked quotes from surveyor management -->
        <div class="tl-quotes">
          <div class="tl-quotes-hd">
            <span class="tl-quotes-label"><i class="las la-file-invoice-dollar"></i> Linked Quotes</span>
            <button class="ct-expand-btn" on:click={toggleQuotePicker}>
              {showQuotePicker ? 'Close' : '+ Link quote'}
            </button>
          </div>
          {#each timelineCondition.linked_quotes || [] as q (q.quote_id)}
            <div class="tl-quote-card">
              <div class="tl-quote-chip">
                <span class="tl-quote-org">{q.organisation || 'Quote'}</span>
                {#if q.discipline}<span class="tl-quote-meta">{q.discipline}</span>{/if}
                {#if formatQuoteTotal(q.quote_total)}<span class="tl-quote-meta">{formatQuoteTotal(q.quote_total)}</span>{/if}
                <button class="btn btn-icon btn-ghost tl-quote-unlink" title="Unlink quote" on:click={() => handleUnlinkQuote(q.quote_id)}>
                  <i class="las la-times"></i>
                </button>
              </div>
              <div class="tl-quote-statuses">
                {#if q.instruction_status}<span class="tl-quote-status-pill">Instruction: {q.instruction_status}</span>{/if}
                {#if q.work_status}<span class="tl-quote-status-pill">Work: {q.work_status}</span>{/if}
              </div>
              {#if q.key_dates?.length}
                <div class="tl-quote-keydates">
                  <span class="tl-quote-keydates-label">Key dates</span>
                  {#each q.key_dates as kd (kd.id)}
                    <span class="tl-quote-keydate">{kd.title} - {formatDate(kd.date)}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            {#if !showQuotePicker}
              <p class="tl-quotes-none">No quotes linked. Link one to pull its updates into this timeline.</p>
            {/if}
          {/each}
          {#if showQuotePicker}
            <div class="tl-quote-picker">
              {#if quotesLoading}
                <p class="tl-quotes-none">Loading quotes…</p>
              {:else}
                {#each pickerQuotes as q (q.id)}
                  {@const linked = isQuoteLinked(q.id)}
                  <div class="tl-quote-option" class:tl-quote-option-match={quoteMatchesConsultant(q, timelineCondition)}>
                    <div class="tl-quote-option-info">
                      <span class="tl-quote-org">{q.organisation || 'Unnamed quote'}</span>
                      <span class="tl-quote-meta">
                        {[q.discipline, q.status, formatQuoteTotal(q.total), q.contact_name].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <button class="btn btn-sm {linked ? 'btn-ghost' : 'btn-secondary'}" on:click={() => linked ? handleUnlinkQuote(q.id) : handleLinkQuote(q.id)}>
                      {linked ? 'Unlink' : 'Link'}
                    </button>
                  </div>
                {:else}
                  <p class="tl-quotes-none">No quotes recorded for this project yet.</p>
                {/each}
              {/if}
            </div>
          {/if}
        </div>

        {#if showTlAdd}
          <div class="tl-add-form">
            <div class="tl-add-row">
              <input type="date" class="form-input tl-input" bind:value={tlAddForm.advancement_date} />
              <select class="form-input tl-input" bind:value={tlAddForm.source_type}>
                <option value="note">Note</option>
                <option value="email">Email trail</option>
              </select>
            </div>
            {#if timelineCondition.requirements.length}
              <div class="tl-req-picker">
                <span class="tl-req-picker-label">Relates to (optional):</span>
                {#each timelineCondition.requirements as req (req.id)}
                  <label class="tl-req-check">
                    <input type="checkbox" checked={!!tlAddReqIds[req.id]} on:change={() => tlAddReqIds = { ...tlAddReqIds, [req.id]: !tlAddReqIds[req.id] }} />
                    <span>{req.requirement_text}</span>
                  </label>
                {/each}
              </div>
            {/if}
            {#if timelineCondition.linked_quotes?.length}
              <div class="tl-add-row">
                <span class="tl-req-picker-label">Relevant quote:</span>
                <select class="form-input tl-input" bind:value={tlAddForm.quote_id}>
                  <option value={null}>Not relevant to a quote</option>
                  {#each timelineCondition.linked_quotes as q (q.quote_id)}
                    <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <textarea class="form-input tl-input" rows="2" bind:value={tlAddForm.summary}
              placeholder="Summary - leave blank to auto-summarise from the text below…"></textarea>
            <textarea class="form-input tl-input" rows="5" bind:value={tlAddForm.full_text}
              placeholder={tlAddForm.source_type === 'email' ? 'Paste the email trail here…' : 'Fuller detail…'}></textarea>
            <div class="tl-generate-row">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                on:click={generateTlSummary}
                disabled={!tlCanGenerate || tlAddGenerating || tlAddSaving}
              >
                {#if tlAddGenerating}<span class="mini-spinner"></span> Generating…{:else}<i class="las la-magic"></i> Generate & Fill Summary{/if}
              </button>
              <span class="tl-generate-hint">Fills the summary above from this text - leave it if you've already typed one</span>
            </div>
            {#if tlAddGenerated}
              <div class="tl-notice"><i class="las la-magic"></i> Summary generated - review or edit it above.</div>
            {/if}
            {#if tlAddError}<div class="tl-error">{tlAddError}</div>{/if}
            <div class="tl-add-btns">
              <button class="btn btn-ghost btn-sm" on:click={() => showTlAdd = false} disabled={tlAddSaving || tlAddGenerating}>Cancel</button>
              <button
                class="btn btn-primary btn-sm"
                on:click={saveTlAdd}
                disabled={tlAddSaving || tlAddGenerating || !tlCanSave}
                title={!tlCanSave ? 'Type a summary or generate one first' : ''}
              >
                {tlAddSaving ? 'Saving…' : 'Save Advancement'}
              </button>
            </div>
          </div>
        {:else}
          <button class="tl-add-btn" on:click={openTlAdd}>
            <i class="las la-plus"></i> Add Advancement
          </button>
        {/if}

        {#if tlMerged.length === 0 && !showTlAdd}
          <p class="tl-empty">No advancements recorded yet.</p>
        {/if}

        <div class="tl-entries">
          {#each tlMerged as a (a.id)}
            <div class="tl-entry">
              <div class="tl-entry-marker"
                class:tl-entry-marker-quote={a._kind === 'quote'}
                class:tl-entry-marker-keydate={a._kind === 'key_date'}
                class:tl-entry-marker-status={a._kind === 'instruction_status'}
              ></div>
              <div class="tl-entry-content">
                {#if tlEditingId === a.id}
                  <div class="tl-add-row">
                    <input type="date" class="form-input tl-input" bind:value={tlEditForm.advancement_date} />
                    <select class="form-input tl-input" bind:value={tlEditForm.source_type}>
                      <option value="email">Email trail</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  {#if timelineCondition.requirements.length}
                    <div class="tl-req-picker">
                      <span class="tl-req-picker-label">Relates to (optional):</span>
                      {#each timelineCondition.requirements as req (req.id)}
                        <label class="tl-req-check">
                          <input type="checkbox" checked={!!tlEditForm.reqIds[req.id]} on:change={() => tlEditForm = { ...tlEditForm, reqIds: { ...tlEditForm.reqIds, [req.id]: !tlEditForm.reqIds[req.id] } }} />
                          <span>{req.requirement_text}</span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                  {#if timelineCondition.linked_quotes?.length}
                    <div class="tl-add-row">
                      <span class="tl-req-picker-label">Relevant quote:</span>
                      <select class="form-input tl-input" bind:value={tlEditForm.quote_id}>
                        <option value={null}>Not relevant to a quote</option>
                        {#each timelineCondition.linked_quotes as q (q.quote_id)}
                          <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                  <textarea class="form-input tl-input" rows="2" bind:value={tlEditForm.summary}></textarea>
                  <textarea class="form-input tl-input" rows="5" bind:value={tlEditForm.full_text} placeholder="Source text (optional)…"></textarea>
                  <div class="tl-add-btns">
                    <button class="btn btn-ghost btn-sm" on:click={() => tlEditingId = null}>Cancel</button>
                    <button class="btn btn-primary btn-sm" on:click={() => saveTlEdit(timelineCondition.id)}>Save</button>
                  </div>
                {:else}
                  <div class="tl-entry-head">
                    <span class="tl-entry-date">{formatDate(a.advancement_date)}</span>
                    {#if a._kind === 'condition' || a._kind === 'quote'}
                      <span class="tl-source-badge" class:tl-source-email={a.source_type === 'email'}>
                        <i class="las {a.source_type === 'email' ? 'la-envelope' : 'la-sticky-note'}"></i>
                        {a.source_type === 'email' ? 'Email trail' : 'Note'}
                      </span>
                    {/if}
                    {#if a._kind === 'condition' && a.quote_id}
                      {@const taggedQuote = timelineCondition.linked_quotes?.find(q => q.quote_id === a.quote_id)}
                      {#if taggedQuote}
                        <span class="tl-quote-badge" title="Tagged as relevant to this linked quote">
                          <i class="las la-link"></i> {taggedQuote.organisation || 'Quote'}
                        </span>
                      {/if}
                    {/if}
                    {#if a._kind === 'quote'}
                      <span class="tl-quote-badge" title="From the linked quote's actions log in surveyor management">
                        <i class="las la-file-invoice-dollar"></i> {a._org}
                      </span>
                    {/if}
                    {#if a._kind === 'key_date'}
                      <span class="tl-quote-badge tl-keydate-badge" title="Key date from the linked quote in surveyor management">
                        <i class="las la-calendar"></i> {a._org}
                      </span>
                    {/if}
                    {#if a._kind === 'instruction_status'}
                      <span class="tl-quote-badge tl-status-badge" title="Instruction status change from the linked quote in surveyor management">
                        <i class="las la-flag"></i> {a._org}
                      </span>
                    {/if}
                    {#if a._kind === 'condition'}
                      <div class="tl-entry-btns">
                        <button class="btn btn-icon btn-ghost" title="Edit" on:click={() => startTlEdit(a)}><i class="las la-pen"></i></button>
                        <button class="btn btn-icon btn-danger-ghost" title="Delete" on:click={() => removeAdvancement(timelineCondition.id, a.id)}><i class="las la-trash"></i></button>
                      </div>
                    {/if}
                  </div>
                  {#if a._kind === 'condition' && a.requirement_ids?.length}
                    <div class="tl-req-tags">
                      {#each timelineCondition.requirements.filter(req => a.requirement_ids.includes(req.id)) as req (req.id)}
                        <span class="tl-req-tag" title={req.requirement_text}>
                          {req.requirement_text.length > 45 ? req.requirement_text.slice(0, 45) + '…' : req.requirement_text}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  <p class="tl-entry-summary">{a.summary}</p>
                  {#if a.full_text}
                    <details class="tl-full-text">
                      <summary>View source text</summary>
                      <pre class="tl-full-text-body">{a.full_text}</pre>
                    </details>
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<svelte:window on:keydown={handleFullscreenKeydown} />

<!-- ── Conditions tracker content ─────────────────────────────────────────── -->
<div class="ct-tab" class:ct-fullscreen={isFullscreen}>

  <!-- Top bar -->
  <div class="ct-topbar">
    <div class="ct-topbar-left">
      <button class="btn btn-primary" on:click={() => showAddConditions = true}>
        <i class="las la-plus"></i> Add Conditions
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => openAddAdvancement()} disabled={!conditions.length}>
        <i class="las la-history"></i> Add Advancement
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => showBulkFeeQuote = true} disabled={!conditions.length} title="Draft a fee quote email for each condition (beta)">
        <i class="las la-flask"></i> Draft Fee Quote Emails
      </button>
    </div>
    <div class="ct-topbar-right">
      <div class="ct-meta-badges">
        {#if meta.last_exported_at}
          <span class="ct-meta-badge"><i class="las la-download"></i> Exported {formatDateTime(meta.last_exported_at)}</span>
        {/if}
        {#if meta.last_issued_to_client_at}
          <span class="ct-meta-badge ct-meta-badge-issued"><i class="las la-paper-plane"></i> Issued {formatDateTime(meta.last_issued_to_client_at)}</span>
        {/if}
      </div>
      <button class="btn btn-secondary btn-sm" on:click={handleCopyForExcel} disabled={!conditions.length} title="Copy the table as a grid to paste into the Excel template at cell A9">
        <i class="las la-table"></i> Copy for Excel
      </button>
      <button class="btn btn-secondary btn-sm" on:click={handleExport} disabled={!conditions.length}>
        <i class="las la-file-word"></i> Word
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => showExportModal = true} disabled={!conditions.length}>
        <i class="las la-file-pdf"></i> PDF
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => isFullscreen = !isFullscreen} title={isFullscreen ? 'Exit full screen (Esc)' : 'Open the tracker full screen'}>
        <i class="las {isFullscreen ? 'la-compress' : 'la-expand'}"></i> {isFullscreen ? 'Exit' : 'Full Screen'}
      </button>
    </div>
  </div>

  <!-- Loading / error / empty -->
  {#if loading}
    <div class="ct-state"><span class="ct-spinner"></span><p>Loading…</p></div>
  {:else if error}
    <div class="ct-state ct-state-error"><i class="las la-exclamation-triangle"></i><p>{error}</p></div>
  {:else if conditions.length === 0}
    <div class="ct-empty">
      <i class="las la-clipboard-list ct-empty-icon"></i>
      <p class="ct-empty-title">No conditions yet</p>
      <p class="ct-empty-hint">Add the conditions from the decision notice - several at once, one per row.</p>
      <button class="btn btn-primary btn-sm" on:click={() => showAddConditions = true}><i class="las la-plus"></i> Add Conditions</button>
    </div>
  {:else}

    <!-- Table -->
    <div class="ct-scroll-top" bind:this={scrollTopEl}><div class="ct-scroll-top-inner"></div></div>
    <div class="ct-table-wrapper" bind:this={tableWrapperEl}>
      <table class="ct-table" bind:this={tableEl}>
        <thead>
          <tr>
            <th class="ct-th ct-th-number">
              <button class="ct-th-sort" class:ct-th-sort-active={sortKey === 'number'} on:click={() => setSort('number')}>
                No. <i class="las {sortKey === 'number' && sortDir === 'desc' ? 'la-arrow-down' : 'la-arrow-up'}"></i>
              </button>
            </th>
            <th class="ct-th ct-th-title">
              <button class="ct-th-sort" class:ct-th-sort-active={sortKey === 'title'} on:click={() => setSort('title')}>
                Title <i class="las {sortKey === 'title' && sortDir === 'desc' ? 'la-arrow-down' : 'la-arrow-up'}"></i>
              </button>
            </th>
            <th class="ct-th ct-th-type">
              <button class="ct-th-sort" class:ct-th-sort-active={sortKey === 'type'} on:click={() => setSort('type')} title="Pre-Commencement first, then Action Required, then Pre-Beneficial Use, Informative last">
                Type <i class="las {sortKey === 'type' && sortDir === 'desc' ? 'la-arrow-down' : 'la-arrow-up'}"></i>
              </button>
            </th>
            <th class="ct-th ct-th-wording">Condition Wording</th>
            <th class="ct-th ct-th-reason">Reason</th>
            <th class="ct-th ct-th-req" title="Where applicable - split a condition into its separate parts">Separated Condition Requirements</th>
            <th class="ct-th ct-th-reqtype">Req. Type</th>
            <th class="ct-th ct-th-reqstatus">Req. Status</th>
            <th class="ct-th ct-th-initial">TRP Internal Notes</th>
            <th class="ct-th ct-th-consultant">Original Consultant</th>
            <th class="ct-th ct-th-progress">Progress</th>
            <th class="ct-th ct-th-status">Status</th>
            <th class="ct-th ct-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each sortedConditions as c (c.id)}
            {@const editing = editingId === c.id}
            {@const reqRows = c.requirements.length ? c.requirements : [null]}
            {@const span = reqRows.length}
            {@const done = c.status === 'Discharged' || c.condition_type === 'Informative' || c.condition_type === 'Compliance'}
            {#each reqRows as r, ri (r ? `r-${r.id}` : `e-${c.id}`)}
            <tr
              class="ct-row"
              class:ct-row-editing={editing}
              class:ct-row-done={done}
            >

              {#if ri === 0}
              <!-- No. -->
              <td class="ct-td ct-td-number" rowspan={span}>
                {#if editing}
                  <input type="text" class="form-input ct-cell-input" bind:value={editForm.condition_number} />
                {:else}
                  <span class="ct-number">{c.condition_number || '—'}</span>
                {/if}
              </td>

              <!-- Title -->
              <td class="ct-td ct-td-title" rowspan={span}>
                {#if editing}
                  <input type="text" class="form-input ct-cell-input" bind:value={editForm.title} />
                {:else}
                  <span class="ct-title-text">{c.title}</span>
                  {#if c.source_file_name}
                    <span class="ct-source-file" title={c.source_file_name}><i class="las la-file-alt"></i></span>
                  {/if}
                {/if}
              </td>

              <!-- Type -->
              <td class="ct-td ct-td-type" rowspan={span}>
                <select
                  class="form-input ct-type-select"
                  class:ct-type-precomm={(editing ? editForm.condition_type : c.condition_type) === 'Pre-Commencement'}
                  class:ct-type-prebeneficial={(editing ? editForm.condition_type : c.condition_type) === 'Pre-Beneficial Use'}
                  class:ct-type-actionreq={(editing ? editForm.condition_type : c.condition_type) === 'Action Required (not Pre-Commencement)'}
                  class:ct-type-compliance={(editing ? editForm.condition_type : c.condition_type) === 'Compliance'}
                  class:ct-type-informative={(editing ? editForm.condition_type : c.condition_type) === 'Informative'}
                  value={editing ? editForm.condition_type : (c.condition_type || '')}
                  on:change={e => {
                    if (editing) {
                      editForm.condition_type = e.target.value;
                      if (typeImpliesNA(e.target.value)) editForm.status = 'N/A';
                    } else {
                      updateType(c, e.target.value);
                    }
                  }}
                >
                  <option value="">Select type</option>
                  {#each TYPE_OPTIONS as t}<option value={t}>{t}</option>{/each}
                </select>
              </td>

              <!-- Condition Wording -->
              <td class="ct-td ct-td-wording" rowspan={span}>
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.wording} rows="5"></textarea>
                {:else}
                  {#if c.wording}
                    {@const key = `${c.id}-wording`}
                    {@const expanded = expandedKeys.has(key)}
                    {@const needsTrunc = c.wording.length > 280}
                    <p class="ct-long-text">
                      {expanded || !needsTrunc ? c.wording : c.wording.slice(0, 280) + '…'}
                    </p>
                    {#if needsTrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand(key)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Reason -->
              <td class="ct-td ct-td-reason" rowspan={span}>
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.reason} rows="4"></textarea>
                {:else}
                  {#if c.reason}
                    {@const key = `${c.id}-reason`}
                    {@const expanded = expandedKeys.has(key)}
                    {@const needsTrunc = c.reason.length > 180}
                    <p class="ct-long-text">
                      {expanded || !needsTrunc ? c.reason : c.reason.slice(0, 180) + '…'}
                    </p>
                    {#if needsTrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand(key)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              {/if}

              <!-- Requirement (one per sub-row) -->
              <td class="ct-td ct-td-req" class:ct-td-internal={ri < span - 1}>
                {#if r}
                  {#if reqEditingId === r.id}
                    <div class="ct-req-add-row">
                      <input
                        type="text"
                        class="form-input ct-cell-input"
                        bind:value={reqEditText}
                        on:keydown={(e) => { if (e.key === 'Enter') saveReqEdit(c.id); if (e.key === 'Escape') reqEditingId = null; }}
                      />
                      <div class="ct-req-btns">
                        <button class="btn btn-icon btn-primary" title="Save" on:click={() => saveReqEdit(c.id)}><i class="las la-check"></i></button>
                        <button class="btn btn-icon btn-ghost" title="Cancel" on:click={() => reqEditingId = null}><i class="las la-times"></i></button>
                      </div>
                    </div>
                  {:else}
                    <div class="ct-req-line">
                      <span class="ct-req-text" class:ct-req-text-complete={r.status === 'Complete'}>{r.requirement_text}</span>
                      <div class="ct-req-btns ct-req-hover-btns">
                        <button class="btn btn-icon btn-ghost" title="Edit requirement" on:click={() => startReqEdit(r)}><i class="las la-pen"></i></button>
                        <button class="btn btn-icon btn-danger-ghost" title="Delete requirement" on:click={() => removeRequirement(c.id, r.id)}><i class="las la-trash"></i></button>
                      </div>
                    </div>
                  {/if}
                {:else if reqAddingFor !== c.id}
                  <span class="ct-cell-muted">No separated requirements</span>
                {/if}
                {#if ri === span - 1}
                  {#if reqAddingFor === c.id}
                    <div class="ct-req-add-row">
                      <input
                        type="text"
                        class="form-input ct-cell-input"
                        bind:value={reqAddText}
                        placeholder="New requirement…"
                        on:keydown={(e) => { if (e.key === 'Enter') saveReqAdd(c.id); if (e.key === 'Escape') reqAddingFor = null; }}
                      />
                      <div class="ct-req-btns">
                        <button class="btn btn-icon btn-primary" title="Add" on:click={() => saveReqAdd(c.id)}><i class="las la-check"></i></button>
                        <button class="btn btn-icon btn-ghost" title="Cancel" on:click={() => reqAddingFor = null}><i class="las la-times"></i></button>
                      </div>
                    </div>
                  {:else}
                    <button class="ct-expand-btn ct-req-add-btn" on:click={() => startReqAdd(c.id)}>
                      + Add requirement
                    </button>
                  {/if}
                {/if}
              </td>

              <!-- Requirement type (one per sub-row) -->
              <td class="ct-td ct-td-reqtype" class:ct-td-internal={ri < span - 1}>
                {#if r}
                  <select
                    class="form-input ct-type-select"
                    class:ct-type-precomm={r.requirement_type === 'Pre-Commencement'}
                    class:ct-type-prebeneficial={r.requirement_type === 'Pre-Beneficial Use'}
                    class:ct-type-actionreq={r.requirement_type === 'Action Required (not Pre-Commencement)'}
                    class:ct-type-compliance={r.requirement_type === 'Compliance'}
                    class:ct-type-informative={r.requirement_type === 'Informative'}
                    value={r.requirement_type || ''}
                    on:change={e => setRequirementType(c.id, r, e.target.value)}
                  >
                    <option value="">Select type</option>
                    {#each TYPE_OPTIONS as t}<option value={t}>{t}</option>{/each}
                  </select>
                {:else}
                  <span class="ct-cell-muted">—</span>
                {/if}
              </td>

              <!-- Requirement status (one per sub-row) -->
              <td class="ct-td ct-td-reqstatus" class:ct-td-internal={ri < span - 1}>
                {#if r}
                  <select
                    class="form-input ct-reqstatus-select"
                    class:ct-reqstatus-complete={r.status === 'Complete'}
                    value={r.status || 'Outstanding'}
                    on:change={e => setRequirementStatus(c.id, r, e.target.value)}
                  >
                    {#each REQ_STATUS_OPTIONS as s}<option value={s}>{s}</option>{/each}
                  </select>
                {:else}
                  <span class="ct-cell-muted">—</span>
                {/if}
              </td>

              {#if ri === 0}
              <!-- Initial Actions -->
              <td class="ct-td ct-td-initial" rowspan={span}>
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.initial_actions} rows="4"></textarea>
                {:else}
                  {#if c.initial_actions}
                    <span class="ct-initial-text">{c.initial_actions}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Original Consultant -->
              <td class="ct-td ct-td-consultant" rowspan={span}>
                {#if editing}
                  <div class="ct-consultant-edit-row">
                    <input type="text" class="form-input ct-cell-input" bind:value={editForm.original_consultant} placeholder="Name / organisation" />
                    <button class="btn btn-icon btn-secondary" type="button" title="Select a surveyor" on:click={() => openSurveyorPicker(null)}>
                      <i class="las la-address-book"></i>
                    </button>
                  </div>
                  <input type="email" class="form-input ct-cell-input" bind:value={editForm.original_consultant_email} placeholder="email" style="margin-top:4px" />
                {:else}
                  <div class="ct-consultant-display">
                    <div class="ct-consultant-info">
                      {#if c.original_consultant || c.original_consultant_email}
                        {#if c.original_consultant}
                          <span class="ct-consultant-name">{c.original_consultant}</span>
                        {/if}
                        {#if c.original_consultant_email}
                          <a class="ct-consultant-email" href="mailto:{c.original_consultant_email}">{c.original_consultant_email}</a>
                        {/if}
                      {:else}
                        <span class="ct-cell-muted">—</span>
                      {/if}
                    </div>
                    <button class="btn btn-icon btn-ghost ct-consultant-pick" type="button" title="Select a surveyor" on:click={() => openSurveyorPicker(c.id)}>
                      <i class="las la-address-book"></i>
                    </button>
                  </div>
                {/if}
              </td>

              <!-- Progress (condition advancements + linked quote actions) -->
              <td class="ct-td ct-td-progress" rowspan={span}>
                {#if mergedTimeline(c).length}
                  {@const merged = mergedTimeline(c)}
                  {@const latest = merged[0]}
                  <button class="ct-progress-cell" on:click={() => openTimeline(c)} title="View full progress timeline">
                    <span class="ct-progress-date">
                      {formatDate(latest.advancement_date)}
                      {#if latest._kind === 'quote'}<i class="las la-file-invoice-dollar" title="From linked quote"></i>{/if}
                    </span>
                    <span class="ct-progress-summary">{latest.summary.length > 90 ? latest.summary.slice(0, 90) + '…' : latest.summary}</span>
                    <span class="ct-progress-count">{merged.length} update{merged.length !== 1 ? 's' : ''}</span>
                  </button>
                {:else}
                  <button class="ct-progress-empty" on:click={() => openAddAdvancement(c.id)} title="Add first advancement">
                    <i class="las la-plus"></i> Add
                  </button>
                {/if}
              </td>

              <!-- Status -->
              <td class="ct-td ct-td-status" rowspan={span}>
                <select
                  class="form-input ct-status-select {statusClass(editing ? editForm.status : c.status)}"
                  value={editing ? editForm.status : (c.status || 'Not Started')}
                  on:change={e => editing
                    ? (editForm.status = e.target.value)
                    : updateStatus(c, e.target.value)}
                >
                  {#each STATUS_OPTIONS as s}<option value={s}>{s}</option>{/each}
                </select>
              </td>

              <!-- Actions -->
              <td class="ct-td ct-td-actions" rowspan={span}>
                {#if editing}
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-primary" on:click={() => saveEdit(c.id)} title="Save"><i class="las la-check"></i></button>
                    <button class="btn btn-icon btn-ghost" on:click={() => editingId = null} title="Cancel"><i class="las la-times"></i></button>
                  </div>
                {:else}
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-ghost" on:click={() => startEdit(c)} title="Edit"><i class="las la-pen"></i></button>
                    <button class="btn btn-icon btn-ghost" on:click={() => openEmailCompose(c)} title="Compose fee quote email"><i class="las la-envelope"></i></button>
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => removeCondition(c.id)} title="Delete"><i class="las la-trash"></i></button>
                  </div>
                {/if}
              </td>
              {/if}

            </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>

    <p class="ct-count">{conditions.length} condition{conditions.length !== 1 ? 's' : ''}</p>
  {/if}

</div>

<style>
  /* ── Layout ─────────────────────────────────────────────────────────────── */
  .ct-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0;
    min-height: 200px;
  }

  /* Full screen: lift the whole tracker over the project modal (its own
     modals/drawer all sit at z-index 2000+ so they still open on top) */
  .ct-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 1500;
    background: #fff;
    padding: 1.25rem 1.75rem;
    margin: 0;
    overflow-y: auto;
  }

  /* In full screen, fit the table to the viewport: drop the fixed min-width,
     shrink column minimums and padding so it all shows without side-scrolling
     on a normal monitor (scrollbar only returns if the window is too narrow) */
  .ct-fullscreen .ct-table {
    min-width: 100%;
    font-size: 0.75rem;
  }
  .ct-fullscreen .ct-th,
  .ct-fullscreen .ct-td { padding: 0.5rem 0.5rem; }
  .ct-fullscreen .ct-th-number       { width: 46px; }
  .ct-fullscreen .ct-th-title        { min-width: 110px; }
  .ct-fullscreen .ct-th-type         { min-width: 105px; }
  .ct-fullscreen .ct-th-wording      { min-width: 190px; max-width: none; }
  .ct-fullscreen .ct-th-reason       { min-width: 130px; }
  .ct-fullscreen .ct-th-req          { min-width: 150px; }
  .ct-fullscreen .ct-th-reqtype      { min-width: 100px; }
  .ct-fullscreen .ct-th-reqstatus    { min-width: 85px; }
  .ct-fullscreen .ct-th-initial      { min-width: 105px; }
  .ct-fullscreen .ct-th-consultant   { min-width: 105px; }
  .ct-fullscreen .ct-th-progress     { min-width: 130px; }
  .ct-fullscreen .ct-long-text,
  .ct-fullscreen .ct-req-text,
  .ct-fullscreen .ct-initial-text { font-size: 0.73rem; }
  /* Stop the long type option labels forcing their columns wide: fix the
     select width (full labels still show in the opened dropdown) */
  .ct-fullscreen .ct-type-select { width: 105px; }
  .ct-fullscreen .ct-status-select,
  .ct-fullscreen .ct-reqstatus-select { width: 85px; }

  /* ── Top bar ─────────────────────────────────────────────────────────────── */
  .ct-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .ct-topbar-left, .ct-topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .ct-meta-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .ct-meta-badge {
    font-size: 0.72rem;
    color: #64748b;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 2px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .ct-meta-badge-issued {
    color: #16a34a;
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
  .ct-issue-btn {
    opacity: 0.7;
  }

  /* ── States ─────────────────────────────────────────────────────────────── */
  .ct-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    color: #64748b;
    font-size: 0.875rem;
  }
  .ct-state-error { color: #dc2626; }
  .ct-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    text-align: center;
  }
  .ct-empty-icon { font-size: 2.5rem; color: #cbd5e1; }
  .ct-empty-title { font-size: 1rem; font-weight: 600; color: #475569; margin: 0; }
  .ct-empty-hint { font-size: 0.8rem; color: #94a3b8; margin: 0 0 0.5rem; }
  .ct-count {
    font-size: 0.75rem;
    color: #94a3b8;
    text-align: right;
    margin: 0;
  }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  .ct-scroll-top {
    overflow-x: auto;
    overflow-y: hidden;
    height: 12px;
  }
  .ct-scroll-top-inner { height: 1px; }

  .ct-table-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .ct-table {
    width: 100%;
    min-width: 1990px;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .ct-th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .ct-th-sort {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-transform: inherit;
    letter-spacing: inherit;
  }
  .ct-th-sort i { opacity: 0; font-size: 0.8rem; transition: opacity 0.15s; }
  .ct-th-sort:hover i { opacity: 0.45; }
  .ct-th-sort-active { color: #9333ea; }
  .ct-th-sort-active i { opacity: 1 !important; }
  .ct-th-number       { width: 60px; }
  .ct-th-title        { min-width: 160px; }
  .ct-th-type         { min-width: 150px; }
  .ct-th-wording      { min-width: 260px; max-width: 360px; }
  .ct-th-reason       { min-width: 180px; }
  .ct-th-req          { min-width: 220px; }
  .ct-th-reqtype      { min-width: 140px; }
  .ct-th-reqstatus    { min-width: 110px; }
  .ct-th-initial      { min-width: 160px; }
  .ct-th-consultant   { min-width: 150px; }
  .ct-th-progress     { min-width: 180px; }
  .ct-th-status       { min-width: 130px; }
  .ct-th-actions      { width: 72px; }

  .ct-row:hover { background: #f8fafc; }
  /* Solid border separates condition groups (rowspanned cells carry it at the
     bottom of the group); requirement sub-row separators are dashed */
  .ct-table tbody .ct-td { border-bottom: 1px solid #e2e8f0; }
  .ct-table tbody .ct-td.ct-td-internal { border-bottom: 1px dashed #e2e8f0; }

  /* Green when nothing left to do: discharged, or an informative */
  .ct-row-done td { background: #f0fdf4 !important; }
  .ct-row-done:hover td { background: #dcfce7 !important; }

  .ct-td {
    padding: 0.65rem 0.75rem;
    vertical-align: top;
    color: #334155;
  }

  .ct-number { font-weight: 600; color: #1e293b; }
  .ct-title-text { font-weight: 500; color: #1e293b; }
  .ct-source-file {
    margin-left: 4px;
    color: #94a3b8;
    font-size: 0.75rem;
  }
  .ct-cell-muted { color: #94a3b8; font-size: 0.78rem; }
  .ct-initial-text { font-size: 0.78rem; white-space: pre-wrap; }

  .ct-consultant-name {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: #1e293b;
  }
  .ct-consultant-email {
    display: block;
    font-size: 0.72rem;
    color: #3b82f6;
    text-decoration: none;
    word-break: break-all;
  }
  .ct-consultant-email:hover { text-decoration: underline; }
  .ct-consultant-edit-row {
    display: flex;
    gap: 4px;
    align-items: stretch;
  }
  .ct-consultant-edit-row .ct-cell-input { flex: 1; min-width: 0; }
  .ct-consultant-display {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }
  .ct-consultant-info { flex: 1; min-width: 0; }
  .ct-consultant-pick { visibility: hidden; flex-shrink: 0; }
  .ct-td-consultant:hover .ct-consultant-pick { visibility: visible; }

  /* ── Long text (wording / reason) ────────────────────────────────────────── */
  .ct-long-text {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.55;
    color: #334155;
    white-space: pre-wrap;
  }
  .ct-expand-btn {
    display: inline-block;
    margin-top: 4px;
    font-size: 0.72rem;
    color: #3b82f6;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }

  /* ── Requirement sub-row cells ───────────────────────────────────────────── */
  .ct-req-line {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .ct-req-text {
    font-size: 0.78rem;
    line-height: 1.5;
    flex: 1;
    min-width: 0;
  }
  .ct-req-text-complete {
    color: #94a3b8;
    text-decoration: line-through;
  }
  .ct-req-btns {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }
  .ct-req-hover-btns { visibility: hidden; }
  .ct-td-req:hover .ct-req-hover-btns { visibility: visible; }
  .ct-req-add-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .ct-req-add-btn { margin-top: 6px; }

  .ct-td-reqstatus { vertical-align: top; }
  .ct-td-reqtype { vertical-align: top; }
  .ct-reqstatus-select {
    font-size: 0.72rem;
    font-weight: 600;
    font-family: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid #fcd34d;
    background: #fef3c7;
    color: #d97706;
    cursor: pointer;
    width: 100%;
  }
  .ct-reqstatus-complete { background: #dcfce7; color: #16a34a; border-color: #86efac; }

  /* ── Status dropdown ─────────────────────────────────────────────────────── */
  .ct-td-status { vertical-align: middle; }
  .ct-status-select {
    font-size: 0.72rem;
    font-weight: 600;
    font-family: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    width: 100%;
  }
  .ct-status-notstarted  { background: #f1f5f9; color: #64748b; border-color: #e2e8f0; }
  .ct-status-inprogress  { background: #fef3c7; color: #d97706; border-color: #fcd34d; }
  .ct-status-submitted   { background: #dbeafe; color: #2563eb; border-color: #93c5fd; }
  .ct-status-discharged  { background: #dcfce7; color: #16a34a; border-color: #86efac; }
  .ct-status-notrequired { background: #ede9fe; color: #6d28d9; border-color: #c4b5fd; }

  /* ── Type dropdown ───────────────────────────────────────────────────────── */
  .ct-td-type { vertical-align: top; }
  .ct-type-select {
    font-size: 0.66rem;
    font-weight: 600;
    font-family: inherit;
    padding: 0.2rem 0.3rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    width: 100%;
    background: #fff;
  }
  .ct-type-precomm       { background: #fff1f2; color: #b91c1c; border-color: #fca5a5; }
  .ct-type-prebeneficial { background: #eff6ff; color: #2563eb; border-color: #93c5fd; }
  .ct-type-actionreq     { background: #fff7ed; color: #ea580c; border-color: #fdba74; }
  .ct-type-compliance    { background: #f0fdf4; color: #15803d; border-color: #86efac; }
  .ct-type-informative   { background: #f0fdf4; color: #16a34a; border-color: #86efac; }

  /* ── Progress cell ───────────────────────────────────────────────────────── */
  .ct-progress-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: 100%;
    background: none;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 4px 6px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
  }
  .ct-progress-cell:hover { border-color: #c4b5fd; background: #faf5ff; }
  .ct-progress-date {
    font-size: 0.7rem;
    font-weight: 700;
    color: #9333ea;
  }
  .ct-progress-summary {
    font-size: 0.76rem;
    line-height: 1.45;
    color: #334155;
  }
  .ct-progress-count {
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 100px;
    padding: 1px 7px;
    margin-top: 2px;
  }
  .ct-progress-empty {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    color: #94a3b8;
    background: none;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    padding: 3px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .ct-progress-empty:hover { color: #9333ea; border-color: #c4b5fd; background: #faf5ff; }

  /* ── Timeline drawer ─────────────────────────────────────────────────────── */
  .tl-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
  }
  .tl-drawer {
    background: #fff;
    width: 100%;
    max-width: 520px;
    height: 100%;
    box-shadow: -12px 0 40px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
  }
  .tl-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1.125rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .tl-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
  }
  .tl-subtitle {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: #94a3b8;
  }
  .tl-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tl-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border: 2px dashed #c4b5fd;
    background: white;
    color: #9333ea;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .tl-add-btn:hover { background: #faf5ff; border-color: #9333ea; }

  .tl-add-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid #e9d5ff;
    background: #faf5ff;
    border-radius: 10px;
    padding: 0.875rem;
  }
  .tl-add-row {
    display: flex;
    gap: 0.5rem;
  }
  .tl-add-row .tl-input { flex: 1; }
  .tl-input {
    font-size: 0.8rem;
    padding: 5px 8px;
    width: 100%;
    box-sizing: border-box;
  }
  textarea.tl-input { font-family: inherit; resize: vertical; }
  .tl-add-btns {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .tl-generate-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .tl-generate-hint { font-size: 0.72rem; color: #94a3b8; }
  .mini-spinner {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border: 2px solid #bae6fd;
    border-top-color: #0369a1;
    border-radius: 50%;
    animation: adv-spin 0.6s linear infinite;
  }
  @keyframes adv-spin { to { transform: rotate(360deg); } }
  .tl-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
  }
  /* ── Linked quotes in the drawer ─────────────────────────────────────────── */
  .tl-quotes {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.75rem 0.875rem;
    background: #f8fafc;
  }
  .tl-quotes-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .tl-quotes-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .tl-quotes-none {
    margin: 0;
    font-size: 0.76rem;
    color: #94a3b8;
  }
  .tl-quote-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.5rem 0.65rem;
  }
  .tl-quote-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tl-quote-statuses {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .tl-quote-status-pill {
    font-size: 0.68rem;
    font-weight: 600;
    color: #334155;
    background: #f1f5f9;
    border-radius: 999px;
    padding: 1px 8px;
  }
  .tl-quote-keydates {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: #64748b;
  }
  .tl-quote-keydates-label { font-weight: 600; color: #475569; }
  .tl-quote-keydate {
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #92400e;
    border-radius: 6px;
    padding: 1px 7px;
  }
  .tl-quote-org {
    font-size: 0.78rem;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tl-quote-meta {
    font-size: 0.7rem;
    color: #64748b;
    flex-shrink: 0;
  }
  .tl-quote-unlink { flex-shrink: 0; }
  .tl-quote-picker {
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    overflow-y: auto;
    max-height: 220px;
  }
  .tl-quote-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .tl-quote-option:last-child { border-bottom: none; }
  .tl-quote-option-match { background: #faf5ff; }
  .tl-quote-option-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  /* Quote / key-date / instruction-status entries in the timeline */
  .tl-entry-marker-quote { background: #0ea5e9; }
  .tl-entry-marker-keydate { background: #f59e0b; }
  .tl-entry-marker-status { background: #16a34a; }
  .tl-quote-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 600;
    color: #0369a1;
    background: #e0f2fe;
    border-radius: 100px;
    padding: 1px 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }
  .tl-keydate-badge { color: #92400e; background: #fef3c7; }
  .tl-status-badge { color: #15803d; background: #dcfce7; }
  .ct-progress-date .las { margin-left: 3px; color: #0369a1; }

  .tl-req-picker {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    background: #fff;
    border: 1px solid #e9d5ff;
    border-radius: 6px;
    padding: 0.5rem 0.625rem;
  }
  .tl-req-picker-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #94a3b8;
  }
  .tl-req-check {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.76rem;
    color: #475569;
    cursor: pointer;
    line-height: 1.45;
  }
  .tl-req-check input { margin-top: 2px; }

  .tl-req-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tl-req-tag {
    font-size: 0.66rem;
    font-weight: 600;
    color: #0369a1;
    background: #e0f2fe;
    border-radius: 100px;
    padding: 1px 8px;
    white-space: nowrap;
  }

  .tl-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: #7e22ce;
    background: #fff;
    border: 1px solid #e9d5ff;
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }
  .tl-empty {
    margin: 0;
    text-align: center;
    font-size: 0.8rem;
    color: #94a3b8;
    padding: 1rem 0;
  }

  /* Entries */
  .tl-entries {
    display: flex;
    flex-direction: column;
  }
  .tl-entry {
    display: flex;
    gap: 0.75rem;
    position: relative;
    padding-bottom: 1.125rem;
  }
  .tl-entry-marker {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #9333ea;
    flex-shrink: 0;
    margin-top: 5px;
    position: relative;
    z-index: 1;
  }
  .tl-entry:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 14px;
    bottom: -4px;
    width: 2px;
    background: #ede9fe;
  }
  .tl-entry-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tl-entry-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .tl-entry-date {
    font-size: 0.78rem;
    font-weight: 700;
    color: #1e293b;
  }
  .tl-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 100px;
    padding: 1px 8px;
  }
  .tl-source-email { color: #2563eb; background: #dbeafe; }
  .tl-entry-btns {
    margin-left: auto;
    display: flex;
    gap: 2px;
    visibility: hidden;
  }
  .tl-entry:hover .tl-entry-btns { visibility: visible; }
  .tl-entry-summary {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.55;
    color: #334155;
    white-space: pre-wrap;
  }
  .tl-full-text summary {
    font-size: 0.72rem;
    color: #9333ea;
    cursor: pointer;
    user-select: none;
  }
  .tl-full-text-body {
    margin: 6px 0 0;
    padding: 0.625rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.74rem;
    line-height: 1.55;
    color: #475569;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    max-height: 320px;
    overflow-y: auto;
  }

  /* ── Row action buttons ──────────────────────────────────────────────────── */
  .ct-row-btns {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  /* ── Inline cell editing ─────────────────────────────────────────────────── */
  .ct-row-editing { background: #f0f7ff; }
  .ct-row-editing td { vertical-align: top; }

  .ct-cell-input {
    font-size: 0.78rem;
    padding: 4px 6px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
  textarea.ct-cell-input { font-family: inherit; resize: vertical; }

  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .ct-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: ct-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes ct-spin { to { transform: rotate(360deg); } }
</style>
