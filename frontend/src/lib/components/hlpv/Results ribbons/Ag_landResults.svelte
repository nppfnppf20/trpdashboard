<script>
  /**
   * @typedef {Object} AgLandItem
   * @property {string} grade - The agricultural land grade
   * @property {number} area_hectares - Area in hectares
   * @property {number} percentage_coverage - Percentage coverage of the site
   */

  /** @type {AgLandItem[] | undefined} */
  export let agLand = [];
  /** @type {string} */
  export let title = 'Agricultural Land Results';
  /** @type {boolean} */
  export let loading = false;
  /** @type {string} */
  export let error = '';

  $: gradesFound = (agLand || []).length;
  $: safeAgLand = agLand || [];

  /** @param {string} grade */
  function cleanGrade(grade) {
    const s = String(grade || '').trim();
    return s.replace(/^Grade\s+/i, '');
  }
</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analyzing agricultural land…</p>
    </div>
  </div>
{:else if error}
  <div class="results-error">
    <strong>Analysis Error:</strong> {error}
  </div>
{:else}
  <div class="analysis-results">
    <h2>{title}</h2>

    <!-- Simple cards for each grade -->
    <div class="results-grid">
      {#each safeAgLand as row}
        <div class="result-item">
          <div class="item-header">
            <h4 class="item-title">Grade {cleanGrade(row.grade)}</h4>
          </div>
          <div class="item-details">
            <div class="detail-row">
              <span class="detail-label">Area</span>
              <span class="detail-value">{Number(row.area_hectares).toFixed(4)} ha</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">% of Site</span>
              <span class="detail-value">{Number(row.percentage_coverage).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

