<script>
  import { authFetch } from '$lib/api/client.js';
  import { getLookupOptions } from '$lib/api/lookups.js';
  import SearchableDropdown from '$lib/components/shared/SearchableDropdown.svelte';
  import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';

  export let project;
  export let onOpenMeetingGuide = () => {};
  export let onUpdated = () => {};

  const statusOptions = ['Prospective', 'Instructed', 'Submitted', 'Post-Submission', 'Closed'];
  const projectTypeOptions = ['Full Application', 'DoC', 'NMA', 'S73', 'Appeal', 'Other'];

  let editMode = false;
  let draft = null;
  let hasUnsavedChanges = false;
  let saving = false;
  let error = null;
  let lpaInput = '';

  // Lookup options for the dropdowns below — same lookup types/shape
  // EditProjectModal.svelte already uses, loaded lazily the first time
  // edit mode is entered rather than on every page view.
  let lookupsLoaded = false;
  let clientOptions = [];
  let clientOptionsLoading = false;
  let teamMemberOptions = [];
  let teamMemberOptionsLoading = false;
  let sectorOptions = [];
  let sectorOptionsLoading = false;
  let subSectorOptions = [];
  let subSectorOptionsLoading = false;
  let developmentTypeOptions = [];
  let developmentTypeOptionsLoading = false;

  async function loadLookups() {
    if (lookupsLoaded) return;
    lookupsLoaded = true;
    clientOptionsLoading = true;
    teamMemberOptionsLoading = true;
    sectorOptionsLoading = true;
    subSectorOptionsLoading = true;
    developmentTypeOptionsLoading = true;
    try {
      const [clients, team, sectors, subSectors, devTypes] = await Promise.all([
        getLookupOptions('client_organisations'),
        getLookupOptions('team_members'),
        getLookupOptions('sectors'),
        getLookupOptions('sub_sectors'),
        getLookupOptions('development_types'),
      ]);
      clientOptions = clients;
      teamMemberOptions = team;
      sectorOptions = sectors;
      subSectorOptions = subSectors;
      developmentTypeOptions = devTypes;
    } catch (err) {
      error = err.message;
    } finally {
      clientOptionsLoading = false;
      teamMemberOptionsLoading = false;
      sectorOptionsLoading = false;
      subSectorOptionsLoading = false;
      developmentTypeOptionsLoading = false;
    }
  }

  function formatDateForInput(dateString) {
    if (!dateString) return '';
    return String(dateString).slice(0, 10);
  }

  function enableEditMode() {
    // Same field shape EditProjectModal.svelte's formData uses, so the
    // save below hits the same PUT /api/projects/:id contract.
    draft = {
      project_id: project.project_id || '',
      project_name: project.project_name || '',
      project_type: project.project_type || '',
      local_planning_authority: [...(project.local_planning_authority || [])],
      project_lead: project.project_lead || '',
      project_manager: project.project_manager || '',
      project_director: project.project_director || '',
      address: project.address || '',
      polygon_geojson: project.polygon_geojson || null,
      area: project.area || '',
      client: project.client || '',
      client_spv_name: project.client_spv_name || '',
      sectors: [...(project.sectors || [])],
      sub_sectors: [...(project.sub_sectors || [])],
      development_types: [...(project.development_types || [])],
      designations_on_site: project.designations_on_site || '',
      relevant_nearby_designations: project.relevant_nearby_designations || '',
      development_description: project.development_description || '',
      about_applicant: project.about_applicant || '',
      status: project.status || '',
      case_officer_name: project.case_officer_name || '',
      case_officer_email: project.case_officer_email || '',
      case_officer_phone_number: project.case_officer_phone_number || '',
      lpa_reference: project.lpa_reference || '',
      submission_date: formatDateForInput(project.submission_date),
      validation_date: formatDateForInput(project.validation_date),
      lpa_consultation_end_date: formatDateForInput(project.lpa_consultation_end_date),
      committee_date: formatDateForInput(project.committee_date),
      target_determination_date: formatDateForInput(project.target_determination_date),
      determined_date: formatDateForInput(project.determined_date),
      expiry_of_1st_stat_period_date: formatDateForInput(project.expiry_of_1st_stat_period_date),
      eot_date: formatDateForInput(project.eot_date),
      six_months_appeal_window_date: formatDateForInput(project.six_months_appeal_window_date),
      comments: project.comments || '',
    };
    editMode = true;
    hasUnsavedChanges = false;
    error = null;
    lpaInput = '';
    loadLookups();
  }

  // Catches edits from every field in one place, including the
  // dropdown/multiselect components — native input/change events bubble
  // up through the DOM regardless of which control fired them.
  function markDirty() {
    hasUnsavedChanges = true;
  }

  function cancelEdit() {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to cancel?')) return;
    editMode = false;
    draft = null;
    hasUnsavedChanges = false;
    error = null;
  }

  function addLPA() {
    if (lpaInput.trim()) {
      draft.local_planning_authority = [...draft.local_planning_authority, lpaInput.trim()];
      lpaInput = '';
      markDirty();
    }
  }

  function removeLPA(index) {
    draft.local_planning_authority = draft.local_planning_authority.filter((_, i) => i !== index);
    markDirty();
  }

  function handleLPAKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addLPA(); }
  }

  async function handleSave() {
    if (!draft.project_id.trim() || !draft.project_name.trim()) {
      error = 'Project ID and Project Name are required.';
      return;
    }
    saving = true;
    error = null;
    try {
      const response = await authFetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onUpdated(data.project);
        editMode = false;
        draft = null;
        hasUnsavedChanges = false;
      } else {
        error = data.error || 'Failed to update project';
      }
    } catch (err) {
      error = err.message || 'Network error. Please try again.';
    } finally {
      saving = false;
    }
  }

  function formatLPA(lpaArray) {
    if (!lpaArray || !Array.isArray(lpaArray) || lpaArray.length === 0) return '-';
    return lpaArray.join(', ');
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="pd-page" on:input={markDirty} on:change={markDirty}>
  <div class="pd-head">
    {#if !editMode}
      <button class="btn btn-primary btn-sm" on:click={enableEditMode}>
        <i class="las la-edit"></i> Edit
      </button>
      <button class="details-guide-btn" on:click={onOpenMeetingGuide}>
        <i class="las la-clipboard-list"></i> Meeting Guide
      </button>
    {:else}
      {#if hasUnsavedChanges}<span class="badge badge-warning">Unsaved changes</span>{/if}
      <button class="btn btn-secondary btn-sm" on:click={cancelEdit} disabled={saving}>Cancel</button>
      <button class="btn btn-primary btn-sm" on:click={handleSave} disabled={saving}>
        {#if saving}<i class="las la-circle-notch la-spin"></i>{:else}<i class="las la-save"></i>{/if} Save
      </button>
    {/if}
  </div>

  {#if error}<div class="pd-error"><i class="las la-exclamation-triangle"></i> {error}</div>{/if}

  <h3 class="detail-section-header">Project Overview</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label class="form-label">Project ID</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.project_id} placeholder="e.g. 1240" />
      {:else}
        <div class="detail-value">{project.project_id || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Project Name</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.project_name} placeholder="e.g. Tollington Solar" />
      {:else}
        <div class="detail-value">{project.project_name || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Status</label>
      {#if editMode}
        <select class="form-input" bind:value={draft.status}>
          <option value="">Select status...</option>
          {#each statusOptions as option}<option value={option}>{option}</option>{/each}
        </select>
      {:else}
        <div class="detail-value">{project.status || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Project Type</label>
      {#if editMode}
        <select class="form-input" bind:value={draft.project_type}>
          <option value="">Not set</option>
          {#each projectTypeOptions as option}<option value={option}>{option}</option>{/each}
        </select>
      {:else}
        <div class="detail-value">{project.project_type || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Sector</label>
      {#if editMode}
        <MultiSelectDropdown options={sectorOptions} bind:selected={draft.sectors} placeholder="Select sector(s)..." loading={sectorOptionsLoading} />
      {:else}
        <div class="detail-value">{(project.sectors || []).join(', ') || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Sub-sector</label>
      {#if editMode}
        <MultiSelectDropdown options={subSectorOptions} bind:selected={draft.sub_sectors} placeholder="Select sub-sector(s)..." loading={subSectorOptionsLoading} />
      {:else}
        <div class="detail-value">{(project.sub_sectors || []).join(', ') || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Development Type</label>
      {#if editMode}
        <MultiSelectDropdown options={developmentTypeOptions} bind:selected={draft.development_types} placeholder="Select development type(s)..." loading={developmentTypeOptionsLoading} />
      {:else}
        <div class="detail-value">{(project.development_types || []).join(', ') || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Address</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.address} />
      {:else}
        <div class="detail-value">{project.address || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Area</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.area} placeholder="e.g. 2.34 ha" />
      {:else}
        <div class="detail-value">{project.area || '-'}</div>
      {/if}
    </div>
    <div class="detail-group detail-group--full">
      <label class="form-label">Description of Development</label>
      {#if editMode}
        <textarea class="form-input" bind:value={draft.development_description} rows="3"></textarea>
      {:else}
        <div class="detail-value">{project.development_description || '-'}</div>
      {/if}
    </div>
  </div>

  <h3 class="detail-section-header">Team</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label class="form-label">Client</label>
      {#if editMode}
        <SearchableDropdown options={clientOptions} bind:value={draft.client} valueField="label" placeholder="Select a client..." loading={clientOptionsLoading} />
      {:else}
        <div class="detail-value">{project.client || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Client SPV Name</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.client_spv_name} />
      {:else}
        <div class="detail-value">{project.client_spv_name || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Project Lead</label>
      {#if editMode}
        <SearchableDropdown options={teamMemberOptions} bind:value={draft.project_lead} valueField="label" placeholder="Select project lead..." loading={teamMemberOptionsLoading} />
      {:else}
        <div class="detail-value">{project.project_lead || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Project Manager</label>
      {#if editMode}
        <SearchableDropdown options={teamMemberOptions} bind:value={draft.project_manager} valueField="label" placeholder="Select project manager..." loading={teamMemberOptionsLoading} />
      {:else}
        <div class="detail-value">{project.project_manager || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Project Director</label>
      {#if editMode}
        <SearchableDropdown options={teamMemberOptions} bind:value={draft.project_director} valueField="label" placeholder="Select project director..." loading={teamMemberOptionsLoading} />
      {:else}
        <div class="detail-value">{project.project_director || '-'}</div>
      {/if}
    </div>
  </div>

  <h3 class="detail-section-header">Planning</h3>
  <div class="detail-grid">
    <div class="detail-group detail-group--full">
      <label class="form-label">Local Planning Authority</label>
      {#if editMode}
        <div class="lpa-editor">
          {#if draft.local_planning_authority.length}
            <div class="lpa-tags">
              {#each draft.local_planning_authority as lpa, i}
                <span class="lpa-tag">
                  {lpa}
                  <button type="button" class="lpa-tag-remove" on:click={() => removeLPA(i)} aria-label="Remove {lpa}">&times;</button>
                </span>
              {/each}
            </div>
          {/if}
          <div class="lpa-add-row">
            <input class="form-input" type="text" bind:value={lpaInput} on:keydown={handleLPAKeydown} placeholder="Add an LPA and press Enter" />
            <button type="button" class="btn btn-secondary btn-sm" on:click={addLPA}>Add</button>
          </div>
        </div>
      {:else}
        <div class="detail-value">{formatLPA(project.local_planning_authority)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">LPA Reference</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.lpa_reference} />
      {:else}
        <div class="detail-value">{project.lpa_reference || '-'}</div>
      {/if}
    </div>
    <div class="detail-group detail-group--full">
      <label class="form-label">Designations on Site</label>
      {#if editMode}
        <textarea class="form-input" bind:value={draft.designations_on_site} rows="2"></textarea>
      {:else}
        <div class="detail-value">{project.designations_on_site || '-'}</div>
      {/if}
    </div>
    <div class="detail-group detail-group--full">
      <label class="form-label">Relevant Nearby Designations</label>
      {#if editMode}
        <textarea class="form-input" bind:value={draft.relevant_nearby_designations} rows="2"></textarea>
      {:else}
        <div class="detail-value">{project.relevant_nearby_designations || '-'}</div>
      {/if}
    </div>
  </div>

  <h3 class="detail-section-header">Case Officer</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label class="form-label">Name</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.case_officer_name} />
      {:else}
        <div class="detail-value">{project.case_officer_name || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Email</label>
      {#if editMode}
        <input class="form-input" type="email" bind:value={draft.case_officer_email} />
      {:else}
        <div class="detail-value">{project.case_officer_email || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Phone</label>
      {#if editMode}
        <input class="form-input" type="text" bind:value={draft.case_officer_phone_number} />
      {:else}
        <div class="detail-value">{project.case_officer_phone_number || '-'}</div>
      {/if}
    </div>
  </div>

  <h3 class="detail-section-header">Key Dates</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label class="form-label">Submission Date</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.submission_date} />
      {:else}
        <div class="detail-value">{formatDate(project.submission_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Validation Date</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.validation_date} />
      {:else}
        <div class="detail-value">{formatDate(project.validation_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">LPA Consultation End</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.lpa_consultation_end_date} />
      {:else}
        <div class="detail-value">{formatDate(project.lpa_consultation_end_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Committee Date</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.committee_date} />
      {:else}
        <div class="detail-value">{formatDate(project.committee_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Target Determination Date</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.target_determination_date} />
      {:else}
        <div class="detail-value">{formatDate(project.target_determination_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Determined Date</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.determined_date} />
      {:else}
        <div class="detail-value">{formatDate(project.determined_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">1st Stat Period Expiry</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.expiry_of_1st_stat_period_date} />
      {:else}
        <div class="detail-value">{formatDate(project.expiry_of_1st_stat_period_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">EOT Date</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.eot_date} />
      {:else}
        <div class="detail-value">{formatDate(project.eot_date)}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">6-Month Appeal Window</label>
      {#if editMode}
        <input class="form-input" type="date" bind:value={draft.six_months_appeal_window_date} />
      {:else}
        <div class="detail-value">{formatDate(project.six_months_appeal_window_date)}</div>
      {/if}
    </div>
  </div>

  <h3 class="detail-section-header">Additional</h3>
  <div class="detail-grid">
    <div class="detail-group detail-group--full">
      <label class="form-label">About the Applicant</label>
      {#if editMode}
        <textarea class="form-input" bind:value={draft.about_applicant} rows="3"></textarea>
      {:else}
        <div class="detail-value">{project.about_applicant || '-'}</div>
      {/if}
    </div>
    <div class="detail-group detail-group--full">
      <label class="form-label">Comments</label>
      {#if editMode}
        <textarea class="form-input" bind:value={draft.comments} rows="3"></textarea>
      {:else}
        <div class="detail-value">{project.comments || '-'}</div>
      {/if}
    </div>
    <div class="detail-group">
      <label class="form-label">Created</label>
      <div class="detail-value">{formatDate(project.created_at)}</div>
    </div>
    <div class="detail-group">
      <label class="form-label">Last Updated</label>
      <div class="detail-value">{formatDate(project.updated_at)}</div>
    </div>
  </div>
</div>

<style>
  .pd-page {
    padding: 1.25rem 1.75rem 1.75rem;
  }

  .pd-head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .pd-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    margin-bottom: 0.75rem;
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: var(--radius-md);
    color: var(--color-red-800);
    font-size: 0.8rem;
  }

  .details-guide-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-slate-600);
    cursor: pointer;
  }
  .details-guide-btn:hover { background: var(--color-slate-50); }

  .detail-section-header {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-slate-700);
    margin: 1.25rem 0 0.75rem;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.9rem 1.25rem;
  }

  .detail-group--full { grid-column: 1 / -1; }

  .detail-group label {
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--color-slate-400);
    margin-bottom: 0.2rem;
  }

  .detail-value {
    font-size: 0.85rem;
    color: var(--color-slate-800);
    line-height: 1.5;
  }

  .lpa-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .lpa-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .lpa-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.3rem 0.2rem 0.6rem;
    background: var(--color-primary-50);
    color: var(--color-primary-700);
    border-radius: var(--radius-pill);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .lpa-tag-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--color-primary-600);
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
  }
  .lpa-tag-remove:hover { background: var(--color-primary-100); }

  .lpa-add-row {
    display: flex;
    gap: 0.5rem;
  }
  .lpa-add-row .form-input { flex: 1; }

  @media (max-width: 900px) {
    .detail-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
