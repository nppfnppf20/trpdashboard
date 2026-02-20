<script>
  /**
   * @typedef {Object} RenewableItem
   * @property {number} id - Development ID
   * @property {string} site_name - Site name
   * @property {string} development_status_short - Development status (short)
   * @property {string} technology_type - Technology type
   * @property {string} installed_capacity_mw - Installed capacity in MW
   * @property {string} planning_authority - Planning authority
   * @property {string} planning_application_reference - Planning application reference
   * @property {number} dist_m - Distance in meters
   * @property {boolean} on_site - Whether on site
   * @property {boolean} within_50m - Within 50m buffer
   * @property {boolean} within_100m - Within 100m buffer
   * @property {boolean} within_250m - Within 250m buffer
   * @property {boolean} within_500m - Within 500m buffer
   * @property {boolean} within_1km - Within 1km buffer
   * @property {boolean} within_3km - Within 3km buffer
   * @property {boolean} within_5km - Within 5km buffer
   * @property {string} direction - Compass direction
   */

  /** @type {RenewableItem[] | undefined} */
  export let renewables = [];
  /** @type {string} */
  export let title = 'Renewables Development';
  /** @type {boolean} */
  export let loading = false;
  /** @type {string} */
  export let error = '';

  $: safeRenewables = renewables || [];

  /** @param {RenewableItem} item */
  function getStatusBadges(item) {
    /** @type {{ text: string, class: string }[]} */
    const badges = [];
    
    if (item.on_site) {
      badges.push({ text: 'ON SITE', class: 'badge-on-site' });
    } else if (item.within_50m) {
      badges.push({ text: 'WITHIN 50M', class: 'badge-nearby' });
    } else if (item.within_100m) {
      badges.push({ text: 'WITHIN 100M', class: 'badge-nearby' });
    } else if (item.within_250m) {
      badges.push({ text: 'WITHIN 250M', class: 'badge-nearby' });
    } else if (item.within_500m) {
      badges.push({ text: 'WITHIN 500M', class: 'badge-nearby' });
    } else if (item.within_1km) {
      badges.push({ text: 'WITHIN 1KM', class: 'badge-nearby' });
    } else if (item.within_3km) {
      badges.push({ text: 'WITHIN 3KM', class: 'badge-nearby' });
    } else if (item.within_5km) {
      badges.push({ text: 'WITHIN 5KM', class: 'badge-nearby' });
    } else {
      badges.push({ text: 'BEYOND 5KM', class: 'badge-distant' });
    }
    
    if (item.direction && item.direction !== 'N/A') {
      badges.push({ text: item.direction, class: 'badge-direction' });
    }
    
    return badges;
  }

  /** @param {string} techType */
  function getTechIcon(techType) {
    if (techType === 'Solar Photovoltaics') return '';
    if (techType === 'Wind Onshore') return '';
    if (techType === 'Battery') return '';
    return '';
  }

  /** @param {number} distanceInMeters */
  function formatDistance(distanceInMeters) {
    if (distanceInMeters >= 1000) {
      return `${(distanceInMeters / 1000).toFixed(1)}km`;
    }
    return `${distanceInMeters}m`;
  }
</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analyzing renewable energy developments…</p>
    </div>
  </div>
{:else if error}
  <div class="results-error">
    <strong>Analysis Error:</strong> {error}
  </div>
{:else}
  <div class="analysis-results">
    <h2>{title}</h2>

    {#if safeRenewables.length > 0}
      <!-- Individual development cards -->
      <div class="results-grid">
        {#each safeRenewables as item}
          <div class="result-item">
            <div class="item-header">
              <h4 class="item-title">
                {getTechIcon(item.technology_type)} {item.site_name || `Development ${item.id}`}
              </h4>
              <div class="status-badges">
                {#each getStatusBadges(item) as badge}
                  <span class="badge {badge.class}">{badge.text}</span>
                {/each}
              </div>
            </div>
            <div class="item-details">
              <div class="detail-row">
                <span class="detail-label">Technology</span>
                <span class="detail-value">{item.technology_type}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="detail-value">{item.development_status_short || 'Unknown'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Capacity</span>
                <span class="detail-value">{item.installed_capacity_mw || 'Unknown'} MW</span>
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
    {:else}
      <div class="results-empty">
        <p>No results found.</p>
      </div>
    {/if}
  </div>
{/if}
