<script>
  import { uploadDocument } from '$lib/api/ingestion.js';

  export let projectId;
  export let topics = [];
  export let stages = [];        // project_stage_instances with stage name attached
  export let onUploaded = () => {};

  let file = null;
  let stageLabel = '';
  let stageInstanceId = '';
  let uploading = false;
  let error = null;
  let dragOver = false;

  $: selectedStage = stages.find(s => String(s.instance_id) === String(stageInstanceId)) ?? null;
  $: hasTopics = topics.length > 0;

  function handleFileInput(e) {
    file = e.target.files[0] ?? null;
  }

  function handleDrop(e) {
    e.preventDefault();
    dragOver = false;
    file = e.dataTransfer.files[0] ?? null;
  }

  async function handleUpload() {
    if (!file || !hasTopics) return;
    uploading = true;
    error = null;
    try {
      const meta = {};
      if (stageInstanceId) meta.stage_instance_id = Number(stageInstanceId);
      else if (stageLabel.trim()) meta.stage_label = stageLabel.trim();

      const result = await uploadDocument(projectId, file, meta);
      file = null;
      stageLabel = '';
      stageInstanceId = '';
      await onUploaded(result);
    } catch (err) {
      error = err.message;
    } finally {
      uploading = false;
    }
  }
</script>

<div class="upload-panel">
  <div class="panel-header">
    <h3>Upload Document</h3>
    <p class="panel-subtext">PDF, Word (.docx), .txt, or .md, max 20MB</p>
  </div>

  {#if !hasTopics}
    <div class="no-topics-notice">
      <i class="las la-info-circle"></i>
      You must define at least one topic before uploading documents.
    </div>
  {/if}

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  <!-- Drop zone -->
  <div
    class="drop-zone"
    class:drag-over={dragOver}
    class:has-file={!!file}
    on:dragover|preventDefault={() => dragOver = true}
    on:dragleave={() => dragOver = false}
    on:drop={handleDrop}
    role="button"
    tabindex="0"
  >
    {#if file}
      <div class="file-selected">
        <i class="las la-file-alt"></i>
        <span>{file.name}</span>
        <button class="clear-file" on:click|stopPropagation={() => file = null}>
          <i class="las la-times"></i>
        </button>
      </div>
    {:else}
      <label class="drop-label" for="file-input">
        <i class="las la-cloud-upload-alt"></i>
        <span>Drop a file here or <u>browse</u></span>
      </label>
      <input
        id="file-input"
        type="file"
        accept=".pdf,.docx,.txt,.md"
        class="hidden-input"
        on:change={handleFileInput}
      />
    {/if}
  </div>

  <!-- Stage options -->
  <div class="stage-row">
    <div class="form-group">
      <label>Project Stage <span class="hint">(optional, links document to a stage on the board)</span></label>
      <select bind:value={stageInstanceId} class="form-select">
        <option value="">Standard upload (no stage)</option>
        {#each stages as stage}
          <option value={stage.instance_id}>{stage.stage_name}</option>
        {/each}
      </select>
    </div>

    {#if !stageInstanceId}
      <div class="form-group">
        <label>Stage Label <span class="hint">(free text, shown on timeline)</span></label>
        <input bind:value={stageLabel} placeholder="e.g. Initial Consultation" class="form-input" />
      </div>
    {/if}
  </div>

  {#if selectedStage?.user_guidance}
    <div class="guidance-callout">
      <i class="las la-info-circle"></i>
      <div>
        <strong>{selectedStage.stage_name}</strong>
        <p>{selectedStage.user_guidance}</p>
        <p class="review-note">This stage has a custom prompt: you'll be asked to review the LLM output before it's saved.</p>
      </div>
    </div>
  {/if}

  <button
    class="btn-upload"
    on:click={handleUpload}
    disabled={!file || !hasTopics || uploading}
  >
    {#if uploading}
      <span class="spinner-sm"></span> Analysing document…
    {:else}
      <i class="las la-rocket"></i> Upload & Analyse
    {/if}
  </button>
</div>

<style>
  .upload-panel { display: flex; flex-direction: column; gap: 0.875rem; }

  .panel-header h3 { margin: 0 0 0.2rem 0; font-size: 1rem; font-weight: 600; color: #1e293b; }
  .panel-subtext { margin: 0; font-size: 0.8rem; color: #94a3b8; }

  .no-topics-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #fef3c7;
    border: 1px solid #fde68a;
    color: #92400e;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .drop-zone {
    border: 2px dashed #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
    background: #fafafa;
    position: relative;
  }
  .drop-zone.drag-over { border-color: #9333ea; background: #faf5ff; }
  .drop-zone.has-file  { border-color: #c4b5fd; background: #faf5ff; border-style: solid; }

  .drop-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    color: #64748b;
    font-size: 0.875rem;
  }
  .drop-label i { font-size: 2rem; color: #9333ea; }
  .drop-label u { color: #9333ea; }

  .hidden-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .file-selected {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #7e22ce;
  }
  .file-selected i { font-size: 1.1rem; }

  .clear-file {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.1rem;
    border-radius: 3px;
    line-height: 1;
    transition: color 0.15s;
  }
  .clear-file:hover { color: #ef4444; }

  .stage-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .form-group { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 180px; }
  .form-group label { font-size: 0.78rem; font-weight: 600; color: #475569; }
  .hint { font-weight: 400; color: #94a3b8; }

  .form-select, .form-input {
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
  .form-select:focus, .form-input:focus { border-color: #9333ea; }

  .guidance-callout {
    display: flex;
    gap: 0.75rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 0.875rem;
    font-size: 0.875rem;
    color: #1e40af;
  }
  .guidance-callout i { font-size: 1.1rem; flex-shrink: 0; margin-top: 2px; }
  .guidance-callout p { margin: 0.35rem 0 0 0; color: #1d4ed8; line-height: 1.5; }
  .review-note { font-size: 0.78rem; color: #3b82f6; font-style: italic; }

  .btn-upload {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #9333ea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-upload:hover:not(:disabled) { background: #7e22ce; }
  .btn-upload:disabled { opacity: 0.6; cursor: not-allowed; }

  .spinner-sm {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
