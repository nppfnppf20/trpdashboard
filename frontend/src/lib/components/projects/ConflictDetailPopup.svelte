<script>
  export let conflict = null;
  export let onClose = () => {};

  function handleBackdropClick() {
    onClose();
  }

  function handlePopupClick(event) {
    event.stopPropagation();
  }
</script>

{#if conflict}
  <div class="detail-popup-backdrop" on:click={handleBackdropClick}>
    <div class="detail-popup" on:click={handlePopupClick}>
      <div class="detail-popup-header">
        <h3>{conflict.layerGroup} - {conflict.layerName}</h3>
        <button class="detail-close-btn" on:click={onClose}>
          <i class="las la-times"></i>
        </button>
      </div>
      
      <div class="detail-popup-body">
        <div class="detail-distance-badge">
          <i class="las la-map-marker-alt"></i>
          {conflict.distance}m from site
        </div>

        {#if conflict.layer === 'renewables' || conflict.layer === 'datacentres'}
          <div class="detail-section">
            <h4>Project Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Name:</span>
                <span class="detail-value">{conflict.name || 'N/A'}</span>
              </div>
              {#if conflict.description}
                <div class="detail-item">
                  <span class="detail-label">Description:</span>
                  <span class="detail-value">{conflict.description}</span>
                </div>
              {/if}
              {#if conflict.address}
                <div class="detail-item">
                  <span class="detail-label">Address:</span>
                  <span class="detail-value">{conflict.address}</span>
                </div>
              {/if}
              {#if conflict.postcode}
                <div class="detail-item">
                  <span class="detail-label">Postcode:</span>
                  <span class="detail-value">{conflict.postcode}</span>
                </div>
              {/if}
              {#if conflict.area_name}
                <div class="detail-item">
                  <span class="detail-label">Area:</span>
                  <span class="detail-value">{conflict.area_name}</span>
                </div>
              {/if}
            </div>
          </div>

          <div class="detail-section">
            <h4>Application Details</h4>
            <div class="detail-grid">
              {#if conflict.app_type}
                <div class="detail-item">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value">{conflict.app_type}</span>
                </div>
              {/if}
              {#if conflict.application_type}
                <div class="detail-item">
                  <span class="detail-label">Application Type:</span>
                  <span class="detail-value">{conflict.application_type}</span>
                </div>
              {/if}
              {#if conflict.app_state}
                <div class="detail-item">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value">{conflict.app_state}</span>
                </div>
              {/if}
              {#if conflict.decision}
                <div class="detail-item">
                  <span class="detail-label">Decision:</span>
                  <span class="detail-value">{conflict.decision}</span>
                </div>
              {/if}
              {#if conflict.start_date}
                <div class="detail-item">
                  <span class="detail-label">Start Date:</span>
                  <span class="detail-value">{conflict.start_date}</span>
                </div>
              {/if}
              {#if conflict.decided_date}
                <div class="detail-item">
                  <span class="detail-label">Decided Date:</span>
                  <span class="detail-value">{conflict.decided_date}</span>
                </div>
              {/if}
            </div>
          </div>

          {#if conflict.url}
            <div class="detail-section">
              <a href={conflict.url} target="_blank" rel="noopener noreferrer" class="detail-link">
                <i class="las la-external-link-alt"></i>
                View Full Details
              </a>
            </div>
          {/if}

        {:else if conflict.layer.startsWith('repd_')}
          <div class="detail-section">
            <h4>Site Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Site Name:</span>
                <span class="detail-value">{conflict.site_name || 'N/A'}</span>
              </div>
              {#if conflict.ref_id}
                <div class="detail-item">
                  <span class="detail-label">Reference ID:</span>
                  <span class="detail-value">{conflict.ref_id}</span>
                </div>
              {/if}
              {#if conflict.operator}
                <div class="detail-item">
                  <span class="detail-label">Operator:</span>
                  <span class="detail-value">{conflict.operator}</span>
                </div>
              {/if}
              {#if conflict.technology_type}
                <div class="detail-item">
                  <span class="detail-label">Technology:</span>
                  <span class="detail-value">{conflict.technology_type}</span>
                </div>
              {/if}
              {#if conflict.capacity}
                <div class="detail-item">
                  <span class="detail-label">Capacity:</span>
                  <span class="detail-value">{conflict.capacity} MWelec</span>
                </div>
              {/if}
            </div>
          </div>

          <div class="detail-section">
            <h4>Development Status</h4>
            <div class="detail-grid">
              {#if conflict.dev_status}
                <div class="detail-item">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value">{conflict.dev_status}</span>
                </div>
              {/if}
              {#if conflict.dev_status_short}
                <div class="detail-item">
                  <span class="detail-label">Status (Short):</span>
                  <span class="detail-value">{conflict.dev_status_short}</span>
                </div>
              {/if}
            </div>
          </div>

          <div class="detail-section">
            <h4>Location</h4>
            <div class="detail-grid">
              {#if conflict.address}
                <div class="detail-item">
                  <span class="detail-label">Address:</span>
                  <span class="detail-value">{conflict.address}</span>
                </div>
              {/if}
              {#if conflict.county}
                <div class="detail-item">
                  <span class="detail-label">County:</span>
                  <span class="detail-value">{conflict.county}</span>
                </div>
              {/if}
              {#if conflict.postcode}
                <div class="detail-item">
                  <span class="detail-label">Postcode:</span>
                  <span class="detail-value">{conflict.postcode}</span>
                </div>
              {/if}
            </div>
          </div>

          {#if conflict.planning_ref || conflict.last_updated}
            <div class="detail-section">
              <h4>Additional Information</h4>
              <div class="detail-grid">
                {#if conflict.planning_ref}
                  <div class="detail-item">
                    <span class="detail-label">Planning Ref:</span>
                    <span class="detail-value">{conflict.planning_ref}</span>
                  </div>
                {/if}
                {#if conflict.last_updated}
                  <div class="detail-item">
                    <span class="detail-label">Last Updated:</span>
                    <span class="detail-value">{conflict.last_updated}</span>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

        {:else if conflict.layer.startsWith('trp_')}
          <div class="detail-section">
            <h4>Project Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Name:</span>
                <span class="detail-value">{conflict.name || 'N/A'}</span>
              </div>
              {#if conflict.description}
                <div class="detail-item full-width">
                  <span class="detail-label">Description:</span>
                  <span class="detail-value">{conflict.description}</span>
                </div>
              {/if}
            </div>
          </div>

        {:else if conflict.layer === 'projects'}
          <div class="detail-section">
            <h4>Project Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Project Name:</span>
                <span class="detail-value">{conflict.project_name || 'N/A'}</span>
              </div>
              {#if conflict.project_id}
                <div class="detail-item">
                  <span class="detail-label">Project ID:</span>
                  <span class="detail-value">{conflict.project_id}</span>
                </div>
              {/if}
              {#if conflict.client}
                <div class="detail-item">
                  <span class="detail-label">Client:</span>
                  <span class="detail-value">{conflict.client}</span>
                </div>
              {/if}
              {#if conflict.sector}
                <div class="detail-item">
                  <span class="detail-label">Sector:</span>
                  <span class="detail-value">{conflict.sector}</span>
                </div>
              {/if}
              {#if conflict.project_type}
                <div class="detail-item">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value">{conflict.project_type}</span>
                </div>
              {/if}
              {#if conflict.address}
                <div class="detail-item">
                  <span class="detail-label">Address:</span>
                  <span class="detail-value">{conflict.address}</span>
                </div>
              {/if}
              {#if conflict.area}
                <div class="detail-item">
                  <span class="detail-label">Area:</span>
                  <span class="detail-value">{conflict.area}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer with close button -->
      <div class="detail-popup-footer">
        <button class="btn-close-popup" on:click={onClose}>Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Detail Popup Styles */
  .detail-popup-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1rem;
  }

  .detail-popup {
    background: white;
    border-radius: 0.75rem;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .detail-popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .detail-popup-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .detail-close-btn {
    background: none;
    border: none;
    font-size: 1.75rem;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .detail-close-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .detail-popup-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .detail-distance-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }

  .detail-distance-badge i {
    font-size: 1.125rem;
  }

  .detail-section {
    margin-bottom: 1.5rem;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .detail-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-item.full-width {
    grid-column: 1 / -1;
  }

  .detail-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 0.9375rem;
    color: #1e293b;
    word-break: break-word;
  }

  .detail-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    padding: 0.75rem 1.25rem;
    border: 2px solid #3b82f6;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .detail-link:hover {
    background: #3b82f6;
    color: white;
  }

  .detail-link i {
    font-size: 1.125rem;
  }

  .detail-popup-footer {
    display: flex;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    justify-content: flex-end;
    align-items: center;
  }

  .btn-close-popup {
    background: #f1f5f9;
    color: #475569;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-close-popup:hover {
    background: #e2e8f0;
  }
</style>

