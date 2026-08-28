<script>
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  export let contact = null;
  
  const dispatch = createEventDispatcher();
  
  function handleClose() {
    show = false;
    dispatch('close');
  }
</script>

{#if show && contact}
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Contact Details</h2>
        <button class="close-btn" on:click={handleClose}>
          <i class="las la-times"></i>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="contact-info">
          <div class="info-row">
            <div class="info-icon">
              <i class="las la-user"></i>
            </div>
            <div class="info-content">
              <span class="info-label">Name</span>
              <span class="info-value">{contact.name}</span>
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-icon">
              <i class="las la-envelope"></i>
            </div>
            <div class="info-content">
              <span class="info-label">Email</span>
              {#if contact.email}
                <a href="mailto:{contact.email}" class="info-value link">
                  {contact.email}
                </a>
              {:else}
                <span class="info-value muted">Not provided</span>
              {/if}
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-icon">
              <i class="las la-phone"></i>
            </div>
            <div class="info-content">
              <span class="info-label">Phone</span>
              {#if contact.phone}
                <a href="tel:{contact.phone}" class="info-value link">
                  {contact.phone}
                </a>
              {:else}
                <span class="info-value muted">Not provided</span>
              {/if}
            </div>
          </div>
          
          {#if contact.is_primary}
            <div class="primary-badge">
              <i class="las la-star"></i>
              Primary Contact
            </div>
          {/if}
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-modal);
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
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .contact-info {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .info-row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .info-icon {
    width: 40px;
    height: 40px;
    background: var(--color-primary-50);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .info-icon i {
    font-size: 1.25rem;
    color: var(--color-primary-500);
  }

  .info-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .info-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 1rem;
    color: var(--color-slate-800);
  }

  .info-value.link {
    color: var(--color-primary-500);
    text-decoration: none;
    transition: color 0.2s;
  }

  .info-value.link:hover {
    color: var(--color-primary-600);
    text-decoration: underline;
  }

  .info-value.muted {
    color: var(--color-slate-400);
    font-style: italic;
  }

  .primary-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .primary-badge i {
    font-size: 1rem;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
  }

</style>

