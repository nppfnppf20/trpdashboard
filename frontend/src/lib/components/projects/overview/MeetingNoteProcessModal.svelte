<script>
  // Standalone popup version of MeetingNotesTab's "Summarise Meeting" card +
  // post-process review step, so dropping a file/pasting text on the
  // Overview page's Meeting Notes widget can be handled without navigating
  // away to the full Meeting Notes page. Deliberately a separate component
  // (not shared with MeetingNotesTab.svelte) — see project memory on this
  // decision. Mirrors that tab's submitUpload/saveReview/reviewAddToIssuesTracker
  // logic; keep the two in sync by hand if that flow changes.
  import { onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import AddActionModal from '$lib/components/projects/AddActionModal.svelte';
  import KeyDateSuggestionCard from '$lib/components/projects/KeyDateSuggestionCard.svelte';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
  import { processMeetingNote, processMultiProjectNote, updateMeetingSummary } from '$lib/api/meetingNotes.js';
  import { getProjects } from '$lib/api/projects.js';
  import { createProgrammeEvent } from '$lib/api/quotes.js';
  import { bumpKeyDatesVersion } from '$lib/stores/keyDates.js';

  export let project;
  export let initialFile = null;
  export let initialText = null;
  export let multiProject = false; // set by the widget's own checkbox — decides whether the project picker shows at all
  export let onClose = () => {};
  export let onSaved = () => {}; // (note) => void — called once the summary is saved, so the widget can refresh its recent-notes list without waiting for this popup to close

  $: projectId = project?.id;

  let inputTab = initialFile ? 'upload' : 'paste';
  let uploadFile = initialFile;
  let pasteText = initialText || '';
  let userNotes = '';
  let agenda = '';
  let summaryType = 'brief';
  let provider = '';
  let customPrompt = '';
  let showExtras = false;
  let processing = false;
  let error = null;
  let dragOver = false;
  let fileInput;

  // ── Multi-project ────────────────────────────────────────────────────────
  // Whether this is a multi-project note is decided by the widget's own
  // checkbox before this modal ever opens (see `multiProject` prop) — this
  // modal only surfaces the project picker, not the on/off toggle itself.
  let allProjects = [];
  let multiOtherLabels = []; // bound to MultiSelectDropdown — "Name (#id)" labels, disambiguated
  let multiCreateCombined = true;
  let reviewOtherProjectNames = []; // set when this note came from a multi-project upload
  let reviewCombinedCreated = false; // set when a combined note was also created

  $: otherProjectOptions = allProjects
    .filter(p => p.id !== projectId)
    .map(p => ({ id: p.id, label: `${p.project_name} (#${p.id})` }));
  $: multiOtherIds = multiOtherLabels
    .map(label => otherProjectOptions.find(o => o.label === label)?.id)
    .filter(id => id != null);

  onMount(async () => {
    if (!multiProject) return;
    try {
      allProjects = await getProjects();
    } catch (err) {
      console.error('Failed to load projects for multi-project picker:', err);
    }
  });

  $: summaryTypeLabel = summaryType === 'brief' ? 'Brief' : summaryType === 'detailed' ? 'Detailed' : 'Custom';
  $: providerLabel = provider === 'anthropic' ? 'Claude' : provider === 'openai' ? 'GPT-5.6' : 'Default AI';

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    const file = e.dataTransfer.files[0];
    if (file) { uploadFile = file; inputTab = 'upload'; }
  }

  function handleFileChange(e) {
    uploadFile = e.target.files[0] || null;
  }

  // ── Review step — reviewTranscript being set is what switches this popup
  // from the upload form to the review step (see the template below). ──────
  let reviewTranscript = null;
  let reviewSummaryHtml = '';
  let reviewEditor;
  let reviewSaving = false;
  let reviewSaved = false;
  let reviewError = null;
  let reviewDateSuggestions = [];

  async function submitUpload() {
    if (inputTab === 'upload' && !uploadFile) { error = 'Please select a file to upload.'; return; }
    if (inputTab === 'paste' && !pasteText.trim()) { error = 'Please paste the transcript text.'; return; }
    if (multiProject && multiOtherIds.length === 0) { error = 'Tick at least one other project.'; return; }

    processing = true;
    error = null;
    try {
      let transcript, summaryHtml, dateSuggestions, otherProjectNames = [], combinedCreated = false;

      if (multiProject) {
        const result = await processMultiProjectNote({
          file: inputTab === 'upload' ? uploadFile : null,
          text: inputTab === 'paste' ? pasteText : null,
          projectIds: [projectId, ...multiOtherIds],
          createIndividual: true,
          createCombined: multiCreateCombined,
          userNotes: userNotes.trim() || null,
          agenda: agenda.trim() || null,
          summaryType,
          customPrompt: summaryType === 'custom' ? customPrompt.trim() || null : null,
          provider: provider || null
        });

        const mine = result.projectNotes.find(pn => pn.project_id === projectId);
        transcript = mine.transcript;
        summaryHtml = mine.summary?.summary_html || '';
        otherProjectNames = result.projectNotes.filter(pn => pn.project_id !== projectId).map(pn => pn.project_name);
        combinedCreated = !!result.combinedNote;
        dateSuggestions = []; // multi-project path doesn't extract date suggestions
      } else {
        const result = await processMeetingNote(projectId, {
          file: inputTab === 'upload' ? uploadFile : null,
          text: inputTab === 'paste' ? pasteText : null,
          userNotes: userNotes.trim() || null,
          agenda: agenda.trim() || null,
          summaryType,
          customPrompt: summaryType === 'custom' ? customPrompt.trim() || null : null,
          provider: provider || null
        });

        transcript = result.transcript;
        summaryHtml = result.summary?.summary_html || '';
        dateSuggestions = result.dateSuggestions || [];
      }

      reviewTranscript = {
        id: transcript.id,
        title: transcript.title,
        meeting_date: transcript.meeting_date,
        attendees_text: transcript.attendees_text,
      };
      reviewSummaryHtml = summaryHtml;
      reviewDateSuggestions = dateSuggestions.map((d, i) => ({ ...d, _key: i }));
      reviewOtherProjectNames = otherProjectNames;
      reviewCombinedCreated = combinedCreated;
      reviewSaving = false;
      reviewSaved = false;
      reviewError = null;
    } catch (err) {
      error = err.message;
    } finally {
      processing = false;
    }
  }

  async function saveReview() {
    reviewSaving = true;
    reviewError = null;
    try {
      const html = reviewEditor?.getHTML() ?? reviewSummaryHtml;
      const updated = await updateMeetingSummary(reviewTranscript.id, html);
      reviewSaved = true;
      onSaved({ ...reviewTranscript, summary_html: updated.summary_html });
    } catch (err) {
      reviewError = err.message;
    } finally {
      reviewSaving = false;
    }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── "Add to Project Tracker?" hop ───────────────────────────────────────
  let showDraftIssuesModal = false;

  function reviewAddToIssuesTracker() {
    showDraftIssuesModal = true;
  }

  async function acceptReviewDateSuggestion(suggestion) {
    try {
      await createProgrammeEvent(project.unique_id, { title: suggestion.title, date: suggestion.date });
      bumpKeyDatesVersion();
      return true;
    } catch (err) {
      alert('Failed to add key date: ' + err.message);
      return false;
    }
  }

  // Whole popup closes once the Issues Tracker hop is resolved either way —
  // unlike the full tab (where that modal sits on top of a page that stays
  // open), here the modal *is* the whole flow.
  function issuesModalDone() {
    showDraftIssuesModal = false;
    onClose();
  }

  function issuesModalClosed() {
    showDraftIssuesModal = false;
    onClose();
  }

  function handleClose() {
    if (processing || reviewSaving) return;
    onClose();
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="mnp-backdrop" role="dialog" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && handleClose()}>
  <div class="mnp-modal">
    <div class="mnp-header">
      <div>
        {#if reviewTranscript}
          <h2 class="mnp-title">{reviewTranscript.title}</h2>
          <p class="mnp-meta">
            {formatDate(reviewTranscript.meeting_date)}
            {#if reviewTranscript.attendees_text} &bull; {reviewTranscript.attendees_text}{/if}
          </p>
        {:else}
          <h2 class="mnp-title">Summarise Meeting</h2>
          <p class="mnp-meta">Processed here on the Overview page — no need to open the full Meeting Notes page.</p>
        {/if}
      </div>
      <button class="btn btn-icon btn-ghost mnp-close-btn" on:click={handleClose} disabled={processing || reviewSaving} title="Close" aria-label="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    {#if !reviewTranscript}
      <!-- ── Upload / options form ── -->
      <div class="mnp-body">
        <div class="mnp-input-tabs">
          <button class="btn btn-sm" class:btn-secondary={inputTab === 'upload'} class:btn-ghost={inputTab !== 'upload'} on:click={() => inputTab = 'upload'}>
            <i class="las la-upload"></i> Upload File
          </button>
          <button class="btn btn-sm" class:btn-secondary={inputTab === 'paste'} class:btn-ghost={inputTab !== 'paste'} on:click={() => inputTab = 'paste'}>
            <i class="las la-clipboard"></i> Paste Text
          </button>
        </div>

        {#if inputTab === 'upload'}
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <div
            class="mnp-drop-zone"
            class:drag-over={dragOver}
            role="button"
            tabindex="0"
            on:dragover|preventDefault={() => dragOver = true}
            on:dragleave={() => dragOver = false}
            on:drop={handleDrop}
            on:click={() => fileInput.click()}
            on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
          >
            {#if uploadFile}
              <i class="las la-file-alt mnp-drop-icon"></i>
              <span class="mnp-drop-filename">{uploadFile.name}</span>
              <span class="mnp-drop-hint">Click to change file</span>
            {:else}
              <i class="las la-cloud-upload-alt mnp-drop-icon"></i>
              <span>Drop a file here or click to browse</span>
              <span class="mnp-drop-hint">PDF, DOCX or TXT</span>
            {/if}
          </div>
          <input bind:this={fileInput} type="file" accept=".pdf,.docx,.txt" style="display:none" on:change={handleFileChange} />
        {:else}
          <textarea class="form-input mnp-paste" bind:value={pasteText} placeholder="Paste the meeting transcript here…" rows="4"></textarea>
        {/if}

        {#if multiProject}
          <div class="form-group">
            <label>Also applies to</label>
            <MultiSelectDropdown
              options={otherProjectOptions}
              bind:selected={multiOtherLabels}
              placeholder="Select other project(s)…"
            />
          </div>
          <label class="mnp-checkbox-row">
            <input type="checkbox" bind:checked={multiCreateCombined} />
            Also create a combined note covering all of them
          </label>
        {/if}

        <button class="btn btn-ghost btn-sm mnp-extras-toggle" on:click={() => showExtras = !showExtras}>
          <i class="las la-{showExtras ? 'angle-up' : 'angle-right'}"></i>
          {showExtras ? 'Hide' : 'Show'} options
          {#if !showExtras}<span class="mnp-options-summary">· {summaryTypeLabel} summary · {providerLabel}</span>{/if}
        </button>
        {#if showExtras}
          <div class="mnp-type-row">
            <span class="mnp-type-label">Summary</span>
            <button class="btn btn-sm" class:btn-primary={summaryType === 'brief'} class:btn-secondary={summaryType !== 'brief'} on:click={() => summaryType = 'brief'}>Brief <span class="mnp-type-sub">· 1 page</span></button>
            <button class="btn btn-sm" class:btn-primary={summaryType === 'detailed'} class:btn-secondary={summaryType !== 'detailed'} on:click={() => summaryType = 'detailed'}>Detailed <span class="mnp-type-sub">· 3-4 pages</span></button>
            <button class="btn btn-sm" class:btn-primary={summaryType === 'custom'} class:btn-secondary={summaryType !== 'custom'} on:click={() => summaryType = 'custom'}>Custom</button>
            <span class="mnp-type-label mnp-provider-label">LLM</span>
            <select class="mnp-provider-select" bind:value={provider} title="AI model used to generate this summary - Default uses the AI Providers admin setting">
              <option value="">Default</option>
              <option value="anthropic">Claude</option>
              <option value="openai">GPT-5.6</option>
            </select>
          </div>
          {#if summaryType === 'custom'}
            <p class="mnp-custom-hint"><i class="las la-info-circle"></i> Describe the format you want in the Custom Instructions field below.</p>
          {/if}
          <div class="form-row">
            <div class="form-group">
              <label>Agenda</label>
              <textarea class="form-input" bind:value={agenda} rows="3" placeholder="Paste the meeting agenda…"></textarea>
            </div>
            <div class="form-group">
              <label>Consultant Notes</label>
              <textarea class="form-input" bind:value={userNotes} rows="3" placeholder="Your own notes, included verbatim in the summary…"></textarea>
            </div>
          </div>
          {#if summaryType === 'custom'}
            <div class="form-group">
              <label>Custom Instructions</label>
              <textarea class="form-input" bind:value={customPrompt} rows="3" placeholder="e.g. Produce a short bullet-point briefing note focused on planning policy. Include a risk register at the end."></textarea>
            </div>
          {/if}
        {/if}

        {#if error}<div class="mnp-error">{error}</div>{/if}
      </div>

      <div class="mnp-footer">
        <button class="btn btn-secondary btn-sm" on:click={handleClose} disabled={processing}>Cancel</button>
        <button class="btn btn-primary mnp-process-btn" on:click={submitUpload} disabled={processing}>
          {#if processing}<span class="mnp-spinner"></span> Processing…{:else}<i class="las la-magic"></i> Process{/if}
        </button>
      </div>

    {:else if !reviewSaved}
      <!-- ── Review AI summary ── -->
      <div class="mnp-body mnp-review-body">
        <section>
          <h3 class="mnp-review-section-title">Meeting Notes</h3>
          <RichTextEditor bind:this={reviewEditor} content={reviewSummaryHtml} placeholder="Meeting summary…" fullHeight={false} />
        </section>
        {#if reviewError}<p class="mnp-error-sm">{reviewError}</p>{/if}
      </div>
      <div class="mnp-footer">
        <button class="btn btn-secondary btn-sm" on:click={handleClose} disabled={reviewSaving}>Close without saving</button>
        <button class="btn btn-primary" on:click={saveReview} disabled={reviewSaving}>
          {#if reviewSaving}<span class="mnp-spinner"></span> Saving…{:else}<i class="las la-save"></i> Save{/if}
        </button>
      </div>

    {:else}
      <!-- ── Post-save — Issues Tracker hop ── -->
      <div class="mnp-body mnp-review-body">
        {#if reviewOtherProjectNames.length || reviewCombinedCreated}
          <p class="mnp-multi-project-note">
            {#if reviewOtherProjectNames.length}Also created tailored notes for: {reviewOtherProjectNames.join(', ')}.{/if}
            {#if reviewCombinedCreated}A combined note covering all {reviewOtherProjectNames.length + 1} projects was also created — find it on the Meeting Notes page.{/if}
          </p>
        {/if}
        <div class="mnp-issues-prompt">
          <span class="mnp-issues-prompt-text"><i class="las la-list-alt"></i> Saved. Add "{reviewTranscript.title}" to the Project Tracker?</span>
          <div class="mnp-issues-prompt-actions">
            <button class="btn btn-primary btn-sm" on:click={reviewAddToIssuesTracker}>
              <i class="las la-magic"></i> Yes, draft from this note
            </button>
            <button class="btn btn-ghost btn-sm" on:click={onClose}>No, done</button>
          </div>
        </div>
        {#if reviewDateSuggestions.length}
          <div class="mnp-date-suggestions">
            {#each reviewDateSuggestions as d (d._key)}
              <KeyDateSuggestionCard suggestion={d} onAccept={() => acceptReviewDateSuggestion(d)} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<AddActionModal
  bind:show={showDraftIssuesModal}
  {projectId}
  initialMode="meeting-notes"
  preselectedTranscriptId={reviewTranscript?.id ?? null}
  on:done={issuesModalDone}
  on:close={issuesModalClosed}
/>

<style>
  .mnp-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }
  .mnp-modal {
    background: var(--color-white);
    border-radius: 10px;
    box-shadow: var(--shadow-modal);
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .mnp-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }
  .mnp-title { font-size: 1.1rem; font-weight: 600; color: var(--color-slate-800); margin: 0 0 0.2rem; }
  .mnp-meta { font-size: 0.8rem; color: var(--color-slate-500); margin: 0; }
  .mnp-close-btn { flex-shrink: 0; }

  .mnp-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 0.6rem; }
  .mnp-review-body { gap: 1.25rem; }
  .mnp-review-section-title { margin: 0 0 0.5rem; font-size: 0.85rem; font-weight: 600; color: var(--color-slate-800); }

  .mnp-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    padding: 0.85rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    flex-shrink: 0;
  }

  .mnp-input-tabs { display: flex; gap: 0.35rem; }

  .mnp-drop-zone {
    border: 2px dashed var(--color-primary-200);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    text-align: center;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .mnp-drop-zone:hover, .mnp-drop-zone.drag-over { background: var(--color-primary-50); border-color: var(--color-primary-500); }
  .mnp-drop-icon { font-size: 1.4rem; color: var(--color-primary-200); }
  .mnp-drop-filename { font-weight: 600; color: var(--color-slate-800); font-size: 0.875rem; }
  .mnp-drop-hint { font-size: 0.75rem; color: var(--color-slate-400); }

  .mnp-paste { min-height: 84px; }

  .mnp-extras-toggle { font-size: 0.8rem; align-self: flex-start; }
  .mnp-options-summary { color: var(--color-slate-400); font-weight: 400; }

  .mnp-type-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .mnp-type-label { font-size: 0.8rem; color: var(--color-slate-500); white-space: nowrap; }
  .mnp-type-sub { font-size: 0.7rem; opacity: 0.8; }
  .mnp-provider-label { margin-left: auto; }
  .mnp-provider-select {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: var(--color-white);
    cursor: pointer;
  }
  .mnp-provider-select:focus { outline: none; border-color: var(--color-primary-600); }
  .mnp-custom-hint { font-size: 0.8rem; color: var(--color-primary-500); margin: 0; display: flex; align-items: center; gap: 0.35rem; }

  .mnp-error {
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 6px;
    padding: 0.6rem 0.85rem;
    color: var(--color-red-800);
    font-size: 0.875rem;
  }
  .mnp-error-sm { color: var(--color-red-600); font-size: 0.8rem; margin: 0.25rem 0 0; }

  .mnp-checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.8125rem; color: var(--color-slate-700); cursor: pointer; }
  .mnp-checkbox-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--color-primary-500); cursor: pointer; }
  .mnp-multi-project-note { font-size: 0.8125rem; color: var(--color-slate-600); margin: 0; }

  .mnp-issues-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: 8px;
    padding: 0.6rem 0.85rem;
  }
  .mnp-issues-prompt-text {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--color-primary-700);
  }
  .mnp-issues-prompt-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .mnp-date-suggestions { display: flex; flex-direction: column; gap: 0.5rem; }

  .mnp-spinner {
    display: inline-block;
    width: 0.85rem; height: 0.85rem;
    border: 2px solid var(--color-primary-200);
    border-top-color: var(--color-white);
    border-radius: 50%;
    animation: mnp-spin 0.7s linear infinite;
  }
  @keyframes mnp-spin { to { transform: rotate(360deg); } }
</style>
