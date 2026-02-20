<script>
  import { createEventDispatcher } from 'svelte';
  import { updateProjectInformation } from '$lib/api/projects.js';

  export let project;

  const dispatch = createEventDispatcher();

  let editMode = false;
  let editedProject = null;
  let hasUnsavedChanges = false;
  let saving = false;
  let lastSaved = null;
  let error = null;
  let copied = false;

  function enableEditMode() {
    editMode = true;
    // Deep clone project data
    editedProject = {
      client_or_spv_name: project.client_or_spv_name || '',
      detailed_description: project.detailed_description || '',
      proposed_use_duration: project.proposed_use_duration || '',
      distribution_network: project.distribution_network || '',
      solar_export_capacity: project.solar_export_capacity || '',
      pv_max_panel_height: project.pv_max_panel_height || '',
      fence_height: project.fence_height || '',
      pv_clearance_from_ground: project.pv_clearance_from_ground || '',
      number_of_solar_panels: project.number_of_solar_panels || '',
      panel_tilt: project.panel_tilt || '',
      panel_tilt_direction: project.panel_tilt_direction || '',
      bess_export_capacity: project.bess_export_capacity || '',
      bess_containers: project.bess_containers || '',
      gwh_per_year: project.gwh_per_year || '',
      homes_powered: project.homes_powered || '',
      co2_offset: project.co2_offset || '',
      equivalent_cars: project.equivalent_cars || '',
      access_arrangements: project.access_arrangements || '',
      access_contact: project.access_contact || '',
      parking_details: project.parking_details || '',
      atv_use: project.atv_use || '',
      additional_notes: project.additional_notes || '',
      invoicing_details: project.invoicing_details || '',
      sharepoint_link: project.sharepoint_link || ''
    };
    hasUnsavedChanges = false;
  }

  function handleFieldChange() {
    hasUnsavedChanges = true;
  }

  function cancelEdit() {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    editMode = false;
    editedProject = null;
    hasUnsavedChanges = false;
    error = null;
  }

  async function handleSave() {
    saving = true;
    error = null;

    try {
      // Convert empty strings to null for numeric fields and constrained fields
      const sanitizedData = {
        ...editedProject,
        proposed_use_duration: editedProject.proposed_use_duration === '' ? null : editedProject.proposed_use_duration,
        solar_export_capacity: editedProject.solar_export_capacity === '' ? null : editedProject.solar_export_capacity,
        pv_max_panel_height: editedProject.pv_max_panel_height === '' ? null : editedProject.pv_max_panel_height,
        fence_height: editedProject.fence_height === '' ? null : editedProject.fence_height,
        pv_clearance_from_ground: editedProject.pv_clearance_from_ground === '' ? null : editedProject.pv_clearance_from_ground,
        number_of_solar_panels: editedProject.number_of_solar_panels === '' ? null : editedProject.number_of_solar_panels,
        panel_tilt: editedProject.panel_tilt === '' ? null : editedProject.panel_tilt,
        bess_export_capacity: editedProject.bess_export_capacity === '' ? null : editedProject.bess_export_capacity,
        bess_containers: editedProject.bess_containers === '' ? null : editedProject.bess_containers,
        gwh_per_year: editedProject.gwh_per_year === '' ? null : editedProject.gwh_per_year,
        homes_powered: editedProject.homes_powered === '' ? null : editedProject.homes_powered,
        co2_offset: editedProject.co2_offset === '' ? null : editedProject.co2_offset,
        equivalent_cars: editedProject.equivalent_cars === '' ? null : editedProject.equivalent_cars,
        atv_use: editedProject.atv_use === '' ? null : editedProject.atv_use
      };

      const updatedData = await updateProjectInformation(project.unique_id, sanitizedData);
      
      // Update parent component with saved data
      dispatch('updated', updatedData);
      
      hasUnsavedChanges = false;
      lastSaved = new Date();
      editMode = false;
      editedProject = null;
    } catch (err) {
      console.error('Error saving project information:', err);
      error = err.message;
    } finally {
      saving = false;
    }
  }

  function formatLastSaved() {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    
    if (diff < 60) return 'Saved just now';
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} minutes ago`;
    return `Saved ${Math.floor(diff / 3600)} hours ago`;
  }

  // Only allow numeric input (numbers, decimal point, backspace, delete, arrows)
  function handleNumericKeypress(event) {
    const charCode = event.which || event.keyCode;
    const char = String.fromCharCode(charCode);
    
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].includes(charCode)) {
      return;
    }
    
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((charCode === 65 || charCode === 67 || charCode === 86 || charCode === 88) && 
        (event.ctrlKey === true || event.metaKey === true)) {
      return;
    }
    
    // Allow: home, end, left, right, up, down
    if (charCode >= 35 && charCode <= 40) {
      return;
    }
    
    // Get the current input value
    const inputValue = event.target.value;
    
    // Allow decimal point only if there isn't one already
    if (char === '.' && !inputValue.includes('.')) {
      return;
    }
    
    // Allow minus sign only at the start
    if (char === '-' && inputValue.length === 0) {
      return;
    }
    
    // Only allow numbers
    if (char >= '0' && char <= '9') {
      return;
    }
    
    // Prevent any other character
    event.preventDefault();
  }

  // Expose method to check for unsaved changes
  export function hasUnsaved() {
    return editMode && hasUnsavedChanges;
  }

  // Helper to get field value (edit mode or display mode)
  function getValue(field) {
    return editMode ? editedProject[field] : (project[field] || '-');
  }

  async function copyToClipboard() {
    const isEnergy = project.sector === 'Energy, Data and Infrastructure';

    let text = `General Project Information

Basic Information
Project Code: ${project.project_id || '-'}
Project Name: ${project.project_name || '-'}
Client/SPV Name: ${project.client_or_spv_name || '-'}
Address: ${project.address || '-'}
Area: ${project.area ? `${project.area} ha` : '-'}
Proposed Use Duration: ${project.proposed_use_duration ? `${project.proposed_use_duration} years` : '-'}

Description
Sector: ${project.sector || '-'}
Sub-sector: ${project.sub_sector || '-'}
Detailed Description: ${project.detailed_description || '-'}`;

    if (isEnergy) {
      text += `

Solar/PV Details
Export Capacity: ${project.solar_export_capacity ? `${project.solar_export_capacity} MW` : '-'}
Number of Panels: ${project.number_of_solar_panels?.toLocaleString() || '-'}
Max Panel Height: ${project.pv_max_panel_height ? `${project.pv_max_panel_height} m` : '-'}
Clearance from Ground: ${project.pv_clearance_from_ground ? `${project.pv_clearance_from_ground} m` : '-'}
Panel Tilt: ${project.panel_tilt ? `${project.panel_tilt}°` : '-'}
Panel Tilt Direction: ${project.panel_tilt_direction || '-'}
Fence Height: ${project.fence_height ? `${project.fence_height} m` : '-'}

Battery Storage (BESS)
Export Capacity: ${project.bess_export_capacity ? `${project.bess_export_capacity} MW` : '-'}
Containers: ${project.bess_containers || '-'}

Environmental Impact
GWh per Year: ${project.gwh_per_year || '-'}
Homes Powered: ${project.homes_powered?.toLocaleString() || '-'}
CO2 Offset: ${project.co2_offset ? `${project.co2_offset} tonnes` : '-'}
Equivalent Cars Off Road: ${project.equivalent_cars?.toLocaleString() || '-'}`;
    }

    text += `

Site Access
Access Arrangements: ${project.access_arrangements || '-'}
Access Contact: ${project.access_contact || '-'}
Parking Details: ${project.parking_details || '-'}
ATV Use: ${project.atv_use ? (project.atv_use === 'yes' ? 'Yes' : 'No') : '-'}

Additional Information
Additional Notes: ${project.additional_notes || '-'}
Invoicing Details: ${project.invoicing_details || '-'}
SharePoint Link: ${project.sharepoint_link || '-'}`;

    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
</script>

<div class="panel-header">
  <h2>General Project Information</h2>
  <div class="header-actions">
    {#if !editMode}
      <button class="btn btn-secondary" on:click={copyToClipboard}>
        <i class="las la-{copied ? 'check' : 'copy'}"></i>
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button class="btn btn-primary" on:click={enableEditMode}>
        <i class="las la-edit"></i>
        Edit
      </button>
    {:else}
      <div class="save-status">
        {#if hasUnsavedChanges}
          <span class="unsaved-badge">Unsaved changes</span>
        {:else if lastSaved}
          <span class="saved-text">{formatLastSaved()}</span>
        {/if}
      </div>
      <button class="btn btn-secondary" on:click={cancelEdit} disabled={saving}>
        Cancel
      </button>
      <button 
        class="btn btn-primary" 
        on:click={handleSave}
        disabled={saving || !hasUnsavedChanges}
      >
        {#if saving}
          <i class="las la-circle-notch la-spin"></i>
        {:else}
          <i class="las la-save"></i>
        {/if}
        Save
      </button>
    {/if}
  </div>
</div>

{#if error}
  <div class="error-banner">
    <i class="las la-exclamation-triangle"></i>
    <span>{error}</span>
    <button class="close-error" on:click={() => error = null}>
      <i class="las la-times"></i>
    </button>
  </div>
{/if}

<div class="info-grid">
  <!-- Basic Information -->
  <div class="info-card">
    <h3>Basic Information</h3>
    <div class="info-rows">
      <div class="info-row">
        <span class="label">Project Code:</span>
        <span class="value project-code">{project.project_id || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Project Name:</span>
        <span class="value">{project.project_name || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Client/SPV Name:</span>
        {#if editMode}
          <input
            type="text"
            class="value-input"
            bind:value={editedProject.client_or_spv_name}
            on:input={handleFieldChange}
            placeholder="Enter client/SPV name"
          />
        {:else}
          <span class="value">{project.client_or_spv_name || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Address:</span>
        <span class="value">{project.address || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Area:</span>
        <span class="value">{project.area ? `${project.area} ha` : '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Proposed Use Duration:</span>
        {#if editMode}
          <input
            type="number"
            class="value-input"
            bind:value={editedProject.proposed_use_duration}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="Years"
          />
        {:else}
          <span class="value">{project.proposed_use_duration ? `${project.proposed_use_duration} years` : '-'}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Description -->
  <div class="info-card">
    <h3>Description</h3>
    <div class="info-rows">
      <div class="info-row">
        <span class="label">Sector:</span>
        <span class="value">{project.sector || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Sub-sector:</span>
        <span class="value">{project.sub_sector || '-'}</span>
      </div>
      <div class="info-row" class:editing={editMode}>
        <span class="label">Detailed Description:</span>
        {#if editMode}
          <textarea
            class="value-textarea"
            bind:value={editedProject.detailed_description}
            on:input={handleFieldChange}
            placeholder="Enter detailed description"
            rows="4"
          />
        {:else}
          <span class="value">{project.detailed_description || '-'}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Designations - hidden for now
  <div class="info-card">
    <h3>Designations</h3>
    <div class="info-rows">
      <div class="info-row full-width">
        <span class="label">Designations on Site:</span>
        <span class="value">{project.designations_on_site || '-'}</span>
      </div>
      <div class="info-row full-width">
        <span class="label">Relevant Nearby Designations:</span>
        <span class="value">{project.relevant_nearby_designations || '-'}</span>
      </div>
    </div>
  </div>
  -->

  {#if project.sector === 'Energy, Data and Infrastructure'}
  <!-- Solar/PV Details -->
  <div class="info-card">
    <h3>Solar/PV Details</h3>
    <div class="info-rows">
      <div class="info-row">
        <span class="label">Export Capacity:</span>
        {#if editMode}
          <input
            type="number"
            step="0.01"
            class="value-input"
            bind:value={editedProject.solar_export_capacity}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="MW"
          />
        {:else}
          <span class="value">{project.solar_export_capacity ? `${project.solar_export_capacity} MW` : '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Number of Panels:</span>
        {#if editMode}
          <input
            type="number"
            class="value-input"
            bind:value={editedProject.number_of_solar_panels}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="Number of panels"
          />
        {:else}
          <span class="value">{project.number_of_solar_panels?.toLocaleString() || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Max Panel Height:</span>
        {#if editMode}
          <input
            type="number"
            step="0.1"
            class="value-input"
            bind:value={editedProject.pv_max_panel_height}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="meters"
          />
        {:else}
          <span class="value">{project.pv_max_panel_height ? `${project.pv_max_panel_height} m` : '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Clearance from Ground:</span>
        {#if editMode}
          <input
            type="number"
            step="0.1"
            class="value-input"
            bind:value={editedProject.pv_clearance_from_ground}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="meters"
          />
        {:else}
          <span class="value">{project.pv_clearance_from_ground ? `${project.pv_clearance_from_ground} m` : '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Panel Tilt:</span>
        {#if editMode}
          <input
            type="number"
            step="1"
            class="value-input"
            bind:value={editedProject.panel_tilt}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="degrees"
          />
        {:else}
          <span class="value">{project.panel_tilt ? `${project.panel_tilt}°` : '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Panel Tilt Direction:</span>
        {#if editMode}
          <input
            type="text"
            class="value-input"
            bind:value={editedProject.panel_tilt_direction}
            on:input={handleFieldChange}
            placeholder="e.g. South, North"
          />
        {:else}
          <span class="value">{project.panel_tilt_direction || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Fence Height:</span>
        {#if editMode}
          <input
            type="number"
            step="0.1"
            class="value-input"
            bind:value={editedProject.fence_height}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="meters"
          />
        {:else}
          <span class="value">{project.fence_height ? `${project.fence_height} m` : '-'}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- BESS Details -->
  <div class="info-card">
    <h3>Battery Storage (BESS)</h3>
    <div class="info-rows">
      <div class="info-row">
        <span class="label">Export Capacity:</span>
        {#if editMode}
          <input
            type="number"
            step="0.01"
            class="value-input"
            bind:value={editedProject.bess_export_capacity}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="MW"
          />
        {:else}
          <span class="value">{project.bess_export_capacity ? `${project.bess_export_capacity} MW` : '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Containers:</span>
        {#if editMode}
          <input
            type="number"
            class="value-input"
            bind:value={editedProject.bess_containers}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="Number of containers"
          />
        {:else}
          <span class="value">{project.bess_containers || '-'}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Environmental Impact -->
  <div class="info-card">
    <h3>Environmental Impact</h3>
    <div class="info-rows">
      <div class="info-row">
        <span class="label">GWh per Year:</span>
        {#if editMode}
          <input
            type="number"
            step="0.01"
            class="value-input"
            bind:value={editedProject.gwh_per_year}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="GWh"
          />
        {:else}
          <span class="value">{project.gwh_per_year || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Homes Powered:</span>
        {#if editMode}
          <input
            type="number"
            class="value-input"
            bind:value={editedProject.homes_powered}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="Number of homes"
          />
        {:else}
          <span class="value">{project.homes_powered?.toLocaleString() || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">CO₂ Offset:</span>
        {#if editMode}
          <input
            type="number"
            step="0.01"
            class="value-input"
            bind:value={editedProject.co2_offset}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="tonnes"
          />
        {:else}
          <span class="value">{project.co2_offset ? `${project.co2_offset} tonnes` : '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Equivalent Cars Off Road:</span>
        {#if editMode}
          <input
            type="number"
            class="value-input"
            bind:value={editedProject.equivalent_cars}
            on:input={handleFieldChange}
            on:keypress={handleNumericKeypress}
            placeholder="Number of cars"
          />
        {:else}
          <span class="value">{project.equivalent_cars?.toLocaleString() || '-'}</span>
        {/if}
      </div>
    </div>
  </div>
  {/if}

  <!-- Site Access -->
  <div class="info-card">
    <h3>Site Access</h3>
    <div class="info-rows">
      <div class="info-row" class:editing={editMode}>
        <span class="label">Access Arrangements:</span>
        {#if editMode}
          <textarea
            class="value-textarea"
            bind:value={editedProject.access_arrangements}
            on:input={handleFieldChange}
            placeholder="Enter access arrangements"
            rows="3"
          />
        {:else}
          <span class="value">{project.access_arrangements || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">Access Contact:</span>
        {#if editMode}
          <input
            type="text"
            class="value-input"
            bind:value={editedProject.access_contact}
            on:input={handleFieldChange}
            placeholder="Contact name/number"
          />
        {:else}
          <span class="value">{project.access_contact || '-'}</span>
        {/if}
      </div>
      <div class="info-row" class:editing={editMode}>
        <span class="label">Parking Details:</span>
        {#if editMode}
          <textarea
            class="value-textarea"
            bind:value={editedProject.parking_details}
            on:input={handleFieldChange}
            placeholder="Enter parking details"
            rows="2"
          />
        {:else}
          <span class="value">{project.parking_details || '-'}</span>
        {/if}
      </div>
      <div class="info-row">
        <span class="label">ATV Use:</span>
        {#if editMode}
          <select
            class="value-input"
            bind:value={editedProject.atv_use}
            on:change={handleFieldChange}
          >
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        {:else}
          <span class="value">{project.atv_use ? (project.atv_use === 'yes' ? 'Yes' : 'No') : '-'}</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Additional Information -->
  <div class="info-card">
    <h3>Additional Information</h3>
    <div class="info-rows">
      <div class="info-row" class:editing={editMode}>
        <span class="label">Additional Notes:</span>
        {#if editMode}
          <textarea
            class="value-textarea"
            bind:value={editedProject.additional_notes}
            on:input={handleFieldChange}
            placeholder="Enter additional notes"
            rows="3"
          />
        {:else}
          <span class="value">{project.additional_notes || '-'}</span>
        {/if}
      </div>
      <div class="info-row" class:editing={editMode}>
        <span class="label">Invoicing Details:</span>
        {#if editMode}
          <textarea
            class="value-textarea"
            bind:value={editedProject.invoicing_details}
            on:input={handleFieldChange}
            placeholder="Enter invoicing details"
            rows="2"
          />
        {:else}
          <span class="value">{project.invoicing_details || '-'}</span>
        {/if}
      </div>
      <div class="info-row full-width">
        <span class="label">SharePoint Link:</span>
        {#if editMode}
          <input
            type="url"
            class="value-input"
            bind:value={editedProject.sharepoint_link}
            on:input={handleFieldChange}
            placeholder="https://"
          />
        {:else}
          <span class="value">
            {#if project.sharepoint_link}
              <a href={project.sharepoint_link} target="_blank" rel="noopener noreferrer">
                {project.sharepoint_link}
              </a>
            {:else}
              -
            {/if}
          </span>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .save-status {
    font-size: 0.875rem;
  }

  .unsaved-badge {
    background: #fef3c7;
    color: #92400e;
    padding: 0.25rem 0.625rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .saved-text {
    color: #64748b;
  }

  .btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #991b1b;
    margin: 1.5rem;
    border-radius: 6px;
  }

  .error-banner i {
    font-size: 1.25rem;
  }

  .close-error {
    margin-left: auto;
    background: none;
    border: none;
    color: #991b1b;
    cursor: pointer;
    padding: 0.25rem;
    font-size: 1.25rem;
  }

  .close-error:hover {
    opacity: 0.7;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .info-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
  }

  .info-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 0.5rem;
  }

  .info-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .info-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 1rem;
    align-items: flex-start;
  }

  .info-row .label {
    font-weight: 600;
    color: #64748b;
    min-width: 180px;
    flex-shrink: 0;
    padding-top: 0.25rem;
  }

  .info-row .value {
    color: #1e293b;
    flex: 1;
    min-width: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }

  .info-row.full-width {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .info-row.full-width .label {
    min-width: auto;
    padding-top: 0;
  }

  /* Stack label and textarea when editing */
  .info-row.editing:has(.value-textarea) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .info-row.editing:has(.value-textarea) .label {
    min-width: auto;
    padding-top: 0;
  }

  .value-input,
  .value-textarea {
    flex: 1;
    width: 100%;
    min-width: 0;
    padding: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #1e293b;
    background: white;
    font-family: inherit;
    box-sizing: border-box;
  }

  .value-input:focus,
  .value-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .value-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .info-row .value a {
    color: #3b82f6;
    text-decoration: none;
    word-break: break-all;
  }

  .info-row .value a:hover {
    text-decoration: underline;
  }

  .project-code {
    font-family: 'Courier New', monospace;
    color: #9333ea;
    font-weight: 600;
  }

  .la-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
