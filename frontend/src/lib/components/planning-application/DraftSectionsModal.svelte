<script>
  import {
    sectionsModalOpen,
    sectionsTypeName,
    sectionsTypeId,
    sections,
    sectionsLoading,
    newSectionName,
    addingSectionLoading,
    sectionGenerating,
    sectionExpandedId,
    sectionPromptText,
    sectionPromptIsCustom,
    sectionPromptSaving,
    sectionPromptSaved,
    sectionPromptResetting,
    sectionTemplateText,
    sectionTemplateSaving,
    sectionTemplateSaved,
    moveSectionUp,
    moveSectionDown,
    toggleSectionExpand,
    handleSaveSectionPrompt,
    handleSaveSectionTemplate,
    openSectionExampleModal,
    requestGenerateSection,
    handleResetSectionPrompt,
    handleAddSection,
    handleDeleteSection,
  } from '$lib/stores/planning-drafts.js';

  export let draftProviderByType = {};

  function autoresize(node, _value) {
    function resize() {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
    node.addEventListener('input', resize);
    resize();
    return {
      update() { resize(); },
      destroy() { node.removeEventListener('input', resize); }
    };
  }

  // programmatic: true = substituted AFTER generation (never seen by LLM — hallucination-safe)
  // programmatic: false = substituted into prompt before sending (LLM synthesises from this content)
  const VARIABLE_SOURCES = {
    PROJECT_NAME:            { label: 'Project name',               source: 'projects.project_name',                                programmatic: true },
    APPLICANT_NAME:          { label: 'Applicant name',             source: 'projects.client',                                      programmatic: true },
    LPA_NAME:                { label: 'LPA name',                   source: 'projects.local_planning_authority',                    programmatic: true },
    SITE_ADDRESS:            { label: 'Site address',               source: 'projects.address',                                     programmatic: true },
    DEVELOPMENT_DESCRIPTION: { label: 'Description of development', source: 'projects.development_description',                    programmatic: true },
    ABOUT_APPLICANT:         { label: 'About the applicant',        source: 'document_summaries, doc_type: about_applicant',       programmatic: true },
    PROPOSED_DEVELOPMENT:    { label: 'Proposed development',       source: 'document_summaries, doc_type: proposed_development',  programmatic: false },
    DOCUMENT_LIST:           { label: 'Document list',              source: 'document_log (all entries)',                          programmatic: false },
    SITE_SURROUNDINGS:       { label: 'Site & surroundings',        source: 'document_summaries, doc_type: site_surroundings',     programmatic: false },
    PLANNING_HISTORY:              { label: 'Planning history',                    source: 'planning_history table',                                       programmatic: false },
    PROJECT_PLANNING_HISTORY:      { label: 'Project planning history (2 tables)', source: 'project_planning_history, on-site + nearby, as HTML tables',   programmatic: true },
    PRE_APP_SUMMARY:         { label: 'Pre-app summary',            source: 'document_summaries, doc_type: pre_app',               programmatic: true },
    EIA_SUMMARY:             { label: 'EIA summary',                source: 'document_summaries, doc_type: eia_response',          programmatic: true },
    SCI_SUMMARY:             { label: 'SCI summary',                source: 'document_summaries, doc_type: sci',                   programmatic: true },
    LOCAL_POLICIES:             { label: 'Local policies (HTML)',       source: 'project_policies, local, verbatim listing',           programmatic: true },
    NATIONAL_POLICIES:          { label: 'National policies (HTML)',   source: 'project_policies, national, verbatim listing',        programmatic: true },
    OTHER_POLICIES:             { label: 'Other policies (HTML)',      source: 'project_policies, other types, verbatim listing',     programmatic: true },
    LOCAL_POLICY_NAMES:         { label: 'Local policy names',         source: 'project_policies, local, ref + name list only',       programmatic: true },
    SUPPLEMENTARY_POLICY_NAMES: { label: 'Supplementary policy names', source: 'project_policies, supplementary, ref + name list',   programmatic: true },
    SITE_SURROUNDINGS_HTML:     { label: 'Site & surroundings (HTML)', source: 'document_summaries, doc_type: site_surroundings, raw HTML', programmatic: true },
    PLANNING_HISTORY_TABLE:     { label: 'Planning history table',     source: 'planning_history table, rendered as HTML table',       programmatic: true },
    PROPOSED_DEVELOPMENT_HTML:  { label: 'Proposed development (HTML)', source: 'document_summaries, doc_type: proposed_development, raw HTML', programmatic: true },
    DOCUMENT_LIST_DOCS:         { label: 'Document list',              source: 'document_log, item_type: document, as bullet list',   programmatic: true },
    DOCUMENT_LIST_DRAWINGS:     { label: 'Drawings list',              source: 'document_log, item_type: drawing, as bullet list',    programmatic: true },
    LOCAL_POLICIES_CONTEXT:  { label: 'Local policies (context)',   source: 'project_policies, local, refs + notes for LLM',       programmatic: false },
    NATIONAL_POLICIES_CONTEXT: { label: 'National policies (context)', source: 'project_policies, national, refs + notes for LLM', programmatic: false },
    OTHER_POLICIES_CONTEXT:  { label: 'Other policies (context)',   source: 'project_policies, other, refs + notes for LLM',       programmatic: false },
    FULL_STATEMENT:          { label: 'Full statement',             source: 'Assembled HTML of all sections (runs_last only)',       programmatic: false },

    // v2/v3 appeal-tool prompts (appeal.service.js / appeal.controller.js) —
    // a separate substitution system from the planning statement one above.
    // Everything here is substituted before the LLM call (no output-slot /
    // post-generation swap pattern exists in this system), so "prog." vs
    // "llm" instead tracks whether the value's own content was itself
    // produced or interpreted by an LLM anywhere upstream (an AI-written
    // document summary) vs a plain deterministic DB field or admin-authored
    // text with no LLM involvement in its provenance.
    NEIGHBOURHOOD_POLICIES: { label: 'Neighbourhood policies (HTML)', source: 'project_policies, neighbourhood, verbatim listing', programmatic: true },
    SUPPLEMENTARY_POLICIES: { label: 'Supplementary policies (HTML)', source: 'project_policies, supplementary, verbatim listing', programmatic: true },
    GUIDING_BRIEF:           { label: 'Guiding brief',                source: 'admin_console.guiding_briefs.guidance_content, matched by document_type + development_type', programmatic: true },
    STYLE_GUIDE:              { label: 'Style example',                 source: 'admin_console.guiding_briefs.style_example', programmatic: true },
    DOCUMENT_TYPE:            { label: 'Draft type name',               source: 'appeals.appeal_draft_types.name', programmatic: true },
    PROJECT_BRIEF:            { label: 'Project brief',                 source: 'planning_applications.document_summaries, latest briefing_transcript (AI-generated summary)', programmatic: false },
    BRIEFING_NOTES:           { label: 'Briefing notes (ticked selection)', source: 'planning_applications.document_summaries, briefing_transcript rows selected via Starting Docs (AI-generated summaries)', programmatic: false },
    ISSUE_LABEL:              { label: 'Issue label',                   source: 'drafting_issues.label / project_issue_tracks.label', programmatic: true },
    ISSUE_DISCIPLINE:         { label: 'Issue discipline',              source: 'drafting_issues.discipline / project_issue_tracks.discipline', programmatic: true },
    ISSUE_LIST:               { label: 'Issue list (all issues)',       source: 'drafting_issues / project_issue_tracks, label + discipline, one per line', programmatic: true },
    ISSUE_CONTEXT:            { label: 'Issue context (single issue)',  source: 'linked policies, snippet templates, and working notes (tier notes, argument notes, specialist report) for one issue', programmatic: true },
    ISSUES_CONTEXT:           { label: 'Issues context (all issues)',   source: 'same as Issue context, for every issue in the section, clearly delimited', programmatic: true },
    DECISION_NOTICE:          { label: 'Decision Notice',               source: 'appeals.pa_draft_starting_docs, slot: decision_notice', programmatic: true },
    OFFICERS_REPORT:          { label: "Officer's Report",              source: 'appeals.pa_draft_starting_docs, slot: officers_report', programmatic: true },
    PLANNING_STATEMENT:       { label: 'Planning Statement (uploaded)', source: 'appeals.pa_draft_starting_docs, slot: planning_statement', programmatic: true },
    COMMITTEE_REPORT:         { label: 'Committee Report',              source: 'appeals.pa_draft_starting_docs, slot: committee_report', programmatic: true },
    COMMITTEE_MINUTES:        { label: 'Committee Minutes',             source: 'appeals.pa_draft_starting_docs, slot: committee_minutes', programmatic: true },
    STAGE1_REVIEW:            { label: 'Stage 1 Review',                source: 'appeals.pa_draft_starting_docs, slot: stage1_review', programmatic: true },
    OTHER_DOCS:               { label: 'Other Documents',               source: 'appeals.pa_draft_starting_docs, slot: other', programmatic: true },
    HLPV_DATA:                { label: 'HLPV Tool Data',                source: 'appeals.pa_draft_starting_docs, slot: hlpv_data', programmatic: true },
    ADDITIONAL_DESIGNATIONS:  { label: 'Additional Designations & Site Notes', source: 'appeals.pa_draft_starting_docs, slot: additional_designations', programmatic: true },
    SOCIO_DATA:               { label: 'Socio-economic Data',           source: 'appeals.pa_draft_starting_docs, slot: socio_data', programmatic: true },
  };

  $: detectedVars = [...new Set(($sectionPromptText || '').match(/\{\{([A-Z_]+)\}\}/g) || [])]
    .map(match => {
      const key = match.slice(2, -2);
      const info = VARIABLE_SOURCES[key];
      return { key, label: info?.label ?? key, source: info?.source ?? 'unknown source', programmatic: info?.programmatic ?? false };
    });
</script>

<div class="modal-overlay" on:click|self={() => $sectionsModalOpen = false} role="dialog" aria-modal="true">
  <div class="modal modal-sections">
    <div class="modal-header">
      <span class="modal-title">Sections: {$sectionsTypeName}</span>
      <button class="modal-close" on:click={() => $sectionsModalOpen = false}><i class="las la-times"></i></button>
    </div>
    <div class="modal-body sections-body">
      {#if $sectionsLoading}
        <div class="prompt-loading"><div class="spinner"></div><span>Loading...</span></div>
      {:else}
        {#if $sections.length === 0}
          <p class="sections-empty">No sections yet. Add one below to define the structure of this document.</p>
        {:else}
          <div class="sections-list">
            {#each $sections as section, idx (section.id)}
              <div class="section-row" class:expanded={$sectionExpandedId === section.id}>
                <div class="section-row-header">
                  <div class="section-order-btns">
                    <button class="section-order-btn" disabled={idx === 0} on:click={() => moveSectionUp(idx)} title="Move up"><i class="las la-angle-up"></i></button>
                    <button class="section-order-btn" disabled={idx === $sections.length - 1} on:click={() => moveSectionDown(idx)} title="Move down"><i class="las la-angle-down"></i></button>
                  </div>
                  <span class="section-name">{section.name}</span>
                  <div class="section-row-actions">
                    <button class="section-generate-btn" disabled={$sectionGenerating === section.id} on:click={() => requestGenerateSection(section, null, draftProviderByType[$sectionsTypeId] || '')} title="Generate this section">
                      {#if $sectionGenerating === section.id}<div class="mini-spinner"></div>{:else}<i class="las la-magic"></i>{/if}
                    </button>
                    <button class="section-edit-btn" on:click={() => toggleSectionExpand(section.id)}>
                      {$sectionExpandedId === section.id ? 'Close' : 'Edit'}
                    </button>
                    <button class="section-delete-btn" on:click={() => handleDeleteSection(section.id)} title="Delete section">
                      <i class="las la-trash"></i>
                    </button>
                  </div>
                </div>

                {#if $sectionExpandedId === section.id}
                  <div class="section-expand">

                    <!-- Template block -->
                    <div class="section-block">
                      <div class="section-block-header">
                        <label class="section-field-label">Template
                          <span class="form-label-hint">fixed structure with <code>{'{{VARIABLE}}'}</code>, <code>{'{{LLM:slug}}'}</code>…<code>{'{{/LLM}}'}</code> and <code>[Placeholder]</code> markers</span>
                        </label>
                        {#if $sectionTemplateText}
                          <span class="section-mode-badge section-mode-badge--template">Template active</span>
                        {/if}
                      </div>
                      <textarea class="prompt-editor section-prompt section-template" bind:value={$sectionTemplateText} use:autoresize={$sectionTemplateText} placeholder="Paste template HTML here..."></textarea>
                      <div class="section-expand-actions">
                        <button class="modal-save" disabled={$sectionTemplateSaving} on:click={() => handleSaveSectionTemplate(section.id)}>
                          {#if $sectionTemplateSaving}Saving...{:else if $sectionTemplateSaved}<i class="las la-check"></i> Saved{:else}Save template{/if}
                        </button>
                      </div>
                    </div>

                    <!-- Prompt block (used when no template) -->
                    <div class="section-block" class:section-block--dimmed={!!$sectionTemplateText}>
                      <label class="section-field-label">Generation prompt
                        <span class="form-label-hint">
                          {#if section.slug === 'planning_assessment'}
                            : replaces the default assessment prompt when set
                          {:else if $sectionTemplateText}
                            : ignored when template is set
                          {:else}
                            : used when no template
                          {/if}
                        </span>
                      </label>

                      {#if section.slug === 'planning_assessment'}
                        <div class="assessment-vars-hint">
                          <span class="assessment-vars-title">Available variables (substituted per issue)</span>
                          <div class="assessment-vars-list">
                            <code>{'{{ISSUE_LABEL}}'}</code>
                            <code>{'{{ISSUE_DISCIPLINE}}'}</code>
                            <code>{'{{POLICY_STRUCTURE}}'}</code>
                            <code>{'{{ISSUE_CONTEXT}}'}</code>
                            <code>{'{{PROJECT_NAME}}'}</code>
                            <code>{'{{SECTION_NAME}}'}</code>
                            <code>{'{{EXAMPLE_BLOCK}}'}</code>
                          </div>
                          <p class="assessment-vars-note">If left blank, the default structured prompt is used.</p>
                        </div>
                      {/if}

                      <textarea class="prompt-editor section-prompt" bind:value={$sectionPromptText} use:autoresize={$sectionPromptText}></textarea>

                      {#if detectedVars.length > 0}
                        <div class="section-vars-panel">
                          <span class="section-vars-title">Variables in this prompt</span>
                          <div class="section-vars-list">
                            {#each detectedVars as v}
                              <div class="section-var-row">
                                <div class="section-var-key-cell">
                                  <code class="section-var-key">{'{{'}{v.key}{'}}'}</code>
                                  <span class="section-var-badge" class:section-var-badge--safe={v.programmatic}>
                                    {v.programmatic ? 'prog.' : 'llm'}
                                  </span>
                                </div>
                                <span class="section-var-label">{v.label}</span>
                                <span class="section-var-source">{v.source}</span>
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <div class="section-expand-actions">
                        {#if section.slug === 'planning_assessment'}
                          {#if $sectionPromptIsCustom}
                            <span class="prompt-custom-badge">Custom prompt</span>
                            <button class="btn-reset-prompt" disabled={$sectionPromptResetting} on:click={() => handleResetSectionPrompt(section.id)}>
                              {$sectionPromptResetting ? 'Resetting…' : 'Reset to default'}
                            </button>
                          {:else}
                            <span class="prompt-default-badge">Default prompt</span>
                          {/if}
                        {/if}
                        <button class="section-example-btn" on:click={() => openSectionExampleModal(section.id)}>
                          <i class="las la-file-alt"></i> Edit style example
                        </button>
                        <button class="modal-save" disabled={$sectionPromptSaving} on:click={() => handleSaveSectionPrompt(section.id)}>
                          {#if $sectionPromptSaving}Saving...{:else if $sectionPromptSaved}<i class="las la-check"></i> Saved{:else}Save prompt{/if}
                        </button>
                      </div>
                    </div>

                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="add-section-row">
          <input
            class="add-section-input"
            type="text"
            placeholder="New section name..."
            bind:value={$newSectionName}
            on:keydown={(e) => e.key === 'Enter' && handleAddSection()}
          />
          <button class="add-section-btn" disabled={!$newSectionName.trim() || $addingSectionLoading} on:click={handleAddSection}>
            {#if $addingSectionLoading}<div class="mini-spinner"></div>{:else}<i class="las la-plus"></i>{/if}
            Add
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal {
    background: white;
    border-radius: 10px;
    width: 100%;
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .modal-title { font-size: 0.9375rem; font-weight: 700; color: var(--color-slate-800); }

  .modal-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--color-slate-400);
    font-size: 1.125rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .modal-close:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
  }

  .modal-save {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .modal-save:hover:not(:disabled) { background: var(--color-slate-100); border-color: var(--color-slate-300); }
  .modal-save:disabled { opacity: 0.4; cursor: not-allowed; }

  .prompt-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-slate-500);
    font-size: 0.875rem;
  }

  .prompt-editor {
    flex: 1;
    width: 100%;
    min-height: 400px;
    box-sizing: border-box;
    padding: 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: 'Menlo', 'Consolas', monospace;
    line-height: 1.6;
    color: var(--color-slate-800);
    background: var(--color-slate-50);
    resize: vertical;
  }
  .prompt-editor:focus { outline: none; border-color: var(--color-primary-600); background: white; }

  .prompt-custom-badge {
    font-size: 0.72rem; font-weight: 600;
    background: var(--color-primary-100); color: var(--color-blue-700);
    padding: 0.2rem 0.5rem; border-radius: 20px;
  }
  .prompt-default-badge {
    font-size: 0.72rem; font-weight: 600;
    background: var(--color-slate-100); color: var(--color-slate-500);
    padding: 0.2rem 0.5rem; border-radius: 20px;
  }
  .btn-reset-prompt {
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--color-slate-300); background: white;
    border-radius: 5px; font-size: 0.78rem;
    font-family: inherit; color: var(--color-slate-500); cursor: pointer;
  }
  .btn-reset-prompt:hover:not(:disabled) { background: var(--color-slate-50); border-color: var(--color-blue-600); color: var(--color-blue-700); }
  .btn-reset-prompt:disabled { opacity: 0.5; cursor: not-allowed; }

  .assessment-vars-hint {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: var(--color-slate-100);
    border: 1px solid var(--color-emerald-100);
    border-radius: 0.375rem;
  }
  .assessment-vars-title {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-emerald-600);
    margin-bottom: 0.5rem;
  }
  .assessment-vars-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }
  .assessment-vars-list code {
    font-size: 0.72rem;
    background: white;
    border: 1px solid var(--color-emerald-100);
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    color: var(--color-green-800);
    font-family: monospace;
  }
  .assessment-vars-note {
    margin: 0;
    font-size: 0.72rem;
    color: var(--color-slate-500);
  }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .section-generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    background: white;
    color: var(--color-primary-600);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .section-generate-btn:hover:not(:disabled) { background: var(--color-blue-50); border-color: var(--color-blue-200); }
  .section-generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .section-delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    background: white;
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
  }
  .section-delete-btn:hover { background: var(--color-red-100); border-color: var(--color-red-200); color: var(--color-red-800); }

  .section-field-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }

  .add-section-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-800);
    background: white;
    transition: border-color 0.15s;
  }
  .add-section-input:focus { outline: none; border-color: var(--color-primary-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07); }
  .add-section-input::placeholder { color: var(--color-slate-400); }

  /* ── Sections manager modal ── */
  .modal-sections { max-width: 680px; }

  .sections-body {
    padding: 0;
    overflow-y: auto;
  }

  .sections-empty {
    margin: 0;
    padding: 2rem 1.25rem 1rem;
    font-size: 0.875rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .sections-list {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--color-slate-100);
  }

  .section-row {
    border-bottom: 1px solid var(--color-slate-100);
  }

  .section-row:last-child { border-bottom: none; }

  .section-row.expanded { background: var(--color-blue-50); }

  .section-row-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
  }

  .section-order-btns {
    display: flex;
    flex-direction: column;
    gap: 0;
    flex-shrink: 0;
  }

  .section-order-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.125rem;
    border: none;
    background: transparent;
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
    transition: color 0.1s;
  }

  .section-order-btn:hover:not(:disabled) { color: var(--color-slate-700); }
  .section-order-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  .section-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-slate-800);
    min-width: 0;
  }

  .section-row-actions {
    display: flex;
    gap: 0.375rem;
    flex-shrink: 0;
    align-items: center;
  }

  .section-edit-btn {
    padding: 0.3rem 0.625rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .section-edit-btn:hover { background: var(--color-slate-100); }

  .section-expand {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 1.25rem 1rem 1.25rem;
  }

  .section-prompt {
    min-height: 80px;
    max-height: 70vh;
    resize: none;
    overflow-y: auto;
  }

  .section-vars-panel {
    margin: 0.75rem 0 0;
    padding: 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
  }

  .section-vars-title {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-slate-500);
    margin-bottom: 0.5rem;
  }

  .section-vars-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .section-var-row {
    display: grid;
    grid-template-columns: minmax(0, 16rem) minmax(0, 10rem) minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .section-var-key-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
  }

  .section-var-key {
    font-family: monospace;
    font-size: 0.7rem;
    color: var(--color-violet-600);
    background: var(--color-violet-100);
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .section-var-label {
    color: var(--color-slate-800);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .section-var-source {
    color: var(--color-slate-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-var-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    white-space: nowrap;
    background: var(--color-amber-100);
    color: var(--color-amber-800);
  }

  .section-var-badge--safe {
    background: var(--color-emerald-100);
    color: var(--color-green-800);
  }

  .section-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 0.375rem;
    margin-bottom: 0.75rem;
  }

  .section-block--dimmed {
    opacity: 0.5;
  }

  .section-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .form-label-hint {
    font-weight: 400;
    color: var(--color-slate-400);
  }

  .section-mode-badge {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    white-space: nowrap;
  }

  .section-mode-badge--template {
    background: var(--color-emerald-100);
    color: var(--color-green-800);
  }

  .section-template {
    font-family: monospace;
    font-size: 0.72rem;
    min-height: 6rem;
  }

  .section-expand-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .section-example-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .section-example-btn:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .add-section-row {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
  }

  .add-section-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.5rem 0.875rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: background 0.15s;
  }
  .add-section-btn:hover:not(:disabled) { background: var(--color-primary-700); }
  .add-section-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
