<script>
  import { createTopic, updateTopic } from '$lib/api/ingestion.js';

  export let topics = [];
  export let projectId;
  export let onTopicsChanged = () => {};

  let adding = false;
  let saving = false;
  let error = null;
  let editingId = null;

  let newTitle = '';
  let newDescription = '';
  let newKeywords = '';

  let editTitle = '';
  let editDescription = '';
  let editKeywords = '';

  async function handleAdd() {
    if (!newTitle.trim()) return;
    saving = true;
    error = null;
    try {
      await createTopic(projectId, {
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        keywords: newKeywords.split(',').map(k => k.trim()).filter(Boolean)
      });
      newTitle = '';
      newDescription = '';
      newKeywords = '';
      adding = false;
      await onTopicsChanged();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function startEdit(topic) {
    editingId = topic.id;
    editTitle = topic.title;
    editDescription = topic.description || '';
    editKeywords = (topic.keywords || []).join(', ');
  }

  async function handleEdit(topic) {
    saving = true;
    error = null;
    try {
      await updateTopic(topic.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        keywords: editKeywords.split(',').map(k => k.trim()).filter(Boolean)
      });
      editingId = null;
      await onTopicsChanged();
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
</script>

<div class="topics-panel">
  <div class="panel-header">
    <div>
      <h3>Tracked Topics</h3>
      <p class="panel-subtext">Define the themes you want the LLM to track across uploaded documents.</p>
    </div>
    <button class="btn-primary" on:click={() => adding = !adding}>
      <i class="las la-plus"></i> Add Topic
    </button>
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if adding}
    <div class="add-form">
      <div class="form-row">
        <div class="form-group">
          <label>Title <span class="required">*</span></label>
          <input bind:value={newTitle} placeholder="e.g. Noise Impact" class="form-input" />
        </div>
        <div class="form-group" style="flex:2">
          <label>Description</label>
          <input bind:value={newDescription} placeholder="Brief description of what to track" class="form-input" />
        </div>
      </div>
      <div class="form-group">
        <label>Keywords <span class="hint">(comma separated — helps the LLM identify mentions)</span></label>
        <input bind:value={newKeywords} placeholder="noise, decibels, acoustic, sound levels" class="form-input" />
      </div>
      <div class="form-actions">
        <button class="btn-primary" on:click={handleAdd} disabled={saving || !newTitle.trim()}>
          {saving ? 'Saving…' : 'Save Topic'}
        </button>
        <button class="btn-ghost" on:click={() => adding = false}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if topics.length === 0 && !adding}
    <div class="empty-state">
      <i class="las la-tags"></i>
      <p>No topics yet. Add at least one topic before uploading documents.</p>
    </div>
  {:else}
    <div class="topic-list">
      {#each topics as topic (topic.id)}
        <div class="topic-card">
          {#if editingId === topic.id}
            <div class="edit-form">
              <div class="form-row">
                <span class="code-badge">{topic.code}</span>
                <div class="form-group" style="flex:1">
                  <input bind:value={editTitle} class="form-input" placeholder="Title" />
                </div>
                <div class="form-group" style="flex:2">
                  <input bind:value={editDescription} class="form-input" placeholder="Description" />
                </div>
              </div>
              <div class="form-group">
                <input bind:value={editKeywords} class="form-input" placeholder="Keywords (comma separated)" />
              </div>
              <div class="form-actions">
                <button class="btn-primary btn-sm" on:click={() => handleEdit(topic)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button class="btn-ghost btn-sm" on:click={() => editingId = null}>Cancel</button>
              </div>
            </div>
          {:else}
            <div class="topic-row">
              <span class="code-badge">{topic.code}</span>
              <div class="topic-content">
                <div class="topic-title">{topic.title}</div>
                {#if topic.description}
                  <div class="topic-desc">{topic.description}</div>
                {/if}
                {#if topic.keywords?.length}
                  <div class="keyword-chips">
                    {#each topic.keywords as kw}
                      <span class="chip">{kw}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <button class="btn-icon" on:click={() => startEdit(topic)} title="Edit">
                <i class="las la-pen"></i>
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .topics-panel { display: flex; flex-direction: column; gap: 1rem; }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .panel-header h3 { margin: 0 0 0.25rem 0; font-size: 1rem; font-weight: 600; color: #1e293b; }
  .panel-subtext { margin: 0; font-size: 0.8rem; color: #64748b; }

  .add-form, .edit-form {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-row { display: flex; gap: 0.75rem; align-items: flex-start; }
  .form-group { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
  .form-group label { font-size: 0.78rem; font-weight: 600; color: #475569; }
  .hint { font-weight: 400; color: #94a3b8; }
  .required { color: #ef4444; }

  .form-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: white;
    color: #1e293b;
    outline: none;
    transition: border-color 0.15s;
  }
  .form-input:focus { border-color: #9333ea; }

  .form-actions { display: flex; gap: 0.5rem; }

  .topic-list { display: flex; flex-direction: column; gap: 0.5rem; }

  .topic-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    overflow: hidden;
  }

  .topic-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
  }

  .code-badge {
    font-size: 0.7rem;
    font-weight: 700;
    background: #f3e8ff;
    color: #7e22ce;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .topic-content { flex: 1; min-width: 0; }
  .topic-title { font-size: 0.9rem; font-weight: 600; color: #1e293b; }
  .topic-desc { font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; }

  .keyword-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .chip {
    font-size: 0.7rem;
    background: #f1f5f9;
    color: #475569;
    padding: 0.15rem 0.5rem;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2.5rem;
    color: #94a3b8;
    text-align: center;
  }
  .empty-state i { font-size: 2.5rem; }
  .empty-state p { margin: 0; font-size: 0.875rem; }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 1rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .btn-primary:hover:not(:disabled) { background: #7e22ce; }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-primary.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }

  .btn-ghost {
    padding: 0.5rem 1rem;
    background: none;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-ghost:hover { background: #f8fafc; }
  .btn-ghost.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }

  .btn-icon {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: color 0.15s;
    flex-shrink: 0;
  }
  .btn-icon:hover { color: #7e22ce; }
</style>
