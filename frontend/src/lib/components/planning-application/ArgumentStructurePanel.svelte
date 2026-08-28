<script>
  import { issueNotes, noteStatus, handleNoteInput } from '$lib/stores/planning-notes.js';

  export let keyIssues = [];
  export let projectPolicies = [];
  export let policyTrackRelevance = {};
  export let argumentPointsByTrack = {};

  const tierLabels = {
    national:      'National',
    local:         'Local',
    neighbourhood: 'Neighbourhood',
    supplementary: 'Supplementary',
    other:         'Other'
  };

  const tierColours = {
    national:      { bg: '#dbeafe', colour: '#1d4ed8' },
    local:         { bg: '#ede9fe', colour: '#6d28d9' },
    neighbourhood: { bg: '#dcfce7', colour: '#15803d' },
    supplementary: { bg: '#fef9c3', colour: '#a16207' },
    other:         { bg: '#f1f5f9', colour: '#475569' }
  };

  function linkedPolicies(issueId) {
    const ids = policyTrackRelevance[issueId] ?? [];
    return projectPolicies.filter(p => ids.includes(p.id));
  }

  const riskColours = {
    showstopper:         { bg: '#fee2e2', colour: '#991b1b' },
    extremely_high_risk: { bg: '#fee2e2', colour: '#dc2626' },
    high_risk:           { bg: '#ffedd5', colour: '#c2410c' },
    medium_high_risk:    { bg: '#fef9c3', colour: '#a16207' },
    medium_risk:         { bg: '#fef9c3', colour: '#ca8a04' },
    medium_low_risk:     { bg: '#dcfce7', colour: '#15803d' },
    low_risk:            { bg: '#dcfce7', colour: '#16a34a' }
  };

  function valueAndResize(node, value) {
    node.value = value ?? '';
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.addEventListener('input', resize);
    resize();
    return {
      update(v) { node.value = v ?? ''; resize(); },
      destroy() { node.removeEventListener('input', resize); }
    };
  }
</script>

{#if keyIssues.length === 0}
  <div class="empty-state">
    <i class="las la-list-alt"></i>
    <p>No key issues found. Add them in the Key Issues tab first.</p>
  </div>
{:else}
  <div class="argument-list">
    {#each keyIssues as issue (issue.id)}
      {@const risk = riskColours[issue.last_known_risk_level]}
      {@const linked = linkedPolicies(issue.id)}
      <div class="argument-section">
        <div class="argument-heading">
          <div class="argument-title-row">
            {#if issue.discipline}
              <span class="discipline-tag">{issue.discipline.replace(/_/g, ' ')}</span>
            {/if}
            <h2 class="argument-issue-title">{issue.label}</h2>
            {#if issue.last_known_risk_level}
              <span class="risk-chip" style="background:{risk?.bg ?? '#f1f5f9'}; color:{risk?.colour ?? '#64748b'}">
                {issue.last_known_risk_level.replace(/_/g, ' ')}
              </span>
            {/if}
          </div>
          {#if $noteStatus[issue.id] === 'saving'}
            <span class="note-status saving"><span class="mini-spinner"></span> Saving</span>
          {:else if $noteStatus[issue.id] === 'saved'}
            <span class="note-status saved"><i class="las la-check"></i> Saved</span>
          {/if}
        </div>

        {#if linked.length > 0}
          <div class="linked-policies">
            <span class="linked-policies-label">Linked policies</span>
            <div class="linked-policy-list">
              {#each linked as policy}
                {@const tier = tierColours[policy.policy_type] ?? tierColours.other}
                <div class="linked-policy-row">
                  <span class="tier-chip" style="background:{tier.bg}; color:{tier.colour}">
                    {tierLabels[policy.policy_type] ?? policy.policy_type}
                  </span>
                  <span class="policy-ref">{policy.policy_reference}</span>
                  {#if policy.policy_name}
                    <span class="policy-name">{policy.policy_name}</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="note-field-group">
          <label class="note-label">Policy Assessment</label>
          <textarea
            class="notes-field"
            placeholder="Describe how the proposal is policy compliant on this issue..."
            use:valueAndResize={$issueNotes[issue.id]?.argument_for ?? ''}
            on:input={(e) => handleNoteInput(issue.id, 'argument_for', e.target.value)}
          ></textarea>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 2rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .empty-state i { font-size: 3rem; }
  .empty-state p { margin: 0; font-size: 0.9rem; max-width: 360px; }

  .argument-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 800px;
  }

  .argument-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .argument-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .argument-title-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .argument-issue-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .discipline-tag {
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-slate-100);
    color: var(--color-slate-500);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    white-space: nowrap;
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .risk-chip {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.625rem;
    border-radius: 999px;
    white-space: nowrap;
    text-transform: capitalize;
    flex-shrink: 0;
  }

  .note-status {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .note-status.saving { color: var(--color-slate-400); }
  .note-status.saved  { color: var(--color-emerald-600); }

  .linked-policies {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
  }

  .linked-policies-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-slate-400);
  }

  .linked-policy-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .linked-policy-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .tier-chip {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.45rem;
    border-radius: 4px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .policy-ref {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-800);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .policy-name {
    font-size: 0.8rem;
    color: var(--color-slate-600);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .note-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .note-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }

  .notes-field {
    width: 100%;
    box-sizing: border-box;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: var(--color-slate-50);
    resize: none;
    overflow: hidden;
    line-height: 1.5;
    min-height: 120px;
    transition: border-color 0.15s, background 0.15s;
  }

  .notes-field:focus {
    outline: none;
    border-color: var(--color-teal-600);
    background: white;
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.07);
  }

  .notes-field::placeholder { color: var(--color-slate-400); }

  .mini-spinner {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
