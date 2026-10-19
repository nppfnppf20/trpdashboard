<script>
  import { onMount, onDestroy } from 'svelte';
  import PolicyAsk from '$lib/components/company-policies/PolicyAsk.svelte';
  import PolicyViewerModal from '$lib/components/company-policies/PolicyViewerModal.svelte';
  import PolicyFolderTree from '$lib/components/company-policies/PolicyFolderTree.svelte';
  import { folderOptions, scopeIds, folderPath } from '$lib/utils/policyFolders.js';
  import {
    getCompanyPolicies,
    getCompanyPolicyFolders,
    createCompanyPolicyFolder,
    updateCompanyPolicyFolder,
    deleteCompanyPolicyFolder,
    uploadCompanyPolicy,
    updateCompanyPolicy,
    reindexCompanyPolicy,
    getCompanyPolicyFileUrl,
    deleteCompanyPolicy
  } from '$lib/api/companyPolicies.js';

  let policies = [];
  /** Flat folder rows from the API. @type {any[]} */
  let folders = [];
  /** What the library is showing: everything, documents with no folder, or one folder (and what is in it). @type {'all' | 'unfiled' | number} */
  let selected = 'all';
  /** The folder the chat searches, or null for all documents. @type {number | null} */
  let scopeFolderId = null;
  let loading = true;
  let error = null;
  let showHistory = false;
  let confirmDeleteId = null;
  let busyId = null;

  const STATUS = {
    uploaded: { label: 'Awaiting indexing', cls: 'badge-neutral' },
    processing: { label: 'Processing', cls: 'badge-info' },
    ready: { label: 'Ready', cls: 'badge-success' },
    failed: { label: 'Failed', cls: 'badge-danger' }
  };

  onMount(load);
  onDestroy(() => clearTimeout(pollTimer));

  async function load({ silent = false } = {}) {
    if (!silent) {
      loading = true;
      error = null;
    }
    try {
      const [docs, folderData] = await Promise.all([
        getCompanyPolicies({ includeHistory: showHistory }),
        getCompanyPolicyFolders()
      ]);
      policies = docs;
      folders = folderData.folders;
      // A folder that no longer exists can't stay selected or be the chat's scope
      if (typeof selected === 'number' && !folders.some(f => f.id === selected)) selected = 'all';
      if (scopeFolderId != null && !folders.some(f => f.id === scopeFolderId)) scopeFolderId = null;
    } catch (err) {
      if (!silent) error = err.message;
    } finally {
      loading = false;
      schedulePoll();
    }
  }

  // Indexing runs in the background, so refresh quietly while anything is still processing.
  let pollTimer;
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (policies.some(p => p.status === 'processing')) {
      pollTimer = setTimeout(() => load({ silent: true }), 3000);
    }
  }

  async function reindex(p) {
    busyId = p.id;
    error = null;
    try {
      await reindexCompanyPolicy(p.id);
      await load({ silent: true });
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  // ── Library filter ──────────────────────────────────────────────────────────
  let filterText = '';
  $: needle = filterText.trim().toLowerCase();
  $: inFolder = selected === 'all'
    ? policies
    : selected === 'unfiled'
      ? policies.filter(p => p.folder_id == null)
      : policies.filter(p => scopeIds(folders, selected).includes(p.folder_id));
  $: visibleDocs = needle
    ? inFolder.filter(p => [p.title, folderPath(folders, p.folder_id), p.original_filename].some(v => (v || '').toLowerCase().includes(needle)))
    : inFolder;

  // The chat can only answer once something in its scope is indexed
  $: askReady = policies.some(p =>
    p.is_current && p.status === 'ready' &&
    (scopeFolderId == null || scopeIds(folders, scopeFolderId).includes(p.folder_id))
  );

  // ── Folder tree actions ─────────────────────────────────────────────────────
  let folderError = null;
  /** @type {{ mode: 'new' | 'edit', id: number | null, name: string, parentId: number | '', error: string | null, saving: boolean } | null} */
  let folderModal = null;

  $: parentChoices = folderOptions(folders, {
    exclude: folderModal?.mode === 'edit' ? folderModal.id : null,
    movingId: folderModal?.mode === 'edit' ? folderModal.id : null
  });

  function openNewFolder(parentId = null) {
    folderModal = { mode: 'new', id: null, name: '', parentId: parentId ?? '', error: null, saving: false };
  }

  function openEditFolder(folder) {
    folderModal = { mode: 'edit', id: folder.id, name: folder.name, parentId: folder.parent_id ?? '', error: null, saving: false };
  }

  async function saveFolder() {
    if (!folderModal) return;
    const name = folderModal.name.trim();
    if (!name) { folderModal.error = 'Give the folder a name'; return; }
    folderModal.saving = true;
    folderModal.error = null;
    const parentId = folderModal.parentId === '' ? null : folderModal.parentId;
    try {
      if (folderModal.mode === 'new') {
        const created = await createCompanyPolicyFolder(name, parentId);
        selected = created.id;
      } else {
        await updateCompanyPolicyFolder(folderModal.id, { name, parent_id: parentId });
      }
      folderModal = null;
      await load({ silent: true });
    } catch (err) {
      if (folderModal) { folderModal.error = err.message; folderModal.saving = false; }
    }
  }

  async function removeFolder(folder) {
    folderError = null;
    try {
      await deleteCompanyPolicyFolder(folder.id);
      await load({ silent: true });
    } catch (err) {
      folderError = err.message;
    }
  }

  // Drag a document onto a folder (or "Unfiled")
  async function fileDocument(docId, folderId) {
    folderError = null;
    const doc = policies.find(p => p.id === docId);
    if (!doc || doc.folder_id === folderId) return;
    try {
      await updateCompanyPolicy(docId, { folder_id: folderId });
      await load({ silent: true });
    } catch (err) {
      folderError = err.message;
    }
  }

  function startDocDrag(e, p) {
    e.dataTransfer.setData('application/x-policy-doc', String(p.id));
    e.dataTransfer.effectAllowed = 'move';
  }

  // ── Document viewer ─────────────────────────────────────────────────────────
  /** @type {{ documentId: number, chunkIndex: number | null, page: number | null } | null} */
  let viewer = null;

  function openViewer(documentId, chunkIndex = null, page = null) {
    viewer = { documentId, chunkIndex, page };
  }

  // ── Upload / new version / edit modal ───────────────────────────────────────
  let modalOpen = false;
  let modalMode = 'new'; // 'new' | 'version' | 'edit'
  let activeDoc = null;
  let saving = false;
  let modalError = null;
  let file = null;
  let form = blankForm();

  /** @returns {{ title: string, folder_id: number | '', version: string, effective_date: string, visibility: string }} */
  function blankForm() {
    return { title: '', folder_id: '', version: '1', effective_date: '', visibility: 'all' };
  }

  $: folderChoices = folderOptions(folders);

  function openNew() {
    modalMode = 'new';
    activeDoc = null;
    file = null;
    form = { ...blankForm(), folder_id: typeof selected === 'number' ? selected : '' }; // upload into the folder you are looking at
    modalError = null;
    modalOpen = true;
  }

  function openVersion(p) {
    modalMode = 'version';
    activeDoc = p;
    file = null;
    form = {
      title: p.title,
      folder_id: p.folder_id ?? '',
      version: nextVersion(p.version),
      effective_date: '',
      visibility: p.visibility
    };
    modalError = null;
    modalOpen = true;
  }

  function openEdit(p) {
    modalMode = 'edit';
    activeDoc = p;
    file = null;
    form = {
      title: p.title,
      folder_id: p.folder_id ?? '',
      version: p.version,
      effective_date: p.effective_date ? p.effective_date.slice(0, 10) : '',
      visibility: p.visibility
    };
    modalError = null;
    modalOpen = true;
  }

  // "3" -> "4", "v2" -> "v3", "1.2" -> "1.3"; anything else is left for the user to type
  function nextVersion(v) {
    const m = /^(.*?)(\d+)$/.exec((v || '').trim());
    return m ? `${m[1]}${Number(m[2]) + 1}` : '';
  }

  function setFile(f) {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      modalError = 'Only PDF and Word (.docx) files are supported';
      return;
    }
    modalError = null;
    file = f;
    if (!form.title.trim()) form.title = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  }

  function onFileChange(e) {
    setFile(e.target.files?.[0]);
  }

  // ── Drag and drop ───────────────────────────────────────────────────────────
  // Dropping on the modal's drop zone sets the file; dropping anywhere on the page
  // (modal closed) opens the upload modal with that file already chosen.
  let zoneDragOver = false;
  let pageDragOver = false;
  let fileInput;

  const hasFiles = (e) => e.dataTransfer?.types?.includes('Files');

  function onZoneDrop(e) {
    zoneDragOver = false;
    setFile(e.dataTransfer?.files?.[0]);
  }

  function onPageDrop(e) {
    pageDragOver = false;
    if (modalOpen || !hasFiles(e)) return;
    openNew();
    setFile(e.dataTransfer?.files?.[0]);
  }

  function onPageDragOver(e) {
    if (!modalOpen && hasFiles(e)) pageDragOver = true;
  }

  async function save() {
    modalError = null;
    if (!form.title.trim()) { modalError = 'Title is required'; return; }
    if (modalMode !== 'edit' && !file) { modalError = 'Choose a PDF or Word file'; return; }
    saving = true;
    try {
      if (modalMode === 'edit') {
        await updateCompanyPolicy(activeDoc.id, {
          title: form.title,
          folder_id: form.folder_id === '' ? null : form.folder_id,
          version: form.version,
          effective_date: form.effective_date || null,
          visibility: form.visibility
        });
      } else {
        await uploadCompanyPolicy(file, {
          ...form,
          supersedes_id: modalMode === 'version' ? activeDoc.id : undefined
        });
      }
      modalOpen = false;
      await load();
    } catch (err) {
      modalError = err.message;
    } finally {
      saving = false;
    }
  }

  async function download(p) {
    busyId = p.id;
    error = null;
    try {
      window.open(await getCompanyPolicyFileUrl(p.id), '_blank', 'noopener');
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  async function remove(p) {
    busyId = p.id;
    error = null;
    try {
      await deleteCompanyPolicy(p.id);
      confirmDeleteId = null;
      await load();
    } catch (err) {
      error = err.message;
    } finally {
      busyId = null;
    }
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }

  function fmtSize(bytes) {
    if (!bytes) return '';
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
</script>

<svelte:window on:keydown={(e) => {
  if (e.key !== 'Escape') return;
  if (folderModal && !folderModal.saving) folderModal = null;
  else if (modalOpen && !saving) modalOpen = false;
}} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="cp-page"
  class:page-drag-over={pageDragOver}
  on:dragover|preventDefault={onPageDragOver}
  on:dragleave|self={() => (pageDragOver = false)}
  on:drop|preventDefault={onPageDrop}
>
  <div class="page-header">
    <div>
      <h1 class="page-title"><i class="las la-book"></i> Company Policies</h1>
      <p class="page-description">Internal policy documents. Upload Word or PDF files here; once indexed they can be searched and queried in chat.</p>
    </div>
    <div class="header-actions">
      <button class="btn btn-primary" on:click={openNew}><i class="las la-upload"></i> Upload policy</button>
    </div>
  </div>

  {#if error}<div class="error-banner">{error}</div>{/if}

  <div class="cp-split">
    <section class="card lib-panel" aria-label="Policy library">
      <div class="lib-head">
        <div class="lib-title">Library <span class="lib-count">· {visibleDocs.length}</span></div>
        <input class="form-input" type="search" bind:value={filterText} placeholder="Filter documents…" aria-label="Filter documents" />
      </div>

      <div class="tree-wrap">
        <PolicyFolderTree
          {folders}
          docs={policies}
          bind:selected
          {scopeFolderId}
          on:select={() => (folderError = null)}
          on:create={(e) => openNewFolder(e.detail)}
          on:edit={(e) => openEditFolder(e.detail)}
          on:remove={(e) => removeFolder(e.detail)}
          on:ask={(e) => (scopeFolderId = e.detail)}
          on:dropdoc={(e) => fileDocument(e.detail.docId, e.detail.folderId)}
        />
        {#if folderError}<div class="folder-error" role="alert">{folderError}</div>{/if}
      </div>

      <div class="lib-list">
        {#if loading}
          <div class="loading-state">Loading…</div>
        {:else}
          {#each visibleDocs as p (p.id)}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="doc" class:superseded={!p.is_current} draggable="true" on:dragstart={(e) => startDocDrag(e, p)} title="Drag onto a folder to move it">
              <i class="las la-file-alt doc-icon"></i>
              <div class="doc-main">
                <button class="title-link" on:click={() => openViewer(p.id)} title="View document">{p.title}</button>
                <div class="doc-meta">
                  {folderPath(folders, p.folder_id) || 'Unfiled'} · v{p.version}{p.status === 'ready' ? ` · ${p.chunk_count} sections` : ''}
                  {#if !p.is_current}<span class="badge badge-neutral">Superseded</span>{/if}
                  {#if p.visibility === 'admin'}<span class="badge badge-warning" title="Visible to admins only">Restricted</span>{/if}
                </div>
                <div class="doc-meta doc-file">{p.original_filename}{p.file_size ? ` · ${fmtSize(p.file_size)}` : ''}</div>

                <div class="doc-foot">
                  <span class="badge {STATUS[p.status]?.cls || 'badge-neutral'}" title={p.status_detail || ''}>
                    {STATUS[p.status]?.label || p.status}
                  </span>
                  <span class="doc-actions">
                    {#if confirmDeleteId === p.id}
                      <span class="confirm-delete">
                        Delete?
                        <button class="btn btn-danger btn-sm" disabled={busyId === p.id} on:click={() => remove(p)}>Delete</button>
                        <button class="btn btn-secondary btn-sm" on:click={() => (confirmDeleteId = null)}>Cancel</button>
                      </span>
                    {:else}
                      <button class="btn btn-ghost btn-sm btn-icon" on:click={() => openViewer(p.id)} title="View document" aria-label="View document"><i class="las la-eye"></i></button>
                      <button class="btn btn-ghost btn-sm btn-icon" disabled={busyId === p.id} on:click={() => download(p)} title="Download original" aria-label="Download original"><i class="las la-download"></i></button>
                      {#if p.is_current}
                        <button class="btn btn-ghost btn-sm btn-icon" on:click={() => openVersion(p)} title="Upload a new version" aria-label="Upload a new version"><i class="las la-code-branch"></i></button>
                      {/if}
                      <button class="btn btn-ghost btn-sm btn-icon" disabled={busyId === p.id || p.status === 'processing'} on:click={() => reindex(p)} title="Re-index" aria-label="Re-index"><i class="las la-sync"></i></button>
                      <button class="btn btn-ghost btn-sm btn-icon" on:click={() => openEdit(p)} title="Edit details" aria-label="Edit details"><i class="las la-edit"></i></button>
                      <button class="btn btn-danger-ghost btn-sm btn-icon" on:click={() => (confirmDeleteId = p.id)} title="Delete" aria-label="Delete"><i class="las la-trash"></i></button>
                    {/if}
                  </span>
                </div>
                {#if p.status === 'failed' && p.status_detail}<div class="doc-error">{p.status_detail}</div>{/if}
              </div>
            </div>
          {/each}
          {#if !visibleDocs.length}
            <div class="empty-row">
              {policies.length ? 'No documents match that filter.' : 'No policies yet. Use "Upload policy" to add the first one.'}
            </div>
          {/if}
        {/if}
      </div>

      <label class="lib-foot">
        <input type="checkbox" bind:checked={showHistory} on:change={() => load()} /> Show previous versions
      </label>
    </section>

    <PolicyAsk
      ready={askReady}
      {folders}
      bind:scopeFolderId
      on:view={(e) => openViewer(e.detail.documentId, e.detail.chunkIndex, e.detail.page)}
    />
  </div>
</div>

{#if viewer}
  {#key viewer.documentId}
    <PolicyViewerModal
      documentId={viewer.documentId}
      focusChunk={viewer.chunkIndex}
      focusPage={viewer.page}
      on:close={() => (viewer = null)}
    />
  {/key}
{/if}

{#if folderModal}
  <div class="modal-backdrop" role="presentation" on:click|self={() => !folderModal?.saving && (folderModal = null)}>
    <div class="modal-content small" role="dialog" aria-modal="true" aria-labelledby="cp-folder-title">
      <div class="modal-header">
        <h2 id="cp-folder-title">{folderModal.mode === 'new' ? 'New folder' : 'Rename or move folder'}</h2>
        <button class="close-btn" on:click={() => (folderModal = null)} disabled={folderModal.saving} aria-label="Close"><i class="las la-times"></i></button>
      </div>
      {#if folderModal.error}<div class="modal-error">{folderModal.error}</div>{/if}
      <form class="modal-body" on:submit|preventDefault={saveFolder}>
        <div class="field">
          <label class="form-label" for="cp-folder-name">Name <span class="required">*</span></label>
          <!-- svelte-ignore a11y-autofocus -->
          <input id="cp-folder-name" class="form-input" type="text" maxlength="100" bind:value={folderModal.name} placeholder="e.g. HR" disabled={folderModal.saving} autofocus />
        </div>
        <div class="field">
          <label class="form-label" for="cp-folder-parent">Inside</label>
          <select id="cp-folder-parent" class="form-input" bind:value={folderModal.parentId} disabled={folderModal.saving}>
            <option value="">Top level</option>
            {#each parentChoices as o (o.id)}<option value={o.id} disabled={!o.canHoldChildren}>{o.label}{o.canHoldChildren ? '' : ' (too deep)'}</option>{/each}
          </select>
          <span class="hint">Folders can go up to 4 levels deep.</span>
        </div>
        <button type="submit" hidden>Save</button>
      </form>
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => (folderModal = null)} disabled={folderModal.saving}>Cancel</button>
        <button class="btn btn-primary" on:click={saveFolder} disabled={folderModal.saving}>
          {folderModal.saving ? 'Saving…' : folderModal.mode === 'new' ? 'Create folder' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if modalOpen}
  <div class="modal-backdrop" role="presentation" on:click|self={() => !saving && (modalOpen = false)}>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="cp-modal-title">
      <div class="modal-header">
        <div>
          <h2 id="cp-modal-title">{modalMode === 'edit' ? 'Edit policy details' : modalMode === 'version' ? 'Upload new version' : 'Upload policy'}</h2>
          {#if modalMode === 'version'}
            <p class="modal-sub">Replaces <strong>{activeDoc.title}</strong> (v{activeDoc.version}). The old version is kept in history and excluded from search.</p>
          {/if}
        </div>
        <button class="close-btn" on:click={() => (modalOpen = false)} disabled={saving} aria-label="Close"><i class="las la-times"></i></button>
      </div>

      {#if modalError}<div class="modal-error">{modalError}</div>{/if}

      <div class="modal-body">
        {#if modalMode !== 'edit'}
          <div class="field">
            <span class="form-label">File <span class="required">*</span></span>
            <div
              class="drop-zone"
              class:drag-over={zoneDragOver}
              role="button"
              tabindex="0"
              on:dragover|preventDefault={() => (zoneDragOver = true)}
              on:dragleave={() => (zoneDragOver = false)}
              on:drop|preventDefault={onZoneDrop}
              on:click={() => fileInput.click()}
              on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.click()}
            >
              {#if file}
                <i class="las la-file-alt drop-icon"></i>
                <span class="drop-filename">{file.name}</span>
                <span class="hint">Drop or click to choose a different file</span>
              {:else}
                <i class="las la-cloud-upload-alt drop-icon"></i>
                <span>Drop a PDF or Word file here, or click to browse</span>
              {/if}
            </div>
            <input bind:this={fileInput} type="file" accept=".pdf,.docx" on:change={onFileChange} hidden />
            <span class="hint">PDF or Word (.docx), up to 25 MB. Scanned PDFs without selectable text can't be indexed.</span>
          </div>
        {/if}

        <div class="field">
          <label class="form-label" for="cp-title">Title <span class="required">*</span></label>
          <input id="cp-title" class="form-input" type="text" bind:value={form.title} placeholder="e.g. Leave and Absence Policy" disabled={saving} />
        </div>

        <div class="row">
          <div class="field">
            <label class="form-label" for="cp-folder">Folder</label>
            <select id="cp-folder" class="form-input" bind:value={form.folder_id} disabled={saving}>
              <option value="">Not in a folder</option>
              {#each folderChoices as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
            </select>
          </div>
          <div class="field narrow">
            <label class="form-label" for="cp-version">Version</label>
            <input id="cp-version" class="form-input" type="text" bind:value={form.version} disabled={saving} />
          </div>
          <div class="field">
            <label class="form-label" for="cp-date">Effective date</label>
            <input id="cp-date" class="form-input" type="date" bind:value={form.effective_date} disabled={saving} />
          </div>
        </div>

        <div class="field">
          <label class="form-label" for="cp-vis">Who can see it</label>
          <select id="cp-vis" class="form-input" bind:value={form.visibility} disabled={saving}>
            <option value="all">Everyone with access to policies</option>
            <option value="admin">Admins only (restricted)</option>
          </select>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => (modalOpen = false)} disabled={saving}>Cancel</button>
        <button class="btn btn-primary" on:click={save} disabled={saving}>
          {saving ? (modalMode === 'edit' ? 'Saving…' : 'Uploading…') : modalMode === 'edit' ? 'Save' : 'Upload'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Page (same shell as the Policy page) ── */
  .cp-page {
    background: var(--color-slate-50);
    padding: 1.5rem 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding-top: 0.25rem;
  }
  .page-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    margin: 0 0 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    letter-spacing: -0.02em;
  }
  .page-title i { color: var(--color-primary-600); font-size: 1.125rem; }
  .page-description { font-size: 0.8125rem; color: var(--color-slate-500); margin: 0; max-width: 560px; line-height: 1.5; }

  .header-actions { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }

  .error-banner {
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    background: var(--color-red-50);
    color: var(--color-red-600);
    border-radius: var(--radius-md);
    font-size: 0.8125rem;
  }

  /* ── Split view: library on the left, chat on the right ── */
  .cp-split {
    display: grid;
    grid-template-columns: 24rem minmax(0, 1fr);
    gap: 1.25rem;
    height: calc(100vh - 10rem);
    min-height: 34rem;
  }
  @media (max-width: 1000px) {
    .cp-split { grid-template-columns: minmax(0, 1fr); height: auto; }
    .lib-panel { max-height: 24rem; }
  }

  .lib-panel { display: flex; flex-direction: column; min-height: 0; height: 100%; padding: 0; overflow: hidden; }
  .lib-head { padding: 0.875rem 1rem 0.75rem; border-bottom: 1px solid var(--color-slate-100); display: flex; flex-direction: column; gap: 0.625rem; flex-shrink: 0; }
  .lib-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }
  .lib-count { font-weight: 500; color: var(--color-slate-500); }
  .tree-wrap { flex-shrink: 0; max-height: 15rem; overflow-y: auto; border-bottom: 1px solid var(--color-slate-100); }
  .folder-error { margin: 0 0.75rem 0.625rem; padding: 0.5rem 0.625rem; background: var(--color-red-50); color: var(--color-red-600); border-radius: var(--radius-md); font-size: 0.75rem; line-height: 1.4; }
  .lib-list { flex: 1; min-height: 0; overflow-y: auto; }
  .lib-foot {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--color-slate-100);
    font-size: 0.75rem;
    color: var(--color-slate-600);
    cursor: pointer;
  }

  .doc { display: flex; gap: 0.75rem; padding: 0.875rem 1rem; border-bottom: 1px solid var(--color-slate-100); }
  .doc:last-child { border-bottom: none; }
  .doc:hover { background: var(--color-slate-50); }
  .doc[draggable='true'] { cursor: grab; }
  .doc.superseded .title-link { color: var(--color-slate-500); }
  .doc-icon { font-size: 1.25rem; color: var(--color-slate-400); margin-top: 0.1rem; flex-shrink: 0; }
  .doc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
  .title-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
    cursor: pointer;
    text-align: left;
    line-height: 1.35;
  }
  .title-link:hover { color: var(--color-primary-600); text-decoration: underline; }
  .doc-meta { font-size: 0.75rem; color: var(--color-slate-500); display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.375rem; }
  .doc-file { word-break: break-all; }
  .doc-foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.25rem 0.5rem; margin-top: 0.5rem; }
  .doc-actions { display: flex; align-items: center; gap: 0.0625rem; margin-left: auto; }
  .doc-error { margin-top: 0.375rem; font-size: 0.75rem; color: var(--color-red-600); }
  .confirm-delete { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--color-red-600); }
  .empty-row { text-align: center; color: var(--color-slate-500); font-size: 0.8125rem; padding: 2rem 1.25rem; }

  /* ── Modal ── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .modal-content {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-modal);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .modal-content.small { max-width: 26rem; }
  .modal-header h2 { margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--color-slate-800); }
  .modal-sub { margin: 0.25rem 0 0; font-size: 0.8125rem; color: var(--color-slate-500); }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    transition: background 0.15s, color 0.15s;
  }
  .close-btn:hover:not(:disabled) { background: var(--color-slate-100); color: var(--color-slate-800); }
  .close-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .modal-error { padding: 0.75rem 1.5rem; background: var(--color-red-50); color: var(--color-red-600); font-size: 0.8125rem; }
  .modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--color-slate-200); }

  .field { flex: 1; min-width: 0; }
  .field.narrow { flex: 0 0 6rem; }
  .row { display: flex; gap: 1rem; }
  .required { color: var(--color-red-500); }
  .hint { display: block; margin-top: 0.375rem; font-size: 0.75rem; color: var(--color-slate-500); }

  /* ── Drag and drop ── */
  .drop-zone {
    border: 2px dashed var(--color-slate-300);
    border-radius: var(--radius-md);
    padding: 1.25rem 1rem;
    text-align: center;
    cursor: pointer;
    color: var(--color-slate-500);
    font-size: 0.8125rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    transition: background 0.15s, border-color 0.15s;
  }
  .drop-zone:hover,
  .drop-zone:focus-visible,
  .drop-zone.drag-over { background: var(--color-primary-50); border-color: var(--color-primary-600); outline: none; }
  .drop-icon { font-size: 1.75rem; color: var(--color-primary-500); }
  .drop-filename { font-weight: 600; color: var(--color-slate-800); font-size: 0.875rem; word-break: break-all; }
  .drop-zone .hint { margin-top: 0; }
  .cp-page.page-drag-over { outline: 2px dashed var(--color-primary-600); outline-offset: -0.75rem; background: var(--color-primary-50); }
</style>
