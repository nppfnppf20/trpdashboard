<script>
  import { resolveRiskSummary } from '$lib/services/reportGenerator.js';
  import GuidanceButton from './GuidanceButton.svelte';

  /** @type {string} */
  export let name = '';

  /** @type {string} */
  export let riskLevel = '';

  /** @type {{title: string, sections: Array<{heading: string, content: string}>} | null} */
  export let guidance = null;

  /** @type {((oldValue: string, newValue: string, applyChange: (v: string) => void) => void) | null} */
  export let onRiskChange = null;

  /** @type {boolean} */
  export let disabled = false;

  /**
   * Handle select change - either apply directly or call callback
   * @param {Event} e
   */
  function handleSelectChange(e) {
    const select = /** @type {HTMLSelectElement} */ (e.currentTarget);
    const newValue = select.value;

    if (onRiskChange && riskLevel && newValue && riskLevel !== newValue) {
      // Callback provided and there's an existing value being changed
      const oldVal = riskLevel;
      select.value = oldVal; // Revert temporarily
      onRiskChange(oldVal, newValue, (v) => { riskLevel = v; });
    } else {
      // No callback or initial selection - apply directly
      riskLevel = newValue;
    }
  }
</script>

<div class="report-section discipline-section">
  <h3>
    {name}
    {#if guidance}
      <GuidanceButton
        title={guidance.title}
        sections={guidance.sections}
      />
    {/if}
  </h3>

  <div class="flood-form">
    <div class="flood-field">
      <label class="flood-label" for="{name.toLowerCase()}-risk-level">Overall {name} Risk Level</label>
      <select
        id="{name.toLowerCase()}-risk-level"
        class="flood-select"
        class:disabled
        value={riskLevel}
        on:change={handleSelectChange}
        {disabled}
      >
        <option value="">-- Select --</option>
        <option value="low_risk">Low Risk</option>
        <option value="medium_low_risk">Medium-Low Risk</option>
        <option value="medium_risk">Medium Risk</option>
        <option value="medium_high_risk">Medium-High Risk</option>
        <option value="high_risk">High Risk</option>
        <option value="extremely_high_risk">Extremely High Risk</option>
        <option value="showstopper">Showstopper</option>
      </select>
    </div>
  </div>

  {#if riskLevel}
    <div class="subsection" style="margin-top: 1rem;">
      <h4>Predicted {name} Risk</h4>
      <div class="risk-badge" style="background-color: {resolveRiskSummary(riskLevel).bgColor}; color: {resolveRiskSummary(riskLevel).color};">
        <span class="risk-level">{resolveRiskSummary(riskLevel).label}</span>
        <span class="risk-description">{resolveRiskSummary(riskLevel).description}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .report-section {
    margin-bottom: 2rem;
  }

  .discipline-section {
    border-top: 2px solid #e5e7eb;
    padding-top: 1.5rem;
  }

  .report-section h3 {
    color: #374151;
    font-size: 1.25rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
  }

  .flood-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background: #f9fafb;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .flood-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .flood-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  .flood-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #374151;
    background: white;
    max-width: 280px;
  }

  .flood-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
  }

  .flood-select.disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
    border-color: #e5e7eb;
  }

  .subsection {
    margin-bottom: 1.5rem;
  }

  .subsection h4 {
    margin-bottom: 0.75rem;
    color: #4b5563;
    font-size: 1rem;
    font-weight: 600;
  }

  .risk-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    border-radius: 8px;
    text-align: center;
    font-weight: 600;
  }

  .risk-level {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .risk-description {
    font-size: 0.875rem;
    font-weight: 400;
  }
</style>
