<script>
  import { onMount } from 'svelte';
  import '$lib/styles/buttons.css';
  import { exportHtmlToWord } from '$lib/services/planningDeliverablesExport.js';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
  import {
    getConsultationData,
    processConsultationDoc,
    createConsultationResponse,
    updateConsultationResponse,
    deleteConsultationResponse,
    markConsultationExported,
    markConsultationIssuedToClient,
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
  let reviewForm = { consultee_name: '', date_received: '', position: '', comments: '', discipline: [], original_consultant: '', original_consultant_email: '' };
  let reviewSaving = false;
  let reviewSourceFile = null;

  // ── Inline editing ────────────────────────────────────────────────────────
  let editingId = null;
  let editForm = {};

  // ── Expand/collapse comments ──────────────────────────────────────────────
  let expandedIds = new Set();

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
    if (!pos) return 'ct-pos-none';
    const p = pos.toLowerCase();
    if (p.includes('objection')) return 'ct-pos-objection';
    if (p.includes('conditional')) return 'ct-pos-conditional';
    if (p.includes('support')) return 'ct-pos-support';
    if (p.includes('no comment') || p.includes('no objection')) return 'ct-pos-no-comment';
    return 'ct-pos-other';
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
        discipline:                joinDisciplines(reviewForm.discipline) || null,
        original_consultant:       reviewForm.original_consultant?.trim() || null,
        original_consultant_email: reviewForm.original_consultant_email?.trim() || null,
        source_file_name:          reviewSourceFile,
      });
      responses = [...responses, created];
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
      consultant_response:       r.consultant_response ?? '',
      response_issued:           r.response_issued ?? false,
      follow_up:                 r.follow_up ?? '',
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
        consultant_response:       editForm.consultant_response || null,
        response_issued:           editForm.response_issued,
        follow_up:                 editForm.follow_up      || null,
        discipline:                joinDisciplines(editForm.discipline) || null,
        original_consultant:       editForm.original_consultant  || null,
        original_consultant_email: editForm.original_consultant_email  || null,
      });
      responses = responses.map(r => r.id === id ? updated : r);
      editingId = null;
    } catch (err) {
      alert(err.message);
    }
  }

  async function toggleResponseIssued(r) {
    try {
      const updated = await updateConsultationResponse(r.id, { response_issued: !r.response_issued });
      responses = responses.map(x => x.id === r.id ? updated : x);
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

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    if (!responses.length) { alert('No responses to export.'); return; }
    const html = buildExportHtml();
    const projectRef = project?.project_reference || project?.site_name || 'Project';
    await exportHtmlToWord(html, `${projectRef} Consultation Tracker.docx`);
    try {
      const updated = await markConsultationExported(projectId);
      meta = { ...meta, ...updated };
    } catch { /* non-fatal */ }
  }

  function buildExportHtml() {
    const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f1f5f9;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${t}</th>`;
    const td = (t) => `<td style="padding:6px 8px;border:1px solid #cbd5e1;vertical-align:top;font-size:12px;">${t || ''}</td>`;
    const rows = responses.map(r => `<tr>
      ${td(r.consultee_name)}
      ${td(r.date_received ? formatDate(r.date_received) : '')}
      ${td(r.position || '')}
      ${td((r.comments || '').replace(/\n/g, '<br>'))}
      ${td((r.consultant_response || '').replace(/\n/g, '<br>'))}
      ${td(r.response_issued ? 'Yes' : 'No')}
      ${td((r.follow_up || '').replace(/\n/g, '<br>'))}
    </tr>`).join('');

    return `<h2>Consultation Tracker</h2>
<p>Project: ${project?.site_name || ''} | Exported: ${formatDate(new Date().toISOString())}</p>
<table style="border-collapse:collapse;width:100%;">
  <thead><tr>${th('Consultee')}${th('Date Received')}${th('Position')}${th('Comments')}${th('Our Response')}${th('Response Issued')}${th('Follow Up')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
  }

  async function handleIssueToClient() {
    try {
      const updated = await markConsultationIssuedToClient(projectId);
      meta = { ...meta, ...updated };
      alert('Marked as issued to client. (Email integration coming soon.)');
    } catch (err) {
      alert(err.message);
    }
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
            <label class="ct-label">Your Notes <span class="ct-label-hint">— flag anything important; these take precedence over the document</span></label>
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
              <option value="">— select —</option>
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

<!-- ── Main tab content ───────────────────────────────────────────────────── -->
<div class="ct-tab">

  <!-- Top bar -->
  <div class="ct-topbar">
    <div class="ct-topbar-left">
      <button class="btn btn-primary" on:click={openPanel}>
        <i class="las la-plus"></i> Process Consultation Response
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
      <button class="btn btn-secondary btn-sm" on:click={handleExport} disabled={!responses.length}>
        <i class="las la-file-word"></i> Export
      </button>
      <button class="btn btn-ghost btn-sm ct-issue-btn" title="Email integration coming soon" on:click={handleIssueToClient} disabled={!responses.length}>
        <i class="las la-paper-plane"></i> Send to Client
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
    <div class="ct-table-wrapper">
      <table class="ct-table">
        <thead>
          <tr>
            <th class="ct-th ct-th-consultee">Consultee</th>
            <th class="ct-th ct-th-date">Date</th>
            <th class="ct-th ct-th-pos">Position</th>
            <th class="ct-th ct-th-comments">Comments</th>
            <th class="ct-th ct-th-response">Our Response</th>
            <th class="ct-th ct-th-issued">Issued</th>
            <th class="ct-th ct-th-followup">Follow Up</th>
            <th class="ct-th ct-th-discipline">Discipline</th>
            <th class="ct-th ct-th-consultant">Original Consultant</th>
            <th class="ct-th ct-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each responses as r (r.id)}
            {@const editing = editingId === r.id}
            <tr class="ct-row" class:ct-row-editing={editing}>

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
                    <option value="">— select —</option>
                    <option>Objection</option>
                    <option>Conditional Support</option>
                    <option>Support</option>
                    <option>No Comment</option>
                  </select>
                {:else}
                  {#if r.position}
                    <span class="ct-pos-badge {positionClass(r.position)}">{r.position}</span>
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

              <!-- Our Response -->
              <td class="ct-td ct-td-response">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.consultant_response} rows="3" placeholder="Response…"></textarea>
                {:else}
                  {#if r.consultant_response}
                    <span class="ct-response-text">{r.consultant_response}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
              </td>

              <!-- Issued -->
              <td class="ct-td ct-td-issued">
                {#if editing}
                  <label class="ct-check-label ct-check-center">
                    <input type="checkbox" bind:checked={editForm.response_issued} />
                  </label>
                {:else}
                  <button
                    class="ct-issued-toggle"
                    class:ct-issued-yes={r.response_issued}
                    on:click={() => toggleResponseIssued(r)}
                    title={r.response_issued ? 'Click to mark not issued' : 'Click to mark issued'}
                  >
                    {#if r.response_issued}
                      <i class="las la-check-circle"></i> Yes
                    {:else}
                      <i class="las la-circle"></i> No
                    {/if}
                  </button>
                {/if}
              </td>

              <!-- Follow Up -->
              <td class="ct-td ct-td-followup">
                {#if editing}
                  <textarea class="form-input ct-cell-input" bind:value={editForm.follow_up} rows="3" placeholder="Follow up…"></textarea>
                {:else}
                  {#if r.follow_up}
                    <span class="ct-followup-text">{r.follow_up}</span>
                  {:else}
                    <span class="ct-cell-muted">—</span>
                  {/if}
                {/if}
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

<style>
  /* ── Layout ─────────────────────────────────────────────────────────────── */
  .ct-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0;
    min-height: 200px;
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
  .ct-table-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .ct-table {
    width: 100%;
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
  .ct-th-consultee  { min-width: 140px; }
  .ct-th-date       { min-width: 100px; }
  .ct-th-pos        { min-width: 120px; }
  .ct-th-comments   { min-width: 220px; max-width: 320px; }
  .ct-th-discipline { min-width: 100px; }
  .ct-th-consultant { min-width: 140px; }
  .ct-th-response   { min-width: 150px; }
  .ct-th-issued     { min-width: 80px; text-align: center; }
  .ct-th-followup   { min-width: 130px; }
  .ct-th-actions    { width: 72px; }

  .ct-row:hover { background: #f8fafc; }
  .ct-row:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }

  .ct-td {
    padding: 0.65rem 0.75rem;
    vertical-align: top;
    color: #334155;
  }
  .ct-td-issued { text-align: center; }

  .ct-consultee-name { font-weight: 500; color: #1e293b; }
  .ct-source-file {
    margin-left: 4px;
    color: #94a3b8;
    font-size: 0.75rem;
  }
  .ct-cell-muted { color: #94a3b8; font-size: 0.78rem; }
  .ct-response-text, .ct-followup-text { font-size: 0.78rem; white-space: pre-wrap; }

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
    background: #e0f2fe;
    color: #0369a1;
    white-space: nowrap;
  }

  /* ── Consultant cell ─────────────────────────────────────────────────────── */
  .ct-orig-consultant-name {
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
    color: #94a3b8;
    font-style: italic;
    line-height: 1.4;
  }

  /* ── Consultant picker dropdown ──────────────────────────────────────────── */
  .ct-picker {
    background: #fff;
    border: 1px solid #cbd5e1;
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
    border-bottom: 1px solid #f1f5f9;
    border-radius: 0;
    font-size: 0.8125rem;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .ct-picker-search:focus {
    outline: none;
    border-bottom-color: #9333ea;
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
    color: #94a3b8;
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
  .ct-picker-item:hover { background: #f8fafc; }
  .ct-picker-org   { font-size: 0.875rem; font-weight: 500; color: #1e293b; }
  .ct-picker-disc  { font-size: 0.75rem; color: #9333ea; }
  .ct-picker-email { font-size: 0.75rem; color: #94a3b8; }
  .ct-picker-empty { padding: 0.75rem 0.875rem; font-size: 0.875rem; color: #94a3b8; margin: 0; text-align: center; }
  .ct-picker-close {
    border-top: 1px solid #f1f5f9;
    border-radius: 0;
    font-size: 0.75rem;
    color: #9333ea;
    padding: 0.5rem;
    background: #fafafa;
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
    display: inline-block;
    padding: 2px 8px;
    border-radius: 100px;
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .ct-pos-objection    { background: #fee2e2; color: #b91c1c; }
  .ct-pos-conditional  { background: #fef9c3; color: #854d0e; }
  .ct-pos-support      { background: #dcfce7; color: #15803d; }
  .ct-pos-no-comment   { background: #f1f5f9; color: #64748b; }
  .ct-pos-other        { background: #ede9fe; color: #6d28d9; }
  .ct-pos-none         {}

  /* ── Comments text ───────────────────────────────────────────────────────── */
  .ct-comments-text {
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

  /* ── Response issued toggle ──────────────────────────────────────────────── */
  .ct-issued-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 3px 8px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ct-issued-toggle:hover { border-color: #94a3b8; }
  .ct-issued-yes {
    color: #16a34a;
    background: #f0fdf4;
    border-color: #86efac;
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
    color: #64748b;
  }
  .ct-required { color: #ef4444; }

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

  .ct-check-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
  }
  .ct-check-center { justify-content: center; }

  /* ── Panel overlay ───────────────────────────────────────────────────────── */
  .ct-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
  }
  .ct-panel {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }
  .ct-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ct-panel-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  /* ── Input tabs ──────────────────────────────────────────────────────────── */
  .ct-input-tabs {
    display: flex;
    gap: 0.5rem;
  }

  /* ── Drop zone ───────────────────────────────────────────────────────────── */
  .ct-drop-zone {
    border: 2px dashed #cbd5e1;
    border-radius: 8px;
    padding: 2rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    text-align: center;
    font-size: 0.875rem;
    color: #64748b;
    transition: border-color 0.15s, background 0.15s;
  }
  .ct-drop-zone:hover, .ct-drop-zone.drag-over {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .ct-drop-icon { font-size: 2rem; color: #94a3b8; }
  .ct-drop-filename { font-weight: 500; color: #334155; }
  .ct-drop-hint { font-size: 0.75rem; color: #94a3b8; }

  /* ── Paste ───────────────────────────────────────────────────────────────── */
  .ct-paste { font-size: 0.8rem; font-family: inherit; }

  /* ── Error ───────────────────────────────────────────────────────────────── */
  .ct-error {
    background: #fee2e2;
    color: #b91c1c;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }

  /* ── Optional extras ────────────────────────────────────────────────────── */
  .ct-extras-toggle {
    align-self: flex-start;
    font-size: 0.78rem;
    color: #64748b;
    padding: 2px 0;
  }
  .ct-label-hint { font-size: 0.72rem; font-weight: 400; color: #94a3b8; }

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
    color: #334155;
  }
  .ct-processing-hint { margin: 0; font-size: 0.78rem; color: #94a3b8; }

  /* ── Review form ─────────────────────────────────────────────────────────── */
  .ct-review-hint { font-size: 0.8rem; color: #64748b; margin: 0; }
  .ct-review-form { display: flex; flex-direction: column; gap: 0.75rem; }
  .ct-comments-textarea { font-size: 0.8rem; font-family: inherit; line-height: 1.6; resize: vertical; }
  .ct-review-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

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
  .ct-spinner-sm { width: 14px; height: 14px; }
  .ct-spinner-lg { width: 36px; height: 36px; border-width: 3px; }
  @keyframes ct-spin { to { transform: rotate(360deg); } }
</style>
