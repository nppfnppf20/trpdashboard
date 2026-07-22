<script>
  import BriefingSuggestionCard from './BriefingSuggestionCard.svelte';

  export let label;
  export let suggestions;
  export let onAccept;
  export let onReject;
  export let issueTypes = [];
  export let onMatchChange;

  $: acceptedCount = suggestions.filter(s => s._state === 'accepted').length;
</script>

{#if suggestions.length > 0}
  <div class="group">
    <div class="group-header">
      <span class="group-label">{label}</span>
      <span class="group-count">{acceptedCount}/{suggestions.length} accepted</span>
    </div>

    <div class="group-cards">
      {#each suggestions as suggestion (suggestion.type === 'document_summary' ? suggestion.doc_type : suggestion.type === 'new_issue' ? suggestion.suggested_label : suggestion.track_id)}
        <BriefingSuggestionCard {suggestion} {onAccept} {onReject} {issueTypes} {onMatchChange} />
      {/each}
    </div>
  </div>
{/if}

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .group-label {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .group-count {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .group-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
