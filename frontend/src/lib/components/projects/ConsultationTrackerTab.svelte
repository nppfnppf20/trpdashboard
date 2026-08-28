<script>
  import { onMount } from 'svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import { exportConsultationCombinedPdf } from '$lib/services/consultationPdfExport.js';
  import { getPublicCommentsData } from '$lib/api/publicComments.js';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import PublicCommentsTab from '$lib/components/projects/PublicCommentsTab.svelte';
  import BatchImportModal from '$lib/components/projects/BatchImportModal.svelte';
  import AddConsultationAdvancementModal from '$lib/components/projects/AddConsultationAdvancementModal.svelte';
  import ExportConsultationModal from '$lib/components/projects/ExportConsultationModal.svelte';

  let showBatchImport = false;
  let showExportModal = false;

  function positionPriority(pos) {
    const p = (pos || '').toLowerCase();
    if (p === 'objection')           return 1;
    if (p === 'conditional support') return 2;
    if (p === 'support')             return 4;
    if (p === 'no comment')          return 5;
    return 3;
  }

  function sortResponses(arr) {
    return [...arr].sort((a, b) => {
      const pd = positionPriority(a.position) - positionPriority(b.position);
      if (pd !== 0) return pd;
      const da = a.date_received || '9999';
      const db_ = b.date_received || '9999';
      if (da !== db_) return da < db_ ? -1 : 1;
      return a.id - b.id;
    });
  }

  function handleBatchDone(e) {
    responses = sortResponses([...responses, ...e.detail.rows]);
  }

  // ── Sub-tab ───────────────────────────────────────────────────────────────
  let subTab = 'statutory';  // 'statutory' | 'public'

  // ── Full screen view ────────────────────────────────────────────────────────
  let isFullscreen = false;

  function handleFullscreenKeydown(e) {
    if (e.key === 'Escape' && isFullscreen) isFullscreen = false;
  }

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
  import {
    getConsultationData,
    processConsultationDoc,
    createConsultationResponse,
    updateConsultationResponse,
    deleteConsultationResponse,
    markConsultationExported,
    emailConsultantForResponse,
    createConsultationAdvancements,
    suggestConsultationAdvancementSummaries,
    updateConsultationAdvancement,
    deleteConsultationAdvancement,
  } from '$lib/api/consultation.js';

  export let project;
  $: projectId = project?.id;

  // ── Data ──────────────────────────────────────────────────────────────────
  let responses = [];
  let meta = { last_exported_at: null, last_issued_to_client_at: null };
  let availableConsultants = [];
  let loading = true;
  let error = null;

  // ── Discipline list ───────────────────────────────────────────────────────
  const DISCIPLINE_OPTIONS = [
    'Agricultural Land and Soil',
    'Arboriculture',
    'Contaminated Land',
    'Ecology',
    'Fire Safety',
    'Flood and Drainage',
    'Glint & Glare',
    'Heritage',
    'Landscape and Visual',
    'PR/Comms',
    'Renewable Drawing Packs',
    'Topographical',
    'Transport',
    'Other',
  ].map(d => ({ id: d, label: d }));

  // Parse comma-separated discipline string → array; join back on save
  function parseDisciplines(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }
  function joinDisciplines(arr) {
    return (arr || []).join(', ');
  }

  // ── Consultant picker ─────────────────────────────────────────────────────
  let pickerOpen = null;  // 'edit' | 'review' | null
  let pickerSearch = '';

  $: consultantsByDiscipline = (() => {
    const grouped = {};
    for (const c of availableConsultants) {
      const d = c.discipline || 'Other';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(c);
    }
    return grouped;
  })();

  $: filteredConsultants = pickerSearch.trim()
    ? availableConsultants.filter(c =>
        c.organisation.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (c.discipline || '').toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (c.contact_name || '').toLowerCase().includes(pickerSearch.toLowerCase())
      )
    : null; // null = show grouped view

  // ── Upload panel state ────────────────────────────────────────────────────
  let showPanel = false;
  let panelStep = 'input';   // 'input' | 'processing' | 'review'
  let uploadInputTab = 'upload'; // 'upload' | 'paste'
  let uploadFile = null;
  let uploadPasteText = '';
  let uploadUserNotes = '';
  let showExtras = false;
  let uploadDragOver = false;
  let uploadError = null;
  let fileInput;

  // ── Review form (post-LLM, pre-save) ─────────────────────────────────────
  let reviewForm = { consultee_name: '', date_received: '', position: '', comments: '', action_required: '', conditions_suggested: '', discipline: [], original_consultant: '', original_consultant_email: '' };
  let reviewSaving = false;
  let reviewSourceFile = null;

  // ── Inline editing ────────────────────────────────────────────────────────
  let editingId = null;
  let editForm = {};

  // ── Expand/collapse comments ──────────────────────────────────────────────
  let expandedIds = new Set();

  // ── Email compose panel ───────────────────────────────────────────────────
  let emailRow = null;
  let emailForm = { to_email: '', to_name: '', subject: '' };
  let emailError = null;
  let emailEditor;   // RichTextEditor instance

  function buildEmailHtml(r, form) {
    let lines = (r.comments || '').split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1 && r.comments) {
      lines = r.comments.split(/(?<=[.!?])\s+(?=[A-Z])/).map(l => l.trim()).filter(Boolean);
    }
    if (!lines.length) lines = [r.comments || ''];

    const th = t => `<th style="text-align:left;padding:8px 12px;background:#f8fafc;border:1px solid #cbd5e1;font-size:13px;font-weight:600;color:#475569;">${t}</th>`;
    const td = (t, s = '') => `<td style="padding:8px 12px;border:1px solid #cbd5e1;vertical-align:top;font-size:13px;color:#1e293b;${s}">${t}</td>`;

    const dataRows = lines.map(line =>
      `<tr>${td(line)}${td('', 'min-width:180px;background:#fafff5;')}</tr>`
    ).join('');
    const blankRows = Array(3).fill(
      `<tr>${td('')}${td('', 'min-width:180px;background:#fafff5;')}</tr>`
    ).join('');

    const greeting = form.to_name?.trim() ? `Hi ${form.to_name.trim()},` : 'Hi,';
    const projectLine = [project?.project_id, project?.site_name || project?.project_name].filter(Boolean).join(', ');

    return `<p>${greeting}</p>
<p>We have received a statutory consultation response from <strong>${r.consultee_name || 'the consultee'}</strong>${projectLine ? ` in relation to <strong>${projectLine}</strong>` : ''}. Please find the full response attached for your reference.</p>
<p>We would be grateful if you could review the comments and provide your thoughts on the most appropriate approach to responding. We have summarised some of the key issues raised in the table below. If possible, it would be helpful if you could add your suggested response in the right-hand column.</p>
<p>Please note that the table is not intended to be exhaustive. If you identify any additional points or issues that have not been captured, please feel free to add these below. Any further thoughts or observations would also be very welcome.</p>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Issue Raised')}${th('Your Response (please complete)')}</tr></thead>
  <tbody>${dataRows}${blankRows}</tbody>
</table>
<p>Could you please complete the response column at your earliest convenience? If you have any questions, do not hesitate to get in touch.</p>
<p>Many thanks for your assistance.</p>`;
  }

  function openEmailCompose(r) {
    emailRow = r;
    emailForm = {
      to_email: r.original_consultant_email || '',
      to_name:  r.original_consultant || '',
      subject:  `Consultation Response Review: ${r.consultee_name || 'Consultee'}${project?.project_id ? ` (${project.project_id})` : ''}`,
    };
    emailError = null;
    // setHTML called after DOM renders via tick
    import('svelte').then(({ tick }) => tick().then(() => {
      emailEditor?.setHTML(buildEmailHtml(r, emailForm));
    }));
  }

  function closeEmailCompose() {
    emailRow = null;
    emailError = null;
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  }

  function openInEmailClient() {
    if (!emailForm.to_email?.trim()) { emailError = 'An email address is required.'; return; }
    const body = emailEditor ? stripHtml(emailEditor.getHTML()) : '';
    const mailto = `mailto:${encodeURIComponent(emailForm.to_email.trim())}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  onMount(() => { if (projectId) load(); });
  $: if (projectId) load();

  async function load() {
    loading = true; error = null;
    try {
      const data = await getConsultationData(projectId);
      responses = data.responses;
      meta = data.meta;
      availableConsultants = data.availableConsultants || [];
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

  function positionClass(pos) {
    if (!pos) return '';
    const p = pos.toLowerCase();
    if (p.includes('objection')) return 'badge-danger';
    if (p.includes('conditional')) return 'badge-warning';
    if (p.includes('support')) return 'badge-success';
    if (p.includes('no comment') || p.includes('no objection')) return 'badge-neutral';
    return 'badge-purple';
  }

  // Some position values come from AI extraction and can arrive in odd
  // casing (e.g. "OBJECTION") — normalize to Title Case for display.
  function toTitleCase(str) {
    if (!str) return str;
    return String(str).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Upload panel ──────────────────────────────────────────────────────────

  function openPanel() {
    showPanel = true;
    panelStep = 'input';
    uploadInputTab = 'upload';
    uploadFile = null;
    uploadPasteText = '';
    uploadUserNotes = '';
    showExtras = false;
    uploadError = null;
    uploadDragOver = false;
  }

  function closePanel() {
    if (panelStep === 'processing') return;
    showPanel = false;
    uploadError = null;
  }

  function handleDrop(e) {
    e.preventDefault();
    uploadDragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) { uploadFile = file; uploadInputTab = 'upload'; }
  }

  function handleFileChange(e) {
    uploadFile = e.target.files[0] || null;
  }

  async function submitProcess() {
    if (uploadInputTab === 'upload' && !uploadFile) { uploadError = 'Please select a file to upload.'; return; }
    if (uploadInputTab === 'paste' && !uploadPasteText.trim()) { uploadError = 'Please paste the consultation response text.'; return; }

    panelStep = 'processing';
    uploadError = null;
    try {
      const result = await processConsultationDoc(projectId, {
        file: uploadInputTab === 'upload' ? uploadFile : null,
        text: uploadInputTab === 'paste' ? uploadPasteText : null,
        userNotes: uploadUserNotes.trim() || null,
      });
      reviewSourceFile = result.source_file_name || null;
      reviewForm = {
        consultee_name:              result.suggestion.consultee_name || '',
        date_received:               result.suggestion.date_received  || '',
        position:                    result.suggestion.position       || '',
        comments:                    result.suggestion.comments       || '',
        action_required:             result.suggestion.action_required || '',
        conditions_suggested:        result.suggestion.conditions_suggested || '',
        discipline:                  [],
        original_consultant:         '',
        original_consultant_email:   '',
      };
      panelStep = 'review';
    } catch (err) {
      uploadError = err.message;
      panelStep = 'input';
    }
  }

  async function acceptReview() {
    if (!reviewForm.consultee_name?.trim()) { uploadError = 'Consultee name is required.'; return; }
    reviewSaving = true;
    uploadError = null;
    try {
      const created = await createConsultationResponse(projectId, {
        consultee_name:            reviewForm.consultee_name.trim(),
        date_received:             reviewForm.date_received   || null,
        position:                  reviewForm.position?.trim()  || null,
        comments:                  reviewForm.comments?.trim()  || null,
        action_required:           reviewForm.action_required?.trim() || null,
        conditions_suggested:      reviewForm.conditions_suggested?.trim() || null,
        discipline:                joinDisciplines(reviewForm.discipline) || null,
        original_consultant:       reviewForm.original_consultant?.trim() || null,
        original_consultant_email: reviewForm.original_consultant_email?.trim() || null,
        source_file_name:          reviewSourceFile,
      });
      responses = sortResponses([...responses, created]);
      showPanel = false;
    } catch (err) {
      uploadError = err.message;
    } finally {
      reviewSaving = false;
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────

  function startEdit(r) {
    editingId = r.id;
    pickerOpen = null;
    pickerSearch = '';
    editForm = {
      consultee_name:            r.consultee_name ?? '',
      date_received:             r.date_received ? r.date_received.split('T')[0] : '',
      position:                  r.position ?? '',
      comments:                  r.comments ?? '',
      action_required:           r.action_required ?? '',
      conditions_suggested:      r.conditions_suggested ?? '',
      status:                    r.status ?? 'In Progress',
      discipline:                parseDisciplines(r.discipline),
      original_consultant:       r.original_consultant ?? '',
      original_consultant_email: r.original_consultant_email ?? '',
    };
  }

  function pickConsultant(c, target) {
    const form = target === 'review' ? reviewForm : editForm;
    form.discipline                  = c.discipline || '';
    form.original_consultant         = c.organisation;
    form.original_consultant_email   = c.contact_email || '';
    if (target === 'review') reviewForm = { ...reviewForm };
    else editForm = { ...editForm };
    pickerOpen = null;
    pickerSearch = '';
  }

  function openPicker(target) {
    pickerOpen = target;
    pickerSearch = '';
  }

  async function saveEdit(id) {
    try {
      const updated = await updateConsultationResponse(id, {
        consultee_name:            editForm.consultee_name || null,
        date_received:             editForm.date_received  || null,
        position:                  editForm.position       || null,
        comments:                  editForm.comments       || null,
        action_required:           editForm.action_required || null,
        conditions_suggested:      editForm.conditions_suggested || null,
        status:                    editForm.status         || 'Open',
        discipline:                joinDisciplines(editForm.discipline) || null,
        original_consultant:       editForm.original_consultant  || null,
        original_consultant_email: editForm.original_consultant_email  || null,
      });
      responses = sortResponses(responses.map(r => r.id === id ? { ...r, ...updated } : r));
      editingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Status inline update ──────────────────────────────────────────────────
  const STATUS_OPTIONS = ['In Progress', 'Closed Out'];

  async function updateStatus(r, newStatus) {
    try {
      const updated = await updateConsultationResponse(r.id, { status: newStatus });
      responses = responses.map(x => x.id === r.id ? { ...x, ...updated } : x);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeResponse(id) {
    if (!confirm('Delete this consultation response?')) return;
    try {
      await deleteConsultationResponse(id);
      responses = responses.filter(r => r.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleExpand(id) {
    const next = new Set(expandedIds);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    expandedIds = next;
  }

  // ── Advancements ──────────────────────────────────────────────────────────
  let showAddAdvancement = false;
  let advPreselectId = null;

  function sortAdvancements(arr) {
    return [...arr].sort((a, b) =>
      (b.advancement_date || '').localeCompare(a.advancement_date || '') || b.id - a.id
    );
  }

  function openAddAdvancement(responseId = null) {
    advPreselectId = responseId;
    showAddAdvancement = true;
  }

  function handleAdvancementsDone(e) {
    for (const row of e.detail.rows) {
      responses = responses.map(r => r.id === row.response_id
        ? { ...r, advancements: sortAdvancements([...(r.advancements || []), row]) }
        : r
      );
    }
  }

  // ── Timeline drawer ───────────────────────────────────────────────────────
  let timelineResponseId = null;
  $: timelineResponse = responses.find(r => r.id === timelineResponseId) || null;

  function openTimeline(r) { timelineResponseId = r.id; }

  function closeTimeline() {
    timelineResponseId = null;
    tlEditingId = null;
    showTlAdd = false;
  }

  // Add form inside the drawer
  let showTlAdd = false;
  let tlAddForm = { advancement_date: '', source_type: 'note', summary: '', full_text: '' };
  let tlAddSaving = false;
  let tlAddGenerating = false;
  let tlAddGenerated = false;
  let tlAddError = null;

  function openTlAdd() {
    tlAddForm = {
      advancement_date: new Date().toISOString().slice(0, 10),
      source_type: 'note',
      summary: '',
      full_text: '',
    };
    tlAddError = null;
    tlAddGenerated = false;
    showTlAdd = true;
  }

  $: tlCanGenerate = !tlAddForm.summary.trim() && tlAddForm.full_text.trim().length > 0;
  $: tlCanSave = tlAddForm.summary.trim().length > 0;

  // Fill the blank summary from the source text (position, comments and
  // previous advancements are read server-side). No-ops once a summary is typed.
  async function generateTlSummary() {
    if (tlAddForm.summary.trim() || !tlAddForm.full_text.trim()) return;
    tlAddGenerating = true;
    tlAddError = null;
    try {
      const { suggestions } = await suggestConsultationAdvancementSummaries(projectId, {
        full_text: tlAddForm.full_text,
        items: [{ response_id: timelineResponseId, user_summary: null }],
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
      const rows = await createConsultationAdvancements(projectId, {
        advancement_date: tlAddForm.advancement_date,
        full_text: tlAddForm.full_text.trim() || null,
        source_type: tlAddForm.source_type,
        items: [{ response_id: timelineResponseId, summary: tlAddForm.summary.trim() }],
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
    tlEditForm = {
      advancement_date: a.advancement_date ? a.advancement_date.split('T')[0] : '',
      source_type: a.source_type || 'note',
      summary: a.summary || '',
      full_text: a.full_text || '',
    };
  }

  async function saveTlEdit(responseId) {
    try {
      const updated = await updateConsultationAdvancement(tlEditingId, {
        advancement_date: tlEditForm.advancement_date || null,
        summary: tlEditForm.summary || null,
        full_text: tlEditForm.full_text || null,
        source_type: tlEditForm.source_type || null,
      });
      responses = responses.map(r => r.id === responseId
        ? { ...r, advancements: sortAdvancements(r.advancements.map(a => a.id === updated.id ? updated : a)) }
        : r
      );
      tlEditingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeAdvancement(responseId, advancementId) {
    if (!confirm('Delete this advancement?')) return;
    try {
      await deleteConsultationAdvancement(advancementId);
      responses = responses.map(r => r.id === responseId
        ? { ...r, advancements: r.advancements.filter(a => a.id !== advancementId) }
        : r
      );
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  // Word and PDF share the same options modal - exportFormat tracks which
  // button opened it so the on:export handler knows which one to run.
  let exportFormat = 'pdf';   // 'pdf' | 'word'

  function openExportModal(format) {
    exportFormat = format;
    showExportModal = true;
  }

  function progressText(advancements) {
    return sortAdvancements(advancements || [])
      .map(a => `${formatDate(a.advancement_date)} - ${a.summary}`)
      .join('<br><br>');
  }

  function actionRequiredHtml(actionRequired) {
    return (actionRequired || '').replace(/\n/g, '<br>');
  }

  function buildStatutoryTableHtml() {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
    const rows = responses.map(r => `<tr>
      ${td(r.consultee_name)}
      ${td(r.date_received ? formatDate(r.date_received) : '')}
      ${td(r.position || '')}
      ${td((r.comments || '').replace(/\n/g, '<br>'))}
      ${td(actionRequiredHtml(r.action_required))}
      ${td(actionRequiredHtml(r.conditions_suggested))}
      ${td(progressText(r.advancements))}
      ${td(r.status || '')}
    </tr>`).join('');

    return `<h2>Statutory Consultee Tracker</h2>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Consultee')}${th('Date Received')}${th('Position')}${th('Comments')}${th('Action Required')}${th('Conditions Suggested')}${th('Progress')}${th('Status')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  function buildPublicCommentsTableHtml(comments) {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
    const rows = (comments || []).map(c => `<tr>
      ${td(c.commenter_name || 'Anonymous')}
      ${td(c.date_received ? formatDate(c.date_received) : '')}
      ${td(c.position || '')}
      ${td((c.comment || '').replace(/\n/g, '<br>'))}
      ${td((c.notes || '').replace(/\n/g, '<br>'))}
    </tr>`).join('');

    return `<h2>Public Comments</h2>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Name')}${th('Date')}${th('Position')}${th('Comment Summary')}${th('Notes')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  function buildPublicCommentsAnalysisHtml(analysis) {
    const lastRun = analysis?.last_analysed_at
      ? `<p><em>Last run ${formatDateTime(analysis.last_analysed_at)}</em></p>`
      : '';

    if (!analysis?.bullet_summary?.length && !analysis?.themes?.length) {
      return `<h2>Public Comments Analysis</h2>${lastRun}<p>No analysis has been run yet.</p>`;
    }

    const bullets = analysis.bullet_summary?.length
      ? `<h3>Summary</h3><ul>${analysis.bullet_summary.map(b => `<li>${b}</li>`).join('')}</ul>`
      : '';

    let themes = '';
    if (analysis.themes?.length) {
      const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
      const td = (t) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
      const rows = analysis.themes.map(t => `<tr>
        ${td(t.theme)}
        ${td(t.count != null ? String(t.count) : '')}
        ${td(t.sentiment)}
        ${td(t.summary)}
      </tr>`).join('');
      themes = `<h3>Recurring Themes</h3>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Theme')}${th('Count')}${th('Sentiment')}${th('Summary')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
    }

    return `<h2>Public Comments Analysis</h2>${lastRun}${bullets}${themes}`;
  }

  function buildCombinedExportHtml({ includeStatutory, includePublic, includeAnalysis }, { publicComments, analysis }) {
    const sections = [];
    if (includeStatutory) sections.push(buildStatutoryTableHtml());
    if (includePublic) sections.push(buildPublicCommentsTableHtml(publicComments));
    if (includeAnalysis) sections.push(buildPublicCommentsAnalysisHtml(analysis));

    return `<p>Project: ${project?.site_name || ''} | Exported: ${formatDate(new Date().toISOString())}</p>
${sections.join('<br>')}`;
  }

  async function handleExportOptions(e) {
    const { includeStatutory, includePublic, includeAnalysis } = e.detail;
    try {
      let publicComments = [];
      let analysis = null;
      if (includePublic || includeAnalysis) {
        const data = await getPublicCommentsData(projectId);
        publicComments = data.comments || [];
        analysis = data.analysis || null;
      }

      if (exportFormat === 'word') {
        const html = buildCombinedExportHtml({ includeStatutory, includePublic, includeAnalysis }, { publicComments, analysis });
        await exportHtmlToWord(html, buildExportFilename(project, 'Consultation Tracker'));
      } else {
        exportConsultationCombinedPdf(
          project,
          { includeStatutory, includePublic, includeAnalysis },
          { responses, publicComments, analysis }
        );
      }
      showExportModal = false;
    } catch (err) {
      alert('Failed to export: ' + err.message);
      return;
    }
    try {
      const updated = await markConsultationExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

</script>

<!-- ── Panel overlay ──────────────────────────────────────────────────────── -->
{#if showPanel}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="ct-overlay" on:click|self={closePanel}>
    <div class="ct-panel">

      {#if panelStep === 'input'}
        <div class="ct-panel-header">
          <h3 class="ct-panel-title">Process Consultation Response</h3>
          <button class="btn btn-icon btn-ghost" on:click={closePanel}><i class="las la-times"></i></button>
        </div>

        <div class="ct-input-tabs">
          <button class="btn btn-sm" class:btn-secondary={uploadInputTab === 'upload'} class:btn-ghost={uploadInputTab !== 'upload'} on:click={() => uploadInputTab = 'upload'}>
            <i class="las la-upload"></i> Upload File
          </button>
          <button class="btn btn-sm" class:btn-secondary={uploadInputTab === 'paste'} class:btn-ghost={uploadInputTab !== 'paste'} on:click={() => uploadInputTab = 'paste'}>
            <i class="las la-clipboard"></i> Paste Text
          </button>
        </div>

        {#if uploadInputTab === 'upload'}
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <div
            class="ct-drop-zone"
            class:drag-over={uploadDragOver}
            role="button"
            tabindex="0"
            on:dragover|preventDefault={() => uploadDragOver = true}
            on:dragleave={() => uploadDragOver = false}
            on:drop={handleDrop}
            on:click={() => fileInput.click()}
            on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
          >
            {#if uploadFile}
              <i class="las la-file-alt ct-drop-icon"></i>
              <span class="ct-drop-filename">{uploadFile.name}</span>
              <span class="ct-drop-hint">Click to change file</span>
            {:else}
              <i class="las la-cloud-upload-alt ct-drop-icon"></i>
              <span>Drop a file here or click to browse</span>
              <span class="ct-drop-hint">PDF, DOCX or TXT</span>
            {/if}
          </div>
          <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
        {:else}
          <textarea class="form-input ct-paste" bind:value={uploadPasteText} placeholder="Paste the consultation response text here…" rows="8"></textarea>
        {/if}

        <button class="btn btn-ghost btn-sm ct-extras-toggle" on:click={() => showExtras = !showExtras}>
          <i class="las la-{showExtras ? 'angle-up' : 'angle-right'}"></i>
          {showExtras ? 'Hide' : 'Show'} optional extras
        </button>
        {#if showExtras}
          <div class="ct-field">
            <label class="ct-label">Your Notes <span class="ct-label-hint">flag anything important; these take precedence over the document</span></label>
            <textarea class="form-input" bind:value={uploadUserNotes} rows="4" placeholder="e.g. The ecology section is the critical issue here. Make sure the survey date concern is captured."></textarea>
          </div>
        {/if}

        {#if uploadError}<div class="ct-error">{uploadError}</div>{/if}

        <button class="btn btn-primary ct-process-btn" on:click={submitProcess}>
          <i class="las la-magic"></i> Extract Consultation Details
        </button>

      {:else if panelStep === 'processing'}
        <div class="ct-processing">
          <span class="ct-spinner ct-spinner-lg"></span>
          <p class="ct-processing-label">Extracting consultation details…</p>
          <p class="ct-processing-hint">Reading the response and capturing all issues.</p>
        </div>

      {:else if panelStep === 'review'}
        <div class="ct-panel-header">
          <h3 class="ct-panel-title">Review Extracted Details</h3>
          <button class="btn btn-icon btn-ghost" on:click={closePanel}><i class="las la-times"></i></button>
        </div>
        <p class="ct-review-hint">Check the extracted details below and correct anything before adding to the tracker.</p>

        <div class="ct-review-form">
          <div class="ct-field-row">
            <div class="ct-field ct-field-grow">
              <label class="ct-label">Consultee <span class="ct-required">*</span></label>
              <input type="text" class="form-input" bind:value={reviewForm.consultee_name} placeholder="e.g. Natural England" />
            </div>
            <div class="ct-field ct-field-date">
              <label class="ct-label">Date Received</label>
              <input type="date" class="form-input" bind:value={reviewForm.date_received} />
            </div>
          </div>
          <div class="ct-field">
            <label class="ct-label">Position</label>
            <select class="form-input" bind:value={reviewForm.position}>
              <option value="">Select position</option>
              <option>Objection</option>
              <option>Conditional Support</option>
              <option>Support</option>
              <option>No Comment</option>
            </select>
          </div>
          <div class="ct-field">
            <label class="ct-label">Comments</label>
            <textarea class="form-input ct-comments-textarea" bind:value={reviewForm.comments} rows="8"></textarea>
          </div>
          <div class="ct-field">
            <label class="ct-label">Action Required <span class="ct-label-hint">(what needs to be provided to the council)</span></label>
            <textarea class="form-input ct-comments-textarea" bind:value={reviewForm.action_required} rows="4" placeholder="- Further ecological survey&#10;- Written confirmation on drainage strategy"></textarea>
          </div>
          <div class="ct-field">
            <label class="ct-label">Conditions Suggested <span class="ct-label-hint">(proposed conditions, applied after approval)</span></label>
            <textarea class="form-input ct-comments-textarea" bind:value={reviewForm.conditions_suggested} rows="4" placeholder="- Condition requiring a surface water drainage scheme&#10;- Condition restricting hours of construction"></textarea>
          </div>
          <div class="ct-field-row">
            <div class="ct-field ct-field-grow">
              <label class="ct-label">Discipline</label>
              <MultiSelectDropdown
                options={DISCIPLINE_OPTIONS}
                bind:selected={reviewForm.discipline}
                placeholder="Select disciplines…"
              />
            </div>
            <div class="ct-field ct-field-grow">
              <label class="ct-label">Original Consultant</label>
              <div class="ct-consultant-row">
                <input type="text" class="form-input" bind:value={reviewForm.original_consultant} placeholder="Name / organisation" />
                {#if availableConsultants.length}
                  <button class="btn btn-secondary btn-sm ct-pick-btn" type="button" on:click={() => openPicker('review')} title="Pick from project consultants">
                    <i class="las la-address-book"></i>
                  </button>
                {/if}
              </div>
              {#if !availableConsultants.length}
                <p class="ct-no-consultants">No consultants assigned to this project yet. Add them in Survey Management.</p>
              {/if}
            </div>
            <div class="ct-field ct-field-grow">
              <label class="ct-label">Email</label>
              <input type="email" class="form-input" bind:value={reviewForm.original_consultant_email} placeholder="consultant@email.com" />
            </div>
          </div>

          {#if pickerOpen === 'review'}
            <div class="ct-picker">
              <input class="form-input ct-picker-search" bind:value={pickerSearch} placeholder="Search by name or discipline…" autofocus />
              <div class="ct-picker-list">
                {#if filteredConsultants}
                  {#each filteredConsultants as c (c.id)}
                    <button class="ct-picker-item" type="button" on:click={() => pickConsultant(c, 'review')}>
                      <span class="ct-picker-org">{c.organisation}</span>
                      <span class="ct-picker-disc">{c.discipline || ''}</span>
                      {#if c.contact_email}<span class="ct-picker-email">{c.contact_email}</span>{/if}
                    </button>
                  {:else}
                    <p class="ct-picker-empty">No matches</p>
                  {/each}
                {:else}
                  {#each Object.entries(consultantsByDiscipline) as [disc, group]}
                    <p class="ct-picker-group">{disc}</p>
                    {#each group as c (c.id)}
                      <button class="ct-picker-item" type="button" on:click={() => pickConsultant(c, 'review')}>
                        <span class="ct-picker-org">{c.organisation}</span>
                        {#if c.contact_email}<span class="ct-picker-email">{c.contact_email}</span>{/if}
                      </button>
                    {/each}
                  {/each}
                {/if}
              </div>
              <button class="btn btn-ghost btn-sm ct-picker-close" type="button" on:click={() => pickerOpen = null}>Close</button>
            </div>
          {/if}
        </div>

        {#if uploadError}<div class="ct-error">{uploadError}</div>{/if}

        <div class="ct-review-footer">
          <button class="btn btn-secondary btn-sm" on:click={() => panelStep = 'input'}>
            <i class="las la-arrow-left"></i> Back
          </button>
          <button class="btn btn-primary" on:click={acceptReview} disabled={reviewSaving}>
            {#if reviewSaving}<span class="ct-spinner ct-spinner-sm"></span> Saving…{:else}<i class="las la-check"></i> Accept & Add to Tracker{/if}
          </button>
        </div>
      {/if}

    </div>
  </div>
{/if}

<!-- ── Email compose panel ────────────────────────────────────────────────── -->
{#if emailRow}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="ct-overlay" on:click|self={closeEmailCompose}>
    <div class="ct-panel">

        <div class="ct-panel-header">
          <h3 class="ct-panel-title">
            <i class="las la-envelope"></i> Email Consultant for Review
          </h3>
          <button class="btn btn-icon btn-ghost" on:click={closeEmailCompose}><i class="las la-times"></i></button>
        </div>

        <div class="ct-email-meta">
          <div class="ct-field-row">
            <div class="ct-field ct-field-grow">
              <label class="ct-label">To <span class="ct-required">*</span></label>
              <input type="email" class="form-input" bind:value={emailForm.to_email} placeholder="consultant@example.com" />
            </div>
            <div class="ct-field ct-field-grow">
              <label class="ct-label">Name (optional)</label>
              <input type="text" class="form-input" bind:value={emailForm.to_name} placeholder="e.g. Jane Smith" />
            </div>
          </div>
          <div class="ct-field">
            <label class="ct-label">Subject</label>
            <input type="text" class="form-input" bind:value={emailForm.subject} />
          </div>
        </div>

        <div class="ct-email-body-section">
          <label class="ct-label">Email content <span class="ct-label-hint">edit before sending</span></label>
          <RichTextEditor bind:this={emailEditor} placeholder="Email draft will appear here…" />
        </div>

        {#if emailError}<div class="ct-error">{emailError}</div>{/if}

        <div class="ct-review-footer">
          <button class="btn btn-secondary btn-sm" on:click={closeEmailCompose}>Cancel</button>
          <button class="btn btn-primary" on:click={openInEmailClient}>
            <i class="las la-external-link-alt"></i> Open in Email Client
          </button>
        </div>

    </div>
  </div>
{/if}

<!-- ── Sub-tab navigation ────────────────────────────────────────────────── -->
<div class="ct-subtabs">
  <button class="ct-subtab" class:ct-subtab-active={subTab === 'statutory'} on:click={() => subTab = 'statutory'}>
    Statutory Consultees
  </button>
  <button class="ct-subtab" class:ct-subtab-active={subTab === 'public'} on:click={() => subTab = 'public'}>
    Public Comments
  </button>
</div>

<svelte:window on:keydown={handleFullscreenKeydown} />

{#if subTab === 'public'}
  <PublicCommentsTab {project} />
{:else}

<!-- ── Progress timeline drawer ───────────────────────────────────────────── -->
{#if timelineResponse}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="tl-overlay" on:click|self={closeTimeline}>
    <div class="tl-drawer">
      <div class="tl-header">
        <div class="tl-header-text">
          <h3 class="tl-title">{timelineResponse.consultee_name}</h3>
          <p class="tl-subtitle">
            {(timelineResponse.advancements || []).length} progress entr{(timelineResponse.advancements || []).length !== 1 ? 'ies' : 'y'}
            {#if timelineResponse.position}· {toTitleCase(timelineResponse.position)}{/if}
          </p>
        </div>
        <button class="btn btn-icon btn-ghost" on:click={closeTimeline}><i class="las la-times"></i></button>
      </div>

      <div class="tl-body">
        {#if showTlAdd}
          <div class="tl-add-form">
            <div class="tl-add-row">
              <input type="date" class="form-input tl-input" bind:value={tlAddForm.advancement_date} />
              <select class="form-input tl-input" bind:value={tlAddForm.source_type}>
                <option value="note">Note</option>
                <option value="email">Email trail</option>
              </select>
            </div>
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

        {#if !(timelineResponse.advancements || []).length && !showTlAdd}
          <p class="tl-empty">No advancements recorded yet.</p>
        {/if}

        <div class="tl-entries">
          {#each sortAdvancements(timelineResponse.advancements || []) as a (a.id)}
            <div class="tl-entry">
              <div class="tl-entry-marker"></div>
              <div class="tl-entry-content">
                {#if tlEditingId === a.id}
                  <div class="tl-add-row">
                    <input type="date" class="form-input tl-input" bind:value={tlEditForm.advancement_date} />
                    <select class="form-input tl-input" bind:value={tlEditForm.source_type}>
                      <option value="email">Email trail</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  <textarea class="form-input tl-input" rows="2" bind:value={tlEditForm.summary}></textarea>
                  <textarea class="form-input tl-input" rows="5" bind:value={tlEditForm.full_text} placeholder="Source text (optional)…"></textarea>
                  <div class="tl-add-btns">
                    <button class="btn btn-ghost btn-sm" on:click={() => tlEditingId = null}>Cancel</button>
                    <button class="btn btn-primary btn-sm" on:click={() => saveTlEdit(timelineResponse.id)}>Save</button>
                  </div>
                {:else}
                  <div class="tl-entry-head">
                    <span class="tl-entry-date">{formatDate(a.advancement_date)}</span>
                    <span class="tl-source-badge" class:tl-source-email={a.source_type === 'email'}>
                      <i class="las {a.source_type === 'email' ? 'la-envelope' : 'la-sticky-note'}"></i>
                      {a.source_type === 'email' ? 'Email trail' : 'Note'}
                    </span>
                    <div class="tl-entry-btns">
                      <button class="btn btn-icon btn-ghost" title="Edit" on:click={() => startTlEdit(a)}><i class="las la-pen"></i></button>
                      <button class="btn btn-icon btn-danger-ghost" title="Delete" on:click={() => removeAdvancement(timelineResponse.id, a.id)}><i class="las la-trash"></i></button>
                    </div>
                  </div>
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

<AddConsultationAdvancementModal
  bind:show={showAddAdvancement}
  {projectId}
  {responses}
  preselectedResponseId={advPreselectId}
  on:done={handleAdvancementsDone}
  on:close={() => { showAddAdvancement = false; advPreselectId = null; }}
/>

<ExportConsultationModal
  bind:show={showExportModal}
  format={exportFormat}
  on:export={handleExportOptions}
  on:close={() => showExportModal = false}
/>

<!-- ── Statutory consultees content ──────────────────────────────────────── -->
<div class="ct-tab" class:ct-fullscreen={isFullscreen}>

  <!-- Top bar -->
  <div class="ct-topbar">
    <div class="ct-topbar-left">
      <button class="btn btn-primary" on:click={openPanel}>
        <i class="las la-plus"></i> Add Response
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => showBatchImport = true}>
        <i class="las la-layer-group"></i> Batch Import Stat Consultee Responses
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => openAddAdvancement()} disabled={!responses.length}>
        <i class="las la-history"></i> Add Advancement
      </button>
    </div>
    <div class="ct-topbar-right">
      <div class="ct-meta-badges">
        {#if meta.last_exported_at}
          <span class="ct-meta-badge"><i class="las la-download"></i> Exported {formatDateTime(meta.last_exported_at)}</span>
        {/if}
      </div>
      <button class="btn btn-secondary btn-sm" on:click={() => openExportModal('word')}>
        <i class="las la-file-word"></i> Word
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => openExportModal('pdf')}>
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
  {:else if responses.length === 0}
    <div class="ct-empty">
      <i class="las la-inbox ct-empty-icon"></i>
      <p class="ct-empty-title">No consultation responses yet</p>
      <p class="ct-empty-hint">Upload or paste a consultation response to extract and track the issues.</p>
      <button class="btn btn-primary btn-sm" on:click={openPanel}><i class="las la-plus"></i> Process First Response</button>
    </div>
  {:else}

    <!-- Table -->
    <div class="ct-scroll-top" bind:this={scrollTopEl}><div class="ct-scroll-top-inner"></div></div>
    <div class="ct-table-wrapper" bind:this={tableWrapperEl}>
      <table class="ct-table" bind:this={tableEl}>
        <thead>
          <tr>
            <th class="ct-th ct-th-consultee">Consultee</th>
            <th class="ct-th ct-th-date">Date</th>
            <th class="ct-th ct-th-pos">Position</th>
            <th class="ct-th ct-th-comments">Comments</th>
            <th class="ct-th ct-th-action-required">Action Required</th>
            <th class="ct-th ct-th-conditions">Conditions Suggested</th>
            <th class="ct-th ct-th-progress">Progress</th>
            <th class="ct-th ct-th-status">Status</th>
            <th class="ct-th ct-th-discipline">Discipline</th>
            <th class="ct-th ct-th-consultant">Original Consultant</th>
            <th class="ct-th ct-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each responses as r (r.id)}
            {@const editing = editingId === r.id}
            <tr class="ct-row" class:ct-row-editing={editing} class:ct-row-closed={r.status === 'Closed Out'}>

              <!-- Consultee -->
              <td class="ct-td ct-td-consultee">
                {#if editing}
                  <input type="text" class="form-input ct-cell-input" bind:value={editForm.consultee_name} />
                {:else}
                  <span class="ct-consultee-name">{r.consultee_name}</span>
                  {#if r.source_file_name}
                    <span class="ct-source-file" title={r.source_file_name}><i class="las la-file-alt"></i></span>
                  {/if}
                {/if}
              </td>

              <!-- Date -->
              <td class="ct-td ct-td-date">
                {#if editing}
                  <input type="date" class="form-input ct-cell-input" bind:value={editForm.date_received} />
                {:else}
                  {r.date_received ? formatDate(r.date_received) : '—'}
                {/if}
              </td>

              <!-- Position -->
              <td class="ct-td ct-td-pos">
                {#if editing}
                  <select class="form-input ct-cell-input" bind:value={editForm.position}>
                    <option value="">Select position</option>
                    <option>Objection</option>
                    <option>Conditional Support</option>
                    <option>Support</option>
                    <option>No Comment</option>
                  </select>
                {:else}
                  {#if r.position}
                    <span class="badge ct-pos-badge {positionClass(r.position)}">{toTitleCase(r.position)}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Comments -->
              <td class="ct-td ct-td-comments">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.comments} rows="4"></textarea>
                {:else}
                  {#if r.comments}
                    {@const expanded = expandedIds.has(r.id)}
                    {@const needsTrunc = r.comments.length > 280}
                    <p class="ct-comments-text">
                      {expanded || !needsTrunc ? r.comments : r.comments.slice(0, 280) + '…'}
                    </p>
                    {#if needsTrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand(r.id)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Action Required -->
              <td class="ct-td ct-td-action-required">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.action_required} rows="4" placeholder="Further information…"></textarea>
                {:else}
                  {#if r.action_required}
                    {@const expanded = expandedIds.has('ar' + r.id)}
                    {@const needsTrunc = r.action_required.length > 280}
                    <p class="ct-comments-text">
                      {expanded || !needsTrunc ? r.action_required : r.action_required.slice(0, 280) + '…'}
                    </p>
                    {#if needsTrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand('ar' + r.id)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Conditions Suggested -->
              <td class="ct-td ct-td-conditions">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.conditions_suggested} rows="4" placeholder="Condition requiring…"></textarea>
                {:else}
                  {#if r.conditions_suggested}
                    {@const expanded = expandedIds.has('cs' + r.id)}
                    {@const needsTrunc = r.conditions_suggested.length > 280}
                    <p class="ct-comments-text">
                      {expanded || !needsTrunc ? r.conditions_suggested : r.conditions_suggested.slice(0, 280) + '…'}
                    </p>
                    {#if needsTrunc}
                      <button class="ct-expand-btn" on:click={() => toggleExpand('cs' + r.id)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Progress (advancements) -->
              <td class="ct-td ct-td-progress">
                {#if r.advancements?.length}
                  {@const sorted = sortAdvancements(r.advancements)}
                  {@const latest = sorted[0]}
                  <button class="ct-progress-cell" on:click={() => openTimeline(r)} title="View full progress timeline">
                    <span class="ct-progress-date">{formatDate(latest.advancement_date)}</span>
                    <span class="ct-progress-summary">{latest.summary.length > 90 ? latest.summary.slice(0, 90) + '…' : latest.summary}</span>
                    <span class="ct-progress-count">{sorted.length} update{sorted.length !== 1 ? 's' : ''}</span>
                  </button>
                {:else}
                  <button class="ct-progress-empty" on:click={() => openAddAdvancement(r.id)} title="Add first advancement">
                    <i class="las la-plus"></i> Add
                  </button>
                {/if}
              </td>

              <!-- Status -->
              <td class="ct-td ct-td-status">
                <select
                  class="form-input ct-status-select"
                  class:ct-status-inprogress={!r.status || r.status === 'In Progress'}
                  class:ct-status-closed={r.status === 'Closed Out'}
                  value={editing ? editForm.status : (r.status || 'In Progress')}
                  on:change={e => editing
                    ? (editForm.status = e.target.value)
                    : updateStatus(r, e.target.value)}
                >
                  {#each STATUS_OPTIONS as s}<option value={s}>{s}</option>{/each}
                </select>
              </td>

              <!-- Discipline -->
              <td class="ct-td ct-td-discipline">
                {#if editing}
                  <div class="ct-disc-cell">
                    <MultiSelectDropdown
                      options={DISCIPLINE_OPTIONS}
                      bind:selected={editForm.discipline}
                      placeholder="Select…"
                    />
                  </div>
                {:else}
                  {#if r.discipline}
                    <div class="ct-disc-badges">
                      {#each parseDisciplines(r.discipline) as d}
                        <span class="ct-discipline-badge">{d}</span>
                      {/each}
                    </div>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Original Consultant -->
              <td class="ct-td ct-td-consultant" class:ct-td-has-picker={editing && pickerOpen === 'edit'}>
                {#if editing}
                  <div class="ct-cell-consultant-edit">
                    <div class="ct-consultant-row">
                      <input type="text" class="form-input ct-cell-input" bind:value={editForm.original_consultant} placeholder="Name / org" />
                      {#if availableConsultants.length}
                        <button class="btn btn-secondary btn-sm ct-pick-btn" type="button" on:click={() => openPicker('edit')} title="Pick from project consultants">
                          <i class="las la-address-book"></i>
                        </button>
                      {/if}
                    </div>
                    {#if !availableConsultants.length}
                      <p class="ct-no-consultants">No consultants assigned to this project yet. Add them in Survey Management.</p>
                    {/if}
                    <input type="email" class="form-input ct-cell-input" bind:value={editForm.original_consultant_email} placeholder="email" style="margin-top:4px" />
                    {#if pickerOpen === 'edit'}
                      <div class="ct-picker ct-picker-cell">
                        <input class="form-input ct-picker-search" bind:value={pickerSearch} placeholder="Search…" autofocus />
                        <div class="ct-picker-list">
                          {#if filteredConsultants}
                            {#each filteredConsultants as c (c.id)}
                              <button class="ct-picker-item" type="button" on:click={() => pickConsultant(c, 'edit')}>
                                <span class="ct-picker-org">{c.organisation}</span>
                                <span class="ct-picker-disc">{c.discipline || ''}</span>
                                {#if c.contact_email}<span class="ct-picker-email">{c.contact_email}</span>{/if}
                              </button>
                            {:else}
                              <p class="ct-picker-empty">No matches</p>
                            {/each}
                          {:else}
                            {#each Object.entries(consultantsByDiscipline) as [disc, group]}
                              <p class="ct-picker-group">{disc}</p>
                              {#each group as c (c.id)}
                                <button class="ct-picker-item" type="button" on:click={() => pickConsultant(c, 'edit')}>
                                  <span class="ct-picker-org">{c.organisation}</span>
                                  {#if c.contact_email}<span class="ct-picker-email">{c.contact_email}</span>{/if}
                                </button>
                              {/each}
                            {/each}
                          {/if}
                        </div>
                        <button class="btn btn-ghost btn-sm ct-picker-close" type="button" on:click={() => pickerOpen = null}>Close</button>
                      </div>
                    {/if}
                  </div>
                {:else}
                  {#if r.original_consultant}
                    <span class="ct-orig-consultant-name">{r.original_consultant}</span>
                    {#if r.original_consultant_email}
                      <a class="ct-consultant-email" href="mailto:{r.original_consultant_email}">{r.original_consultant_email}</a>
                    {/if}
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Actions -->
              <td class="ct-td ct-td-actions">
                {#if editing}
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-primary" on:click={() => saveEdit(r.id)} title="Save"><i class="las la-check"></i></button>
                    <button class="btn btn-icon btn-ghost" on:click={() => { editingId = null; pickerOpen = null; }} title="Cancel"><i class="las la-times"></i></button>
                  </div>
                {:else}
                  <div class="ct-row-btns">
                    <button class="btn btn-icon btn-ghost" on:click={() => startEdit(r)} title="Edit"><i class="las la-pen"></i></button>
                    <button class="btn btn-icon btn-ghost" on:click={() => openEmailCompose(r)} title="Email consultant for review"
                      class:ct-btn-emailed={r.last_emailed_consultant_at}>
                      <i class="las la-envelope"></i>
                    </button>
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => removeResponse(r.id)} title="Delete"><i class="las la-trash"></i></button>
                  </div>
                {/if}
              </td>

            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="ct-count">{responses.length} consultee response{responses.length !== 1 ? 's' : ''}</p>
  {/if}

</div>

<BatchImportModal
  bind:show={showBatchImport}
  {projectId}
  mode="statutory"
  on:done={handleBatchDone}
  on:close={() => showBatchImport = false}
/>

{/if}

<style>
  /* ── Sub-tab navigation ─────────────────────────────────────────────────── */
  .ct-subtabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-slate-200);
    padding: 0 1rem;
    background: var(--color-slate-50);
  }
  .ct-subtab {
    padding: 0.625rem 1.125rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    transition: all 0.15s;
  }
  .ct-subtab:hover { color: var(--color-slate-800); }
  .ct-subtab-active {
    color: var(--color-primary-500);
    border-bottom-color: var(--color-primary-500);
    font-weight: 600;
  }

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
    background: var(--color-white);
    padding: 1.25rem 1.75rem;
    margin: 0;
    overflow-y: auto;
  }

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
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border: 1px solid var(--color-slate-200);
    border-radius: 4px;
    padding: 2px 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  /* ── States ─────────────────────────────────────────────────────────────── */
  .ct-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }
  .ct-state-error { color: var(--color-red-600); }
  .ct-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    text-align: center;
  }
  .ct-empty-icon { font-size: 2.5rem; color: var(--color-slate-300); }
  .ct-empty-title { font-size: 1rem; font-weight: 600; color: var(--color-slate-600); margin: 0; }
  .ct-empty-hint { font-size: 0.8rem; color: var(--color-slate-400); margin: 0 0 0.5rem; }
  .ct-count {
    font-size: 0.75rem;
    color: var(--color-slate-400);
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
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
  }
  .ct-table {
    width: 100%;
    min-width: 1400px;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  .ct-th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-slate-500);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
    white-space: nowrap;
  }
  .ct-th-consultee  { min-width: 140px; }
  .ct-th-date       { min-width: 100px; }
  .ct-th-pos        { min-width: 120px; }
  .ct-th-comments   { min-width: 220px; max-width: 320px; }
  .ct-th-action-required { min-width: 180px; max-width: 260px; }
  .ct-th-conditions { min-width: 180px; max-width: 260px; }
  .ct-th-discipline { min-width: 100px; }
  .ct-th-consultant { min-width: 140px; }
  .ct-th-progress   { min-width: 180px; }
  .ct-th-status     { min-width: 120px; }
  .ct-th-actions    { width: 72px; }

  .ct-row:hover { background: var(--color-slate-50); }
  .ct-row-closed td { background: var(--color-slate-100) !important; }
  .ct-row-closed:hover td { background: var(--color-emerald-100) !important; }
  .ct-row:not(:last-child) td { border-bottom: 1px solid var(--color-slate-100); }

  /* Status dropdown */
  .ct-td-status { vertical-align: middle; }
  .ct-status-select {
    font-size: 0.72rem;
    font-weight: 600;
    font-family: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--color-slate-200);
    cursor: pointer;
    width: 100%;
  }
  .ct-status-inprogress { background: var(--color-amber-100); color: var(--color-amber-600); border-color: var(--color-yellow-300); }
  .ct-status-closed     { background: var(--color-emerald-100); color: var(--color-emerald-600); border-color: var(--color-slate-400); }

  .ct-td {
    padding: 0.65rem 0.75rem;
    vertical-align: top;
    color: var(--color-slate-700);
  }
  .ct-consultee-name { font-weight: 500; color: var(--color-slate-800); }
  .ct-source-file {
    margin-left: 4px;
    color: var(--color-slate-400);
    font-size: 0.75rem;
  }
  .ct-cell-muted { color: var(--color-slate-400); font-size: 0.78rem; }

  /* ── Progress cell ────────────────────────────────────────────────────────── */
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
  .ct-progress-cell:hover { border-color: var(--color-primary-200); background: var(--color-primary-50); }
  .ct-progress-date {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-primary-600);
  }
  .ct-progress-summary {
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--color-slate-700);
  }
  .ct-progress-count {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border-radius: 100px;
    padding: 1px 7px;
    margin-top: 2px;
  }
  .ct-progress-empty {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    color: var(--color-slate-400);
    background: none;
    border: 1px dashed var(--color-slate-300);
    border-radius: 6px;
    padding: 3px 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .ct-progress-empty:hover { color: var(--color-primary-600); border-color: var(--color-primary-200); background: var(--color-primary-50); }

  /* ── Timeline drawer ─────────────────────────────────────────────────────── */
  .tl-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
  }
  .tl-drawer {
    background: var(--color-white);
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
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .tl-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-slate-800);
    line-height: 1.4;
  }
  .tl-subtitle {
    margin: 2px 0 0;
    font-size: 0.75rem;
    color: var(--color-slate-400);
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
    border: 2px dashed var(--color-primary-200);
    background: white;
    color: var(--color-primary-600);
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }
  .tl-add-btn:hover { background: var(--color-primary-50); border-color: var(--color-primary-600); }

  .tl-add-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid var(--color-sky-200);
    background: var(--color-primary-50);
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
  .tl-generate-hint { font-size: 0.72rem; color: var(--color-slate-400); }
  .mini-spinner {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border: 2px solid var(--color-sky-200);
    border-top-color: var(--color-teal-600);
    border-radius: 50%;
    animation: adv-spin 0.6s linear infinite;
  }
  @keyframes adv-spin { to { transform: rotate(360deg); } }
  .tl-error {
    background: var(--color-red-100);
    color: var(--color-red-800);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
  }
  .tl-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--color-teal-600);
    background: var(--color-white);
    border: 1px solid var(--color-sky-200);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
  }
  .tl-empty {
    margin: 0;
    text-align: center;
    font-size: 0.8rem;
    color: var(--color-slate-400);
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
    background: var(--color-primary-600);
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
    background: var(--color-sky-100);
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
    color: var(--color-slate-800);
  }
  .tl-source-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border-radius: 100px;
    padding: 1px 8px;
  }
  .tl-source-email { color: var(--color-primary-600); background: var(--color-primary-100); }
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
    color: var(--color-slate-700);
    white-space: pre-wrap;
  }
  .tl-full-text summary {
    font-size: 0.72rem;
    color: var(--color-primary-600);
    cursor: pointer;
    user-select: none;
  }
  .tl-full-text-body {
    margin: 6px 0 0;
    padding: 0.625rem 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    font-size: 0.74rem;
    line-height: 1.55;
    color: var(--color-slate-600);
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    max-height: 320px;
    overflow-y: auto;
  }

  /* ── Discipline multi-select in table cell (compact overrides) ──────────── */
  .ct-disc-cell :global(.msd-trigger) {
    padding: 4px 8px;
    font-size: 0.78rem;
    min-height: 0;
  }
  .ct-disc-cell :global(.msd-panel) {
    font-size: 0.78rem;
    min-width: 200px;
  }
  .ct-disc-cell :global(.msd-option) {
    padding: 4px 10px;
    font-size: 0.78rem;
  }
  .ct-disc-cell :global(.msd-footer) {
    padding: 4px 10px;
  }
  .ct-disc-cell :global(.msd-clear),
  .ct-disc-cell :global(.msd-count) {
    font-size: 0.72rem;
  }
  .ct-disc-cell :global(.msd-options) {
    max-height: 180px;
  }

  /* ── Discipline badges (display mode) ───────────────────────────────────── */
  .ct-disc-badges { display: flex; flex-wrap: wrap; gap: 3px; }
  .ct-discipline-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 100px;
    font-size: 0.68rem;
    font-weight: 600;
    background: var(--color-sky-100);
    color: var(--color-teal-600);
    white-space: nowrap;
  }

  /* ── Consultant cell ─────────────────────────────────────────────────────── */
  .ct-orig-consultant-name {
    display: block;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-slate-800);
  }
  .ct-consultant-email {
    display: block;
    font-size: 0.72rem;
    color: var(--color-primary-500);
    text-decoration: none;
    word-break: break-all;
  }
  .ct-consultant-email:hover { text-decoration: underline; }

  /* ── Consultant picker row (input + book button) ─────────────────────────── */
  .ct-consultant-row {
    display: flex;
    gap: 4px;
    align-items: stretch;
  }
  .ct-consultant-row .form-input { flex: 1; }
  .ct-pick-btn { flex-shrink: 0; }
  .ct-no-consultants {
    margin: 4px 0 0;
    font-size: 0.72rem;
    color: var(--color-slate-400);
    font-style: italic;
    line-height: 1.4;
  }

  /* ── Consultant picker dropdown ──────────────────────────────────────────── */
  .ct-picker {
    background: var(--color-white);
    border: 1px solid var(--color-slate-300);
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .ct-picker-cell {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 280px;
    z-index: 200;
  }
  .ct-picker-search {
    padding: 0.5rem;
    border: none;
    border-bottom: 1px solid var(--color-slate-100);
    border-radius: 0;
    font-size: 0.8125rem;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .ct-picker-search:focus {
    outline: none;
    border-bottom-color: var(--color-purple-600);
  }
  .ct-picker-list {
    max-height: 220px;
    overflow-y: auto;
  }
  .ct-picker-group {
    margin: 0;
    padding: 6px 14px 2px;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--color-slate-400);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ct-picker-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    padding: 0.5rem 0.875rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.1s;
  }
  .ct-picker-item:hover { background: var(--color-slate-50); }
  .ct-picker-org   { font-size: 0.875rem; font-weight: 500; color: var(--color-slate-800); }
  .ct-picker-disc  { font-size: 0.75rem; color: var(--color-purple-600); }
  .ct-picker-email { font-size: 0.75rem; color: var(--color-slate-400); }
  .ct-picker-empty { padding: 0.75rem 0.875rem; font-size: 0.875rem; color: var(--color-slate-400); margin: 0; text-align: center; }
  .ct-picker-close {
    border-top: 1px solid var(--color-slate-100);
    border-radius: 0;
    font-size: 0.75rem;
    color: var(--color-purple-600);
    padding: 0.5rem;
    background: var(--color-slate-50);
    font-family: inherit;
    cursor: pointer;
    width: 100%;
    text-align: center;
    border-left: none;
    border-right: none;
    border-bottom: none;
  }
  .ct-picker-close:hover { text-decoration: underline; }

  /* ── Position badges ────────────────────────────────────────────────────── */
  .ct-pos-badge {
    font-size: 0.7rem;
    white-space: nowrap;
  }

  /* ── Comments text ───────────────────────────────────────────────────────── */
  .ct-comments-text {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.55;
    color: var(--color-slate-700);
    white-space: pre-wrap;
  }
  .ct-expand-btn {
    display: inline-block;
    margin-top: 4px;
    font-size: 0.72rem;
    color: var(--color-primary-500);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
  }

  /* ── Row action buttons ──────────────────────────────────────────────────── */
  .ct-row-btns {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  /* ── Shared field layout (edit form + review form) ──────────────────────── */
  .ct-field-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .ct-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .ct-field-grow { flex: 1; min-width: 0; }
  .ct-field-date { width: 150px; flex-shrink: 0; }
  .ct-field-pos  { width: 180px; flex-shrink: 0; }
  .ct-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }
  .ct-required { color: var(--color-red-500); }

  /* ── Inline cell editing ─────────────────────────────────────────────────── */
  .ct-row-editing { background: var(--color-primary-50); }
  .ct-row-editing td { vertical-align: top; }

  /* Base .form-input comes from the shared inputs.css; this tab's
     teal-tinted focus ring stays as a local override. */
  .form-input:focus { outline: none; border-color: var(--color-teal-600); box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1); }
  .ct-cell-input {
    font-size: 0.78rem;
    padding: 4px 6px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
  textarea.ct-cell-input { font-family: inherit; resize: vertical; }

  /* Consultant cell in edit mode */
  .ct-cell-consultant-edit {
    display: flex;
    flex-direction: column;
    position: relative;
  }

  /* Picker anchored below the consultant cell */
  .ct-picker-cell {
    position: absolute;
    top: 100%;
    left: 0;
    min-width: 280px;
    z-index: 200;
    margin-top: 2px;
  }

  /* ── Panel overlay ───────────────────────────────────────────────────────── */
  .ct-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
  }
  .ct-panel {
    background: var(--color-white);
    border-radius: 12px;
    width: 100%;
    max-width: 860px;
    max-height: 90vh;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
  }
  .ct-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem 0;
  }
  .ct-panel-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-slate-800);
    margin: 0;
  }

  /* ── Input tabs ──────────────────────────────────────────────────────────── */
  .ct-input-tabs {
    display: flex;
    gap: 0.5rem;
  }

  /* ── Drop zone ───────────────────────────────────────────────────────────── */
  .ct-drop-zone {
    border: 2px dashed var(--color-slate-300);
    border-radius: 8px;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    text-align: center;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    transition: border-color 0.15s, background 0.15s;
  }
  .ct-drop-zone:hover, .ct-drop-zone.drag-over {
    border-color: var(--color-primary-500);
    background: var(--color-primary-50);
  }
  .ct-drop-icon { font-size: 2rem; color: var(--color-slate-400); }
  .ct-drop-filename { font-weight: 500; color: var(--color-slate-700); }
  .ct-drop-hint { font-size: 0.75rem; color: var(--color-slate-400); }

  /* ── Paste ───────────────────────────────────────────────────────────────── */
  .ct-paste { font-size: 0.8rem; font-family: inherit; }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  .ct-error {
    background: var(--color-red-100);
    color: var(--color-red-800);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }

  /* ── Optional extras ────────────────────────────────────────────────────── */
  .ct-extras-toggle {
    align-self: flex-start;
    font-size: 0.78rem;
    color: var(--color-slate-500);
    padding: 2px 0;
  }
  .ct-label-hint { font-size: 0.72rem; font-weight: 400; color: var(--color-slate-400); }

  /* ── Process button ──────────────────────────────────────────────────────── */
  .ct-process-btn { align-self: flex-end; }

  /* ── Processing state ────────────────────────────────────────────────────── */
  .ct-processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 3rem 1rem;
    text-align: center;
    min-height: 180px;
  }
  .ct-processing-label {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--color-slate-700);
  }
  .ct-processing-hint { margin: 0; font-size: 0.78rem; color: var(--color-slate-400); }

  /* ── Review form ─────────────────────────────────────────────────────────── */
  .ct-review-hint { font-size: 0.8rem; color: var(--color-slate-500); margin: 0; }
  .ct-review-form { display: flex; flex-direction: column; gap: 0.75rem; }
  .ct-comments-textarea { font-size: 0.8rem; font-family: inherit; line-height: 1.6; resize: vertical; }
  .ct-review-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    margin-top: 0.75rem;
  }

  /* ── Email compose panel ─────────────────────────────────────────────────── */
  .ct-email-meta {
    padding: 1rem 1.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ct-email-body-section {
    padding: 0.75rem 1.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex: 1;
    min-height: 0;
  }

  /* Envelope button tint when already emailed */
  .ct-btn-emailed { color: var(--color-purple-600) !important; }

  /* ── Spinner ─────────────────────────────────────────────────────────────── */
  .ct-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-500);
    border-radius: 50%;
    animation: ct-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .ct-spinner-sm { width: 14px; height: 14px; }
  .ct-spinner-lg { width: 36px; height: 36px; border-width: 3px; }
  @keyframes ct-spin { to { transform: rotate(360deg); } }
</style>
