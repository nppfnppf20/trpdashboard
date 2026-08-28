<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** @type {string} */
  export let title = 'Guidance';

  /** @type {Array<{heading: string, content: string}>} */
  export let sections = [];

  /** @type {boolean} */
  export let isOpen = false;

  function close() {
    dispatch('close');
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="guidance-title">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="guidance-title">{title}</h2>
        <button class="close-button" on:click={close} aria-label="Close guidance">
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        {#each sections as section, index}
          <div class="guidance-section" class:first={index === 0}>
            <h3>{section.heading}</h3>
            <div class="guidance-content">
              {#each section.content.split(/\n\n|\\n\\n/) as paragraph}
                {#if paragraph.trim()}
                  <p>{paragraph.replace(/\\n/g, '\n')}</p>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn-close" on:click={close}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--overlay-bg);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    padding: 1rem;
  }

  .modal-content {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    max-width: 700px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-modal);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-gray-200);
    flex-shrink: 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-gray-800);
    font-weight: 500;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: var(--color-slate-500);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-700);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .guidance-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-gray-200);
  }

  .guidance-section.first {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .guidance-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: var(--color-slate-700);
    font-weight: 500;
  }

  .guidance-content {
    color: var(--color-slate-600);
    line-height: 1.7;
    font-size: 0.925rem;
  }

  .guidance-content p {
    margin: 0 0 1rem 0;
  }

  .guidance-content p:last-child {
    margin-bottom: 0;
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-gray-200);
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .btn-close {
    padding: 0.5rem 1.25rem;
    background: var(--color-slate-100);
    color: var(--color-slate-700);
    border: 1px solid var(--color-gray-300);
    border-radius: var(--radius-md);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-close:hover {
    background: var(--color-gray-200);
  }
</style>
