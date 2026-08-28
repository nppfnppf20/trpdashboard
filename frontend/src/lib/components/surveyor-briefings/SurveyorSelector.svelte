<script>
  import { createEventDispatcher } from 'svelte';

  export let surveyors = [];
  export let selected = [];

  const dispatch = createEventDispatcher();

  // Group surveyors by discipline
  $: groupedSurveyors = surveyors.reduce((acc, surveyor) => {
    const discipline = surveyor.discipline || 'Other';
    if (!acc[discipline]) {
      acc[discipline] = [];
    }
    acc[discipline].push(surveyor);
    return acc;
  }, {});

  $: disciplines = Object.keys(groupedSurveyors).sort();

  function toggleSurveyor(surveyorId) {
    const index = selected.indexOf(surveyorId);
    if (index > -1) {
      selected = selected.filter(id => id !== surveyorId);
    } else {
      selected = [...selected, surveyorId];
    }
    dispatch('change', selected);
  }

  function isSelected(surveyorId) {
    return selected.includes(surveyorId);
  }
</script>

<div class="surveyor-selector">
  {#if surveyors.length === 0}
    <p class="empty">No surveyors available</p>
  {:else}
    {#each disciplines as discipline}
      <div class="discipline-group">
        <h4 class="discipline-header">{discipline}</h4>
        <div class="surveyor-list">
          {#each groupedSurveyors[discipline] as surveyor}
            <label class="surveyor-item">
              <input
                type="checkbox"
                checked={isSelected(surveyor.id)}
                on:change={() => toggleSurveyor(surveyor.id)}
              />
              <span class="surveyor-name">{surveyor.organisation}</span>
              {#if surveyor.location}
                <span class="surveyor-location">({surveyor.location})</span>
              {/if}
            </label>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .surveyor-selector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .empty {
    color: var(--color-slate-400);
    text-align: center;
    padding: 2rem;
  }

  .discipline-group {
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    overflow: hidden;
  }

  .discipline-header {
    margin: 0;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50);
    color: var(--color-slate-600);
    font-size: 0.875rem;
    font-weight: 600;
    border-bottom: 1px solid var(--color-slate-200);
  }

  .surveyor-list {
    display: flex;
    flex-direction: column;
  }

  .surveyor-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .surveyor-item:hover {
    background: var(--color-slate-50);
  }

  .surveyor-item:not(:last-child) {
    border-bottom: 1px solid var(--color-slate-100);
  }

  .surveyor-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary-500);
  }

  .surveyor-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--color-slate-800);
    font-weight: 500;
  }

  .surveyor-location {
    font-size: 0.8125rem;
    color: var(--color-slate-500);
  }
</style>
