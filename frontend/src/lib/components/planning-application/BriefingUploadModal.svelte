<script>
  import {
    briefingUploadOpen,
    briefingUploadTab,
    briefingUploadFile,
    briefingUploadText,
    briefingUploadTitle,
    briefingUploadLoading,
    submitBriefingUpload,
  } from '$lib/stores/planning-notes.js';
  import { openActionPrompt } from '$lib/stores/actionPrompts.js';

  export let project;

  let briefingFileInput;
</script>

<div class="modal-overlay" on:click|self={() => $briefingUploadOpen = false} role="dialog" aria-modal="true">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">Upload briefing note</span>
      <button class="modal-close" on:click={() => $briefingUploadOpen = false}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="log-form-field" style="margin-bottom:1rem">
        <label class="section-field-label">Title <span class="form-label-hint">(optional)</span></label>
        <input class="add-section-input" type="text" bind:value={$briefingUploadTitle} placeholder="e.g. Briefing note v2, April review" />
      </div>
      <div class="input-tabs">
        <button class="input-tab" class:active={$briefingUploadTab === 'upload'} on:click={() => $briefingUploadTab = 'upload'}>
          <i class="las la-file-upload"></i> Upload
        </button>
        <button class="input-tab" class:active={$briefingUploadTab === 'paste'} on:click={() => $briefingUploadTab = 'paste'}>
          <i class="las la-paste"></i> Paste Text
        </button>
      </div>
      {#if $briefingUploadTab === 'upload'}
        <div
          class="upload-zone"
          class:has-file={$briefingUploadFile}
          on:dragover|preventDefault={() => {}}
          on:drop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) $briefingUploadFile = f; }}
          on:click={() => briefingFileInput.click()}
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === 'Enter' && briefingFileInput.click()}
        >
          {#if $briefingUploadFile}
            <i class="las la-file-alt"></i>
            <span>{$briefingUploadFile.name}</span>
            <span class="upload-sub">Click to change</span>
          {:else}
            <i class="las la-cloud-upload-alt"></i>
            <span>Drop a PDF or click to upload</span>
            <span class="upload-sub">PDF, TXT or MD · max 20MB</span>
          {/if}
        </div>
        <input type="file" accept=".pdf,.txt,.md" bind:this={briefingFileInput} on:change={(e) => $briefingUploadFile = e.target.files[0] || null} style="display:none" />
      {:else}
        <textarea class="paste-area" bind:value={$briefingUploadText} placeholder="Paste briefing note text here..."></textarea>
      {/if}
    </div>
    <div class="modal-footer">
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="modal-cancel" on:click={() => $briefingUploadOpen = false}>Cancel</button>
        <button class="prompt-info-btn" title="Edit draft arguments prompt" on:click={() => openActionPrompt('draft_arguments_from_briefing')}><i class="las la-sliders-h"></i></button>
        <button
          class="modal-run"
          disabled={$briefingUploadLoading || ($briefingUploadTab === 'upload' ? !$briefingUploadFile : !$briefingUploadText.trim())}
          on:click={() => submitBriefingUpload(project.id)}
        >
          {$briefingUploadLoading ? 'Uploading...' : 'Upload & draft arguments'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 100%;
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-slate-400);
    font-size: 1.125rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .modal-close:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-footer-left { display: flex; gap: 0.5rem; }
  .modal-footer-right { display: flex; gap: 0.5rem; }

  .modal-cancel {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
  }
  .modal-cancel:hover { background: var(--color-slate-100); }

  .modal-run {
    padding: 0.5rem 1.25rem;
    background: var(--color-violet-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .modal-run:hover:not(:disabled) { background: var(--color-violet-700); }
  .modal-run:disabled { opacity: 0.4; cursor: not-allowed; }

  .prompt-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 0.25rem;
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.75rem;
    opacity: 0.7;
    transition: opacity 0.15s, color 0.15s;
    vertical-align: middle;
    margin-left: 0.35rem;
  }
  .prompt-info-btn:hover { opacity: 1; color: var(--color-primary-500); border-color: var(--color-primary-500); }

  .log-form-field { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }

  .section-field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }

  .form-label-hint {
    font-weight: 400;
    color: var(--color-slate-400);
  }

  .add-section-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    transition: border-color 0.15s;
  }
  .add-section-input:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.07); }
  .add-section-input::placeholder { color: var(--color-slate-400); }

  .input-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    flex-shrink: 0;
  }

  .input-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    border: none;
    background: transparent;
    color: var(--color-slate-500);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .input-tab.active { color: var(--color-violet-600); border-bottom-color: var(--color-violet-600); }
  .input-tab:hover:not(.active) { color: var(--color-slate-700); }

  .upload-zone {
    margin: 1.25rem;
    border: 2px dashed var(--color-slate-300);
    border-radius: 10px;
    padding: 2.5rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.15s;
    background: white;
    text-align: center;
  }

  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--color-violet-600); background: var(--color-purple-50); }
  .upload-zone i { font-size: 2.25rem; color: var(--color-slate-400); }
  .upload-zone span { font-size: 0.875rem; color: var(--color-slate-600); font-weight: 500; }
  .upload-sub { font-size: 0.8rem !important; color: var(--color-slate-400) !important; font-weight: 400 !important; }

  .upload-zone.has-file { border-color: var(--color-violet-600); background: var(--color-purple-50); }
  .upload-zone.has-file i { color: var(--color-violet-600); }

  .paste-area {
    flex: 1;
    margin: 1.25rem;
    padding: 0.875rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    min-height: 200px;
    transition: border-color 0.15s;
    background: white;
  }

  .paste-area:focus { outline: none; border-color: var(--color-violet-600); box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08); }
</style>
