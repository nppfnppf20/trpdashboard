<script>
  import CompletenessStatusBadge from './CompletenessStatusBadge.svelte';

  export let item;
  export let onDraftFromBriefing = null;
</script>

<div class="item">
  <span class="item-label">{item.label}</span>
  <div class="item-right">
    {#if item.can_draft_from_briefing && item.status !== 'complete'}
      <button class="draft-link" on:click={() => onDraftFromBriefing?.(item)}>
        <i class="las la-magic"></i> Draft from briefing
      </button>
    {/if}
    <CompletenessStatusBadge status={item.status} />
  </div>
</div>

<style>
  .item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--color-slate-100);
  }

  .item:last-child {
    border-bottom: none;
  }

  .item-label {
    font-size: 0.85rem;
    color: var(--color-slate-700);
  }

  .item-right {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-shrink: 0;
  }

  .draft-link {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: var(--color-primary-500);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 0.2rem;
    white-space: nowrap;
  }

  .draft-link:hover {
    text-decoration: underline;
  }
</style>
