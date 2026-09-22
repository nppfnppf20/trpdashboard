<script>
  import { onMount } from 'svelte';
  import { getNppfPolicies, createNppfPolicy, updateNppfPolicy, deleteNppfPolicy, extractNppfPolicies } from '$lib/api/nppfPolicies.js';

  let policies = [];
  let loading = true;
  let error = null;
  let confirmDeleteId = null;

  onMount(load);

  async function load() {
    loading = true; error = null;
    try { policies = await getNppfPolicies(); }
    catch (err) { error = err.message; }
    finally { loading = false; }
  }

  // ── Manual add/edit modal ─────────────────────────────────────────────
  let modalOpen = false;
  let modalSaving = false;
  let modalError = null;
  let isNew = false;
  let activeId = null;
  let form = { policy_reference: '', policy_name: '', policy_text: '' };

  function openNew() {
    isNew = true;
    activeId = null;
    form = { policy_reference: '', policy_name: '', policy_text: '' };
    modalError = null;
    modalOpen = true;
  }

  function openEdit(p) {
    isNew = false;
    activeId = p.id;
    form = { policy_reference: p.policy_reference || '', policy_name: p.policy_name || '', policy_text: p.policy_text || '' };
    modalError = null;
    modalOpen = true;
  }

  async function save() {
    if (!form.policy_name.trim()) { modalError = 'Policy name is required'; return; }
    if (!form.policy_text.trim()) { modalError = 'Policy text is required'; return; }
    modalSaving = true; modalError = null;
    try {
      const payload = {
        policy_reference: form.policy_reference.trim(),
        policy_name: form.policy_name.trim(),
        policy_text: form.policy_text.trim(),
      };
      if (isNew) {
        const created = await createNppfPolicy(payload);
        policies = [...policies, created];
      } else {
        const updated = await updateNppfPolicy(activeId, payload);
        policies = policies.map(p => p.id === activeId ? updated : p);
      }
      modalOpen = false;
    } catch (err) {
      modalError = err.message;
    } finally {
      modalSaving = false;
    }
  }

  async function confirmDelete(id) {
    try {
      await deleteNppfPolicy(id);
      policies = policies.filter(p => p.id !== id);
    } catch (err) {
      error = err.message;
    } finally {
      confirmDeleteId = null;
    }
  }

  // ── Extract from Document (one-off bulk import) ──────────────────────
  let showExtractModal = false;
  let extractStep = 'input'; // 'input' | 'review'
  let extractMode = 'file'; // 'file' | 'text'
  let extractFile = null;
  let extractText = '';
  let extracting = false;
  let extractError = null;
  let extractWarning = null;
  let extractSourceText = null;
  let showExtractSourceText = false;
  let extractRows = [];
  let extractSaving = false;

  function openExtractModal() {
    showExtractModal = true;
    extractStep = 'input';
    extractMode = 'file';
    extractFile = null;
    extractText = '';
    extractError = null;
    extractWarning = null;
    extractSourceText = null;
    showExtractSourceText = false;
    extractRows = [];
  }

  function closeExtractModal() {
    showExtractModal = false;
  }

  function onExtractFileChange(e) {
    extractFile = e.target.files?.[0] || null;
  }

  function clearRowVerbatim(row, key) {
    if (row._verbatim) row._verbatim = { ...row._verbatim, [key]: null };
  }

  async function runExtract() {
    if (extractMode === 'file' && !extractFile) { extractError = 'Choose a file to upload'; return; }
    if (extractMode === 'text' && !extractText.trim()) { extractError = 'Paste the document text'; return; }
    extracting = true;
    extractError = null;
    extractWarning = null;
    try {
      const { policies: found, sourceText, warning } = await extractNppfPolicies(
        extractMode === 'file' ? { file: extractFile } : { text: extractText }
      );
      if (!found?.length) {
        extractError = 'Could not find any policies in that document.';
        return;
      }
      extractWarning = warning || null;
      extractSourceText = sourceText || null;
      extractRows = found.map(p => ({ ...p, include: true }));
      extractStep = 'review';
    } catch (err) {
      extractError = err.message;
    } finally {
      extracting = false;
    }
  }

  async function saveExtracted() {
    const toSave = extractRows.filter(r => r.include && r.policy_name.trim() && r.policy_text.trim());
    if (!toSave.length) { extractError = 'Nothing selected to save'; return; }
    extractSaving = true;
    extractError = null;
    try {
      const created = [];
      for (const r of toSave) {
        created.push(await createNppfPolicy({
          policy_reference: r.policy_reference.trim(),
          policy_name: r.policy_name.trim(),
          policy_text: r.policy_text.trim(),
        }));
      }
      policies = [...policies, ...created];
      closeExtractModal();
    } catch (err) {
      extractError = err.message;
    } finally {
      extractSaving = false;
    }
  }

  function wordCount(text) {
    if (!text?.trim()) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>NPPF Policy Library</h1>
      <p>Canonical, verbatim NPPF policy wording — maintained once here, then pulled programmatically (no AI re-transcription) whenever a project cites one of these policies.</p>
    </div>
    <div class="header-actions">
      <button class="btn-secondary" on:click={openExtractModal}><i class="las la-file-import"></i> Extract from Document</button>
      <button class="btn-add" on:click={openNew}><i class="las la-plus"></i> Add Policy</button>
    </div>
  </div>

  {#if error}<div class="error-banner">{error}</div>{/if}

  {#if loading}
    <div class="loading">Loading…</div>
  {:else}
    <table class="tpl-table">
      <thead>
        <tr>
          <th>Reference</th>
          <th>Name</th>
          <th>Wording</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each policies as p (p.id)}
          <tr>
            <td class="ref-cell">{#if p.policy_reference}{p.policy_reference}{:else}<span class="muted">—</span>{/if}</td>
            <td class="label-cell">{p.policy_name}</td>
            <td class="text-cell">{wordCount(p.policy_text)}w</td>
            <td class="actions-cell">
              {#if confirmDeleteId === p.id}
                <span class="confirm-delete">
                  Delete?
                  <button class="btn-danger-sm" on:click={() => confirmDelete(p.id)}>Yes</button>
                  <button class="btn-cancel-sm" on:click={() => confirmDeleteId = null}>No</button>
                </span>
              {:else}
                <button class="btn-edit" on:click={() => openEdit(p)}><i class="las la-edit"></i> Edit</button>
                <button class="btn-delete" on:click={() => confirmDeleteId = p.id}><i class="las la-trash"></i></button>
              {/if}
            </td>
          </tr>
        {/each}
        {#if !policies.length}
          <tr><td colspan="4" class="empty-row">No NPPF policies yet. Use "Extract from Document" to bulk-import them, or "Add Policy" for one at a time.</td></tr>
        {/if}
      </tbody>
    </table>
  {/if}
</div>

<!-- Manual Add/Edit Modal -->
{#if modalOpen}
  <div class="modal-backdrop" on:click|self={() => modalOpen = false} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>{isNew ? 'Add NPPF Policy' : form.policy_name}</h2>
        </div>
        <button class="close-btn" on:click={() => modalOpen = false}><i class="las la-times"></i></button>
      </div>

      {#if modalError}<div class="modal-error">{modalError}</div>{/if}

      <div class="modal-body">
        <div class="modal-meta">
          <div class="meta-field">
            <label>Policy Reference</label>
            <input type="text" bind:value={form.policy_reference} placeholder="e.g. Policy T1" />
          </div>
          <div class="meta-field" style="flex: 2;">
            <label>Policy Name <span class="required">*</span></label>
            <input type="text" bind:value={form.policy_name} placeholder="e.g. Sustainable Transport" />
          </div>
        </div>
        <div class="meta-field">
          <label>Policy Text (verbatim) <span class="required">*</span></label>
          <textarea bind:value={form.policy_text} rows="10" placeholder="Paste the exact operative wording of the policy…"></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={() => modalOpen = false} disabled={modalSaving}>Cancel</button>
        <button class="btn-primary" on:click={save} disabled={modalSaving}>
          {modalSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Extract from Document Modal -->
{#if showExtractModal}
  <div class="modal-backdrop" on:click|self={closeExtractModal} role="dialog" aria-modal="true">
    <div class="modal wide-modal">
      <div class="modal-header">
        <div>
          <h2>Extract NPPF Policies from Document</h2>
          <p class="modal-sub">One-off bulk import — upload the NPPF (or paste its text), review the extracted wording against a verbatim check, then save.</p>
        </div>
        <button class="close-btn" on:click={closeExtractModal}><i class="las la-times"></i></button>
      </div>

      <div class="modal-body">
        {#if extractStep === 'input'}
          <div class="extract-mode-toggle">
            <button type="button" class:active={extractMode === 'file'} on:click={() => extractMode = 'file'}>Upload file</button>
            <button type="button" class:active={extractMode === 'text'} on:click={() => extractMode = 'text'}>Paste text</button>
          </div>

          {#if extractMode === 'file'}
            <input type="file" accept=".pdf,.docx,.txt,.md" on:change={onExtractFileChange} />
            {#if extractFile}<p class="extract-filename"><i class="las la-file-alt"></i> {extractFile.name}</p>{/if}
          {:else}
            <textarea bind:value={extractText} rows="14" placeholder="Paste the NPPF text here…"></textarea>
          {/if}
        {:else}
          {#if extractWarning}
            <div class="extract-warning-note"><i class="las la-exclamation-triangle"></i> {extractWarning}</div>
          {/if}
          {#if extractSourceText}
            <div class="extract-note-info">
              <i class="las la-info-circle"></i>
              Rows flagged <span class="verbatim-badge verbatim-flag"><i class="las la-exclamation-triangle"></i> Check this</span> didn't closely match the source text — compare against the original before trusting them.
              <button type="button" class="source-text-toggle" on:click={() => showExtractSourceText = !showExtractSourceText}>
                {showExtractSourceText ? 'Hide' : 'View'} extracted source text
              </button>
              {#if showExtractSourceText}<pre class="source-text-body">{extractSourceText}</pre>{/if}
            </div>
          {/if}

          {#each extractRows as row, i (i)}
            <div class="extract-row-card">
              <label class="row-include">
                <input type="checkbox" bind:checked={row.include} />
              </label>
              <div class="row-fields">
                <div class="row-header-fields">
                  <input type="text" class="ref-input" bind:value={row.policy_reference} placeholder="Reference" />
                  <input
                    type="text"
                    class="name-input"
                    bind:value={row.policy_name}
                    on:input={() => clearRowVerbatim(row, 'policy_name')}
                    placeholder="Policy name"
                  />
                  {#if row._verbatim?.policy_name}
                    <span class="verbatim-badge" class:verbatim-ok={row._verbatim.policy_name.verified} class:verbatim-flag={!row._verbatim.policy_name.verified} title={row._verbatim.policy_name.verified ? 'Closely matches the source document' : `Only ~${Math.round(row._verbatim.policy_name.score * 100)}% match to the source text`}>
                      <i class="las {row._verbatim.policy_name.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i>
                    </span>
                  {/if}
                </div>
                <label class="wording-label">
                  Wording
                  {#if row._verbatim?.policy_text}
                    <span class="verbatim-badge" class:verbatim-ok={row._verbatim.policy_text.verified} class:verbatim-flag={!row._verbatim.policy_text.verified} title={row._verbatim.policy_text.verified ? 'Closely matches the source document' : `Only ~${Math.round(row._verbatim.policy_text.score * 100)}% match to the source text — check against the original`}>
                      <i class="las {row._verbatim.policy_text.verified ? 'la-check-circle' : 'la-exclamation-triangle'}"></i> {row._verbatim.policy_text.verified ? 'Verbatim' : 'Check this'}
                    </span>
                  {/if}
                </label>
                <textarea bind:value={row.policy_text} on:input={() => clearRowVerbatim(row, 'policy_text')} rows="4"></textarea>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      {#if extractError}<div class="modal-error">{extractError}</div>{/if}

      <div class="modal-footer">
        {#if extractStep === 'review'}
          <span class="extract-count-hint">{extractRows.filter(r => r.include && r.policy_name.trim() && r.policy_text.trim()).length} of {extractRows.length} will be saved</span>
        {/if}
        <div class="footer-actions">
          <button class="btn-secondary" on:click={closeExtractModal} disabled={extracting || extractSaving}>Cancel</button>
          {#if extractStep === 'input'}
            <button class="btn-primary" on:click={runExtract} disabled={extracting || (extractMode === 'file' ? !extractFile : !extractText.trim())}>
              {extracting ? 'Extracting…' : 'Extract'}
            </button>
          {:else}
            <button class="btn-primary" on:click={saveExtracted} disabled={extractSaving}>
              {extractSaving ? 'Saving…' : 'Save Selected'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 1200px; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; gap: 1rem; }
  .page-header h1 { margin: 0 0 0.25rem; font-size: 1.5rem; color: var(--color-slate-800); }
  .page-header p { margin: 0; color: var(--color-slate-500); font-size: 0.875rem; max-width: 640px; }
  .header-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

  .btn-add {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.5rem 1.1rem; background: var(--color-primary-600); color: white;
    border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; white-space: nowrap;
  }
  .btn-add:hover { background: var(--color-primary-700); }

  .tpl-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.07); }
  .tpl-table th { background: var(--color-slate-50); padding: 0.75rem 1rem; text-align: left; font-size: 0.8125rem; font-weight: 600; color: var(--color-slate-500); border-bottom: 1px solid var(--color-slate-200); }
  .tpl-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-slate-100); font-size: 0.875rem; color: var(--color-slate-800); vertical-align: middle; }
  .tpl-table tr:last-child td { border-bottom: none; }

  .ref-cell { font-family: monospace; font-size: 0.8rem; color: var(--color-slate-600); white-space: nowrap; }
  .label-cell { font-weight: 500; }
  .text-cell { color: var(--color-slate-500); font-size: 0.8125rem; }
  .muted { color: var(--color-slate-400); }
  .empty-row { text-align: center; color: var(--color-slate-400); padding: 2rem; }

  .actions-cell { white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; }
  .btn-edit { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: var(--color-primary-50); color: var(--color-primary-600); border: 1px solid var(--color-primary-200); border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-edit:hover { background: var(--color-primary-100); }
  .btn-delete { display: inline-flex; align-items: center; padding: 0.35rem 0.5rem; background: var(--color-red-50); color: var(--color-red-600); border: 1px solid var(--color-red-200); border-radius: 5px; font-size: 0.8125rem; cursor: pointer; }
  .btn-delete:hover { background: var(--color-red-100); }
  .confirm-delete { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--color-red-600); }
  .btn-danger-sm { padding: 0.2rem 0.5rem; background: var(--color-red-600); color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
  .btn-cancel-sm { padding: 0.2rem 0.5rem; background: var(--color-slate-100); color: var(--color-slate-700); border: 1px solid var(--color-slate-200); border-radius: 4px; font-size: 0.75rem; cursor: pointer; }

  .loading { padding: 3rem; text-align: center; color: var(--color-slate-500); }
  .error-banner { padding: 1rem; background: var(--color-red-50); color: var(--color-red-600); border-radius: 6px; margin-bottom: 1rem; }

  .modal-backdrop { position: fixed; inset: 0; background: var(--overlay-bg); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { background: white; border-radius: 10px; width: 760px; max-width: 98vw; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); }
  .wide-modal { width: 900px; }
  .modal-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .modal-header h2 { margin: 0 0 0.25rem; font-size: 1.25rem; color: var(--color-slate-800); }
  .modal-sub { margin: 0; font-size: 0.8125rem; color: var(--color-slate-500); }
  .close-btn { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--color-slate-500); padding: 0.25rem; flex-shrink: 0; }
  .close-btn:hover { color: var(--color-slate-800); }
  .modal-error { padding: 0.75rem 1.5rem; background: var(--color-red-50); color: var(--color-red-600); font-size: 0.875rem; flex-shrink: 0; }

  .modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 0.9rem; }
  .modal-meta { display: flex; gap: 1rem; }
  .meta-field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
  .meta-field label { font-size: 0.8125rem; font-weight: 500; color: var(--color-slate-700); }
  .required { color: var(--color-red-500); }
  input[type="text"], textarea {
    padding: 0.5rem 0.625rem; border: 1px solid var(--color-slate-300); border-radius: 6px; font-size: 0.875rem;
    font-family: inherit; color: var(--color-slate-800); resize: vertical;
  }
  input[type="text"]:focus, textarea:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }

  .modal-footer { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--color-slate-200); flex-shrink: 0; }
  .footer-actions { display: flex; gap: 0.75rem; }
  .btn-primary { padding: 0.5rem 1.25rem; background: var(--color-primary-600); color: white; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
  .btn-primary:hover { background: var(--color-primary-700); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.25rem; background: white; color: var(--color-slate-700); border: 1px solid var(--color-slate-300); border-radius: 6px; font-size: 0.875rem; cursor: pointer; }
  .btn-secondary:hover { background: var(--color-slate-50); }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
  .extract-count-hint { font-size: 0.8rem; color: var(--color-slate-500); }

  .extract-mode-toggle { display: flex; gap: 0.5rem; }
  .extract-mode-toggle button {
    padding: 0.4rem 0.9rem; border: 1px solid var(--color-slate-300); background: white; color: var(--color-slate-500);
    border-radius: 6px; font-size: 0.82rem; font-weight: 500; cursor: pointer; font-family: inherit;
  }
  .extract-mode-toggle button.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }
  .extract-filename { display: flex; align-items: center; gap: 0.4rem; margin: 0; font-size: 0.8rem; color: var(--color-slate-600); }

  .extract-warning-note {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.8rem; color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg);
    border-radius: 6px; padding: 0.6rem 0.75rem;
  }

  .extract-note-info {
    font-size: 0.8rem; color: var(--color-slate-600); background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200); border-radius: 6px; padding: 0.6rem 0.75rem;
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;
  }
  .source-text-toggle { background: none; border: none; color: var(--color-primary-600); font-size: 0.78rem; font-weight: 500; cursor: pointer; text-decoration: underline; font-family: inherit; padding: 0; }
  .source-text-body { flex-basis: 100%; max-height: 220px; overflow-y: auto; background: white; border: 1px solid var(--color-slate-200); border-radius: 4px; padding: 0.5rem; font-size: 0.72rem; white-space: pre-wrap; color: var(--color-slate-700); margin: 0.25rem 0 0; }

  .extract-row-card { display: flex; gap: 0.6rem; align-items: flex-start; background: var(--color-slate-50); border: 1px solid var(--color-slate-200); border-radius: 8px; padding: 0.75rem; }
  .row-include { display: flex; align-items: center; padding-top: 0.4rem; }
  .row-include input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer; }
  .row-fields { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
  .row-header-fields { display: flex; align-items: center; gap: 0.5rem; }
  .ref-input { width: 8rem; flex-shrink: 0; font-family: monospace; }
  .name-input { flex: 1; font-weight: 600; }
  .wording-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; font-weight: 600; color: var(--color-slate-600); }

  .verbatim-badge { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.68rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 10px; white-space: nowrap; }
  .verbatim-ok { color: var(--color-badge-success-fg); background: var(--color-badge-success-bg); }
  .verbatim-flag { color: var(--color-badge-warning-fg); background: var(--color-badge-warning-bg); }
</style>
