<script>
  /** @type {{ listed_buildings?: any[], conservation_areas?: any[], scheduled_monuments?: any[], registered_parks_gardens?: any[], world_heritage_sites?: any[] } | null} */
  export let data = null;
  
  /** @type {string} */
  export let title = "Analysis Results";
  
  /** @type {boolean} */
  export let loading = false;
  
  /** @type {string} */
  export let error = '';

  // Helper functions
  /**
   * @param {number} distance
   * @param {boolean} onSite
   */
  function getDistanceClass(distance, onSite) {
    if (onSite) return 'on-site';
    if (distance <= 100) return 'nearby';
    return 'distant';
  }

  /**
   * @param {any} item
   * @param {string} type
   */
  function getStatusBadges(item, type) {
    /** @type {{ text: string, class: string }[]} */
    const badges = [];
    
    if (item.on_site) {
      badges.push({ text: 'ON SITE', class: 'badge-on-site' });
    } else {
      const distance = item.dist_m;
      if (type === 'listed_buildings') {
        if (distance <= 100) badges.push({ text: 'WITHIN 100M', class: 'badge-nearby' });
        else badges.push({ text: `${distance}M AWAY`, class: 'badge-distant' });
      } else if (type === 'conservation_areas') {
        if (item.within_250m) badges.push({ text: 'WITHIN 250M', class: 'badge-nearby' });
        else badges.push({ text: `${distance}M AWAY`, class: 'badge-distant' });
      } else if (type === 'scheduled_monuments') {
        if (distance <= 50) badges.push({ text: 'WITHIN 50M', class: 'badge-nearby' });
        else if (distance <= 100) badges.push({ text: 'WITHIN 100M', class: 'badge-nearby' });
        else if (distance <= 250) badges.push({ text: 'WITHIN 250M', class: 'badge-nearby' });
        else if (distance <= 500) badges.push({ text: 'WITHIN 500M', class: 'badge-nearby' });
        else if (distance <= 1000) badges.push({ text: 'WITHIN 1KM', class: 'badge-nearby' });
        else if (distance <= 3000) badges.push({ text: 'WITHIN 3KM', class: 'badge-nearby' });
        else if (distance <= 5000) badges.push({ text: 'WITHIN 5KM', class: 'badge-distant' });
        else badges.push({ text: `${(distance/1000).toFixed(1)}KM AWAY`, class: 'badge-distant' });
      } else if (type === 'registered_parks_gardens') {
        if (distance <= 50) badges.push({ text: 'WITHIN 50M', class: 'badge-nearby' });
        else if (distance <= 100) badges.push({ text: 'WITHIN 100M', class: 'badge-nearby' });
        else if (distance <= 250) badges.push({ text: 'WITHIN 250M', class: 'badge-nearby' });
        else if (distance <= 500) badges.push({ text: 'WITHIN 500M', class: 'badge-nearby' });
        else if (distance <= 1000) badges.push({ text: 'WITHIN 1KM', class: 'badge-nearby' });
        else if (distance <= 3000) badges.push({ text: 'WITHIN 3KM', class: 'badge-nearby' });
        else if (distance <= 5000) badges.push({ text: 'WITHIN 5KM', class: 'badge-distant' });
        else badges.push({ text: `${(distance/1000).toFixed(1)}KM AWAY`, class: 'badge-distant' });
      } else if (type === 'world_heritage_sites') {
        if (distance <= 50) badges.push({ text: 'WITHIN 50M', class: 'badge-nearby' });
        else if (distance <= 100) badges.push({ text: 'WITHIN 100M', class: 'badge-nearby' });
        else if (distance <= 250) badges.push({ text: 'WITHIN 250M', class: 'badge-nearby' });
        else if (distance <= 500) badges.push({ text: 'WITHIN 500M', class: 'badge-nearby' });
        else if (distance <= 1000) badges.push({ text: 'WITHIN 1KM', class: 'badge-nearby' });
        else if (distance <= 3000) badges.push({ text: 'WITHIN 3KM', class: 'badge-nearby' });
        else if (distance <= 5000) badges.push({ text: 'WITHIN 5KM', class: 'badge-distant' });
        else badges.push({ text: `${(distance/1000).toFixed(1)}KM AWAY`, class: 'badge-distant' });
      }
    }
    
    if (item.grade) {
      badges.push({ text: `GRADE ${item.grade}`, class: 'badge-grade' });
    }
    
    if (item.direction && item.direction !== 'N/A') {
      badges.push({ text: item.direction, class: 'badge-direction' });
    }
    
    return badges;
  }

  /**
   * @param {number} distance
   * @param {boolean} onSite
   */
  function formatDistance(distance, onSite) {
    if (onSite) return 'On Site';
    if (distance < 1000) return `${distance}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  }

  // State for expandable sections
  let listedBuildingsExpanded = false;
  let conservationAreasExpanded = false;
  let scheduledMonumentsExpanded = false;
  let registeredParksGardensExpanded = false;
  let worldHeritageSitesExpanded = false;

  // Computed values
  $: listedBuildings = data?.listed_buildings || [];
  $: conservationAreas = data?.conservation_areas || [];
  $: scheduledMonuments = data?.scheduled_monuments || [];
  $: registeredParksGardens = data?.registered_parks_gardens || [];
  $: worldHeritageSites = data?.world_heritage_sites || [];

  // All results (for expandable sections - up to 5km)
  $: totalListedBuildings = listedBuildings.length;
  $: totalConservationAreas = conservationAreas.length;
  $: totalScheduledMonuments = scheduledMonuments.length;
  $: totalRegisteredParksGardens = registeredParksGardens.length;
  $: totalWorldHeritageSites = worldHeritageSites.length;

  // Within 1km only (for summary boxes)
  $: listedBuildingsWithin1km = listedBuildings.filter(b => b.on_site || b.dist_m <= 1000);
  $: conservationAreasWithin1km = conservationAreas.filter(a => a.on_site || a.dist_m <= 1000);
  $: scheduledMonumentsWithin1km = scheduledMonuments.filter(sm => sm.on_site || sm.dist_m <= 1000);
  $: registeredParksGardensWithin1km = registeredParksGardens.filter(pg => pg.on_site || pg.dist_m <= 1000);
  $: worldHeritageSitesWithin1km = worldHeritageSites.filter(whs => whs.on_site || whs.dist_m <= 1000);

  $: totalListedBuildingsWithin1km = listedBuildingsWithin1km.length;
  $: totalConservationAreasWithin1km = conservationAreasWithin1km.length;
  $: totalScheduledMonumentsWithin1km = scheduledMonumentsWithin1km.length;
  $: totalRegisteredParksGardensWithin1km = registeredParksGardensWithin1km.length;
  $: totalWorldHeritageSitesWithin1km = worldHeritageSitesWithin1km.length;

  // Surrounding area counts (within 1km but not on site)
  $: surroundingBuildings = listedBuildingsWithin1km.filter(b => !b.on_site).length;
  $: surroundingAreas = conservationAreasWithin1km.filter(a => !a.on_site).length;
  $: surroundingMonuments = scheduledMonumentsWithin1km.filter(sm => !sm.on_site).length;
  $: surroundingParksGardens = registeredParksGardensWithin1km.filter(pg => !pg.on_site).length;
  $: surroundingWorldHeritageSites = worldHeritageSitesWithin1km.filter(whs => !whs.on_site).length;

  $: onSiteBuildings = listedBuildings.filter(b => b.on_site).length;
  $: onSiteAreas = conservationAreas.filter(a => a.on_site).length;
  $: onSiteMonuments = scheduledMonuments.filter(sm => sm.on_site).length;
  $: onSiteParksGardens = registeredParksGardens.filter(pg => pg.on_site).length;
  $: onSiteWorldHeritageSites = worldHeritageSites.filter(whs => whs.on_site).length;
</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analysing site...</p>
    </div>
  </div>
{:else if error}
  <div class="results-error">
    <strong>Analysis Error:</strong> {error}
  </div>
{:else if data}
  <div class="analysis-results">
    <h2>{title}</h2>
    
    <!-- Summary Cards -->
    <div class="results-summary">
      <div class="summary-card">
        <h3>Listed Buildings</h3>
        <p class="summary-value">{onSiteBuildings > 0 ? 'Yes' : (surroundingBuildings > 0 ? 'Nearby' : 'No')}</p>
        <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
          {onSiteBuildings > 0 ? `(${onSiteBuildings} on-site)` : (surroundingBuildings > 0 ? `(${surroundingBuildings} within 1km)` : `(0 within 1km)`)}
        </p>
      </div>
      
      <div class="summary-card">
        <h3>Conservation Areas</h3>
        <p class="summary-value">{onSiteAreas > 0 ? 'Yes' : (surroundingAreas > 0 ? 'Nearby' : 'No')}</p>
        <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
          {onSiteAreas > 0 ? `(${onSiteAreas} on-site)` : (surroundingAreas > 0 ? `(${surroundingAreas} within 1km)` : `(0 within 1km)`)}
        </p>
      </div>

      <div class="summary-card">
        <h3>Scheduled Monuments</h3>
        <p class="summary-value">{onSiteMonuments > 0 ? 'Yes' : (surroundingMonuments > 0 ? 'Nearby' : 'No')}</p>
        <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
          {onSiteMonuments > 0 ? `(${onSiteMonuments} on-site)` : (surroundingMonuments > 0 ? `(${surroundingMonuments} within 1km)` : `(0 within 1km)`)}
        </p>
      </div>

      <div class="summary-card">
        <h3>Parks &amp; Gardens</h3>
        <p class="summary-value">{onSiteParksGardens > 0 ? 'Yes' : (surroundingParksGardens > 0 ? 'Nearby' : 'No')}</p>
        <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
          {onSiteParksGardens > 0 ? `(${onSiteParksGardens} on-site)` : (surroundingParksGardens > 0 ? `(${surroundingParksGardens} within 1km)` : `(0 within 1km)`)}
        </p>
      </div>

      <div class="summary-card">
        <h3>World Heritage Sites</h3>
        <p class="summary-value">{onSiteWorldHeritageSites > 0 ? 'Yes' : (surroundingWorldHeritageSites > 0 ? 'Nearby' : 'No')}</p>
        <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
          {onSiteWorldHeritageSites > 0 ? `(${onSiteWorldHeritageSites} on-site)` : (surroundingWorldHeritageSites > 0 ? `(${surroundingWorldHeritageSites} within 1km)` : `(0 within 1km)`)}
        </p>
      </div>
    </div>

    <!-- Listed Buildings Section -->
    {#if listedBuildings.length > 0}
      <div class="results-section">
        <div 
          class="section-header clickable" 
          on:click={() => listedBuildingsExpanded = !listedBuildingsExpanded}
          on:keydown={(e) => e.key === 'Enter' && (listedBuildingsExpanded = !listedBuildingsExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={listedBuildingsExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Listed Buildings ({totalListedBuildings})</h3>
            {#if onSiteBuildings > 0}
              <span class="section-subtitle">{onSiteBuildings} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{listedBuildingsExpanded ? '▼' : '→'}</span>
        </div>
        
        {#if listedBuildingsExpanded}
          <div class="results-grid">
            {#each listedBuildings as building}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{building.name || `Building #${building.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(building, 'listed_buildings') as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                
                <div class="item-details">
                  {#if building.grade}
                    <div class="detail-row">
                      <span class="detail-label">Heritage Grade</span>
                      <span class="detail-value">Grade {building.grade}</span>
                    </div>
                  {/if}
                  
                  <div class="detail-row">
                    <span class="detail-label">Distance</span>
                    <span class="detail-value distance {getDistanceClass(building.dist_m, building.on_site)}">
                      {formatDistance(building.dist_m, building.on_site)}
                    </span>
                  </div>
                  
                  {#if building.direction && building.direction !== 'N/A'}
                    <div class="detail-row">
                      <span class="detail-label">Direction</span>
                      <span class="detail-value">{building.direction}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Conservation Areas Section -->
    {#if conservationAreas.length > 0}
      <div class="results-section">
        <div 
          class="section-header clickable" 
          on:click={() => conservationAreasExpanded = !conservationAreasExpanded}
          on:keydown={(e) => e.key === 'Enter' && (conservationAreasExpanded = !conservationAreasExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={conservationAreasExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Conservation Areas ({totalConservationAreas})</h3>
            {#if onSiteAreas > 0}
              <span class="section-subtitle">{onSiteAreas} intersecting</span>
            {/if}
          </div>
          <span class="expand-icon">{conservationAreasExpanded ? '▼' : '→'}</span>
        </div>
        
        {#if conservationAreasExpanded}
          <div class="results-grid">
            {#each conservationAreas as area}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{area.name || `Area #${area.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(area, 'conservation_areas') as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>
                
                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Distance</span>
                    <span class="detail-value distance {getDistanceClass(area.dist_m, area.on_site)}">
                      {formatDistance(area.dist_m, area.on_site)}
                    </span>
                  </div>
                  
                  {#if area.direction && area.direction !== 'N/A'}
                    <div class="detail-row">
                      <span class="detail-label">Direction</span>
                      <span class="detail-value">{area.direction}</span>
                    </div>
                  {/if}
                  
                  {#if area.within_250m !== undefined}
                    <div class="detail-row">
                      <span class="detail-label">Within 250m</span>
                      <span class="detail-value">{area.within_250m ? 'Yes' : 'No'}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Scheduled Monuments Section -->
    {#if scheduledMonuments.length > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => scheduledMonumentsExpanded = !scheduledMonumentsExpanded}
          on:keydown={(e) => e.key === 'Enter' && (scheduledMonumentsExpanded = !scheduledMonumentsExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={scheduledMonumentsExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Scheduled Monuments ({totalScheduledMonuments})</h3>
            {#if onSiteMonuments > 0}
              <span class="section-subtitle">{onSiteMonuments} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{scheduledMonumentsExpanded ? '▼' : '→'}</span>
        </div>

        {#if scheduledMonumentsExpanded}
          <div class="results-grid">
            {#each scheduledMonuments as monument}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{monument.name || `Scheduled Monument ${monument.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(monument, 'scheduled_monuments') as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>

                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">Scheduled Monument</span>
                  </div>

                  {#if !monument.on_site}
                    <div class="detail-row">
                      <span class="detail-label">Distance</span>
                      <span class="detail-value distance {getDistanceClass(monument.dist_m, monument.on_site)}">
                        {formatDistance(monument.dist_m, monument.on_site)}
                      </span>
                    </div>
                  {/if}

                  {#if monument.direction && monument.direction !== 'N/A'}
                    <div class="detail-row">
                      <span class="detail-label">Direction</span>
                      <span class="detail-value">{monument.direction}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Registered Parks and Gardens Section -->
    {#if registeredParksGardens.length > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => registeredParksGardensExpanded = !registeredParksGardensExpanded}
          on:keydown={(e) => e.key === 'Enter' && (registeredParksGardensExpanded = !registeredParksGardensExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={registeredParksGardensExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">Registered Parks &amp; Gardens ({totalRegisteredParksGardens})</h3>
            {#if onSiteParksGardens > 0}
              <span class="section-subtitle">{onSiteParksGardens} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{registeredParksGardensExpanded ? '▼' : '→'}</span>
        </div>

        {#if registeredParksGardensExpanded}
          <div class="results-grid">
            {#each registeredParksGardens as parkGarden}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{parkGarden.name || `Park/Garden ${parkGarden.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(parkGarden, 'registered_parks_gardens') as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>

                <div class="item-details">
                  {#if parkGarden.grade}
                    <div class="detail-row">
                      <span class="detail-label">Heritage Grade</span>
                      <span class="detail-value">Grade {parkGarden.grade}</span>
                    </div>
                  {/if}

                  <div class="detail-row">
                    <span class="detail-label">Distance</span>
                    <span class="detail-value distance {getDistanceClass(parkGarden.dist_m, parkGarden.on_site)}">
                      {formatDistance(parkGarden.dist_m, parkGarden.on_site)}
                    </span>
                  </div>

                  {#if parkGarden.direction && parkGarden.direction !== 'N/A'}
                    <div class="detail-row">
                      <span class="detail-label">Direction</span>
                      <span class="detail-value">{parkGarden.direction}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- World Heritage Sites Section -->
    {#if worldHeritageSites.length > 0}
      <div class="results-section">
        <div
          class="section-header clickable"
          on:click={() => worldHeritageSitesExpanded = !worldHeritageSitesExpanded}
          on:keydown={(e) => e.key === 'Enter' && (worldHeritageSitesExpanded = !worldHeritageSitesExpanded)}
          role="button"
          tabindex="0"
          aria-expanded={worldHeritageSitesExpanded}
        >
          <div class="section-header-content">
            <span class="section-icon"></span>
            <h3 class="section-title">UNESCO World Heritage Sites ({totalWorldHeritageSites})</h3>
            {#if onSiteWorldHeritageSites > 0}
              <span class="section-subtitle">{onSiteWorldHeritageSites} on site</span>
            {/if}
          </div>
          <span class="expand-icon">{worldHeritageSitesExpanded ? '▼' : '→'}</span>
        </div>

        {#if worldHeritageSitesExpanded}
          <div class="results-grid">
            {#each worldHeritageSites as site}
              <div class="result-item">
                <div class="item-header">
                  <h4 class="item-title">{site.name || `World Heritage Site ${site.id}`}</h4>
                  <div class="status-badges">
                    {#each getStatusBadges(site, 'world_heritage_sites') as badge}
                      <span class="badge {badge.class}">{badge.text}</span>
                    {/each}
                  </div>
                </div>

                <div class="item-details">
                  <div class="detail-row">
                    <span class="detail-label">Designation</span>
                    <span class="detail-value">UNESCO World Heritage Site</span>
                  </div>

                  <div class="detail-row">
                    <span class="detail-label">Distance</span>
                    <span class="detail-value distance {getDistanceClass(site.dist_m, site.on_site)}">
                      {formatDistance(site.dist_m, site.on_site)}
                    </span>
                  </div>

                  {#if site.direction && site.direction !== 'N/A'}
                    <div class="detail-row">
                      <span class="detail-label">Direction</span>
                      <span class="detail-value">{site.direction}</span>
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
    {#if listedBuildings.length === 0 && conservationAreas.length === 0 && scheduledMonuments.length === 0 && registeredParksGardens.length === 0 && worldHeritageSites.length === 0}
      <div class="results-empty">
        <p>No heritage assets found in the analyzed area.</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Try drawing a larger polygon or a different location.</p>
      </div>
    {/if}
  </div>
{/if}
