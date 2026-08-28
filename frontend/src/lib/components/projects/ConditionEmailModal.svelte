<script>
  import { createEventDispatcher, tick } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { updateCondition, createConditionAdvancements } from '$lib/api/conditions.js';

  export let show = false;
  export let project;
  export let condition = null;

  const dispatch = createEventDispatcher();

  let richTextEditor;
  let toEmail = '';
  let toName = '';
  let currentSubject = '';
  let seededForId = null;
  let sentSaving = false;
  let sentDone = false;

  $: projectRef = project?.project_id || '';
  $: projectName = project?.site_name || project?.project_name || '';

  // Seed subject + stock email whenever the modal opens for a condition
  $: if (show && condition && seededForId !== condition.id) {
    seededForId = condition.id;
    toEmail = condition.original_consultant_email || '';
    toName = condition.original_consultant || '';
    currentSubject = buildSubject(condition);
    sentDone = !!condition.fee_quote_requested_at;
    tick().then(() => richTextEditor?.setHTML(buildEmailHtml(condition, toName)));
  }

  function buildSubject(c) {
    const condLabel = c.condition_number ? `Condition ${c.condition_number}` : 'Condition';
    const projectPart = [projectName, projectRef ? `(${projectRef})` : ''].filter(Boolean).join(' ');
    return `${projectPart ? `${projectPart} - ` : ''}Fee Quote Request - ${condLabel}: ${c.title}`;
  }

  function buildEmailHtml(c, name) {
    const greeting = name?.trim() ? `Hi ${name.trim()},` : 'Hi,';
    const projectLine = [projectRef, projectName].filter(Boolean).join(': ');
    const condLabel = c.condition_number ? `Condition ${c.condition_number}: ` : '';
    const wording = (c.wording || '').replace(/\n/g, '<br>');
    const reason = (c.reason || '').replace(/\n/g, '<br>');

    return `<p>${greeting}</p>
<p>We have received an approval${projectLine ? ` for <strong>${projectLine}</strong>` : ''} (decision notice attached).</p>
${c.original_consultant ? `<p>As you may recall, this is a project you have previously worked on.</p>` : ''}
<p>Please can we request a fee quote related to the following condition:</p>
<p><strong>${condLabel}${c.title}</strong></p>
<p><em>"${wording}"</em></p>
${reason ? `<p><em>Reason: "${reason}"</em></p>` : ''}
<p>Can I please request a fee quote for the following works:</p>
<p><em>[Our commentary and fee quote request items - add here]</em></p>
<p>I'd also welcome your thoughts on whether, in your view, any further works are likely to be required in order to discharge the condition.</p>
<p>It would be much appreciated if you could come back to me with the following:</p>
<ul>
<li>A fee quote</li>
<li>Indicative timescales</li>
<li>Details of any information you require from us</li>
</ul>
<p>Many thanks</p>`;
  }

  // Rebuild greeting when the name changes (only if the user hasn't started editing heavily —
  // keep it simple: offer a refresh button instead of clobbering edits automatically)
  function refreshTemplate() {
    if (condition) richTextEditor?.setHTML(buildEmailHtml(condition, toName));
  }

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

  // Confirm the fee quote request as sent: stamps the condition and logs a
  // progress entry, so the tracker reflects it without any manual toggling.
  async function handleConfirmSent() {
    if (!condition || sentSaving) return;
    sentSaving = true;
    try {
      const updated = await updateCondition(condition.id, {
        fee_quote_requested_at: new Date().toISOString(),
      });
      const summary = toName?.trim()
        ? `Fee quote request sent to ${toName.trim()}`
        : 'Fee quote request sent';
      const rows = await createConditionAdvancements(project.id, {
        advancement_date: new Date().toISOString().slice(0, 10),
        full_text: null,
        source_type: 'note',
        items: [{ condition_id: condition.id, summary }],
      });
      sentDone = true;
      dispatch('sent', { condition: updated, advancements: rows });
    } catch (err) {
      alert(err.message);
    } finally {
      sentSaving = false;
    }
  }

  function handleClose() {
    show = false;
    seededForId = null;
    sentDone = false;
    dispatch('close');
  }
</script>

{#if show && condition}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Fee Quote Request - {condition.condition_number ? `Condition ${condition.condition_number}` : condition.title}</h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <div class="form-group grow">
            <label for="cem-to">To</label>
            <input id="cem-to" type="email" class="text-input" bind:value={toEmail} placeholder="consultant@example.com" />
          </div>
          <div class="form-group grow">
            <label for="cem-name">Name <span class="label-hint">(optional - used in the greeting)</span></label>
            <div class="name-row">
              <input id="cem-name" type="text" class="text-input" bind:value={toName} placeholder="e.g. Jane" />
              <button class="btn btn-secondary btn-refresh" on:click={refreshTemplate} title="Rebuild the email with this greeting (discards edits)">
                <i class="las la-sync"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="cem-subject">Subject</label>
          <input id="cem-subject" type="text" class="text-input" bind:value={currentSubject} />
        </div>

        <div class="form-group">
          <label>Email Content <span class="label-hint">remember to attach the decision notice</span></label>
          <RichTextEditor bind:this={richTextEditor} placeholder="Email content…" />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>Cancel</button>
        <button class="btn btn-secondary" on:click={handleCopyToClipboard} disabled={!richTextEditor}>
          <i class="las la-copy"></i> Copy to Clipboard
        </button>
        <button class="btn btn-secondary" on:click={handleOpenInEmail} disabled={!richTextEditor}>
          <i class="las la-envelope"></i> Open in Email
        </button>
        <button class="btn btn-confirm-sent" class:is-sent={sentDone} on:click={handleConfirmSent} disabled={sentSaving || sentDone}>
          {#if sentSaving}
            Confirming…
          {:else if sentDone}
            <i class="las la-check-double"></i> Sent
          {:else}
            <i class="las la-check"></i> Confirm Sent
          {/if}
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
    background: var(--overlay-bg);
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
    padding: 1.5rem;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0;
    width: 32px; height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .close-btn:hover { background: var(--color-slate-100); color: var(--color-slate-800); }

  .modal-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .form-group.grow { flex: 1; min-width: 0; }

  .form-group label {
    font-weight: 600;
    color: var(--color-slate-600);
    font-size: 0.875rem;
  }
  .label-hint { font-weight: 400; color: var(--color-slate-400); font-size: 0.78rem; }

  .text-input {
    padding: 0.625rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    width: 100%;
    box-sizing: border-box;
  }
  .text-input:focus { outline: none; border-color: var(--color-primary-500); box-shadow: var(--focus-ring-blue); }

  .name-row {
    display: flex;
    gap: 0.5rem;
  }
  .name-row .text-input { flex: 1; }
  .btn-refresh { flex-shrink: 0; padding: 0.5rem 0.75rem; }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--color-slate-200);
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
    color: var(--color-slate-600);
    border: 1px solid var(--color-slate-300);
  }
  .btn-secondary:hover:not(:disabled) { background: var(--color-slate-50); }
  .btn-send {
    background: var(--color-purple-600);
    color: white;
  }
  .btn-send:hover:not(:disabled) { background: var(--color-purple-700); }
  .btn-confirm-sent {
    background: var(--color-emerald-600);
    color: white;
  }
  .btn-confirm-sent:hover:not(:disabled) { background: var(--color-green-800); }
  .btn-confirm-sent.is-sent {
    background: var(--color-emerald-100);
    color: var(--color-emerald-600);
    opacity: 1;
  }
</style>
