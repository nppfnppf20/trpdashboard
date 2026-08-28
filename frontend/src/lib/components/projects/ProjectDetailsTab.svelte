<script>
  export let project;
  export let onOpenMeetingGuide = () => {};

  function formatLPA(lpaArray) {
    if (!lpaArray || !Array.isArray(lpaArray) || lpaArray.length === 0) return '-';
    return lpaArray.join(', ');
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<div class="pd-page">
  <div class="pd-head">
    <button class="details-guide-btn" on:click={onOpenMeetingGuide}>
      <i class="las la-clipboard-list"></i> Meeting Guide
    </button>
  </div>

  <h3 class="detail-section-header">Project Overview</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label>Project ID</label>
      <div class="detail-value">{project.project_id || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Project Name</label>
      <div class="detail-value">{project.project_name || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Status</label>
      <div class="detail-value">{project.status || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Sector</label>
      <div class="detail-value">{(project.sectors || []).join(', ') || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Sub-sector</label>
      <div class="detail-value">{(project.sub_sectors || []).join(', ') || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Development Type</label>
      <div class="detail-value">{(project.development_types || []).join(', ') || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Address</label>
      <div class="detail-value">{project.address || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Area</label>
      <div class="detail-value">{project.area || '-'}</div>
    </div>
    <div class="detail-group detail-group--full">
      <label>Description of Development</label>
      <div class="detail-value">{project.development_description || '-'}</div>
    </div>
  </div>

  <h3 class="detail-section-header">Team</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label>Client</label>
      <div class="detail-value">{project.client || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Client SPV Name</label>
      <div class="detail-value">{project.client_spv_name || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Project Lead</label>
      <div class="detail-value">{project.project_lead || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Project Manager</label>
      <div class="detail-value">{project.project_manager || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Project Director</label>
      <div class="detail-value">{project.project_director || '-'}</div>
    </div>
  </div>

  <h3 class="detail-section-header">Planning</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label>Local Planning Authority</label>
      <div class="detail-value">{formatLPA(project.local_planning_authority)}</div>
    </div>
    <div class="detail-group">
      <label>LPA Reference</label>
      <div class="detail-value">{project.lpa_reference || '-'}</div>
    </div>
    <div class="detail-group detail-group--full">
      <label>Designations on Site</label>
      <div class="detail-value">{project.designations_on_site || '-'}</div>
    </div>
    <div class="detail-group detail-group--full">
      <label>Relevant Nearby Designations</label>
      <div class="detail-value">{project.relevant_nearby_designations || '-'}</div>
    </div>
  </div>

  <h3 class="detail-section-header">Case Officer</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label>Name</label>
      <div class="detail-value">{project.case_officer_name || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Email</label>
      <div class="detail-value">{project.case_officer_email || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Phone</label>
      <div class="detail-value">{project.case_officer_phone_number || '-'}</div>
    </div>
  </div>

  <h3 class="detail-section-header">Key Dates</h3>
  <div class="detail-grid">
    <div class="detail-group">
      <label>Submission Date</label>
      <div class="detail-value">{formatDate(project.submission_date)}</div>
    </div>
    <div class="detail-group">
      <label>Validation Date</label>
      <div class="detail-value">{formatDate(project.validation_date)}</div>
    </div>
    <div class="detail-group">
      <label>LPA Consultation End</label>
      <div class="detail-value">{formatDate(project.lpa_consultation_end_date)}</div>
    </div>
    <div class="detail-group">
      <label>Committee Date</label>
      <div class="detail-value">{formatDate(project.committee_date)}</div>
    </div>
    <div class="detail-group">
      <label>Target Determination Date</label>
      <div class="detail-value">{formatDate(project.target_determination_date)}</div>
    </div>
    <div class="detail-group">
      <label>Determined Date</label>
      <div class="detail-value">{formatDate(project.determined_date)}</div>
    </div>
    <div class="detail-group">
      <label>1st Stat Period Expiry</label>
      <div class="detail-value">{formatDate(project.expiry_of_1st_stat_period_date)}</div>
    </div>
    <div class="detail-group">
      <label>EOT Date</label>
      <div class="detail-value">{formatDate(project.eot_date)}</div>
    </div>
    <div class="detail-group">
      <label>6-Month Appeal Window</label>
      <div class="detail-value">{formatDate(project.six_months_appeal_window_date)}</div>
    </div>
  </div>

  <h3 class="detail-section-header">Additional</h3>
  <div class="detail-grid">
    <div class="detail-group detail-group--full">
      <label>About the Applicant</label>
      <div class="detail-value">{project.about_applicant || '-'}</div>
    </div>
    <div class="detail-group detail-group--full">
      <label>Comments</label>
      <div class="detail-value">{project.comments || '-'}</div>
    </div>
    <div class="detail-group">
      <label>Created</label>
      <div class="detail-value">{formatDate(project.created_at)}</div>
    </div>
    <div class="detail-group">
      <label>Last Updated</label>
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
    justify-content: flex-end;
    margin-bottom: 0.5rem;
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

  @media (max-width: 900px) {
    .detail-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
