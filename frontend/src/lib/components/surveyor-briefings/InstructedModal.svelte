<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';

  export let show = false;
  export let quote = null;

  const dispatch = createEventDispatcher();

  let richTextEditor;
  let emailContent = '';

  // Generate default email content when quote changes
  $: if (quote) {
    generateDefaultContent();
  }

  function generateDefaultContent() {
    // Default instruction email content
    emailContent = `
      <p>Dear ${quote?.contact_name || 'Sir/Madam'},</p>
      
      <p>We are pleased to instruct you to proceed with the <strong>${quote?.discipline}</strong> survey for this project.</p>
      
      <p><strong>Project Details:</strong></p>
      <ul>
        <li>Discipline: ${quote?.discipline}</li>
        <li>Organisation: ${quote?.surveyor_organisation}</li>
      </ul>
      
      <p>[Additional instruction details will go here]</p>
      
      <p>Please confirm receipt of this instruction and advise of your anticipated delivery timescales.</p>
      
      <p>Best regards</p>
    `;
  }

  async function handleCopyToClipboard() {
    if (!richTextEditor) return;

    try {
      const htmlContent = richTextEditor.getHTML();
      const plainText = stripHtml(htmlContent);

      // Try modern Clipboard API with HTML support
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        });
        await navigator.clipboard.write([clipboardItem]);
        alert('Email content copied to clipboard!');
      } else {
        // Fallback for browsers that don't support ClipboardItem
        fallbackCopyRichText(htmlContent);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      fallbackCopyRichText(richTextEditor.getHTML());
    }
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    let text = tmp.textContent || tmp.innerText || '';
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    return text.trim();
  }

  function fallbackCopyRichText(html) {
    const container = document.createElement('div');
    container.contentEditable = 'true';
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
      document.execCommand('copy');
      alert('Email content copied to clipboard!');
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy to clipboard');
    }

    selection.removeAllRanges();
    document.body.removeChild(container);
  }

  function handleConfirm() {
    dispatch('confirm', { quote });
  }

  function handleClose() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="modal-overlay" on:click|self={handleClose}>
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
          <i class="las la-paper-plane header-icon"></i>
          <h2>Instruction Email</h2>
        </div>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#if quote}
          <!-- To Field -->
          <div class="email-field">
            <label>To:</label>
            <div class="recipient-info">
              <div class="recipient-details">
                <span class="recipient-name">{quote.contact_name || 'No contact'}</span>
                {#if quote.contact_email}
                  <span class="recipient-email">&lt;{quote.contact_email}&gt;</span>
                {/if}
              </div>
              <div class="recipient-meta">
                <span class="badge">{quote.discipline}</span>
                <span class="org-name">{quote.surveyor_organisation}</span>
              </div>
            </div>
          </div>

          <!-- Email Content -->
          <div class="editor-section">
            <label>Email Content:</label>
            <RichTextEditor
              bind:this={richTextEditor}
              content={emailContent}
              placeholder="Compose your instruction email..."
            />
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Cancel
        </button>
        <button class="btn btn-secondary" on:click={handleCopyToClipboard}>
          <i class="las la-copy"></i>
          Copy to Clipboard
        </button>
        <button class="btn btn-primary" on:click={handleConfirm}>
          <i class="las la-check"></i>
          Confirm & Send Instruction
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 1000px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-icon {
    font-size: 1.5rem;
    color: #3b82f6;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 1.25rem;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .email-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .email-field label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

  .recipient-info {
    padding: 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .recipient-details {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .recipient-name {
    font-weight: 600;
    color: #1e293b;
    font-size: 0.95rem;
  }

  .recipient-email {
    color: #64748b;
    font-size: 0.875rem;
  }

  .recipient-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    background: #dbeafe;
    color: #1e40af;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .org-name {
    color: #64748b;
    font-size: 0.875rem;
  }

  .editor-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-height: 0;
  }

  .editor-section label {
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
  }

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
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
  }
</style>
