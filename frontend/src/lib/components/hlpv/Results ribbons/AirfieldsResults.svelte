<script>
  /**
   * @typedef {Object} UkAirportItem
   * @property {number} id - Airport ID
   * @property {string} name - Airport name
   * @property {string} aeroway_type - Type (aerodrome, airstrip, helipad, heliport)
   * @property {number} dist_m - Distance in meters
   * @property {boolean} on_site - Whether on site
   * @property {boolean} within_500m - Within 500m buffer
   * @property {boolean} within_5km - Within 5km buffer
   * @property {boolean} within_10km - Within 10km buffer
   * @property {string} direction - Compass direction
   */

  /** @type {UkAirportItem[] | undefined} */
  export let ukAirports = [];
  /** @type {string} */
  export let title = 'Airfields';
  /** @type {boolean} */
  export let loading = false;
  /** @type {string} */
  export let error = '';

  $: safeUkAirports = ukAirports || [];

  /** @param {UkAirportItem} item */
  function getStatusBadges(item) {
    /** @type {{ text: string, class: string }[]} */
    const badges = [];

    if (item.on_site) {
      badges.push({ text: 'ON SITE', class: 'badge-on-site' });
    } else if (item.within_500m) {
      badges.push({ text: 'WITHIN 500M', class: 'badge-nearby' });
    } else if (item.within_5km) {
      badges.push({ text: 'WITHIN 5KM', class: 'badge-moderate' });
    } else if (item.within_10km) {
      badges.push({ text: 'WITHIN 10KM', class: 'badge-distant' });
    } else {
      badges.push({ text: 'BEYOND 10KM', class: 'badge-distant' });
    }

    if (item.direction && item.direction !== 'N/A') {
      badges.push({ text: item.direction, class: 'badge-direction' });
    }

    return badges;
  }

  /** @param {string} aerowayType */
  function formatAerowayType(aerowayType) {
    if (!aerowayType) return 'Airport';
    return aerowayType.charAt(0).toUpperCase() + aerowayType.slice(1);
  }

  /** @param {number} distanceInMeters */
  function formatDistance(distanceInMeters) {
    if (distanceInMeters >= 1000) {
      return `${(distanceInMeters / 1000).toFixed(1)}km`;
    }
    return `${distanceInMeters}m`;
  }

  // State for expandable sections
  let ukAirportsExpanded = false;

  // Computed values
  $: totalUkAirports = safeUkAirports.length;
  $: onSiteUkAirports = safeUkAirports.filter(a => a.on_site).length;
  $: within500mUkAirports = safeUkAirports.filter(a => a.within_500m && !a.on_site).length;
  $: within5kmUkAirports = safeUkAirports.filter(a => a.within_5km && !a.within_500m).length;
  $: airportsStatus = onSiteUkAirports > 0 ? 'On Site' : (within500mUkAirports > 0 ? 'Nearby' : (within5kmUkAirports > 0 ? 'Within 5km' : 'None nearby'));
</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analyzing UK Airports...</p>
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
        <h3>UK Airports</h3>
        <p class="summary-value">{totalUkAirports}</p>
        {#if onSiteUkAirports > 0}
          <p style="font-size: 0.875rem; color: #dc2626; margin: 0.25rem 0 0 0;">
            {onSiteUkAirports} on site
          </p>
        {:else if within500mUkAirports > 0}
          <p style="font-size: 0.875rem; color: #ea580c; margin: 0.25rem 0 0 0;">
            {within500mUkAirports} within 500m
          </p>
        {:else if within5kmUkAirports > 0}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            {within5kmUkAirports} within 5km
          </p>
        {/if}
      </div>
    </div>

    <!-- UK Airports Section -->
    {#if totalUkAirports > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => ukAirportsExpanded = !ukAirportsExpanded}
          on:keydown={(e) => e.key === 'Enter' && (ukAirportsExpanded = !ukAirportsExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={ukAirportsExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">UK Airports ({totalUkAirports})</h3>
            {#if onSiteUkAirports > 0}
              <span class="section-subtitle">{onSiteUkAirports} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{ukAirportsExpanded ? '▼' : '→'}</span>
        </div>

        {#if ukAirportsExpanded}
          <div class="results-grid">
            {#each safeUkAirports as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || `Airport ${item.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">{formatAerowayType(item.aeroway_type)}</span>
                  </div>
                  {#if !item.on_site}
                    <div class="detail-row">
                      <span class="detail-label">Distance</span>
                      <span class="detail-value">{formatDistance(item.dist_m)} {item.direction}</span>
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
    {#if totalUkAirports === 0}
      <div class="results-empty">
        <p>No UK Airports found within 10km of the site.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .analysis-results {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .analysis-results h2 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .results-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .summary-card h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-value {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
  }

  .results-section {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 1rem;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  .section-header.clickable {
    cursor: pointer;
    user-select: none;
  }

  .section-header.clickable:hover {
    background: #f1f5f9;
  }

  .section-header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-icon {
    font-size: 1.25rem;
  }

  .section-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .section-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin-left: 0.5rem;
  }

  .expand-icon {
    font-size: 0.75rem;
    color: #64748b;
  }

  .results-grid {
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .result-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
  }

  .item-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .item-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1e293b;
  }

  .status-badges {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-on-site {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge-nearby {
    background: #ffedd5;
    color: #9a3412;
  }

  .badge-moderate {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-distant {
    background: #e2e8f0;
    color: #475569;
  }

  .badge-direction {
    background: #e0e7ff;
    color: #3730a3;
  }

  .item-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .detail-label {
    color: #64748b;
  }

  .detail-value {
    color: #1e293b;
    font-weight: 500;
  }

  .results-empty {
    text-align: center;
    padding: 2rem;
    color: #64748b;
  }

  .results-empty p {
    margin: 0;
  }

  .results-loading {
    text-align: center;
    padding: 2rem;
    color: #64748b;
  }

  .results-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 1rem;
    color: #dc2626;
  }
</style>
