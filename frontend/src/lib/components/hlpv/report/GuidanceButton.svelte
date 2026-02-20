<script>
  import GuidanceModal from './GuidanceModal.svelte';

  /** @type {string} */
  export let title = 'Guidance';

  /** @type {Array<{heading: string, content: string}>} */
  export let sections = [];

  let isModalOpen = false;

  function openModal() {
    isModalOpen = true;
  }

  function closeModal() {
    isModalOpen = false;
  }
</script>

<button
  class="guidance-button"
  on:click={openModal}
  title="View {title}"
  aria-label="View guidance for {title}"
>
  <i class="las la-info-circle"></i>
</button>

<GuidanceModal
  {title}
  {sections}
  isOpen={isModalOpen}
  on:close={closeModal}
/>

<style>
  .guidance-button {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.15s ease;
    font-size: 1.25rem;
    margin-left: 0.5rem;
    vertical-align: middle;
  }

  .guidance-button:hover {
    background: #f3f4f6;
    color: #3b82f6;
  }

  .guidance-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }
</style>
