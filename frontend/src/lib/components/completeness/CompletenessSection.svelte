<script>
  import CompletenessStatusBadge from './CompletenessStatusBadge.svelte';
  import CompletenessItem from './CompletenessItem.svelte';

  export let section;
  export let onDraftFromBriefing = null;

  $: completeCount = section.items.filter(i => i.status === 'complete').length;
</script>

<div class="section">
  <div class="section-header">
    <div class="section-title">
      <span class="section-label">{section.label}</span>
      <span class="section-count">{completeCount}/{section.items.length}</span>
    </div>
    <CompletenessStatusBadge status={section.status} />
  </div>

  <div class="section-items">
    {#each section.items as item}
      <CompletenessItem {item} {onDraftFromBriefing} />
    {/each}
  </div>
</div>

<style>
  .section {
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50);
    border-bottom: 1px solid var(--color-slate-200);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .section-count {
    font-size: 0.75rem;
    color: var(--color-slate-400);
    font-weight: 400;
  }

  .section-items {
    padding: 0.25rem 1rem;
  }
</style>
