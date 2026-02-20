<script>
  /** @type {any[] | undefined} */
  export let drinking_water = [];
  /** @type {string} */
  export let title = 'Other';
  /** @type {boolean} */
  export let loading = false;
  /** @type {string} */
  export let error = '';

  $: safeDrinkingWater = drinking_water || [];

  let drinkingWaterExpanded = false;

  $: totalDrinkingWater = safeDrinkingWater.length;
  $: drinkingWaterCoverage = safeDrinkingWater.reduce((sum, d) => sum + (d.percentage_coverage || 0), 0);
  $: cappedCoverage = Math.min(drinkingWaterCoverage, 100);
  $: drinkingWaterStatus = cappedCoverage >= 80 ? 'High Coverage' : (cappedCoverage > 0 ? 'Partial' : 'No');

  /** @param {any} item */
  function getDrinkingWaterLayerName(item) {
    if (item.source_layer === 'safeguard_surface') return 'Safeguard Zone (Surface Water)';
    if (item.source_layer === 'protected_surface') return 'Protected Area (Surface Water)';
    if (item.source_layer === 'safeguard_groundwater') return 'Safeguard Zone (Groundwater)';
    return 'Drinking Water Protected Area';
  }
</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analyzing Drinking Water Protected Areas...</p>
    </div>
  </div>
{:else if error}
  <div class="results-error">
    <strong>Analysis Error:</strong> {error}
  </div>
{:else}
  <div class="analysis-results">
    <h2>{title}</h2>

    <!-- Summary Cards -->
    <div class="results-summary">
      <div class="summary-card">
        <h3>Drinking Water Protected Areas</h3>
        <p class="summary-value">{drinkingWaterStatus}</p>
        {#if drinkingWaterStatus === 'High Coverage'}
          <p style="font-size: 0.875rem; color: #dc2626; margin: 0.25rem 0 0 0;">
            {cappedCoverage.toFixed(1)}% coverage
          </p>
        {:else if drinkingWaterStatus === 'Partial'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            {cappedCoverage.toFixed(1)}% coverage
          </p>
        {/if}
      </div>
    </div>

    <!-- Drinking Water Section -->
    {#if totalDrinkingWater > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => drinkingWaterExpanded = !drinkingWaterExpanded}
          on:keydown={(e) => e.key === 'Enter' && (drinkingWaterExpanded = !drinkingWaterExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={drinkingWaterExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Drinking Water Protected Areas ({totalDrinkingWater})</h3>
            <span class="section-subtitle">{cappedCoverage.toFixed(1)}% total coverage</span>
          </div>
          <span class="expand-icon">{drinkingWaterExpanded ? '▼' : '→'}</span>
        </div>

        {#if drinkingWaterExpanded}
          <div class="results-grid">
            {#each safeDrinkingWater as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || 'Drinking Water Area'}</h4>
                  <div class="status-badges">
                    <span class="badge badge-on-site">ON SITE</span>
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">{getDrinkingWaterLayerName(item)}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Coverage</span>
                    <span class="detail-value">{item.percentage_coverage?.toFixed(1)}%</span>
                  </div>
                  {#if item.area_hectares}
                    <div class="detail-row">
                      <span class="detail-label">Area</span>
                      <span class="detail-value">{item.area_hectares.toFixed(4)} ha</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Empty state -->
    {#if totalDrinkingWater === 0}
      <div class="results-empty">
        <p>No drinking water protected areas found on the site.</p>
      </div>
    {/if}
  </div>
{/if}
