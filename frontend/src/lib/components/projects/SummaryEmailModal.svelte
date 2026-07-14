<script>
  import { createEventDispatcher } from 'svelte';
  import { draftConditionsSummaryEmail } from '$lib/api/conditions.js';

  export let show = false;
  export let project;

  const dispatch = createEventDispatcher();

  let fromDate = '';
  let toDate = '';
  let generating = false;
  let error = null;
  let subject = '';
  let body = '';
  let advancementCount = 0;
  let seeded = false;

  function isoDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  // Default range: the last week, ending today
  $: if (show && !seeded) {
    seeded = true;
    fromDate = isoDaysAgo(7);
    toDate = isoDaysAgo(0);
    subject = '';
    body = '';
    error = null;
    advancementCount = 0;
  }

  async function handleGenerate() {
    if (!fromDate || !toDate) {
      error = 'Pick both dates';
      return;
    }
    if (fromDate > toDate) {
      error = 'The from date must be before the to date';
      return;
    }
    generating = true;
    error = null;
    try {
      const result = await draftConditionsSummaryEmail(project.id, {
        from_date: fromDate,
        to_date: toDate,
      });
      subject = result.subject || '';
      body = result.body || '';
      advancementCount = result.advancement_count || 0;
    } catch (err) {
      error = err.message;
    } finally {
      generating = false;
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      alert('Email copied to clipboard!');
    } catch {
      alert('Failed to copy to clipboard');
    }
  }

  function handleOpenInEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function handleClose() {
    if (generating) return;
    show = false;
    seeded = false;
    dispatch('close');
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2><i class="las la-envelope-open-text"></i> Summary Email</h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <p class="intro">
          Drafts a client progress email from the advancements logged in the period.
          The draft only covers what the advancements actually say — treat it as a starting point.
        </p>

        <div class="form-row">
          <div class="form-group">
            <label for="sem-from">From</label>
            <input id="sem-from" type="date" class="text-input" bind:value={fromDate} max={toDate} />
          </div>
          <div class="form-group">
            <label for="sem-to">To</label>
            <input id="sem-to" type="date" class="text-input" bind:value={toDate} min={fromDate} />
          </div>
          <button class="btn btn-primary btn-generate" on:click={handleGenerate} disabled={generating}>
            {#if generating}
              <span class="spinner"></span> Drafting…
            {:else}
              <i class="las la-magic"></i> {body ? 'Regenerate' : 'Generate Draft'}
            {/if}
          </button>
        </div>

        {#if error}
          <div class="error-notice"><i class="las la-exclamation-triangle"></i> {error}</div>
        {/if}

        {#if body}
          <div class="form-group">
            <label for="sem-subject">Subject</label>
            <input id="sem-subject" type="text" class="text-input" bind:value={subject} />
          </div>
          <div class="form-group grow">
            <label for="sem-body">
              Email draft
              <span class="label-hint">drafted from {advancementCount} advancement{advancementCount === 1 ? '' : 's'} — edit freely</span>
            </label>
            <textarea id="sem-body" class="text-input body-input" bind:value={body} rows="16"></textarea>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose} disabled={generating}>Close</button>
        <button class="btn btn-secondary" on:click={handleCopy} disabled={!body}>
          <i class="las la-copy"></i> Copy to Clipboard
        </button>
        <button class="btn btn-secondary" on:click={handleOpenInEmail} disabled={!body}>
          <i class="las la-envelope"></i> Open in Email
        </button>
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
    max-width: 760px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 0.5rem;
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

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .intro {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
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
    box-sizing: border-box;
  }
  .text-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

  .body-input {
    width: 100%;
    resize: vertical;
    line-height: 1.5;
  }

  .btn-generate { flex-shrink: 0; }

  .error-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #b91c1c;
    font-size: 0.875rem;
  }

  .spinner {
    width: 14px; height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
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
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  .btn-primary:hover:not(:disabled) { background: #2563eb; }
  .btn-secondary {
    background: white;
    color: #475569;
    border: 1px solid #cbd5e1;
  }
  .btn-secondary:hover:not(:disabled) { background: #f8fafc; }
</style>
