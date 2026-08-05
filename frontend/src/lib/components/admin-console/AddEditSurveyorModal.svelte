<script>
  import { createEventDispatcher } from 'svelte';
  import { createSurveyorOrganisation, updateSurveyorOrganisation } from '$lib/api/surveyorOrganisations.js';

  export let show = false;
  export let surveyor = null; // null for add, object for edit
  export let prefill = null; // optional seed values for add mode only — { organisation, discipline, contacts }

  const dispatch = createEventDispatcher();

  const DISCIPLINES = [
    'Agricultural Land and Soil',
    'Arboriculture',
    'Contaminated Land',
    'Ecology',
    'Fire Safety',
    'Flood and Drainage',
    'Glint & Glare',
    'Heritage',
    'Landscape and Visual',
    'Other',
    'PR/Comms',
    'Renewable Drawing Packs',
    'Topographical',
    'Transport'
  ];

  let saving = false;
  let error = null;

  let organisation = '';
  let discipline = '';
  let location = '';
  let notes = '';
  let approval_status = 'approved';
  let small_business = '';
  let contacts = [];

  $: if (show) {
    if (surveyor) {
      organisation = surveyor.organisation || '';
      discipline = surveyor.discipline || '';
      location = surveyor.location || '';
      notes = surveyor.notes || '';
      approval_status = surveyor.approval_status || 'approved';
      small_business = surveyor.small_business || '';
      contacts = (surveyor.contacts || []).map(c => ({ ...c }));
    } else if (prefill) {
      organisation = prefill.organisation || '';
      discipline = prefill.discipline || '';
      location = '';
      notes = '';
      approval_status = 'approved';
      small_business = '';
      contacts = (prefill.contacts || []).map(c => ({ ...c }));
    } else {
      organisation = '';
      discipline = '';
      location = '';
      notes = '';
      approval_status = 'approved';
      small_business = '';
      contacts = [];
    }
    error = null;
  }

  $: isEditMode = !!surveyor;
  $: modalTitle = isEditMode ? 'Edit Surveyor Organisation' : 'Add Surveyor Organisation';
  $: saveButtonText = isEditMode ? 'Save Changes' : 'Add Surveyor';

  function handleClose() {
    if (saving) return;
    show = false;
    dispatch('close');
  }

  function addContact() {
    contacts = [...contacts, {
      name: '',
      email: '',
      phone_number: '',
      is_primary: contacts.length === 0
    }];
  }

  function removeContact(index) {
    contacts = contacts.filter((_, i) => i !== index);
  }

  async function handleSave() {
    if (!organisation.trim()) {
      error = 'Organisation name is required';
      return;
    }
    if (!discipline) {
      error = 'Discipline is required';
      return;
    }
    for (let i = 0; i < contacts.length; i++) {
      if (!contacts[i].name.trim()) {
        error = `Contact ${i + 1}: Name is required`;
        return;
      }
    }

    saving = true;
    error = null;

    const data = {
      organisation: organisation.trim(),
      discipline,
      location: location.trim() || null,
      notes: notes.trim() || null,
      approval_status,
      small_business: small_business || null,
      contacts: contacts.map(c => ({
        id: c.id || null,
        name: c.name.trim(),
        email: c.email?.trim() || null,
        phone_number: c.phone_number?.trim() || null,
        is_primary: c.is_primary || false
      }))
    };

    try {
      const saved = isEditMode
        ? await updateSurveyorOrganisation(surveyor.id, data)
        : await createSurveyorOrganisation(data);
      show = false;
      dispatch('saved', saved);
    } catch (err) {
      error = err.message;
    } finally {
      saving = false;
    }
  }
</script>

{#if show}
  <div class="modal-backdrop" on:click={handleClose}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{modalTitle}</h2>
        <button class="close-btn" on:click={handleClose} disabled={saving}>
          <i class="las la-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Organisation Details -->
        <div class="form-row">
          <div class="form-group">
            <label for="org-name">Organisation Name <span class="required">*</span></label>
            <input
              id="org-name"
              type="text"
              bind:value={organisation}
              placeholder="e.g. FPCR Environment & Design"
              disabled={saving}
            />
          </div>

          <div class="form-group">
            <label for="discipline">Discipline <span class="required">*</span></label>
            <select id="discipline" bind:value={discipline} disabled={saving}>
              <option value="">Select discipline...</option>
              {#each DISCIPLINES as d}
                <option value={d}>{d}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="location">Location</label>
            <input
              id="location"
              type="text"
              bind:value={location}
              placeholder="e.g. Cambridge"
              disabled={saving}
            />
          </div>

          <div class="form-group">
            <label for="approval-status">Approval Status</label>
            <select id="approval-status" bind:value={approval_status} disabled={saving}>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="small-business">Small Business</label>
          <select id="small-business" bind:value={small_business} disabled={saving}>
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            bind:value={notes}
            placeholder="Any notes about this surveyor..."
            rows="3"
            disabled={saving}
          ></textarea>
        </div>

        <!-- Contacts Section -->
        <div class="contacts-section">
          <div class="section-header">
            <h3>Contacts</h3>
            <button type="button" class="btn btn-sm btn-secondary" on:click={addContact} disabled={saving}>
              <i class="las la-plus"></i> Add Contact
            </button>
          </div>

          {#if contacts.length === 0}
            <p class="no-contacts">No contacts added yet.</p>
          {:else}
            <div class="contacts-list">
              {#each contacts as contact, index}
                <div class="contact-card">
                  <div class="contact-header">
                    <span class="contact-number">Contact {index + 1}</span>
                    <label class="primary-label">
                      <input
                        type="checkbox"
                        bind:checked={contact.is_primary}
                        disabled={saving}
                      />
                      Primary
                    </label>
                    <button
                      type="button"
                      class="remove-contact-btn"
                      on:click={() => removeContact(index)}
                      disabled={saving}
                      title="Remove contact"
                    >
                      <i class="las la-times"></i>
                    </button>
                  </div>

                  <div class="contact-fields">
                    <div class="form-group">
                      <label>Name <span class="required">*</span></label>
                      <input
                        type="text"
                        bind:value={contact.name}
                        placeholder="Contact name"
                        disabled={saving}
                      />
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          bind:value={contact.email}
                          placeholder="email@example.com"
                          disabled={saving}
                        />
                      </div>

                      <div class="form-group">
                        <label>Phone</label>
                        <input
                          type="tel"
                          bind:value={contact.phone_number}
                          placeholder="+44 123 456 7890"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        {#if error}
          <div class="error-box">
            <i class="las la-exclamation-circle"></i>
            {error}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose} disabled={saving}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={handleSave} disabled={saving}>
          {#if saving}
            <i class="las la-spinner la-spin"></i> Saving...
          {:else}
            {saveButtonText}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 640px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover:not(:disabled) {
    background: #f1f5f9;
    color: #1e293b;
  }

  .close-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .required {
    color: #ef4444;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #1e293b;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
    background: white;
  }

  .form-group textarea {
    resize: vertical;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-group input:disabled,
  .form-group select:disabled,
  .form-group textarea:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    min-width: 0;
  }

  .form-row .form-group {
    min-width: 0;
  }

  .contacts-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e2e8f0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .no-contacts {
    color: #64748b;
    font-size: 0.875rem;
    font-style: italic;
    text-align: center;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 8px;
  }

  .contacts-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .contact-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    background: #f8fafc;
    box-sizing: border-box;
  }

  .contact-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .contact-number {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
  }

  .primary-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: #64748b;
    cursor: pointer;
    margin-bottom: 0;
    font-weight: 400;
  }

  .primary-label input[type="checkbox"] {
    width: auto;
    padding: 0;
    border: none;
    cursor: pointer;
  }

  .remove-contact-btn {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    font-size: 1.25rem;
    color: #94a3b8;
    transition: all 0.2s;
  }

  .remove-contact-btn:hover:not(:disabled) {
    color: #ef4444;
  }

  .remove-contact-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .contact-fields .form-group {
    margin-bottom: 0.75rem;
  }

  .contact-fields .form-group:last-child {
    margin-bottom: 0;
  }

  .contact-fields .form-row {
    margin-bottom: 0;
  }

  .contact-fields .form-row .form-group {
    margin-bottom: 0;
  }

  .error-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #991b1b;
    margin-top: 1rem;
  }

  .error-box i {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-secondary {
    background: white;
    color: #64748b;
    border: 1px solid #cbd5e1;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
</style>
