<script>
  import { createEventDispatcher } from 'svelte';

  export let doc = null;

  const dispatch = createEventDispatcher();

  $: review = doc?.ai_review ?? null;

  const impactLabels = {
    strengthens: { label: 'Strengthens argument', colour: '#16a34a' },
    weakens:     { label: 'Weakens argument',     colour: '#dc2626' },
    qualifies:   { label: 'Qualifies argument',   colour: '#d97706' },
    neutral:     { label: 'No material change',   colour: '#64748b' },
    new_sub_point: { label: 'Introduces new point', colour: '#7c3aed' }
  };

  function handleAction(status) {
    dispatch('action', { docId: doc.id, status });
  }

  function close() {
    dispatch('close');
  }
</script>

{#if doc}
  <div class="modal-backdrop" on:click|self={close} role="dialog" aria-modal="true">
    <div class="modal">
      <div class="modal-header">
        <div class="header-left">
          <i class="las la-file-alt"></i>
          <h2>{doc.filename}</h2>
        </div>
        <button class="close-btn" on:click={close}><i class="las la-times"></i></button>
      </div>

      {#if !review}
        <div class="modal-body">
          <p class="no-review">No AI review available for this document.</p>
        </div>
      {:else}
        <div class="modal-body">

          <!-- Relevance -->
          <div class="section relevance-section" class:not-relevant={!review.relevant}>
            <div class="relevance-badge" class:relevant={review.relevant} class:irrelevant={!review.relevant}>
              <i class="las {review.relevant ? 'la-check-circle' : 'la-times-circle'}"></i>
              {review.relevant ? 'Relevant' : 'Not relevant'}
            </div>
            <p class="relevance-summary">{review.relevance_summary}</p>
            {#if review.affected_issues?.length}
              <div class="affected-issues">
                <span class="label-small">Affects:</span>
                {#each review.affected_issues as issue}
                  <span class="issue-chip">{issue}</span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Impact -->
          {#if review.argument_impact}
            {@const impact = impactLabels[review.argument_impact]}
            <div class="section impact-section">
              <div class="impact-badge" style="color: {impact?.colour ?? '#64748b'}; border-color: {impact?.colour ?? '#64748b'}">
                {impact?.label ?? review.argument_impact}
              </div>
              {#if review.impact_explanation}
                <p class="impact-explanation">{review.impact_explanation}</p>
              {/if}
            </div>
          {/if}

          <!-- Extracted points -->
          {#if review.extracted_points}
            <div class="section">
              <h3>Extracted Points</h3>
              {#each [['helpful','Helpful','#16a34a'], ['harmful','Harmful','#dc2626'], ['procedural','Procedural','#0284c7'], ['policy','Policy','#7c3aed']] as [key, label, colour]}
                {#if review.extracted_points[key]?.length}
                  <div class="point-group">
                    <span class="point-label" style="color:{colour}">{label}</span>
                    <ul>
                      {#each review.extracted_points[key] as point}
                        <li>{point}</li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}

          <!-- Bullet suggestions -->
          {#if review.bullet_suggestions?.length}
            <div class="section">
              <h3>Suggested Additions</h3>
              <ul class="suggestions">
                {#each review.bullet_suggestions as suggestion}
                  <li>{suggestion}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Draft paragraph -->
          {#if review.draft_paragraph}
            <div class="section">
              <h3>Suggested Draft Text</h3>
              <div class="draft-paragraph">{review.draft_paragraph}</div>
            </div>
          {/if}

          <!-- Caution note -->
          {#if review.caution_note}
            <div class="caution-note">
              <i class="las la-exclamation-triangle"></i>
              {review.caution_note}
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="modal-footer">
          <p class="footer-label">Mark this document as:</p>
          <div class="action-buttons">
            <button class="action-btn merge" on:click={() => handleAction('merged')}>
              <i class="las la-check"></i> Merged into argument
            </button>
            <button class="action-btn notes" on:click={() => handleAction('notes_only')}>
              <i class="las la-sticky-note"></i> Save as note only
            </button>
            <button class="action-btn ignore" on:click={() => handleAction('ignored')}>
              <i class="las la-ban"></i> Ignore
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-left i {
    font-size: 1.5rem;
    color: #7c3aed;
  }

  .header-left h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    word-break: break-word;
  }

  .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 1.5rem;
    padding: 0.25rem;
    flex-shrink: 0;
  }

  .close-btn:hover { color: #475569; }

  .modal-body {
    overflow-y: auto;
    padding: 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .section { display: flex; flex-direction: column; gap: 0.5rem; }

  .section h3 {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .relevance-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 600;
    width: fit-content;
  }

  .relevance-badge.relevant { background: #dcfce7; color: #16a34a; }
  .relevance-badge.irrelevant { background: #fee2e2; color: #dc2626; }

  .relevance-summary { margin: 0; font-size: 0.9rem; color: #374151; }

  .affected-issues {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }

  .label-small { font-size: 0.8rem; color: #64748b; font-weight: 500; }

  .issue-chip {
    padding: 0.2rem 0.6rem;
    background: #ede9fe;
    color: #7c3aed;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .impact-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border: 1px solid;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    width: fit-content;
  }

  .impact-explanation { margin: 0; font-size: 0.9rem; color: #374151; }

  .point-group { margin-bottom: 0.5rem; }

  .point-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .point-group ul, .suggestions {
    margin: 0.375rem 0 0 1rem;
    padding: 0;
  }

  .point-group li, .suggestions li {
    font-size: 0.9rem;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .draft-paragraph {
    background: #f8fafc;
    border-left: 3px solid #7c3aed;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    color: #374151;
    border-radius: 0 6px 6px 0;
    line-height: 1.6;
  }

  .caution-note {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #92400e;
  }

  .caution-note i { font-size: 1rem; margin-top: 0.1rem; flex-shrink: 0; }

  .no-review { color: #64748b; font-size: 0.9rem; }

  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
  }

  .footer-label {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: #64748b;
    font-weight: 500;
  }

  .action-buttons {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid;
    transition: all 0.15s;
  }

  .action-btn.merge  { background: #dcfce7; color: #16a34a; border-color: #86efac; }
  .action-btn.notes  { background: #ede9fe; color: #7c3aed; border-color: #c4b5fd; }
  .action-btn.ignore { background: #f1f5f9; color: #64748b; border-color: #cbd5e1; }

  .action-btn:hover { filter: brightness(0.95); }
</style>
