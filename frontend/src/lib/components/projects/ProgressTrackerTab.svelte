<script>
  import { onMount } from 'svelte';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import { exportProgressPdf } from '$lib/services/progressTrackerPdfExport.js';
  import AddIssuesModal from '$lib/components/projects/AddIssuesModal.svelte';
  import AddActionModal from '$lib/components/projects/AddActionModal.svelte';
  import { getStageBoard, createCustomStage } from '$lib/services/workflowApi.js';
  import {
    getProgressData,
    updateIssue,
    deleteIssue,
    createSubIssue,
    updateSubIssue,
    deleteSubIssue,
    createActions,
    suggestActionSummaries,
    updateAction,
    deleteAction,
    markProgressExported,
    getProjectQuotesForIssues,
    linkIssueQuote,
    unlinkIssueQuote,
  } from '$lib/api/progressTracker.js';

  export let project;
  $: projectId = project?.id;

  // ── Data ──────────────────────────────────────────────────────────────────
  let issues = [];
  let meta = { last_exported_at: null, last_issued_to_client_at: null };
  let loading = true;
  let error = null;

  const STATUS_OPTIONS = ['In Progress', 'Complete'];
  const SUB_STATUS_OPTIONS = ['In Progress', 'Complete'];

  // ── Sorting (click column headers) ────────────────────────────────────────
  let sortKey = 'discipline';   // 'discipline' | 'title'
  let sortDir = 'asc';

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
      if (key === 'discipline') {
        cmp = (a.discipline || '￿').localeCompare(b.discipline || '￿', undefined, { sensitivity: 'base' });
        if (cmp === 0) cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      } else {
        cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
      }
      if (cmp === 0) cmp = a.id - b.id;
      return dir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  $: sortedIssues = sortList(issues, sortKey, sortDir);

  // Sub-issue Status / Progress columns only earn their place once something
  // in the tracker actually uses sub-issues — many projects won't.
  $: hasAnySubIssues = issues.some(iss => iss.sub_issues?.length > 0);

  // ── Top scrollbar mirror ──────────────────────────────────────────────────
  let scrollTopEl, tableWrapperEl, tableEl;
  let _mirrorCleanup = null;

  $: if (scrollTopEl && tableWrapperEl && tableEl) {
    if (_mirrorCleanup) { _mirrorCleanup(); _mirrorCleanup = null; }

    const inner = scrollTopEl.querySelector('.pt-scroll-top-inner');
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
      const data = await getProgressData(projectId);
      issues = data.issues;
      meta = data.meta;
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
    loadStages();
  }

  async function refreshData() {
    try {
      const data = await getProgressData(projectId);
      issues = data.issues;
      meta = data.meta;
    } catch (err) {
      console.error('progress tracker refresh failed:', err);
    }
  }

  // ── Stages (per-action tag only — no global "current stage" concept.
  // Shared with the Stages Board via admin_console.project_stage_instances.
  // Each Add Action flow defaults to whatever stage was used most recently,
  // as a one-click starting point, not a project-wide setting.) ─────────────
  let stages = [];

  async function loadStages() {
    try {
      const board = await getStageBoard(projectId);
      stages = board.stages || [];
    } catch (err) {
      console.error('Failed to load stages:', err);
    }
  }

  function computeLastUsedStage(issuesList) {
    let latest = null;
    for (const iss of issuesList) {
      const a = iss.actions?.[0];
      if (!a) continue;
      if (!latest || a.action_date > latest.action_date || (a.action_date === latest.action_date && a.id > latest.id)) {
        latest = a;
      }
    }
    return latest?.stage_instance_id ?? null;
  }

  $: lastUsedStageInstanceId = computeLastUsedStage(issues);

  // Inline "+ new stage" for the drawer's own quick-add form (Add Action's
  // modal has an equivalent of its own).
  let showAddStageInline = false;
  let newStageNameInline = '';
  let addingStageInline = false;

  async function handleAddStageInline() {
    const trimmed = newStageNameInline.trim();
    if (!trimmed) { showAddStageInline = false; return; }
    addingStageInline = true;
    try {
      const board = await createCustomStage(projectId, { name: trimmed });
      stages = board.stages || [];
      const created = stages.find(s => s.stage_name === trimmed) || stages[stages.length - 1];
      if (created) tlAddForm.stage_instance_id = created.instance_id;
      newStageNameInline = '';
      showAddStageInline = false;
    } catch (err) {
      console.error('Failed to add stage:', err);
    } finally {
      addingStageInline = false;
    }
  }

  function stageColour(instanceId) {
    if (instanceId == null) return '#94a3b8';
    const idx = stages.findIndex(s => s.instance_id === instanceId);
    const palette = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#c026d3'];
    return palette[idx % palette.length] || '#64748b';
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
    const s = (status || 'In Progress').toLowerCase();
    return s === 'complete' ? 'pt-status-complete' : 'pt-status-inprogress';
  }

  // ── Full screen view ──────────────────────────────────────────────────────
  let isFullscreen = false;

  function handleFullscreenKeydown(e) {
    if (e.key === 'Escape' && isFullscreen) isFullscreen = false;
  }

  // ── Add issues modal ────────────────────────────────────────────────────────
  let showAddIssues = false;

  function handleAddDone(e) {
    issues = [...issues, ...e.detail.rows];
  }

  // ── Inline edit (issue row) ─────────────────────────────────────────────────
  let editingId = null;
  let editForm = {};

  function startEdit(iss) {
    editingId = iss.id;
    editForm = {
      title:      iss.title ?? '',
      discipline: iss.discipline ?? '',
      status:     iss.status ?? 'In Progress',
    };
  }

  async function saveEdit(id) {
    try {
      const updated = await updateIssue(id, {
        title:      editForm.title || null,
        discipline: editForm.discipline || null,
        status:     editForm.status || 'In Progress',
      });
      issues = issues.map(i => i.id === id ? { ...i, ...updated, sub_issues: i.sub_issues, actions: i.actions } : i);
      editingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function updateStatus(iss, newStatus) {
    try {
      const updated = await updateIssue(iss.id, { status: newStatus });
      issues = issues.map(x => x.id === iss.id ? { ...x, ...updated, sub_issues: x.sub_issues, actions: x.actions } : x);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeIssue(id) {
    if (!confirm('Delete this issue? Its sub-issues and action history will also be deleted.')) return;
    try {
      await deleteIssue(id);
      issues = issues.filter(i => i.id !== id);
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Sub-issues (always interactive, independent of row edit) ─────────────────
  let subEditingId = null;
  let subEditText = '';
  let subAddingFor = null;
  let subAddText = '';

  function patchSubIssue(issueId, updated) {
    issues = issues.map(i => i.id === issueId
      ? { ...i, sub_issues: i.sub_issues.map(s => s.id === updated.id ? updated : s) }
      : i
    );
  }

  async function setSubStatus(issueId, sub, newStatus) {
    try {
      const updated = await updateSubIssue(sub.id, { status: newStatus });
      patchSubIssue(issueId, updated);
    } catch (err) {
      alert(err.message);
    }
  }

  function startSubEdit(sub) {
    subEditingId = sub.id;
    subEditText = sub.sub_issue_text;
  }

  async function saveSubEdit(issueId) {
    if (!subEditText.trim()) return;
    try {
      const updated = await updateSubIssue(subEditingId, { sub_issue_text: subEditText.trim() });
      patchSubIssue(issueId, updated);
      subEditingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeSubIssue(issueId, subId) {
    if (!confirm('Delete this sub-issue?')) return;
    try {
      await deleteSubIssue(subId);
      issues = issues.map(i => i.id === issueId
        ? { ...i, sub_issues: i.sub_issues.filter(s => s.id !== subId) }
        : i
      );
    } catch (err) {
      alert(err.message);
    }
  }

  function startSubAdd(issueId) {
    subAddingFor = issueId;
    subAddText = '';
  }

  async function saveSubAdd(issueId) {
    if (!subAddText.trim()) { subAddingFor = null; return; }
    try {
      const created = await createSubIssue(issueId, { sub_issue_text: subAddText.trim() });
      issues = issues.map(i => i.id === issueId
        ? { ...i, sub_issues: [...i.sub_issues, created] }
        : i
      );
      subAddText = '';
      subAddingFor = null;
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Add Action modal ────────────────────────────────────────────────────────
  let showAddAction = false;
  let actionPreselectId = null;
  let addActionInitialMode = 'manual';

  function openAddAction(issueId = null, initialMode = 'manual') {
    actionPreselectId = issueId;
    addActionInitialMode = initialMode;
    showAddAction = true;
  }

  function handleActionsDone(e) {
    if (e.detail.rows) {
      for (const row of e.detail.rows) {
        issues = issues.map(i => i.id === row.issue_id
          ? { ...i, actions: sortActions([...(i.actions || []), row]) }
          : i
        );
      }
    }
    if (e.detail.issues?.length || e.detail.subIssues?.length) {
      // New issues/sub-issues created via Draft from Meeting Notes — simplest
      // correct path is a full refresh so their actions land nested correctly too.
      refreshData();
    }
  }

  function sortActions(arr) {
    return [...arr].sort((a, b) =>
      (b.action_date || '').localeCompare(a.action_date || '') || b.id - a.id
    );
  }

  // Progress is split into two columns: actions tagged to a specific
  // sub-issue, and actions logged against the issue as a whole. Both read
  // from the same action list — the drawer still shows the full amalgamated
  // timeline (all actions, with sub-issue tags) when either is opened.
  function subIssueActions(iss, subId) {
    return (iss.actions || []).filter(a => a.sub_issue_ids?.includes(subId));
  }

  function mainIssueActions(iss) {
    return (iss.actions || []).filter(a => !a.sub_issue_ids || a.sub_issue_ids.length === 0);
  }

  // ── Progress timeline drawer ───────────────────────────────────────────────
  let timelineIssueId = null;
  $: timelineIssue = issues.find(i => i.id === timelineIssueId) || null;

  function openTimeline(iss) { timelineIssueId = iss.id; }

  function closeTimeline() {
    timelineIssueId = null;
    tlEditingId = null;
    showTlAdd = false;
    showQuotePicker = false;
  }

  // ── Linked quotes (from surveyor management) ────────────────────────────────
  let showQuotePicker = false;
  let projectQuotes = [];
  let quotesLoading = false;
  let quotesLoaded = false;

  async function toggleQuotePicker() {
    showQuotePicker = !showQuotePicker;
    if (showQuotePicker && !quotesLoaded) {
      quotesLoading = true;
      try {
        const data = await getProjectQuotesForIssues(projectId);
        projectQuotes = data.quotes;
        quotesLoaded = true;
      } catch (err) {
        alert(err.message);
      } finally {
        quotesLoading = false;
      }
    }
  }

  function isQuoteLinked(quoteId) {
    return (timelineIssue?.linked_quotes || []).some(q => q.quote_id === quoteId);
  }

  async function handleLinkQuote(quoteId) {
    try {
      await linkIssueQuote(timelineIssueId, quoteId);
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleUnlinkQuote(quoteId) {
    try {
      await unlinkIssueQuote(timelineIssueId, quoteId);
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  }

  function formatQuoteTotal(total) {
    const n = Number(total);
    return Number.isFinite(n) && n > 0 ? `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : null;
  }

  // Issues Tracker has no equivalent of Conditions Tracker's "original
  // consultant" field to smart-match quotes against, so the picker is a
  // plain list (no likely-match sort/highlight).

  // Same three extra read-only sources merged into a condition's timeline
  // (quote actions, key dates, instruction-status changes), applied here.
  function mergedTimeline(iss) {
    const own = (iss.actions || []).map(a => ({ ...a, _kind: 'issue' }));
    const fromQuotes = (iss.linked_quotes || []).flatMap(q =>
      (q.actions || []).map(a => ({
        id: `q-${a.id}`,
        action_date: a.action_date,
        summary: a.summary,
        full_text: a.full_text,
        source_type: a.source_type,
        _kind: 'quote',
        _org: q.organisation || 'Quote',
      }))
    );
    const fromKeyDates = (iss.linked_quotes || []).flatMap(q =>
      (q.key_dates || []).map(kd => ({
        id: `kd-${kd.id}`,
        action_date: kd.date,
        summary: kd.title,
        full_text: null,
        _kind: 'key_date',
        _org: q.organisation || 'Quote',
      }))
    );
    const fromInstructionStatus = (iss.linked_quotes || [])
      .filter(q => q.instruction_status_changed_at)
      .map(q => ({
        id: `is-${q.quote_id}`,
        action_date: String(q.instruction_status_changed_at).slice(0, 10),
        summary: `Instruction status: ${q.instruction_status}`,
        full_text: null,
        _kind: 'instruction_status',
        _org: q.organisation || 'Quote',
      }));
    return [...own, ...fromQuotes, ...fromKeyDates, ...fromInstructionStatus].sort((a, b) =>
      String(b.action_date || '').localeCompare(String(a.action_date || ''))
      || String(b.id).localeCompare(String(a.id))
    );
  }

  $: tlMerged = timelineIssue ? mergedTimeline(timelineIssue) : [];

  // Quick-add form inside the drawer
  let showTlAdd = false;
  let tlAddForm = { action_date: '', source_type: 'note', summary: '', full_text: '', stage_instance_id: null, quote_id: null };
  let tlAddSubIds = {};
  let tlAddSaving = false;
  let tlAddGenerating = false;
  let tlAddGenerated = false;
  let tlAddError = null;

  function openTlAdd() {
    // Default the "relevant quote" tag: auto-select when there's exactly one
    // linked quote, otherwise leave untagged and let the picker force a choice.
    const linked = timelineIssue?.linked_quotes || [];
    tlAddForm = {
      action_date: new Date().toISOString().slice(0, 10),
      source_type: 'note',
      summary: '',
      full_text: '',
      stage_instance_id: lastUsedStageInstanceId,
      quote_id: linked.length === 1 ? linked[0].quote_id : null,
    };
    tlAddSubIds = {};
    tlAddError = null;
    tlAddGenerated = false;
    showAddStageInline = false;
    newStageNameInline = '';
    showTlAdd = true;
  }

  function tlSelectedSubIds() {
    return Object.entries(tlAddSubIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10));
  }

  $: tlCanGenerate = !tlAddForm.summary.trim() && tlAddForm.full_text.trim().length > 0;
  $: tlCanSave = tlAddForm.summary.trim().length > 0;

  // Fill the blank summary from the pasted text (issue title/discipline and
  // previous actions are read server-side). No-ops once a summary is typed.
  async function generateTlSummary() {
    if (tlAddForm.summary.trim() || !tlAddForm.full_text.trim()) return;
    tlAddGenerating = true;
    tlAddError = null;
    try {
      const { suggestions } = await suggestActionSummaries(projectId, {
        full_text: tlAddForm.full_text,
        items: [{ issue_id: timelineIssueId, user_summary: null }],
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
      const rows = await createActions(projectId, {
        action_date: tlAddForm.action_date,
        full_text: tlAddForm.full_text.trim() || null,
        source_type: tlAddForm.source_type,
        stage_instance_id: tlAddForm.stage_instance_id || null,
        items: [{ issue_id: timelineIssueId, summary: tlAddForm.summary.trim(), sub_issue_ids: tlSelectedSubIds(), quote_id: tlAddForm.quote_id || null }],
      });
      handleActionsDone({ detail: { rows } });
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
    const subIds = {};
    for (const id of a.sub_issue_ids || []) subIds[id] = true;
    tlEditForm = {
      action_date: a.action_date ? a.action_date.split('T')[0] : '',
      source_type: a.source_type || 'note',
      summary: a.summary || '',
      full_text: a.full_text || '',
      stage_instance_id: a.stage_instance_id ?? null,
      quote_id: a.quote_id || null,
      subIds,
    };
  }

  async function saveTlEdit(issueId) {
    try {
      const updated = await updateAction(tlEditingId, {
        action_date: tlEditForm.action_date || null,
        summary: tlEditForm.summary || null,
        full_text: tlEditForm.full_text || null,
        source_type: tlEditForm.source_type || null,
        stage_instance_id: tlEditForm.stage_instance_id,
        quote_id: tlEditForm.quote_id || null,
        sub_issue_ids: Object.entries(tlEditForm.subIds).filter(([, on]) => on).map(([id]) => parseInt(id, 10)),
      });
      issues = issues.map(i => i.id === issueId
        ? { ...i, actions: sortActions(i.actions.map(a => a.id === updated.id ? { ...updated, stage_name: stages.find(s => s.instance_id === updated.stage_instance_id)?.stage_name } : a)) }
        : i
      );
      tlEditingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeAction(issueId, actionId) {
    if (!confirm('Delete this action?')) return;
    try {
      await deleteAction(actionId);
      issues = issues.map(i => i.id === issueId
        ? { ...i, actions: i.actions.filter(a => a.id !== actionId) }
        : i
      );
    } catch (err) {
      alert(err.message);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExportPdf() {
    if (!issues.length) { alert('No issues to export.'); return; }
    exportProgressPdf(project, sortedIssues);
    try {
      const updated = await markProgressExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

  function buildExportHtml() {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t, span = 1) => `<td${span > 1 ? ` rowspan="${span}"` : ''} style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
    const progressText = (actions) => actions
      .map(a => `${formatDate(a.action_date)}${a.stage_name ? ` [${a.stage_name}]` : ''} - ${a.summary}`)
      .join('<br><br>');
    const rows = sortedIssues.map(iss => {
      const subs = iss.sub_issues || [];
      const span = Math.max(1, subs.length);
      const subCells = (s) => {
        const base = s ? td(s.sub_issue_text) : td('');
        if (!hasAnySubIssues) return base;
        return s
          ? `${base}${td(s.status || 'In Progress')}${td(progressText(subIssueActions(iss, s.id)))}`
          : `${base}${td('')}${td('')}`;
      };
      const mainProgress = progressText(mainIssueActions(iss));
      const first = `<tr>
        ${td(iss.discipline, span)}
        ${td(iss.title, span)}
        ${subCells(subs[0])}
        ${td(mainProgress, span)}
        ${td(iss.status || '', span)}
      </tr>`;
      const rest = subs.slice(1).map(s => `<tr>${subCells(s)}</tr>`).join('');
      return first + rest;
    }).join('');

    const subHeaders = hasAnySubIssues ? `${th('Sub-issue status')}${th('Sub-issue progress')}` : '';
    return `<h2>Project Tracker</h2>
<p>Project: ${project?.site_name || ''} | Exported: ${formatDate(new Date().toISOString())}</p>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Discipline')}${th('Title')}${th('Sub-issue')}${subHeaders}${th('Main issue progress')}${th('Status')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  let exportingWord = false;
  async function handleExport() {
    if (!issues.length) { alert('No issues to export.'); return; }
    exportingWord = true;
    try {
      const html = buildExportHtml();
      await exportHtmlToWord(html, buildExportFilename(project, 'Project Tracker'));
      const updated = await markProgressExported(projectId);
      meta = { ...meta, ...updated };
    } catch (err) {
      alert('Failed to export: ' + err.message);
    } finally {
      exportingWord = false;
    }
  }

</script>

<AddIssuesModal
  bind:show={showAddIssues}
  {projectId}
  on:done={handleAddDone}
  on:close={() => showAddIssues = false}
/>

<AddActionModal
  bind:show={showAddAction}
  {projectId}
  {issues}
  preselectedIssueId={actionPreselectId}
  defaultStageInstanceId={lastUsedStageInstanceId}
  initialMode={addActionInitialMode}
  on:done={handleActionsDone}
  on:close={() => { showAddAction = false; actionPreselectId = null; addActionInitialMode = 'manual'; }}
/>

<!-- ── Progress timeline drawer ───────────────────────────────────────────── -->
{#if timelineIssue}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="tl-overlay" on:click|self={closeTimeline}>
    <div class="tl-drawer">
      <div class="tl-header">
        <div class="tl-header-text">
          <h3 class="tl-title">{timelineIssue.title}</h3>
          <p class="tl-subtitle">
            {tlMerged.length} progress entr{tlMerged.length !== 1 ? 'ies' : 'y'}
            {#if timelineIssue.discipline}· {timelineIssue.discipline}{/if}
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
          {#each timelineIssue.linked_quotes || [] as q (q.quote_id)}
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
                {#each projectQuotes as q (q.id)}
                  {@const linked = isQuoteLinked(q.id)}
                  <div class="tl-quote-option">
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

        <div class="tl-quick-actions">
          <button class="tl-add-btn" on:click={openTlAdd} class:tl-add-btn-hidden={showTlAdd}>
            <i class="las la-plus"></i> Add Advancement
          </button>
          <button class="tl-add-btn tl-add-btn-secondary" on:click={() => openAddAction(timelineIssueId, 'meeting-notes')}>
            <i class="las la-magic"></i> Draft from Meeting Notes
          </button>
        </div>

        {#if showTlAdd}
          <div class="tl-add-form">
            <div class="tl-add-row">
              <input type="date" class="form-input tl-input" bind:value={tlAddForm.action_date} />
              <select class="form-input tl-input" bind:value={tlAddForm.stage_instance_id}>
                <option value={null}>No stage</option>
                {#each stages as s (s.instance_id)}
                  <option value={s.instance_id}>{s.stage_name}</option>
                {/each}
              </select>
              {#if showAddStageInline}
                <input
                  class="form-input tl-input tl-stage-new-input"
                  placeholder="New stage name"
                  bind:value={newStageNameInline}
                  on:keydown={e => { if (e.key === 'Enter') handleAddStageInline(); if (e.key === 'Escape') { showAddStageInline = false; newStageNameInline = ''; } }}
                />
                <button class="btn btn-secondary btn-sm" disabled={addingStageInline} on:click={handleAddStageInline}>{addingStageInline ? 'Adding…' : 'Add'}</button>
                <button class="btn btn-ghost btn-sm" on:click={() => { showAddStageInline = false; newStageNameInline = ''; }}>Cancel</button>
              {:else}
                <button class="tl-stage-add-toggle" on:click={() => showAddStageInline = true}><i class="las la-plus"></i> New stage</button>
              {/if}
            </div>
            {#if timelineIssue.sub_issues.length}
              <div class="tl-req-picker">
                <span class="tl-req-picker-label">Relates to (optional):</span>
                {#each timelineIssue.sub_issues as sub (sub.id)}
                  <label class="tl-req-check">
                    <input type="checkbox" checked={!!tlAddSubIds[sub.id]} on:change={() => tlAddSubIds = { ...tlAddSubIds, [sub.id]: !tlAddSubIds[sub.id] }} />
                    <span>{sub.sub_issue_text}</span>
                  </label>
                {/each}
              </div>
            {/if}
            {#if timelineIssue.linked_quotes?.length}
              <div class="tl-add-row">
                <span class="tl-req-picker-label">Relevant quote:</span>
                <select class="form-input tl-input" bind:value={tlAddForm.quote_id}>
                  <option value={null}>Not relevant to a quote</option>
                  {#each timelineIssue.linked_quotes as q (q.quote_id)}
                    <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                  {/each}
                </select>
              </div>
            {/if}
            <textarea class="form-input tl-input" rows="2" bind:value={tlAddForm.summary}
              placeholder="Summary - leave blank to auto-summarise from the text below…"></textarea>
            <textarea class="form-input tl-input" rows="4" bind:value={tlAddForm.full_text}
              placeholder="Fuller detail - paste an email trail, notes, whatever you've got…"></textarea>
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
                style={a._kind === 'issue' ? `background:${stageColour(a.stage_instance_id)}` : ''}
              ></div>
              <div class="tl-entry-content">
                {#if tlEditingId === a.id}
                  <div class="tl-add-row">
                    <input type="date" class="form-input tl-input" bind:value={tlEditForm.action_date} />
                    <select class="form-input tl-input" bind:value={tlEditForm.source_type}>
                      <option value="note">Note</option>
                      <option value="email">Email trail</option>
                      <option value="meeting">Meeting note</option>
                    </select>
                    <select class="form-input tl-input" bind:value={tlEditForm.stage_instance_id}>
                      <option value={null}>No stage</option>
                      {#each stages as s (s.instance_id)}
                        <option value={s.instance_id}>{s.stage_name}</option>
                      {/each}
                    </select>
                  </div>
                  {#if timelineIssue.sub_issues.length}
                    <div class="tl-req-picker">
                      <span class="tl-req-picker-label">Relates to (optional):</span>
                      {#each timelineIssue.sub_issues as sub (sub.id)}
                        <label class="tl-req-check">
                          <input type="checkbox" checked={!!tlEditForm.subIds[sub.id]} on:change={() => tlEditForm = { ...tlEditForm, subIds: { ...tlEditForm.subIds, [sub.id]: !tlEditForm.subIds[sub.id] } }} />
                          <span>{sub.sub_issue_text}</span>
                        </label>
                      {/each}
                    </div>
                  {/if}
                  {#if timelineIssue.linked_quotes?.length}
                    <div class="tl-add-row">
                      <span class="tl-req-picker-label">Relevant quote:</span>
                      <select class="form-input tl-input" bind:value={tlEditForm.quote_id}>
                        <option value={null}>Not relevant to a quote</option>
                        {#each timelineIssue.linked_quotes as q (q.quote_id)}
                          <option value={q.quote_id}>{q.organisation || 'Quote'}</option>
                        {/each}
                      </select>
                    </div>
                  {/if}
                  <textarea class="form-input tl-input" rows="2" bind:value={tlEditForm.summary}></textarea>
                  <textarea class="form-input tl-input" rows="4" bind:value={tlEditForm.full_text} placeholder="Source text (optional)…"></textarea>
                  <div class="tl-add-btns">
                    <button class="btn btn-ghost btn-sm" on:click={() => tlEditingId = null}>Cancel</button>
                    <button class="btn btn-primary btn-sm" on:click={() => saveTlEdit(timelineIssue.id)}>Save</button>
                  </div>
                {:else}
                  <div class="tl-entry-head">
                    <span class="tl-entry-date">{formatDate(a.action_date)}</span>
                    {#if a._kind === 'issue' && a.stage_name}
                      <span class="tl-stage-badge" style="background:{stageColour(a.stage_instance_id)}1a; color:{stageColour(a.stage_instance_id)};">
                        {a.stage_name}
                      </span>
                    {/if}
                    {#if a._kind === 'issue'}
                      <span class="tl-source-badge" class:tl-source-email={a.source_type === 'email'} class:tl-source-meeting={a.source_type === 'meeting'}>
                        <i class="las {a.source_type === 'email' ? 'la-envelope' : a.source_type === 'meeting' ? 'la-users' : 'la-sticky-note'}"></i>
                        {a.source_type === 'email' ? 'Email trail' : a.source_type === 'meeting' ? (a.meeting_note_title || 'Meeting note') : 'Note'}
                      </span>
                    {/if}
                    {#if a._kind === 'issue' && a.quote_id}
                      {@const taggedQuote = timelineIssue.linked_quotes?.find(q => q.quote_id === a.quote_id)}
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
                    {#if a._kind === 'issue'}
                      <div class="tl-entry-btns">
                        <button class="btn btn-icon btn-ghost" title="Edit" on:click={() => startTlEdit(a)}><i class="las la-pen"></i></button>
                        <button class="btn btn-icon btn-danger-ghost" title="Delete" on:click={() => removeAction(timelineIssue.id, a.id)}><i class="las la-trash"></i></button>
                      </div>
                    {/if}
                  </div>
                  {#if a._kind === 'issue' && a.sub_issue_ids?.length}
                    <div class="tl-req-tags">
                      {#each timelineIssue.sub_issues.filter(sub => a.sub_issue_ids.includes(sub.id)) as sub (sub.id)}
                        <span class="tl-req-tag" title={sub.sub_issue_text}>
                          {sub.sub_issue_text.length > 45 ? sub.sub_issue_text.slice(0, 45) + '…' : sub.sub_issue_text}
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

<!-- ── Issues tracker content ─────────────────────────────────────────────── -->
<div class="pt-tab" class:pt-fullscreen={isFullscreen}>

  <!-- Top bar -->
  <div class="pt-topbar">
    <div class="pt-topbar-left">
      <button class="btn btn-primary" on:click={() => showAddIssues = true}>
        <i class="las la-plus"></i> Add Issues
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => openAddAction()} disabled={!issues.length}>
        <i class="las la-history"></i> Add Advancement
      </button>
    </div>
    <div class="pt-topbar-right">
      <div class="pt-meta-badges">
        {#if meta.last_exported_at}
          <span class="pt-meta-badge"><i class="las la-download"></i> Exported {formatDateTime(meta.last_exported_at)}</span>
        {/if}
      </div>
      <button class="btn btn-secondary btn-sm" on:click={handleExport} disabled={!issues.length || exportingWord}>
        {#if exportingWord}<div class="mini-spinner"></div> Exporting…{:else}<i class="las la-file-word"></i> Word{/if}
      </button>
      <button class="btn btn-secondary btn-sm" on:click={handleExportPdf} disabled={!issues.length}>
        <i class="las la-file-pdf"></i> PDF
      </button>
      <button class="btn btn-secondary btn-sm" on:click={() => isFullscreen = !isFullscreen} title={isFullscreen ? 'Exit full screen (Esc)' : 'Open the tracker full screen'}>
        <i class="las {isFullscreen ? 'la-compress' : 'la-expand'}"></i> {isFullscreen ? 'Exit' : 'Full Screen'}
      </button>
    </div>
  </div>

  <!-- Loading / error / empty -->
  {#if loading}
    <div class="pt-state"><span class="pt-spinner"></span><p>Loading…</p></div>
  {:else if error}
    <div class="pt-state pt-state-error"><i class="las la-exclamation-triangle"></i><p>{error}</p></div>
  {:else if issues.length === 0}
    <div class="pt-empty">
      <i class="las la-tasks pt-empty-icon"></i>
      <p class="pt-empty-title">No issues yet</p>
      <p class="pt-empty-hint">Add the issues you're working through with the client and LPA, one per row.</p>
      <button class="btn btn-primary btn-sm" on:click={() => showAddIssues = true}><i class="las la-plus"></i> Add Issues</button>
    </div>
  {:else}

    <!-- Table -->
    <div class="pt-scroll-top" bind:this={scrollTopEl}><div class="pt-scroll-top-inner"></div></div>
    <div class="pt-table-wrapper" bind:this={tableWrapperEl}>
      <table class="pt-table" bind:this={tableEl}>
        <thead>
          <tr>
            <th class="pt-th pt-th-discipline">
              <button class="pt-th-sort" class:pt-th-sort-active={sortKey === 'discipline'} on:click={() => setSort('discipline')}>
                Discipline <i class="las {sortKey === 'discipline' && sortDir === 'desc' ? 'la-arrow-down' : 'la-arrow-up'}"></i>
              </button>
            </th>
            <th class="pt-th pt-th-title">
              <button class="pt-th-sort" class:pt-th-sort-active={sortKey === 'title'} on:click={() => setSort('title')}>
                Issue <i class="las {sortKey === 'title' && sortDir === 'desc' ? 'la-arrow-down' : 'la-arrow-up'}"></i>
              </button>
            </th>
            <th class="pt-th pt-th-sub">Sub-issues</th>
            {#if hasAnySubIssues}
              <th class="pt-th pt-th-substatus">Sub-issue Status</th>
              <th class="pt-th pt-th-subprogress">Sub-issue Progress</th>
            {/if}
            <th class="pt-th pt-th-mainprogress">Main Issue Progress</th>
            <th class="pt-th pt-th-status">Status</th>
            <th class="pt-th pt-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each sortedIssues as iss (iss.id)}
            {@const editing = editingId === iss.id}
            {@const subRows = iss.sub_issues.length ? iss.sub_issues : [null]}
            {@const span = subRows.length}
            {@const done = iss.status === 'Complete'}
            {#each subRows as sub, si (sub ? `s-${sub.id}` : `e-${iss.id}`)}
            <tr class="pt-row" class:pt-row-editing={editing} class:pt-row-done={done}>

              {#if si === 0}
              <!-- Discipline -->
              <td class="pt-td pt-td-discipline" rowspan={span}>
                {#if editing}
                  <input type="text" class="form-input pt-cell-input" bind:value={editForm.discipline} placeholder="e.g. Heritage" />
                {:else}
                  {#if iss.discipline}<span class="pt-discipline-tag">{iss.discipline}</span>{:else}<span class="pt-cell-muted">—</span>{/if}
                {/if}
              </td>

              <!-- Title -->
              <td class="pt-td pt-td-title" rowspan={span}>
                {#if editing}
                  <input type="text" class="form-input pt-cell-input" bind:value={editForm.title} />
                {:else}
                  <span class="pt-title-text">{iss.title}</span>
                {/if}
              </td>
              {/if}

              <!-- Sub-issue text (one per sub-row) -->
              <td class="pt-td pt-td-sub" class:pt-td-internal={si < span - 1}>
                {#if sub}
                  {#if subEditingId === sub.id}
                    <div class="pt-req-add-row">
                      <input
                        type="text"
                        class="form-input pt-cell-input"
                        bind:value={subEditText}
                        on:keydown={(e) => { if (e.key === 'Enter') saveSubEdit(iss.id); if (e.key === 'Escape') subEditingId = null; }}
                      />
                      <div class="pt-req-btns">
                        <button class="btn btn-icon btn-primary" title="Save" on:click={() => saveSubEdit(iss.id)}><i class="las la-check"></i></button>
                        <button class="btn btn-icon btn-ghost" title="Cancel" on:click={() => subEditingId = null}><i class="las la-times"></i></button>
                      </div>
                    </div>
                  {:else}
                    <div class="pt-req-line">
                      <span class="pt-req-text" class:pt-req-text-complete={sub.status === 'Complete'}>{sub.sub_issue_text}</span>
                      <div class="pt-req-btns pt-req-hover-btns">
                        <button class="btn btn-icon btn-ghost" title="Edit sub-issue" on:click={() => startSubEdit(sub)}><i class="las la-pen"></i></button>
                        <button class="btn btn-icon btn-danger-ghost" title="Delete sub-issue" on:click={() => removeSubIssue(iss.id, sub.id)}><i class="las la-trash"></i></button>
                      </div>
                    </div>
                  {/if}
                {/if}
                {#if si === span - 1}
                  {#if subAddingFor === iss.id}
                    <div class="pt-req-add-row">
                      <input
                        type="text"
                        class="form-input pt-cell-input"
                        bind:value={subAddText}
                        placeholder="New sub-issue…"
                        on:keydown={(e) => { if (e.key === 'Enter') saveSubAdd(iss.id); if (e.key === 'Escape') subAddingFor = null; }}
                      />
                      <div class="pt-req-btns">
                        <button class="btn btn-icon btn-primary" title="Add" on:click={() => saveSubAdd(iss.id)}><i class="las la-check"></i></button>
                        <button class="btn btn-icon btn-ghost" title="Cancel" on:click={() => subAddingFor = null}><i class="las la-times"></i></button>
                      </div>
                    </div>
                  {:else}
                    <button class="pt-progress-empty" title="Add sub-issue" on:click={() => startSubAdd(iss.id)}>
                      <i class="las la-plus"></i> Add
                    </button>
                  {/if}
                {/if}
              </td>

              {#if hasAnySubIssues}
              <!-- Sub-issue status (one per sub-row) -->
              <td class="pt-td pt-td-substatus" class:pt-td-internal={si < span - 1}>
                {#if sub}
                  <select
                    class="form-input pt-status-select {statusClass(sub.status)}"
                    value={sub.status || 'In Progress'}
                    on:change={e => setSubStatus(iss.id, sub, e.target.value)}
                  >
                    {#each SUB_STATUS_OPTIONS as s}<option value={s}>{s}</option>{/each}
                  </select>
                {:else}
                  <span class="pt-cell-muted">—</span>
                {/if}
              </td>

              <!-- Sub-issue Progress (one per sub-row — the drawer, opened from
                   either progress cell, shows the full amalgamated timeline
                   with sub-issue tags kept on each entry) -->
              <td class="pt-td pt-td-subprogress" class:pt-td-internal={si < span - 1}>
                {#if sub}
                  {@const subActions = subIssueActions(iss, sub.id)}
                  {#if subActions.length}
                    {@const latest = subActions[0]}
                    <button class="pt-progress-cell" on:click={() => openTimeline(iss)} title="View full progress timeline">
                      <span class="pt-progress-date">
                        {formatDate(latest.action_date)}
                        {#if latest.stage_name}<span class="pt-progress-stage" style="background:{stageColour(latest.stage_instance_id)}">{latest.stage_name}</span>{/if}
                      </span>
                      <span class="pt-progress-summary">{latest.summary.length > 90 ? latest.summary.slice(0, 90) + '…' : latest.summary}</span>
                      <span class="pt-progress-count">{subActions.length} update{subActions.length !== 1 ? 's' : ''}</span>
                    </button>
                  {:else}
                    <button class="pt-progress-empty" on:click={() => openAddAction(iss.id)} title="Add an advancement for this sub-issue">
                      <i class="las la-plus"></i> Add
                    </button>
                  {/if}
                {:else}
                  <span class="pt-cell-muted">—</span>
                {/if}
              </td>
              {/if}

              {#if si === 0}
              <!-- Main Issue Progress (rowspan — actions not tied to any
                   specific sub-issue) -->
              <td class="pt-td pt-td-mainprogress" rowspan={span}>
                {#if mainIssueActions(iss).length}
                  {@const mainActions = mainIssueActions(iss)}
                  {@const latest = mainActions[0]}
                  <button class="pt-progress-cell" on:click={() => openTimeline(iss)} title="View full progress timeline">
                    <span class="pt-progress-date">
                      {formatDate(latest.action_date)}
                      {#if latest.stage_name}<span class="pt-progress-stage" style="background:{stageColour(latest.stage_instance_id)}">{latest.stage_name}</span>{/if}
                    </span>
                    <span class="pt-progress-summary">{latest.summary.length > 90 ? latest.summary.slice(0, 90) + '…' : latest.summary}</span>
                    <span class="pt-progress-count">{mainActions.length} update{mainActions.length !== 1 ? 's' : ''}</span>
                  </button>
                {:else}
                  <button class="pt-progress-empty" on:click={() => openAddAction(iss.id)} title="Add first advancement">
                    <i class="las la-plus"></i> Add
                  </button>
                {/if}
              </td>

              <!-- Status -->
              <td class="pt-td pt-td-status" rowspan={span}>
                <select
                  class="form-input pt-status-select {statusClass(editing ? editForm.status : iss.status)}"
                  value={editing ? editForm.status : (iss.status || 'In Progress')}
                  on:change={e => editing ? (editForm.status = e.target.value) : updateStatus(iss, e.target.value)}
                >
                  {#each STATUS_OPTIONS as s}<option value={s}>{s}</option>{/each}
                </select>
              </td>

              <!-- Actions -->
              <td class="pt-td pt-td-actions" rowspan={span}>
                {#if editing}
                  <div class="pt-row-btns">
                    <button class="btn btn-icon btn-primary" on:click={() => saveEdit(iss.id)} title="Save"><i class="las la-check"></i></button>
                    <button class="btn btn-icon btn-ghost" on:click={() => editingId = null} title="Cancel"><i class="las la-times"></i></button>
                  </div>
                {:else}
                  <div class="pt-row-btns">
                    <button class="btn btn-icon btn-ghost" on:click={() => startEdit(iss)} title="Edit"><i class="las la-pen"></i></button>
                    <button class="btn btn-icon btn-danger-ghost" on:click={() => removeIssue(iss.id)} title="Delete"><i class="las la-trash"></i></button>
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

    <p class="pt-count">{issues.length} issue{issues.length !== 1 ? 's' : ''}</p>
  {/if}

</div>

<style>
  /* ── Layout ─────────────────────────────────────────────────────────────── */
  .pt-tab { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0; min-height: 200px; }

  .pt-fullscreen {
    position: fixed; inset: 0; z-index: 1500; background: var(--color-white);
    padding: 1.25rem 1.75rem; margin: 0; overflow-y: auto;
  }
  .pt-fullscreen .pt-table { min-width: 100%; font-size: 0.75rem; }
  .pt-fullscreen .pt-th, .pt-fullscreen .pt-td { padding: 0.5rem 0.5rem; }

  /* ── Top bar ─────────────────────────────────────────────────────────────── */
  .pt-topbar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
  .pt-topbar-left, .pt-topbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  .pt-meta-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .pt-meta-badge {
    font-size: 0.72rem; color: var(--color-slate-500); background: var(--color-slate-100); border: 1px solid var(--color-slate-200);
    border-radius: 4px; padding: 2px 8px; display: flex; align-items: center; gap: 4px;
  }

  /* ── States ─────────────────────────────────────────────────────────────── */
  .pt-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 1rem; color: var(--color-slate-500); font-size: 0.875rem; }
  .pt-state-error { color: var(--color-red-600); }
  .pt-empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 1rem; text-align: center; }
  .pt-empty-icon { font-size: 2.5rem; color: var(--color-slate-300); }
  .pt-empty-title { font-size: 1rem; font-weight: 600; color: var(--color-slate-600); margin: 0; }
  .pt-empty-hint { font-size: 0.8rem; color: var(--color-slate-400); margin: 0 0 0.5rem; }
  .pt-count { font-size: 0.75rem; color: var(--color-slate-400); text-align: right; margin: 0; }
  .pt-spinner {
    width: 24px; height: 24px; border: 3px solid var(--color-slate-200); border-top-color: var(--color-primary-600);
    border-radius: 50%; animation: pt-spin 0.8s linear infinite;
  }
  .mini-spinner {
    width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.4); border-top-color: white;
    border-radius: 50%; animation: pt-spin 0.8s linear infinite; display: inline-block;
  }
  @keyframes pt-spin { to { transform: rotate(360deg); } }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  .pt-scroll-top { overflow-x: auto; overflow-y: hidden; height: 12px; }
  .pt-scroll-top-inner { height: 1px; }
  .pt-table-wrapper { overflow-x: auto; border: 1px solid var(--color-slate-200); border-radius: 8px; }
  .pt-table { width: 100%; min-width: 1650px; border-collapse: collapse; font-size: 0.8rem; }
  .pt-th {
    padding: 0.5rem 0.75rem; text-align: left; font-size: 0.7rem; font-weight: 600; color: var(--color-slate-500);
    text-transform: uppercase; letter-spacing: 0.04em; background: var(--color-slate-50); border-bottom: 1px solid var(--color-slate-200); white-space: nowrap;
  }
  .pt-th-sort { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit; }
  .pt-th-sort-active { color: var(--color-primary-600); }
  .pt-th-discipline { min-width: 130px; }
  .pt-th-title { min-width: 220px; }
  .pt-th-sub { min-width: 220px; }
  .pt-th-substatus { min-width: 110px; }
  .pt-th-subprogress { min-width: 230px; }
  .pt-th-mainprogress { min-width: 230px; }
  .pt-th-status { min-width: 130px; }
  .pt-th-actions { width: 80px; }

  .pt-td { padding: 0.6rem 0.75rem; vertical-align: top; border-bottom: 1px solid var(--color-slate-100); }
  .pt-td-internal { border-bottom: 1px dashed var(--color-slate-100); }
  .pt-row-done { background: var(--color-slate-50); }
  .pt-row-editing { background: var(--color-primary-50); }
  .pt-cell-muted { color: var(--color-slate-300); font-size: 0.78rem; }
  .pt-cell-input { width: 100%; font-size: 0.8rem; padding: 0.3rem 0.45rem; }

  .pt-discipline-tag {
    display: inline-block; font-size: 0.7rem; font-weight: 600; color: var(--color-teal-600); background: var(--color-sky-100);
    border-radius: 999px; padding: 2px 9px;
  }
  .pt-title-text { font-weight: 500; color: var(--color-slate-800); }

  .pt-req-line { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.4rem; }
  .pt-req-text { font-size: 0.8rem; color: var(--color-slate-700); line-height: 1.4; }
  .pt-req-text-complete { color: var(--color-slate-400); text-decoration: line-through; }
  .pt-req-hover-btns { opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
  .pt-req-line:hover .pt-req-hover-btns { opacity: 1; }
  .pt-req-btns { display: flex; gap: 2px; }
  .pt-req-add-row { display: flex; gap: 4px; align-items: center; }

  .pt-progress-cell {
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
  .pt-progress-cell:hover { border-color: var(--color-violet-300); background: var(--color-purple-50); }
  .pt-progress-date {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--color-purple-600);
    display: flex; align-items: center; gap: 5px;
  }
  .pt-progress-stage { font-size: 0.62rem; font-weight: 600; color: white; border-radius: 999px; padding: 1px 6px; }
  .pt-progress-summary {
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--color-slate-700);
  }
  .pt-progress-count {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border-radius: 100px;
    padding: 1px 7px;
    margin-top: 2px;
  }
  .pt-progress-empty {
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
  .pt-progress-empty:hover { color: var(--color-purple-600); border-color: var(--color-violet-300); background: var(--color-purple-50); }

  select.pt-status-select {
    font-size: 0.72rem;
    font-weight: 600;
    font-family: inherit;
    padding: 0.2rem 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--color-slate-200);
    cursor: pointer;
    width: 100%;
  }
  select.pt-status-inprogress { background: var(--color-amber-100); color: var(--color-amber-600); border-color: var(--color-yellow-300); }
  select.pt-status-complete   { background: var(--color-emerald-100); color: var(--color-emerald-600); border-color: var(--color-slate-400); }

  .pt-row-btns { display: flex; gap: 2px; }

  /* ── Timeline drawer (mirrors Conditions Tracker's) ────────────────────────── */
  .tl-overlay {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 2100;
    display: flex; justify-content: flex-end;
  }
  .tl-drawer {
    width: min(560px, 100%); height: 100%; background: white; display: flex; flex-direction: column;
    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.2);
  }
  .tl-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;
    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0;
  }
  .tl-title { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--color-slate-800); }
  .tl-subtitle { margin: 0.2rem 0 0; font-size: 0.78rem; color: var(--color-slate-500); }
  .tl-body { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

  .tl-quick-actions { display: flex; gap: 0.5rem; }
  .tl-add-btn {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    padding: 0.55rem; border: 1.5px dashed var(--color-sky-200); border-radius: 8px; background: white;
    color: var(--color-primary-600); font-size: 0.82rem; font-weight: 500; cursor: pointer; font-family: inherit;
  }
  .tl-add-btn:hover { background: var(--color-primary-50); }
  .tl-add-btn-hidden { display: none; }
  .tl-add-btn-secondary { border-style: solid; border-color: var(--color-slate-200); color: var(--color-violet-600); }
  .tl-add-btn-secondary:hover { background: var(--color-purple-50); }

  .tl-add-form { display: flex; flex-direction: column; gap: 0.6rem; border: 1px solid var(--color-slate-200); border-radius: 8px; padding: 0.85rem; background: var(--color-slate-50); }
  .tl-add-row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: var(--color-white);
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .form-input:focus { outline: none; border-color: var(--color-teal-600); box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1); }
  textarea.form-input { resize: vertical; line-height: 1.5; }
  .tl-input { font-size: 0.8rem; }
  .tl-stage-new-input { max-width: 160px; }
  .tl-stage-add-toggle {
    display: flex; align-items: center; gap: 0.25rem; background: none; border: none;
    color: var(--color-primary-600); font-size: 0.75rem; font-weight: 500; cursor: pointer; font-family: inherit;
  }
  .tl-stage-add-toggle:hover { text-decoration: underline; }
  .tl-req-picker { display: flex; flex-direction: column; gap: 0.3rem; background: white; border: 1px solid var(--color-slate-200); border-radius: 6px; padding: 0.5rem; }
  .tl-req-picker-label { font-size: 0.7rem; font-weight: 600; color: var(--color-slate-500); }
  .tl-req-check { display: flex; align-items: flex-start; gap: 0.4rem; font-size: 0.78rem; color: var(--color-slate-700); cursor: pointer; }
  .tl-add-btns { display: flex; justify-content: flex-end; gap: 0.5rem; }
  .tl-notice { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--color-teal-600); background: var(--color-primary-50); border: 1px solid var(--color-sky-200); border-radius: 6px; padding: 0.5rem 0.6rem; }
  .tl-generate-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
  .tl-generate-hint { font-size: 0.72rem; color: var(--color-slate-400); }
  .tl-error { font-size: 0.78rem; color: var(--color-red-600); background: var(--color-red-50); border: 1px solid var(--color-red-200); border-radius: 6px; padding: 0.4rem 0.6rem; }
  .tl-empty { color: var(--color-slate-400); font-size: 0.85rem; text-align: center; padding: 1rem 0; }

  .ct-expand-btn {
    display: inline-block; margin-top: 4px; font-size: 0.72rem; color: var(--color-primary-500);
    background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline;
  }

  /* Linked quotes from surveyor management */
  .tl-quotes {
    display: flex; flex-direction: column; gap: 0.4rem;
    border: 1px solid var(--color-slate-200); border-radius: 10px; padding: 0.75rem 0.875rem; background: var(--color-slate-50);
  }
  .tl-quotes-hd { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .tl-quotes-label {
    font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--color-slate-500); display: flex; align-items: center; gap: 0.3rem;
  }
  .tl-quotes-none { margin: 0; font-size: 0.76rem; color: var(--color-slate-400); }
  .tl-quote-card {
    display: flex; flex-direction: column; gap: 0.4rem;
    background: var(--color-white); border: 1px solid var(--color-slate-200); border-radius: 8px; padding: 0.5rem 0.65rem;
  }
  .tl-quote-chip { display: flex; align-items: center; gap: 0.5rem; }
  .tl-quote-statuses { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .tl-quote-status-pill {
    font-size: 0.68rem; font-weight: 600; color: var(--color-slate-700); background: var(--color-slate-100);
    border-radius: 999px; padding: 1px 8px;
  }
  .tl-quote-keydates { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--color-slate-500); }
  .tl-quote-keydates-label { font-weight: 600; color: var(--color-slate-600); }
  .tl-quote-keydate {
    background: var(--color-red-50); border: 1px solid var(--color-amber-200); color: var(--color-amber-800); border-radius: 6px; padding: 1px 7px;
  }
  .tl-quote-org {
    font-size: 0.78rem; font-weight: 600; color: var(--color-slate-800); flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .tl-quote-meta { font-size: 0.7rem; color: var(--color-slate-500); flex-shrink: 0; }
  .tl-quote-unlink { flex-shrink: 0; }
  .tl-quote-picker {
    display: flex; flex-direction: column; border: 1px solid var(--color-slate-200); border-radius: 8px;
    background: var(--color-white); overflow-y: auto; max-height: 220px;
  }
  .tl-quote-option { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--color-slate-100); }
  .tl-quote-option:last-child { border-bottom: none; }
  .tl-quote-option-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }

  /* Quote / key-date / instruction-status entries in the timeline */
  .tl-entry-marker-quote { background: var(--color-primary-500); }
  .tl-entry-marker-keydate { background: var(--color-amber-500); }
  .tl-entry-marker-status { background: var(--color-emerald-600); }
  .tl-quote-badge {
    display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; font-weight: 600;
    color: var(--color-teal-600); background: var(--color-sky-100); border-radius: 100px; padding: 1px 8px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;
  }
  .tl-keydate-badge { color: var(--color-amber-800); background: var(--color-amber-100); }
  .tl-status-badge { color: var(--color-green-800); background: var(--color-emerald-100); }

  .tl-entries { display: flex; flex-direction: column; gap: 0; }
  .tl-entry { display: flex; gap: 0.75rem; position: relative; padding-bottom: 1.25rem; }
  .tl-entry:not(:last-child)::before {
    content: ''; position: absolute; left: 5px; top: 14px; bottom: 0; width: 2px; background: var(--color-slate-200);
  }
  .tl-entry-marker { width: 12px; height: 12px; border-radius: 50%; margin-top: 4px; flex-shrink: 0; z-index: 1; }
  .tl-entry-content { flex: 1; min-width: 0; }
  .tl-entry-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .tl-entry-date { font-size: 0.78rem; font-weight: 600; color: var(--color-slate-700); }
  .tl-stage-badge { font-size: 0.68rem; font-weight: 600; border-radius: 999px; padding: 1px 8px; }
  .tl-source-badge {
    display: flex; align-items: center; gap: 4px; font-size: 0.68rem; color: var(--color-slate-500);
    background: var(--color-slate-100); border-radius: 999px; padding: 1px 8px;
  }
  .tl-source-email { color: var(--color-teal-600); background: var(--color-sky-100); }
  .tl-source-meeting { color: var(--color-violet-600); background: var(--color-violet-100); }
  .tl-entry-btns { display: flex; gap: 2px; margin-left: auto; }
  .tl-req-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .tl-req-tag { font-size: 0.68rem; color: var(--color-slate-600); background: var(--color-slate-100); border-radius: 4px; padding: 1px 6px; }
  .tl-entry-summary { margin: 0.35rem 0 0; font-size: 0.85rem; color: var(--color-slate-800); line-height: 1.5; }
  .tl-full-text { margin-top: 0.35rem; }
  .tl-full-text summary { font-size: 0.72rem; color: var(--color-primary-600); cursor: pointer; }
  .tl-full-text-body { white-space: pre-wrap; font-size: 0.75rem; color: var(--color-slate-600); background: var(--color-slate-50); border-radius: 6px; padding: 0.5rem; margin-top: 0.3rem; }

  /* ── Shared button primitives (kept local since buttons.css targets .btn) ── */
  .btn-icon { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
</style>
