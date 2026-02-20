<script>
  /**
   * @typedef {Object} PondItem
   * @property {number} id - Pond ID
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

  /**
   * @typedef {Object} RamsarItem
   * @property {number} id - Ramsar site ID
   * @property {string} name - Site name
   * @property {string} code - Site code
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

  /** @type {PondItem[] | undefined} */
  export let osPriorityPonds = [];
  /** @type {RamsarItem[] | undefined} */
  export let ramsar = [];
  /** @type {RamsarItem[] | undefined} */
  export let spa = [];
  /** @type {RamsarItem[] | undefined} */
  export let sac = [];
  /** @type {PondItem[] | undefined} */
  export let gcn = [];
  /** @type {any[] | undefined} */
  export let sssi = [];
  export let national_nature_reserves = [];
  /** @type {string} */
  export let title = 'Ecology Results';
  /** @type {boolean} */
  export let loading = false;
  /** @type {string} */
  export let error = '';

  $: safePonds = osPriorityPonds || [];
  $: safeRamsar = ramsar || [];
  $: safeSPA = spa || [];
  $: safeSAC = sac || [];
  $: safeGcn = gcn || [];
  $: safeSSSI = sssi || [];
  $: safeNNR = national_nature_reserves || [];

  /** @param {PondItem} item */
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

  /** @param {number} distanceInMeters */
  function formatDistance(distanceInMeters) {
    if (distanceInMeters >= 1000) {
      return `${(distanceInMeters / 1000).toFixed(1)}km`;
    }
    return `${distanceInMeters}m`;
  }

  // State for expandable sections
  let osPriorityPondsExpanded = false;
  let ramsarExpanded = false;
  let spaExpanded = false;
  let sacExpanded = false;
  let gcnExpanded = false;
  let sssiExpanded = false;
  let nnrExpanded = false;

  // Computed values
  $: totalPonds = safePonds.length;
  $: onSitePonds = safePonds.filter(p => p.on_site).length;
  $: within1kmPonds = safePonds.filter(p => p.dist_m <= 1000).length;
  $: pondStatus = onSitePonds > 0 ? 'Yes' : (within1kmPonds > 0 ? 'Nearby' : 'No');

  $: totalRamsar = safeRamsar.length;
  $: onSiteRamsar = safeRamsar.filter(r => r.on_site).length;
  $: within1kmRamsar = safeRamsar.filter(r => r.dist_m <= 1000).length;
  $: ramsarStatus = onSiteRamsar > 0 ? 'Yes' : (within1kmRamsar > 0 ? 'Nearby' : 'No');

  $: totalSPA = safeSPA.length;
  $: onSiteSPA = safeSPA.filter(s => s.on_site).length;
  $: within1kmSPA = safeSPA.filter(s => s.dist_m <= 1000).length;
  $: spaStatus = onSiteSPA > 0 ? 'Yes' : (within1kmSPA > 0 ? 'Nearby' : 'No');

  $: totalSAC = safeSAC.length;
  $: onSiteSAC = safeSAC.filter(s => s.on_site).length;
  $: within1kmSAC = safeSAC.filter(s => s.dist_m <= 1000).length;
  $: sacStatus = onSiteSAC > 0 ? 'Yes' : (within1kmSAC > 0 ? 'Nearby' : 'No');

  $: totalGcn = safeGcn.length;
  $: onSiteGcn = safeGcn.filter(g => g.on_site).length;
  $: within1kmGcn = safeGcn.filter(g => g.dist_m <= 1000).length;
  $: gcnStatus = onSiteGcn > 0 ? 'Yes' : (within1kmGcn > 0 ? 'Nearby' : 'No');

  $: totalSSSI = safeSSSI.length;
  $: onSiteSSSI = safeSSSI.filter(s => s.on_site).length;
  $: within1kmSSSI = safeSSSI.filter(s => s.dist_m <= 1000).length;
  $: sssiStatus = onSiteSSSI > 0 ? 'Yes' : (within1kmSSSI > 0 ? 'Nearby' : 'No');

  $: totalNNR = safeNNR.length;
  $: onSiteNNR = safeNNR.filter(n => n.on_site).length;
  $: within1kmNNR = safeNNR.filter(n => n.dist_m <= 1000).length;
  $: nnrStatus = onSiteNNR > 0 ? 'Yes' : (within1kmNNR > 0 ? 'Nearby' : 'No');

</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analyzing OS Priority Ponds…</p>
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
        <h3>OS Priority Ponds</h3>
        <p class="summary-value">{pondStatus}</p>
        {#if pondStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSitePonds} on site
          </p>
        {:else if pondStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 1km
          </p>
        {/if}
      </div>

      <div class="summary-card">
        <h3>Ramsar Sites</h3>
        <p class="summary-value">{ramsarStatus}</p>
        {#if ramsarStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSiteRamsar} on site
          </p>
        {:else if ramsarStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 1km
          </p>
        {/if}
      </div>

      <div class="summary-card">
        <h3>Special Protection Areas</h3>
        <p class="summary-value">{spaStatus}</p>
        {#if spaStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSiteSPA} on site
          </p>
        {:else if spaStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 1km
          </p>
        {/if}
      </div>

      <div class="summary-card">
        <h3>Special Areas of Conservation</h3>
        <p class="summary-value">{sacStatus}</p>
        {#if sacStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSiteSAC} on site
          </p>
        {:else if sacStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 1km
          </p>
        {/if}
      </div>

      <div class="summary-card">
        <h3>GCN Class Survey License Returns</h3>
        <p class="summary-value">{gcnStatus}</p>
        {#if gcnStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSiteGcn} on site
          </p>
        {:else if gcnStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 250m
          </p>
        {/if}
      </div>

      <div class="summary-card">
        <h3>SSSI Sites</h3>
        <p class="summary-value">{sssiStatus}</p>
        {#if sssiStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSiteSSSI} on site
          </p>
        {:else if sssiStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 1km
          </p>
        {/if}
      </div>

      <div class="summary-card">
        <h3>National Nature Reserves</h3>
        <p class="summary-value">{nnrStatus}</p>
        {#if nnrStatus === 'Yes'}
          <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
            {onSiteNNR} on site
          </p>
        {:else if nnrStatus === 'Nearby'}
          <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
            Within 1km
          </p>
        {/if}
      </div>
    </div>

    <!-- OS Priority Ponds Section -->
    {#if totalPonds > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => osPriorityPondsExpanded = !osPriorityPondsExpanded}
          on:keydown={(e) => e.key === 'Enter' && (osPriorityPondsExpanded = !osPriorityPondsExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={osPriorityPondsExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">OS Priority Ponds ({totalPonds})</h3>
            {#if onSitePonds > 0}
              <span class="section-subtitle">{onSitePonds} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{osPriorityPondsExpanded ? '▼' : '→'}</span>
        </div>

        {#if osPriorityPondsExpanded}
          <div class="results-grid">
            {#each safePonds as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">OS Priority Pond {item.id}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">OS Priority Pond</span>
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

    <!-- Ramsar Sites Section -->
    {#if totalRamsar > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => ramsarExpanded = !ramsarExpanded}
          on:keydown={(e) => e.key === 'Enter' && (ramsarExpanded = !ramsarExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={ramsarExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Ramsar Sites ({totalRamsar})</h3>
            {#if onSiteRamsar > 0}
              <span class="section-subtitle">{onSiteRamsar} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{ramsarExpanded ? '▼' : '→'}</span>
        </div>

        {#if ramsarExpanded}
          <div class="results-grid">
            {#each safeRamsar as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || `Ramsar Site ${item.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Ramsar Wetland</span>
                  </div>
                  {#if item.code}
                    <div class="detail-row">
                      <span class="detail-label">Code</span>
                      <span class="detail-value">{item.code}</span>
                    </div>
                  {/if}
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

    <!-- Special Protection Areas Section -->
    {#if totalSPA > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => spaExpanded = !spaExpanded}
          on:keydown={(e) => e.key === 'Enter' && (spaExpanded = !spaExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={spaExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Special Protection Areas ({totalSPA})</h3>
            {#if onSiteSPA > 0}
              <span class="section-subtitle">{onSiteSPA} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{spaExpanded ? '▼' : '→'}</span>
        </div>

        {#if spaExpanded}
          <div class="results-grid">
            {#each safeSPA as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || `SPA ${item.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Special Protection Area</span>
                  </div>
                  {#if item.code}
                    <div class="detail-row">
                      <span class="detail-label">Code</span>
                      <span class="detail-value">{item.code}</span>
                    </div>
                  {/if}
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

    <!-- Special Areas of Conservation Section -->
    {#if totalSAC > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => sacExpanded = !sacExpanded}
          on:keydown={(e) => e.key === 'Enter' && (sacExpanded = !sacExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={sacExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Special Areas of Conservation ({totalSAC})</h3>
            {#if onSiteSAC > 0}
              <span class="section-subtitle">{onSiteSAC} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{sacExpanded ? '▼' : '→'}</span>
        </div>

        {#if sacExpanded}
          <div class="results-grid">
            {#each safeSAC as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || `SAC ${item.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Special Area of Conservation</span>
                  </div>
                  {#if item.code}
                    <div class="detail-row">
                      <span class="detail-label">Code</span>
                      <span class="detail-value">{item.code}</span>
                    </div>
                  {/if}
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

    <!-- GCN Class Survey License Returns Section -->
    {#if totalGcn > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => gcnExpanded = !gcnExpanded}
          on:keydown={(e) => e.key === 'Enter' && (gcnExpanded = !gcnExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={gcnExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">GCN Class Survey License Returns ({totalGcn})</h3>
            {#if onSiteGcn > 0}
              <span class="section-subtitle">{onSiteGcn} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{gcnExpanded ? '▼' : '→'}</span>
        </div>
        {#if gcnExpanded}
          <div class="results-grid">
            {#each safeGcn as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">GCN License Return {item.id}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Great Crested Newt Survey</span>
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

    <!-- SSSI Section -->
    {#if totalSSSI > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => sssiExpanded = !sssiExpanded}
          on:keydown={(e) => e.key === 'Enter' && (sssiExpanded = !sssiExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={sssiExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">SSSI Sites ({totalSSSI})</h3>
            {#if onSiteSSSI > 0}
              <span class="section-subtitle">{onSiteSSSI} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{sssiExpanded ? '▼' : '→'}</span>
        </div>
        {#if sssiExpanded}
          <div class="results-grid">
            {#each safeSSSI as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || `SSSI ${item.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Site of Special Scientific Interest</span>
                  </div>
                  {#if item.ref_code}
                    <div class="detail-row">
                      <span class="detail-label">Reference</span>
                      <span class="detail-value">{item.ref_code}</span>
                    </div>
                  {/if}
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

    <!-- National Nature Reserves Section -->
    {#if totalNNR > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => nnrExpanded = !nnrExpanded}
          on:keydown={(e) => e.key === 'Enter' && (nnrExpanded = !nnrExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={nnrExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">National Nature Reserves ({totalNNR})</h3>
            {#if onSiteNNR > 0}
              <span class="section-subtitle">{onSiteNNR} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{nnrExpanded ? '▼' : '→'}</span>
        </div>
        {#if nnrExpanded}
          <div class="results-grid">
            {#each safeNNR as item}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{item.name || `NNR ${item.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(item) as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">National Nature Reserve</span>
                  </div>
                  {#if item.ref_code}
                    <div class="detail-row">
                      <span class="detail-label">Reference</span>
                      <span class="detail-value">{item.ref_code}</span>
                    </div>
                  {/if}
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
    {#if totalPonds === 0 && totalRamsar === 0 && totalSPA === 0 && totalSAC === 0 && totalGcn === 0 && totalSSSI === 0 && totalNNR === 0}
      <div class="results-empty">
        <p>No ecological designations found in the analyzed area.</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">OS Priority Ponds and GCN License Returns searched within 250m, Ramsar/SPA/SAC sites and SSSI within 5km, NNR within 1km.</p>
      </div>
    {/if}
  </div>
{/if}

