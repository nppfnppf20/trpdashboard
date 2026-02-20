<script>
  import { onMount } from 'svelte';
  import { getTemplates, getProjectDeliverables, deleteDeliverable } from '$lib/services/planningDeliverablesApi.js';
  import TemplateSelector from './TemplateSelector.svelte';
  import DeliverableEditor from './DeliverableEditor.svelte';
  import TemplatePreviewModal from './TemplatePreviewModal.svelte';
  import EditDeliverablesMasterModal from './EditDeliverablesMasterModal.svelte';
  import EditMasterWarningModal from '$lib/components/shared/EditMasterWarningModal.svelte';

  export let project;

  let templates = [];
  let deliverables = [];
  let loading = true;
  let error = null;

  let showTemplateSelector = false;
  let selectedDeliverable = null;
  let editingDeliverable = false;
  let showTemplatePreview = false;
  let selectedTemplate = null;
  let showTemplateEditor = false;
  let templateToEdit = null;
  let showEditWarning = false;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    error = null;
    
    try {
      // Load templates and existing deliverables
      const [templatesData, deliverablesData] = await Promise.all([
        getTemplates(),
        getProjectDeliverables(project.id)
      ]);
      
      templates = templatesData;
      deliverables = deliverablesData;
    } catch (err) {
      console.error('Error loading data:', err);
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function handleCreateNew() {
    showTemplateSelector = true;
  }

  function handleCloseTemplateSelector() {
    showTemplateSelector = false;
  }

  async function handleTemplateSelected(event) {
    showTemplateSelector = false;
    
    // The deliverable is created in TemplateSelector
    // Reload the deliverables list
    await loadData();
    
    // Open the newly created deliverable for editing
    if (event.detail?.deliverable) {
      selectedDeliverable = event.detail.deliverable;
      editingDeliverable = true;
    }
  }

  function handleEditDeliverable(deliverable) {
    selectedDeliverable = deliverable;
    editingDeliverable = true;
  }

  function handleCloseEditor() {
    selectedDeliverable = null;
    editingDeliverable = false;
    loadData(); // Reload to get updated data
  }

  async function handleDeleteDeliverable(deliverableId) {
    if (!confirm('Are you sure you want to delete this deliverable? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDeliverable(deliverableId);
      await loadData(); // Reload list
    } catch (err) {
      console.error('Error deleting deliverable:', err);
      alert('Failed to delete deliverable: ' + err.message);
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function getStatusColor(status) {
    const colors = {
      'draft': '#f59e0b',
      'review': '#3b82f6',
      'final': '#10b981'
    };
    return colors[status] || '#6b7280';
  }

  function handleTemplateClick(template) {
    selectedTemplate = template;
    showTemplatePreview = true;
  }

  function handleCloseTemplatePreview() {
    showTemplatePreview = false;
    selectedTemplate = null;
  }

  function openTemplateForEditing(event, template) {
    event.stopPropagation(); // Prevent triggering the card click (preview)
    templateToEdit = template;
    showEditWarning = true;
  }

  function handleWarningCancel() {
    showEditWarning = false;
    templateToEdit = null;
  }

  function handleWarningContinue() {
    showEditWarning = false;
    showTemplateEditor = true;
  }

  async function handleTemplateEditorClose() {
    showTemplateEditor = false;
    templateToEdit = null;
    // Reload templates to get any updates
    await loadData();
  }
</script>

<div class="deliverables-panel">
  {#if loading}
    <div class="loading">
      <i class="las la-spinner la-spin"></i>
      <p>Loading...</p>
    </div>
  {:else if error}
    <div class="error">
      <i class="las la-exclamation-circle"></i>
      <p>Error: {error}</p>
      <button on:click={loadData} class="retry-btn">Try Again</button>
    </div>
  {:else}
    <div class="panel-header">
      <div class="project-info">
        <h2>{project.project_name}</h2>
        <p class="project-id">Project ID: {project.project_id}</p>
      </div>
      <button class="create-btn" on:click={handleCreateNew}>
        <i class="las la-plus"></i>
        Create New Deliverable
      </button>
    </div>

    <div class="deliverables-section">
      <h3 class="section-title">
        <i class="las la-file-alt"></i>
        Your Deliverables ({deliverables.length})
      </h3>

      {#if deliverables.length === 0}
        <div class="empty-deliverables">
          <i class="las la-folder-open"></i>
          <p>No deliverables created yet</p>
          <p class="empty-hint">Click "Create New Deliverable" above to get started</p>
        </div>
      {:else}
        <div class="deliverables-grid">
          {#each deliverables as deliverable}
            <div class="deliverable-card">
              <div class="card-header">
                <div class="card-icon">
                  <i class="las la-file-alt"></i>
                </div>
                <div class="card-status" style="background: {getStatusColor(deliverable.status)}20; color: {getStatusColor(deliverable.status)}">
                  {deliverable.status}
                </div>
              </div>

              <div class="card-content">
                <h4 class="deliverable-name">{deliverable.deliverable_name}</h4>
                <p class="template-type">{deliverable.template_name}</p>
                <p class="meta-info">
                  <span>
                    <i class="las la-clock"></i>
                    Updated {formatDate(deliverable.updated_at)}
                  </span>
                </p>
              </div>

              <div class="card-actions">
                <button 
                  class="action-btn edit-btn" 
                  on:click={() => handleEditDeliverable(deliverable)}
                  title="Edit deliverable"
                >
                  <i class="las la-edit"></i>
                  Edit
                </button>
                <button 
                  class="action-btn delete-btn" 
                  on:click={() => handleDeleteDeliverable(deliverable.id)}
                  title="Delete deliverable"
                >
                  <i class="las la-trash"></i>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="templates-section">
      <h3 class="section-title">
        <i class="las la-layer-group"></i>
        Available Templates ({templates.length})
      </h3>
      <div class="templates-grid">
        {#each templates as template}
          <div
            class="template-card clickable"
            on:click={() => handleTemplateClick(template)}
            on:keydown={(e) => e.key === 'Enter' && handleTemplateClick(template)}
            role="button"
            tabindex="0"
            title="Click to preview template"
          >
            <button
              class="template-edit-btn"
              on:click={(e) => openTemplateForEditing(e, template)}
              title="Edit template"
            >
              <i class="las la-edit"></i>
            </button>
            <div class="template-icon">
              <i class="las la-file-invoice"></i>
            </div>
            <div class="template-info">
              <h4>{template.template_name}</h4>
              <p>{template.description || 'No description available'}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Template Selector Modal -->
{#if showTemplateSelector}
  <TemplateSelector
    {project}
    {templates}
    on:close={handleCloseTemplateSelector}
    on:templateSelected={handleTemplateSelected}
  />
{/if}

<!-- Deliverable Editor Modal -->
{#if editingDeliverable && selectedDeliverable}
  <DeliverableEditor
    deliverable={selectedDeliverable}
    on:close={handleCloseEditor}
  />
{/if}

<!-- Template Preview Modal -->
{#if showTemplatePreview && selectedTemplate}
  <TemplatePreviewModal
    template={selectedTemplate}
    on:close={handleCloseTemplatePreview}
  />
{/if}

<!-- Edit Master Warning Modal -->
<EditMasterWarningModal
  isOpen={showEditWarning}
  title="Edit Master Template"
  itemName={templateToEdit?.template_name}
  itemType="template"
  hint="To create a deliverable for this project only, use the <strong>template selector</strong> to add a new deliverable instead."
  on:cancel={handleWarningCancel}
  on:continue={handleWarningContinue}
/>

<!-- Template Editor Modal -->
{#if showTemplateEditor && templateToEdit}
  <EditDeliverablesMasterModal
    template={templateToEdit}
    on:close={handleTemplateEditorClose}
  />
{/if}

<style>
  .deliverables-panel {
    max-width: 1400px;
    margin: 0 auto;
  }

  .loading, .error {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .loading i, .error i {
    font-size: 3rem;
    color: #64748b;
    margin-bottom: 1rem;
  }

  .loading p, .error p {
    font-size: 1.125rem;
    color: #64748b;
    margin: 0;
  }

  .retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #0d9488;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
  }

  .retry-btn:hover {
    background: #0f766e;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }

  .project-info h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }

  .project-id {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #0d9488;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-btn:hover {
    background: #0f766e;
    transform: translateY(-1px);
  }

  .create-btn i {
    font-size: 1.25rem;
  }

  .deliverables-section, .templates-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-title i {
    font-size: 1.5rem;
    color: #0d9488;
  }

  .empty-deliverables {
    text-align: center;
    padding: 3rem 2rem;
    background: white;
    border-radius: 12px;
    border: 2px dashed #cbd5e1;
  }

  .empty-deliverables i {
    font-size: 4rem;
    color: #cbd5e1;
    margin-bottom: 1rem;
  }

  .empty-deliverables p {
    font-size: 1.125rem;
    color: #64748b;
    margin: 0;
  }

  .empty-hint {
    font-size: 0.875rem !important;
    color: #94a3b8 !important;
    margin-top: 0.5rem !important;
  }

  .deliverables-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .deliverable-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .deliverable-card:hover {
    border-color: #0d9488;
    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.1);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .card-icon {
    width: 3rem;
    height: 3rem;
    background: #ccfbf1;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-icon i {
    font-size: 1.5rem;
    color: #0d9488;
  }

  .card-status {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .card-content {
    margin-bottom: 1rem;
  }

  .deliverable-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }

  .template-type {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 0.5rem 0;
  }

  .meta-info {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .meta-info i {
    font-size: 0.875rem;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: white;
    color: #64748b;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    border-color: #0d9488;
    color: #0d9488;
  }

  .delete-btn {
    flex: 0;
  }

  .delete-btn:hover {
    border-color: #dc2626;
    color: #dc2626;
    background: #fef2f2;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
  }

  .template-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    gap: 1rem;
    transition: all 0.2s;
    position: relative;
  }

  .template-card.clickable {
    cursor: pointer;
  }

  .template-edit-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    color: #94a3b8;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0;
  }

  .template-edit-btn:hover {
    background: #f1f5f9;
    color: #0d9488;
  }

  .template-card:hover .template-edit-btn {
    opacity: 1;
  }

  .template-card.clickable:hover {
    border-color: #0d9488;
    box-shadow: 0 2px 8px rgba(13, 148, 136, 0.1);
    transform: translateY(-1px);
  }

  .template-card.clickable:focus {
    outline: none;
    border-color: #0d9488;
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
  }

  .template-icon {
    width: 2.5rem;
    height: 2.5rem;
    background: #f1f5f9;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .template-icon i {
    font-size: 1.25rem;
    color: #64748b;
  }

  .template-info h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }

  .template-info p {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
    line-height: 1.4;
  }

  @media (max-width: 768px) {
    .panel-header {
      flex-direction: column;
      gap: 1rem;
    }

    .create-btn {
      width: 100%;
      justify-content: center;
    }

    .deliverables-grid, .templates-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

