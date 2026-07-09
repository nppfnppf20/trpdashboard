<script>
  import { createEventDispatcher, tick } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { suggestFeeQuoteWorks, updateCondition, createConditionAdvancements } from '$lib/api/conditions.js';

  export let show = false;
  export let projectId;
  export let project;
  export let conditions = [];

  const dispatch = createEventDispatcher();

  let phase = 'select';   // 'select' | 'generating' | 'editor'
  let selected = {};      // condition_id -> bool
  let seeded = false;
  let error = null;

  // Editor state (one draft at a time, like the surveyor briefings bulk flow)
  let drafts = [];        // [{ condition, toEmail, toName, subject, html }]
  let currentIndex = 0;
  let richTextEditor;
  let toEmail = '';
  let toName = '';
  let currentSubject = '';

  $: projectRef = project?.project_id || '';
  $: projectName = project?.site_name || project?.project_name || '';

  // Seed selection when the modal opens: everything except discharged/informative
  $: if (show && !seeded) {
    selected = {};
    for (const c of conditions) {
      selected[c.id] = !(c.status === 'Discharged' || c.condition_type === 'Informative');
    }
    phase = 'select';
    error = null;
    drafts = [];
    seeded = true;
  }

  $: selectedCount = Object.values(selected).filter(Boolean).length;

  function selectAllConditions() {
    selected = Object.fromEntries(conditions.map(c => [c.id, true]));
  }
  function deselectAllConditions() {
    selected = Object.fromEntries(conditions.map(c => [c.id, false]));
  }

  function conditionLabel(c) {
    return `${c.condition_number ? c.condition_number + '. ' : ''}${c.title}`;
  }

  // ── Template (mirrors the single fee quote email; wording and reason are
  //    inserted verbatim here in code, never rewritten by the LLM) ───────────
  function buildSubject(c) {
    const condLabel = c.condition_number ? `Condition ${c.condition_number}` : 'Condition';
    return `Fee Quote Request - ${condLabel}: ${c.title}${projectRef ? ` (${projectRef})` : ''}`;
  }

  function buildDraftHtml(c, works, name) {
    const greeting = name?.trim() ? `Hi ${name.trim()},` : 'Hi,';
    const projectLine = [projectRef, projectName].filter(Boolean).join(': ');
    const condLabel = c.condition_number ? `Condition ${c.condition_number}: ` : '';
    const wording = (c.wording || '').replace(/\n/g, '<br>');
    const reason = (c.reason || '').replace(/\n/g, '<br>');

    const worksHtml = works?.length
      ? `<ul>${works.map(w => `<li>${w}</li>`).join('')}</ul>`
      : `<p><em>[Our commentary and fee quote request items - add here]</em></p>`;

    return `<p>${greeting}</p>
<p>We have received an approval${projectLine ? ` for <strong>${projectLine}</strong>` : ''} (decision notice attached).</p>
<p>Please can we request a fee quote related to the following condition:</p>
<p><strong>${condLabel}${c.title}</strong></p>
<p><em>"${wording}"</em></p>
${reason ? `<p><em>Reason: "${reason}"</em></p>` : ''}
<p>Can I please request a fee quote for the following works:</p>
${worksHtml}
<p>I'd also welcome your thoughts on whether, in your view, any further works are likely to be required in order to discharge the condition.</p>
<p>It would be much appreciated if you could come back to me with the following:</p>
<ul>
<li>A fee quote</li>
<li>Indicative timescales</li>
<li>Details of any information you require from us</li>
</ul>
<p>Many thanks</p>`;
  }

  // ── Generate ──────────────────────────────────────────────────────────────
  async function generate() {
    const picked = conditions.filter(c => selected[c.id]);
    if (!picked.length) { error = 'Tick at least one condition.'; return; }

    phase = 'generating';
    error = null;
    try {
      const { suggestions } = await suggestFeeQuoteWorks(projectId, picked.map(c => c.id));
      const worksById = Object.fromEntries(suggestions.map(s => [s.condition_id, s.works]));

      drafts = picked.map(c => ({
        condition: c,
        toEmail: c.original_consultant_email || '',
        toName: c.original_consultant || '',
        subject: buildSubject(c),
        html: buildDraftHtml(c, worksById[c.id], c.original_consultant || ''),
        sent: !!c.fee_quote_requested_at,
      }));
      currentIndex = 0;
      phase = 'editor';
      await tick();
      loadDraft();
    } catch (err) {
      error = err.message;
      phase = 'select';
    }
  }

  // ── Editor navigation (edits persist across prev/next) ───────────────────
  function saveCurrentDraft() {
    const d = drafts[currentIndex];
    if (!d) return;
    d.toEmail = toEmail;
    d.toName = toName;
    d.subject = currentSubject;
    if (richTextEditor) d.html = richTextEditor.getHTML();
  }

  function loadDraft() {
    const d = drafts[currentIndex];
    if (!d) return;
    toEmail = d.toEmail;
    toName = d.toName;
    currentSubject = d.subject;
    tick().then(() => richTextEditor?.setHTML(d.html));
  }

  function goPrev() {
    if (currentIndex === 0) return;
    saveCurrentDraft();
    currentIndex -= 1;
    loadDraft();
  }

  function goNext() {
    if (currentIndex >= drafts.length - 1) return;
    saveCurrentDraft();
    currentIndex += 1;
    loadDraft();
  }

  // ── Copy / open in email (same mechanics as the briefings editor) ────────
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  }

  async function handleCopyToClipboard() {
    if (!richTextEditor) return;
    try {
      const htmlContent = richTextEditor.getHTML();
      const plainText = stripHtml(htmlContent);
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
        alert('Email content copied to clipboard!');
      } else {
        fallbackCopyRichText(htmlContent);
      }
    } catch {
      fallbackCopyRichText(richTextEditor.getHTML());
    }
  }

  function fallbackCopyRichText(htmlContent) {
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      document.execCommand('copy');
      alert('Email content copied to clipboard!');
    } catch {
      alert('Failed to copy to clipboard');
    }
    selection.removeAllRanges();
    document.body.removeChild(container);
  }

  function handleOpenInEmail() {
    if (!richTextEditor) return;
    const plainText = stripHtml(richTextEditor.getHTML());
    window.location.href = `mailto:${encodeURIComponent(toEmail.trim())}?subject=${encodeURIComponent(currentSubject || '')}&body=${encodeURIComponent(plainText)}`;
  }

  // Confirm the current draft's fee quote request as sent: stamps the
  // condition and logs a progress entry.
  let sentSaving = false;

  async function handleConfirmSent() {
    const d = drafts[currentIndex];
    if (!d || d.sent || sentSaving) return;
    sentSaving = true;
    try {
      const updated = await updateCondition(d.condition.id, {
        fee_quote_requested_at: new Date().toISOString(),
      });
      const summary = toName?.trim()
        ? `Fee quote request sent to ${toName.trim()}`
        : 'Fee quote request sent';
      const rows = await createConditionAdvancements(projectId, {
        advancement_date: new Date().toISOString().slice(0, 10),
        full_text: null,
        source_type: 'note',
        items: [{ condition_id: d.condition.id, summary }],
      });
      d.sent = true;
      drafts = [...drafts];
      dispatch('sent', { condition: updated, advancements: rows });
    } catch (err) {
      alert(err.message);
    } finally {
      sentSaving = false;
    }
  }

  function handleClose() {
    if (phase === 'generating') return;
    if (phase === 'editor' && !confirm('Close and discard the drafts?')) return;
    show = false;
    seeded = false;
    phase = 'select';
    drafts = [];
    error = null;
    dispatch('close');
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Draft Fee Quote Emails <span class="beta-badge">Beta</span></h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      {#if phase === 'editor' && drafts.length}
        <div class="step-bar">
          <button class="step-nav-btn" on:click={goPrev} disabled={currentIndex === 0} title="Previous email">
            <i class="las la-angle-left"></i>
          </button>
          <div class="step-bar-center">
            <span class="step-count">
              Email {currentIndex + 1} of {drafts.length}
              {#if drafts[currentIndex].sent}<span class="step-sent-badge"><i class="las la-check-double"></i> Sent</span>{/if}
            </span>
            <span class="step-label">{conditionLabel(drafts[currentIndex].condition)}</span>
          </div>
          <button class="step-nav-btn" on:click={goNext} disabled={currentIndex === drafts.length - 1} title="Next email">
            <i class="las la-angle-right"></i>
          </button>
        </div>
      {/if}

      <div class="modal-body">
        {#if error}
          <div class="error-banner"><i class="las la-exclamation-triangle"></i><span>{error}</span></div>
        {/if}

        {#if phase === 'select'}
          <p class="select-hint">
            One draft email is prepared per ticked condition. The condition wording and reason go in verbatim;
            the requested works list is suggested from the condition wording for you to review.
            Discharged and informative conditions are unticked by default.
          </p>
          <div class="select-toolbar">
            <span class="select-count"><strong>{selectedCount}</strong> of {conditions.length} selected</span>
            <div class="select-toolbar-right">
              <button class="btn-link" on:click={deselectAllConditions}>Deselect all</button>
              <button class="btn-link" on:click={selectAllConditions}>Select all</button>
            </div>
          </div>
          <div class="cond-list">
            {#each conditions as c (c.id)}
              <label class="cond-row" class:checked={selected[c.id]}>
                <input type="checkbox" checked={selected[c.id]} on:change={() => selected = { ...selected, [c.id]: !selected[c.id] }} />
                <span class="cond-label">{conditionLabel(c)}</span>
                {#if c.original_consultant}
                  <span class="cond-consultant"><i class="las la-user"></i> {c.original_consultant}</span>
                {/if}
                {#if c.status === 'Discharged'}
                  <span class="cond-tag cond-tag-green">Discharged</span>
                {:else if c.condition_type === 'Informative'}
                  <span class="cond-tag cond-tag-green">Informative</span>
                {/if}
              </label>
            {:else}
              <p class="no-conditions">No conditions in the tracker yet.</p>
            {/each}
          </div>

        {:else if phase === 'generating'}
          <div class="generating">
            <div class="spinner"></div>
            <p class="generating-label">Drafting {selectedCount} email{selectedCount !== 1 ? 's' : ''}…</p>
            <p class="generating-hint">Reading each condition and identifying the works a fee quote is needed for.</p>
          </div>

        {:else if phase === 'editor'}
          <div class="form-row">
            <div class="form-group grow">
              <label for="bfq-to">To</label>
              <input id="bfq-to" type="email" class="text-input" bind:value={toEmail} placeholder="consultant@example.com" />
            </div>
            <div class="form-group grow">
              <label for="bfq-name">Name</label>
              <input id="bfq-name" type="text" class="text-input" bind:value={toName} placeholder="Used in the greeting" />
            </div>
          </div>
          <div class="form-group">
            <label for="bfq-subject">Subject</label>
            <input id="bfq-subject" type="text" class="text-input" bind:value={currentSubject} />
          </div>
          <div class="form-group">
            <label>Email Content <span class="label-hint">remember to attach the decision notice</span></label>
            <RichTextEditor bind:this={richTextEditor} placeholder="Email content…" />
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose} disabled={phase === 'generating'}>
          {phase === 'editor' ? 'Close' : 'Cancel'}
        </button>
        {#if phase === 'select'}
          <button class="btn btn-send" on:click={generate} disabled={selectedCount === 0}>
            <i class="las la-magic"></i> Draft {selectedCount} Email{selectedCount !== 1 ? 's' : ''}
          </button>
        {:else if phase === 'generating'}
          <button class="btn btn-send" disabled>
            <div class="btn-spinner"></div> Drafting…
          </button>
        {:else if phase === 'editor'}
          <button class="btn btn-secondary" on:click={handleCopyToClipboard} disabled={!richTextEditor}>
            <i class="las la-copy"></i> Copy to Clipboard
          </button>
          <button class="btn btn-secondary" on:click={handleOpenInEmail} disabled={!richTextEditor}>
            <i class="las la-envelope"></i> Open in Email
          </button>
          <button class="btn btn-confirm-sent" class:is-sent={drafts[currentIndex]?.sent} on:click={handleConfirmSent} disabled={sentSaving || drafts[currentIndex]?.sent}>
            {#if sentSaving}
              Confirming…
            {:else if drafts[currentIndex]?.sent}
              <i class="las la-check-double"></i> Sent
            {:else}
              <i class="las la-check"></i> Confirm Sent
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .modal-header h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .beta-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7c3aed;
    background: #f3e8ff;
    border: 1px solid #d8b4fe;
    border-radius: 999px;
    padding: 2px 8px;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 32px; height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .close-btn:hover { background: #f1f5f9; color: #1e293b; }

  /* Step bar (copied from the briefings editor) */
  .step-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
    background: #faf5ff;
    border-bottom: 2px solid #d8b4fe;
    flex-shrink: 0;
  }
  .step-bar-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    min-width: 0;
  }
  .step-count {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #7c3aed;
    white-space: nowrap;
  }
  .step-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .step-nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    background: white;
    border: 1.5px solid #d8b4fe;
    border-radius: 6px;
    color: #7c3aed;
    font-size: 1rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .step-nav-btn:hover:not(:disabled) { background: #f3e8ff; border-color: #a855f7; }
  .step-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .select-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
  }
  .select-count { font-size: 0.82rem; color: #475569; }
  .select-toolbar-right { display: flex; gap: 0.75rem; }
  .btn-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.8rem;
    font-family: inherit;
    color: #7c3aed;
    cursor: pointer;
  }
  .btn-link:hover { text-decoration: underline; }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  /* Select phase */
  .select-hint {
    margin: 0;
    font-size: 0.82rem;
    color: #64748b;
    line-height: 1.5;
  }
  .cond-list {
    display: flex;
    flex-direction: column;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow-y: auto;
    max-height: 55vh;
    flex-shrink: 1;
    min-height: 0;
  }
  .cond-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
  }
  .cond-row:last-child { border-bottom: none; }
  .cond-row.checked { background: #faf5ff; }
  .cond-label {
    font-size: 0.83rem;
    font-weight: 500;
    color: #1e293b;
    flex: 1;
    min-width: 0;
  }
  .cond-consultant {
    font-size: 0.72rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  .cond-tag {
    font-size: 0.66rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 1px 8px;
    flex-shrink: 0;
  }
  .cond-tag-green { color: #16a34a; background: #dcfce7; }
  .no-conditions {
    margin: 0;
    padding: 0.75rem;
    font-size: 0.82rem;
    color: #94a3b8;
    text-align: center;
  }

  /* Generating phase */
  .generating {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 3rem 1rem;
    text-align: center;
    min-height: 180px;
  }
  .generating-label { margin: 0; font-size: 0.9rem; font-weight: 500; color: #334155; }
  .generating-hint  { margin: 0; font-size: 0.78rem; color: #94a3b8; }
  .spinner {
    width: 36px; height: 36px;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Editor phase */
  .form-row { display: flex; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .form-group.grow { flex: 1; min-width: 0; }
  .form-group label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }
  .label-hint { font-weight: 400; color: #94a3b8; font-size: 0.78rem; }
  .text-input {
    padding: 0.625rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: #1e293b;
    background: white;
    width: 100%;
    box-sizing: border-box;
  }
  .text-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary {
    background: white;
    color: #475569;
    border: 1px solid #cbd5e1;
  }
  .btn-secondary:hover:not(:disabled) { background: #f8fafc; }
  .btn-send { background: #9333ea; color: white; }
  .btn-send:hover:not(:disabled) { background: #7e22ce; }
  .btn-confirm-sent { background: #16a34a; color: white; }
  .btn-confirm-sent:hover:not(:disabled) { background: #15803d; }
  .btn-confirm-sent.is-sent {
    background: #dcfce7;
    color: #16a34a;
    opacity: 1;
  }
  .step-sent-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: 6px;
    color: #16a34a;
    background: #dcfce7;
    border-radius: 999px;
    padding: 0 7px;
    font-size: 0.68rem;
  }
  .btn-spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
</style>
