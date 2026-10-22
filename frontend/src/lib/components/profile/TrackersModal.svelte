<script>
  // Popup wrapper so the Trackers & Surveyor browser can live behind a button on
  // the profile page instead of taking up a slot in the grid. The widget itself
  // is unchanged — it already scrolls inside whatever height it is given.
  import { onMount } from 'svelte';
  import TrackersSurveyorWidget from './TrackersSurveyorWidget.svelte';

  export let projects = [];
  export let onClose = () => {};

  onMount(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="tm-backdrop" role="presentation" on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="tm-modal" role="dialog" aria-modal="true" aria-label="Trackers and Surveyor">
    <button class="btn btn-icon btn-ghost tm-close" on:click={onClose} title="Close" aria-label="Close">
      <i class="las la-times"></i>
    </button>
    <div class="tm-body">
      <TrackersSurveyorWidget {projects} />
    </div>
  </div>
</div>

<style>
  .tm-backdrop {
    position: fixed; inset: 0; z-index: 1000; padding: 1rem;
    display: flex; align-items: center; justify-content: center;
    background: var(--overlay-bg);
  }
  .tm-modal {
    position: relative; display: flex; flex-direction: column;
    width: min(820px, 100%); height: min(680px, 88vh);
    background: var(--color-white); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-modal);
  }
  .tm-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  /* The widget brings its own card chrome; inside the popup it should just fill it. */
  .tm-body > :global(.widget) {
    flex: 1; border: none; box-shadow: none; border-radius: var(--radius-lg);
    grid-row: auto;
  }
  /* Sits in the widget header's right-hand gap, past the project dropdown. */
  .tm-close { position: absolute; top: 0.6rem; right: 0.75rem; z-index: 1; }
  .tm-body > :global(.widget .widget-head) { padding-right: 3rem; }
</style>
