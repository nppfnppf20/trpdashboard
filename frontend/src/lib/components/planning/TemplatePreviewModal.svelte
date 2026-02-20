<script>
  import { createEventDispatcher } from 'svelte';

  export let template;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function convertSectionsToHTML(sections) {
    if (!sections || !Array.isArray(sections)) return '';

    let html = '';
    sections.forEach(section => {
      switch (section.type) {
        case 'heading':
          const level = section.level || 2;
          html += `<h${level}>${section.content}</h${level}>`;
          break;
        case 'paragraph':
          html += `<p>${section.content}</p>`;
          break;
        case 'list':
          if (section.items && Array.isArray(section.items)) {
            html += '<ul>';
            section.items.forEach(item => {
              html += `<li>${item}</li>`;
            });
            html += '</ul>';
          }
          break;
        default:
          html += `<p>${section.content || ''}</p>`;
      }
    });
    return html;
  }

  $: templateHTML = template?.template_content?.sections 
    ? convertSectionsToHTML(template.template_content.sections) 
    : '';
</script>

<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <div class="header-info">
        <h2>
          <i class="las la-file-invoice"></i>
          {template.template_name}
        </h2>
        <p class="template-type">{template.template_type}</p>
      </div>
      <button class="close-btn" on:click={handleClose} title="Close">
        <i class="las la-times"></i>
      </button>
    </div>

    <div class="modal-body">
      <div class="info-banner">
        <i class="las la-info-circle"></i>
        <div>
          <strong>Template Preview</strong>
          <span>Placeholders like {'{{'}project_name{'}}'} or «Client_name» will be replaced with actual project data when you create a deliverable.</span>
        </div>
      </div>

      {#if template.description}
        <div class="description">
          <h3>Description</h3>
          <p>{template.description}</p>
        </div>
      {/if}

      <div class="template-preview">
        <h3>Template Content</h3>
        <div class="preview-content">
          {@html templateHTML}
        </div>
      </div>

      {#if template.template_content?.placeholders && template.template_content.placeholders.length > 0}
        <div class="placeholders-section">
          <h3>Available Placeholders</h3>
          <div class="placeholders-grid">
            {#each template.template_content.placeholders as placeholder}
              <div class="placeholder-tag">
                <i class="las la-tag"></i>
                {placeholder}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="close-footer-btn" on:click={handleClose}>
        Close
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .header-info {
    flex: 1;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .modal-header h2 i {
    font-size: 1.75rem;
    color: #0d9488;
  }

  .template-type {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
    font-style: italic;
  }

  .close-btn {
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .close-btn i {
    font-size: 1.5rem;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .info-banner {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
  }

  .info-banner i {
    font-size: 1.5rem;
    color: #3b82f6;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .info-banner div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-banner strong {
    color: #1e40af;
    font-size: 0.9375rem;
  }

  .info-banner span {
    color: #475569;
    line-height: 1.5;
  }

  .description {
    margin-bottom: 1.5rem;
  }

  .description h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .description p {
    font-size: 0.9375rem;
    color: #64748b;
    margin: 0;
    line-height: 1.6;
  }

  .template-preview {
    margin-bottom: 1.5rem;
  }

  .template-preview h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .preview-content {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #1e293b;
  }

  .preview-content :global(h1) {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1rem 0 0.75rem;
    color: #0f172a;
  }

  .preview-content :global(h1:first-child) {
    margin-top: 0;
  }

  .preview-content :global(h2) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
    color: #0f172a;
  }

  .preview-content :global(h3) {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0.75rem 0 0.5rem;
    color: #0f172a;
  }

  .preview-content :global(p) {
    margin: 0.5rem 0;
  }

  .preview-content :global(ul),
  .preview-content :global(ol) {
    margin: 0.5rem 0;
    padding-left: 2rem;
  }

  .preview-content :global(li) {
    margin: 0.25rem 0;
  }

  .placeholders-section {
    margin-bottom: 1rem;
  }

  .placeholders-section h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
  }

  .placeholders-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .placeholder-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: 'Courier New', monospace;
    color: #475569;
  }

  .placeholder-tag i {
    font-size: 0.875rem;
    color: #64748b;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .close-footer-btn {
    padding: 0.75rem 1.5rem;
    background: #64748b;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-footer-btn:hover {
    background: #475569;
  }

  @media (max-width: 768px) {
    .modal-content {
      max-width: 100%;
      max-height: 100vh;
      border-radius: 0;
    }

    .preview-content {
      font-size: 0.875rem;
      padding: 1rem;
    }
  }
</style>

