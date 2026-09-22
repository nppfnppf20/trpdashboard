<script>
  import { onMount } from 'svelte';
  import { getIssueNotes, getDocumentLog, getPaDraftContext, saveDraft, paIncorporateTargeted } from '$lib/api/planningApplication.js';
  import { initNotes, briefingDraftOpen, runDraftFromBriefing, runDraftFromIssueSummaries, selectedBriefingNoteId, briefingDropdownOpen, briefingUploadOpen, loadBriefingNotes, selectBriefingNote, keyIssueDraftOpen } from '$lib/stores/planning-notes.js';
  import { documentLog, logModalOpen, initLog, editModalOpen, openEditModal, deleteEntry } from '$lib/stores/planning-log.js';
  import { suggestState, conversation, suggestError, refinementInput, refinementLoading, suggestInputTab, suggestFile, suggestPasteText, suggestDocumentType, suggestDocumentTitle, suggestUserNotes, suggestTrackIds, acceptedIssues, suggestPromptOpen, initSuggestion, runSuggestion, sendRefinement, acceptSuggestion, openSuggestionLogModal, resetSuggestion, onSuggestDrop, onSuggestFileChange, toggleSuggestTrack, openSuggestPromptModal } from '$lib/stores/planning-suggestion.js';
  import { draftTypes, drafts, draftGenerating, activeDraftTypeId, draftEditorHtml, draftSaving, draftSaved, sectionsModalOpen, sectionGenerating, sectionExampleModalOpen, cardExpandedTypeId, cardSections, cardSectionsLoading, assessmentIssues, assessmentIssuesLoading, issueGenerating, initDrafts, loadDraftTypes, setDraftEditor, handleGenerate, openDraft, closeDraft, handleSaveDraft, openSectionsModal, handleGenerateSection, toggleCardExpand, loadAssessmentIssues, handleGenerateAssessmentIssue, cardContextState, toggleCardContext, appealPromptOpen, appealPromptTypeId, appealPromptText, appealPromptLoading, appealPromptSaving, appealPromptSaved, openAppealPrompt, closeAppealPrompt, saveAppealPrompt, resetAppealPrompt} from '$lib/stores/planning-drafts.js';
  import { getStage1Context } from '$lib/api/stage1Review.js';
  import { getTemplates, createDeliverable, createCustomDeliverable, updateDeliverableFromHTML, getProjectDeliverables, getDeliverableAsHTML, deleteDeliverable as deleteDeliverableApi, incorporateDeliverableTargeted } from '$lib/services/planningDeliverablesApi.js';
  import { authFetch } from '$lib/api/client.js';
  import RichTextEditor from '$lib/components/planning/RichTextEditor.svelte';
  import { appealIncorporateTargeted } from '$lib/api/appeal.js';
  import DraftCheckPanel from '$lib/components/planning-application/DraftCheckPanel.svelte';
  import DraftCreatePanel from '$lib/components/planning-application/DraftCreatePanel.svelte';
  import DraftingIssuesModal from '$lib/components/planning-application/DraftingIssuesModal.svelte';
  import MeetingGuideModal from '$lib/components/meeting-guide/MeetingGuideModal.svelte';
  import { getDraftingIssues } from '$lib/api/draftingIssues.js';
  import ArgumentStructurePanel from '$lib/components/planning-application/ArgumentStructurePanel.svelte';
  import { exportHtmlToWord, getExportConfigForSlug } from '$lib/services/planningDeliverablesExport.js';
  import { buildExportFilename } from '$lib/services/exportFilename.js';
  import Stage1ReviewPanel from '$lib/components/planning-application/Stage1ReviewPanel.svelte';
  import DraftCommentsList from '$lib/components/planning-application/DraftCommentsList.svelte';
  import SelectionPopup from '$lib/components/planning-application/SelectionPopup.svelte';
  import { splitAllParagraphs, mergeParagraphUpdates, markFragmentPending, markChangedWordsPending, clearPendingMarkers } from '$lib/utils/draftParagraphs.js';
  import { getDraftComments, updateDraftComment, deleteDraftComment } from '$lib/api/draftComments.js';
  import PromptEditModal from '$lib/components/shared/PromptEditModal.svelte';
  import StartingDocsModal from '$lib/components/planning-application/StartingDocsModal.svelte';
  import { getStartingDocs, getDraftContext } from '$lib/api/appeal.js';
  import { md } from '$lib/utils/markdown.js';
  import BriefingDraftModal from '$lib/components/planning-application/BriefingDraftModal.svelte';
  import BriefingUploadModal from '$lib/components/planning-application/BriefingUploadModal.svelte';
  import KeyIssueDraftModal from '$lib/components/planning-application/KeyIssueDraftModal.svelte';
  import DocumentLogEntryModal from '$lib/components/planning-application/DocumentLogEntryModal.svelte';
  import DocumentLogEditModal from '$lib/components/planning-application/DocumentLogEditModal.svelte';
  import DraftSectionsModal from '$lib/components/planning-application/DraftSectionsModal.svelte';
  import SectionExampleModal from '$lib/components/planning-application/SectionExampleModal.svelte';
  import SuggestPromptModal from '$lib/components/planning-application/SuggestPromptModal.svelte';
  import RegenerateConfirmModal from '$lib/components/planning-application/RegenerateConfirmModal.svelte';
  import { actionPromptState, openActionPrompt, closeActionPrompt, saveActionPromptStore, resetActionPromptStore, setPromptText } from '$lib/stores/actionPrompts.js';

  const draftKeyState  = actionPromptState('draft_key_summaries');
  const draftArgsState    = actionPromptState('draft_arguments_from_briefing');
  const stage1PromptState   = actionPromptState('stage1_review');
  const stage1v2PromptState = actionPromptState('stage1_review_v2');
  const stage1v3PromptState = actionPromptState('stage1_review_v3');
  const hlpvV3PromptState   = actionPromptState('hlpv_v3');

  $: appealPromptTitle = $draftTypes.find(t => t.id === $appealPromptTypeId)?.name ?? 'Appeal Document';

  const SUGGEST_DOC_TYPES = [
    'Officer Report',
    'Design & Access Statement',
    'Planning Statement',
    'Heritage Statement',
    'Transport Assessment',
    'Ecology Report',
    'Noise Assessment',
    'Surveyor Report',
    'Pre-application Response',
    'Other'
  ];

  const POLICY_TIERS = [
    { key: 'policy_national',      label: 'National Policy',      placeholder: 'Key NPPF provisions and national guidance relevant to this issue...' },
    { key: 'policy_local',         label: 'Local Policy',         placeholder: 'Local plan policies and their requirements...' },
    { key: 'policy_neighbourhood', label: 'Neighbourhood Policy', placeholder: 'Neighbourhood plan policies (if applicable)...' },
    { key: 'policy_supplementary', label: 'Supplementary',        placeholder: 'SPDs, design guides or other supplementary guidance...' },
  ];

  let openTiers = {};

  function toggleTier(issueId, tierKey) {
    const current = openTiers[issueId] ?? {};
    openTiers = {
      ...openTiers,
      [issueId]: { ...current, [tierKey]: !current[tierKey] }
    };
  }

  let suggestFileInput;
  let chatEndEl;

  $: if ($conversation.length && chatEndEl) setTimeout(() => chatEndEl?.scrollIntoView({ behavior: 'smooth' }), 50);

  let draftEditor;

  // Planning Statement v3 and Stage 1 Review v3 are the ones we actually use
  // day to day — their older versions stay out of the main card list by
  // default, tucked behind a small picker on the v3 card instead of
  // cluttering the list with multiple versions of the same document. Purely
  // a display filter — nothing about how any version actually works changes
  // here.
  const LEGACY_PLANNING_STATEMENT_SLUGS = ['planning_statement', 'planning_statement_v2'];
  const LEGACY_PLANNING_STATEMENT_LABELS = {
    planning_statement:    'Original',
    planning_statement_v2: 'v2',
  };
  let visibleLegacyPlanningStatementSlug = '';

  const LEGACY_STAGE1_SLUGS = ['stage1_review', 'stage1_review_v2'];
  const LEGACY_STAGE1_LABELS = {
    stage1_review:    'Original',
    stage1_review_v2: 'v2',
  };
  let visibleLegacyStage1Slug = '';

  const LEGACY_HLPV_SLUGS = ['hlpv_narrative'];
  const LEGACY_HLPV_LABELS = {
    hlpv_narrative: 'Original',
  };
  let visibleLegacyHlpvSlug = '';

  // Draft types not in this list keep their relative order and are appended
  // after all of these — Array.prototype.sort is stable, so this is purely
  // a "pull these to the front, in this order" list.
  const CARD_ORDER_PRIORITY = [
    'hlpv_v3',
    'stage1_review_v3',
    'pre_application_request',
    'planning_statement_v3',
    'statement_of_common_ground',
    'statement_of_case',
  ];

  // Not yet ready to generate — shown as a static "Coming Soon" card instead
  // of a live draft-type card.
  const COMING_SOON_SLUGS = [];

  $: legacyPlanningStatementTypes = ($draftTypes ?? []).filter(t => LEGACY_PLANNING_STATEMENT_SLUGS.includes(t.slug));
  $: legacyStage1Types = ($draftTypes ?? []).filter(t => LEGACY_STAGE1_SLUGS.includes(t.slug));
  $: legacyHlpvTypes = ($draftTypes ?? []).filter(t => LEGACY_HLPV_SLUGS.includes(t.slug));
  $: visibleDraftTypes = ($draftTypes ?? [])
    .filter(t =>
      (!LEGACY_PLANNING_STATEMENT_SLUGS.includes(t.slug) || t.slug === visibleLegacyPlanningStatementSlug) &&
      (!LEGACY_STAGE1_SLUGS.includes(t.slug) || t.slug === visibleLegacyStage1Slug) &&
      (!LEGACY_HLPV_SLUGS.includes(t.slug) || t.slug === visibleLegacyHlpvSlug) &&
      !COMING_SOON_SLUGS.includes(t.slug)
    )
    .sort((a, b) => {
      const ai = CARD_ORDER_PRIORITY.indexOf(a.slug);
      const bi = CARD_ORDER_PRIORITY.indexOf(b.slug);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  $: setDraftEditor(draftEditor);

  export let project;

  const DEV_TYPES = [
    'Residential', 'Co-Living', 'Commercial', 'Solar', 'Wind', 'Mixed Use',
    'Industrial', 'Change of Use', 'Agricultural', 'Synchronous condensers', 'Other'
  ];

  // Set on the project's own info page now (Development Type multi-select) —
  // this card only reads it, it doesn't offer an editable selector any more.
  let developmentType = project.development_type ?? '';

  // Per-card dev type override for appeal cards that use dev-type-specific guiding briefs.
  // Defaults to the project dev type and can be changed per-card without saving to DB.
  let appealCardDevTypes = {};
  $: {
    for (const type of $draftTypes ?? []) {
      if (type.slug === 'hlpv_narrative' && !(type.id in appealCardDevTypes)) {
        appealCardDevTypes[type.id] = developmentType || '';
      }
    }
  }

  // Per-card AI provider choice for draft generation — session-only override,
  // not persisted. Empty/unset means "use the AI Providers admin default".
  let draftProviderByType = {};

  // Which draft-type card's "Config" dropdown is open (LLM choice, dev type,
  // version picker, Meeting Guide, edit prompt) — at most one at a time.
  let configOpenTypeId = null;
  let configDropdownStyle = '';

  // Cards near the left edge (e.g. the grid's first column) would otherwise
  // open the dropdown further left still, off-screen under the sidebar — so
  // position it from the button's actual on-screen position and flip to
  // open rightward whenever opening leftward would run out of room.
  function toggleConfig(e, id) {
    if (configOpenTypeId === id) {
      configOpenTypeId = null;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const dropdownWidth = 220; // matches .draft-config-dropdown's min-width
    const top = rect.bottom + 4;
    configDropdownStyle = (rect.right - dropdownWidth < 16)
      ? `top:${top}px; left:${rect.left}px;`
      : `top:${top}px; right:${window.innerWidth - rect.right}px;`;
    configOpenTypeId = id;
  }

  let activeTab = 'draft';

  let issueNotes = {};
  let loading = true;
  let loadError = null;

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [notes, log] = await Promise.all([
        getIssueNotes(project.id),
        getDocumentLog(project.id),
      ]);
      issueNotes = notes;
      initSuggestion(project.id);
      initDrafts(project.id);
      initNotes(project.id, notes);
      initLog(log);
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
    // Run independently — failures must not block the rest of the workspace
    await Promise.all([loadDraftTypes(), loadAssessmentIssues(), loadBriefingNotes(project.id)]);
    loadCardContextPcts();
    loadDeliverables();
  }


  function clickOutside(node, handler) {
    function onClick(e) { if (!node.contains(e.target)) handler(); }
    document.addEventListener('click', onClick, true);
    return { destroy() { document.removeEventListener('click', onClick, true); } };
  }

  let exportingWord = false;

  // Letter docs (Certificate B Notice, Cover Letter)
  let letterDeliverables = { certificate_b_notice: null, cover_letter: null };
  let letterGenerating = null;
  let letterModal = null; // { type, deliverableId, html, name }
  let letterModalEditor;
  let letterModalSaving = false;
  let letterModalSaved = false;
  let exportingLetterWord = false;

  // Custom documents saved from the blank document editor's Save button —
  // shown as cards in the document type list, same as letter docs.
  let customDeliverables = [];

  async function loadDeliverables() {
    try {
      const all = await getProjectDeliverables(project.id);
      letterDeliverables = {
        certificate_b_notice: all.find(d => d.deliverable_type === 'certificate_b_notice') ?? null,
        cover_letter: all.find(d => d.deliverable_type === 'cover_letter') ?? null,
      };
      customDeliverables = all.filter(d => d.deliverable_type === 'custom_document');
    } catch { /* non-critical */ }
  }

  async function handleLetterGenerate(templateType) {
    letterGenerating = templateType;
    try {
      const res = await authFetch('/api/planning/deliverables/generate-by-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, templateType })
      });
      if (!res.ok) throw new Error(await res.text());
      const { deliverable, html } = await res.json();
      letterDeliverables = { ...letterDeliverables, [templateType]: deliverable };
      letterModal = { type: templateType, deliverableId: deliverable.id, html, name: deliverable.deliverable_name };
    } catch (err) {
      console.error('Letter generation failed:', err);
      alert('Generation failed: ' + err.message);
    } finally {
      letterGenerating = null;
    }
  }

  async function handleLetterOpen(templateType) {
    const deliverable = letterDeliverables[templateType];
    if (!deliverable) return;
    try {
      const res = await authFetch(`/api/planning/deliverables/${deliverable.id}/html`);
      const { html } = await res.json();
      letterModal = { type: templateType, deliverableId: deliverable.id, html, name: deliverable.deliverable_name };
    } catch (err) {
      console.error('Failed to open letter:', err);
    }
  }

  async function handleLetterSave() {
    if (!letterModal) return;
    const html = letterModalEditor?.getHTML() ?? letterModal.html;
    letterModalSaving = true;
    try {
      await updateDeliverableFromHTML(letterModal.deliverableId, html);
      letterModalSaved = true;
      setTimeout(() => { letterModalSaved = false; }, 2000);
    } catch (err) {
      console.error('Failed to save letter:', err);
    } finally {
      letterModalSaving = false;
    }
  }

  // Tracks which saved custom_document deliverable the blank editor currently
  // holds (null for a fresh, never-saved document) so Save updates that same
  // row instead of creating a new one every time.
  let openCustomDeliverableId = null;

  function openBlankDoc() {
    $activeDraftTypeId = 'blank';
    $draftEditorHtml = '';
    $draftSaved = false;
    openCustomDeliverableId = null;
  }

  async function openCustomDeliverable(cd) {
    try {
      const { html } = await getDeliverableAsHTML(cd.id);
      openCustomDeliverableId = cd.id;
      $activeDraftTypeId = 'blank';
      $draftEditorHtml = html;
      $draftSaved = false;
    } catch (err) {
      console.error('Failed to open custom deliverable:', err);
      alert('Failed to open document: ' + err.message);
    }
  }

  async function handleDeleteCustomDeliverable(cd) {
    if (!confirm(`Delete "${cd.deliverable_name}"? This cannot be undone.`)) return;
    try {
      await deleteDeliverableApi(cd.id);
      customDeliverables = customDeliverables.filter(d => d.id !== cd.id);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  async function handleLetterExport() {
    if (!letterModalEditor) return;
    exportingLetterWord = true;
    try {
      await exportHtmlToWord(letterModalEditor.getHTML(), buildExportFilename(project, letterModal?.name ?? 'Letter'), '/basicdocument.docx');
    } finally {
      exportingLetterWord = false;
    }
  }

  let startingDocsType = null; // { id, slug, name } of the appeal type whose modal is open
  let cardContextPct = {}; // typeId -> 0-100

  // Draft types that actually read from admin_console.drafting_issues —
  // planning_statement_v3 fully (editable, drives its section generation),
  // stage1_review_v3 and hlpv_v3 read-only (a {{DRAFTING_ISSUE_NOTES}} prompt
  // block). Shown as an "Issues" button on each of their cards.
  const DRAFTING_ISSUES_SLUGS = ['planning_statement_v3', 'stage1_review_v3', 'hlpv_v3'];
  let draftingIssuesType = null; // { id, slug, name } of the card whose Issues modal is open

  // Meeting Guide — launched from a draft card so it can show the briefing
  // agenda tailored to that specific document type (planning_statement_v3,
  // stage1_review_v3, hlpv_v3, statement_of_case and statement_of_common_ground
  // have dedicated content — see DOC_TYPE_GUIDES in meetingGuideContent.js;
  // other types, including older non-v3 vintages of the above, fall back to
  // the generic guide).
  let meetingGuideType = null; // { id, slug, name } of the card whose guide is open
  let meetingGuideIssues = [];
  async function openMeetingGuide(type) {
    meetingGuideType = type;
    meetingGuideIssues = [];
    try {
      meetingGuideIssues = await getDraftingIssues(project.id);
    } catch (err) {
      console.error('Failed to load drafting issues for meeting guide:', err);
    }
  }

  async function loadCardContextPcts() {
    // Issue notes already loaded — add their text to every type's baseline
    const issueNotesChars = Object.values(issueNotes).reduce((acc, note) =>
      acc + (note.argument_for?.length ?? 0) + (note.argument_against?.length ?? 0), 0);

    const results = await Promise.all(
      $draftTypes.map(async type => {
        const isAppeal = type.tool === 'appeal';
        const rawId = isAppeal ? parseInt(type.id.replace('appeal_', ''), 10) : type.id;
        try {
          const ctxPromise = isAppeal
            ? getDraftContext(project.id, rawId).catch(() => null)
            : type.tool === 'stage1'
              ? getStage1Context(project.id).catch(() => null)
              : getPaDraftContext(project.id, rawId).catch(() => null);
          const docsPromise = isAppeal
            ? getStartingDocs(project.id, rawId).catch(() => [])
            : Promise.resolve([]);
          const [ctx, docs] = await Promise.all([ctxPromise, docsPromise]);

          let chars = 1500 + issueNotesChars;
          if (ctx?.guidingBrief?.content) chars += ctx.guidingBrief.content.length;
          if (ctx?.projectBrief) chars += ctx.projectBrief.replace(/<[^>]+>/g, '').length;
          chars += docs.reduce((acc, r) => acc + (r.content_text?.length ?? 0), 0);

          return [type.id, Math.min(100, Math.round(chars / 200000 * 100))];
        } catch {
          return [type.id, null];
        }
      })
    );
    cardContextPct = Object.fromEntries(results);
  }

  async function handleExportToWord() {
    const html = draftEditor?.getHTML();
    if (!html) return;
    const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId);
    const filename = buildExportFilename(project, activeType?.name ?? 'Document');
    const { templatePath, styles } = getExportConfigForSlug(activeType?.slug ?? '');
    console.log('[Export] slug:', activeType?.slug, '| template:', templatePath, '| styles:', styles);
    console.log('[Export] HTML preview:', html.slice(0, 500));
    exportingWord = true;
    try {
      await exportHtmlToWord(html, filename, templatePath, styles);
    } finally {
      exportingWord = false;
    }
  }

  // Save blank-document content to the project's Planning Deliverables list
  let savingToDeliverables = false;

  function guessDeliverableName(html) {
    const match = html.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
    const heading = match ? match[1].replace(/<[^>]+>/g, '').trim() : '';
    return heading || `Custom Document - ${new Date().toLocaleDateString('en-GB')}`;
  }

  async function handleSaveToDeliverables() {
    const html = draftEditor?.getHTML() ?? $draftEditorHtml;
    if (!html?.replace(/<[^>]+>/g, '').trim()) {
      alert('Nothing to save yet, write some content first.');
      return;
    }

    savingToDeliverables = true;
    try {
      if (openCustomDeliverableId) {
        await updateDeliverableFromHTML(openCustomDeliverableId, html);
      } else {
        const name = prompt('Name this document:', guessDeliverableName(html));
        if (!name?.trim()) { savingToDeliverables = false; return; }
        const { deliverable } = await createCustomDeliverable(project.id, name.trim(), html);
        openCustomDeliverableId = deliverable.id;
      }
      await loadDeliverables();
      alert('Saved to Planning Deliverables.');
    } catch (err) {
      console.error('Failed to save to deliverables:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      savingToDeliverables = false;
    }
  }

  // Auto-save
  let autoSaveTimer = null;

  function onDraftChange(e) {
    if (e?.detail?.html !== undefined) $draftEditorHtml = e.detail.html;
    $draftSaved = false;
    if ($activeDraftTypeId === 'blank') return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(handleSaveDraft, 2000);
  }

  async function closeDraftWithSave() {
    clearTimeout(autoSaveTimer);
    if (!$draftSaved && $activeDraftTypeId && $activeDraftTypeId !== 'blank') {
      await handleSaveDraft();
    }
    closeDraft();
  }

  // Regenerate confirmation modal
  let regenPending = null; // { typeId, opts } | null

  function requestGenerate(typeId, opts, hasDraft) {
    if (hasDraft) {
      regenPending = { typeId, opts };
    } else {
      handleGenerate(typeId, opts);
    }
  }

  function confirmRegen() {
    if (!regenPending) return;
    handleGenerate(regenPending.typeId, regenPending.opts);
    regenPending = null;
  }

  let checkPanelOpen = false;
  let createPanelOpen = false;
  // A highlight's compose popup: { paragraphIds, quotedText, top, left } | null
  let selectionPopup = null;
  // A quick AI edit awaiting Accept/Edit Again. Written straight into the
  // draft (marked with a pending CSS class so it renders in a different
  // color) rather than shown in a side panel/diff view:
  // { paragraphIds, quotedText, top, left, originalHtml, loading, error } | null
  let pendingAiEdit = null;

  $: activeType = $draftTypes.find(t => t.id === $activeDraftTypeId);

  $: if (!$activeDraftTypeId) { checkPanelOpen = false; createPanelOpen = false; closeSelectionPopup(); cancelPendingAiEdit(); commentsPanelOpen = false; lastOpenedDraftId = null; }
  $: if (!checkPanelOpen) draftEditor?.clearHighlight();

  // Default the right panel to Check whenever a (different) draft is opened —
  // but only once per opening, so closing Check manually afterward sticks
  // instead of being forced back open on the next reactive tick.
  let lastOpenedDraftId = null;
  $: if ($activeDraftTypeId && $activeDraftTypeId !== 'blank' && $activeDraftTypeId !== lastOpenedDraftId) {
    lastOpenedDraftId = $activeDraftTypeId;
    checkPanelOpen = true;
    commentsPanelOpen = false;
    createPanelOpen = false;
  }

  function handleTextSelected(e) {
    selectionPopup = { ...e.detail, isWholeDocument: false };
  }

  function closeSelectionPopup() {
    selectionPopup = null;
    draftEditor?.clearSelectionHighlight();
  }

  function handleSelectionCommented() {
    selectionPopup = null;
    draftEditor?.clearSelectionHighlight();
    loadDraftComments();
  }

  // A blank/custom document has no appeal- or PA-draft-type row behind it
  // (drafts/:typeId/incorporate expects a real numeric draft_type_id), so it
  // can't go through quickIncorporateApi. It's saved into the same
  // planning_deliverables.planning_deliverables table the generic Planning
  // Deliverables page uses instead — autosave it there the first time an AI
  // edit is requested (same as clicking Save) so it has a real id to target.
  async function ensureBlankDeliverableId(html) {
    if (openCustomDeliverableId) return openCustomDeliverableId;
    const { deliverable } = await createCustomDeliverable(project.id, guessDeliverableName(html), html || '<p></p>');
    openCustomDeliverableId = deliverable.id;
    loadDeliverables();
    return deliverable.id;
  }

  // Shared by both AI-edit entry points: a highlight's compose popup
  // (handleSendToAi) and the "apply to whole document" box in the Create
  // panel (handleReviseAll). Writes the result straight into the draft,
  // pending-highlighted, for Accept/Edit Again — see pendingAiEdit above.
  async function sendAiEdit({ paragraphIds, quotedText, top, left, isWholeDocument, notes, file, documentText, documentTitle, docType }) {
    const originalHtml = draftEditor?.getHTML() ?? $draftEditorHtml;
    pendingAiEdit = { paragraphIds, quotedText, top, left, isWholeDocument, originalHtml, loading: true, error: null };

    try {
      const allParagraphs = splitAllParagraphs(originalHtml);
      const targeted = allParagraphs.filter(p => paragraphIds.includes(p.id));
      // Without pointing at the exact highlighted text, the model only sees
      // "the paragraph" + a disconnected instruction and has no anchor for
      // what to actually change — it tends to just restate the paragraph.
      const notesForApi = [
        !isWholeDocument && quotedText?.trim() ? `The user highlighted this exact text: "${quotedText.trim()}"` : null,
        notes?.trim() ? `Their instruction: ${notes.trim()}` : null,
      ].filter(Boolean).join('\n\n') || null;
      const requestOpts = {
        file: file ?? null,
        documentText: documentText ?? '',
        documentTitle: documentTitle ?? null,
        paragraphs: targeted,
        userNotes: notesForApi,
        docType: docType ?? null,
      };
      const result = $activeDraftTypeId === 'blank'
        ? await incorporateDeliverableTargeted(await ensureBlankDeliverableId(originalHtml), requestOpts)
        : await quickIncorporateApi(project.id, apiDraftTypeId, requestOpts);
      const oldHtmlById = Object.fromEntries(allParagraphs.map(p => [p.id, p.html]));
      const taggedUpdates = (result.updated ?? []).map(p => {
        const oldHtml = oldHtmlById[p.id];
        // A brand-new inserted paragraph has no prior version to diff against
        // — mark the whole thing pending instead of a word-level diff.
        const html = oldHtml ? markChangedWordsPending(oldHtml, p.html) : markFragmentPending(p.html);
        return { id: p.id, html };
      });
      const mergedHtml = mergeParagraphUpdates(allParagraphs, taggedUpdates);
      $draftEditorHtml = mergedHtml;
      draftEditor?.setHTML(mergedHtml);
      $draftSaved = false;
      pendingAiEdit = { ...pendingAiEdit, loading: false };
    } catch (err) {
      pendingAiEdit = { ...pendingAiEdit, loading: false, error: err.message };
    }
  }

  async function handleSendToAi(e) {
    if (!selectionPopup) return;
    const { paragraphIds, quotedText, top, left, isWholeDocument } = selectionPopup;
    const { notes, file, documentText, documentTitle, docType } = e.detail;
    selectionPopup = null;
    // The highlight box was only ever meant to mark the live selection while
    // the compose popup was open — once we're writing the AI's result back
    // into the document (in a different color of its own), it needs to go,
    // or the two visibly overlap and the stale box doesn't track scrolling.
    draftEditor?.clearSelectionHighlight();
    await sendAiEdit({ paragraphIds, quotedText, top, left, isWholeDocument, notes, file, documentText, documentTitle, docType });
  }

  async function handleReviseAll(e) {
    if (pendingAiEdit) return;
    const notes = e.detail?.notes?.trim();
    if (!notes) return;
    const html = draftEditor?.getHTML() ?? $draftEditorHtml;
    const allParagraphs = splitAllParagraphs(html);
    if (!allParagraphs.length) {
      alert('Nothing to revise yet — write or generate some content first.');
      return;
    }
    createPanelOpen = false;
    await sendAiEdit({
      paragraphIds: allParagraphs.map(p => p.id),
      quotedText: '(Applies to the whole document)',
      top: 24,
      left: typeof window !== 'undefined' ? window.innerWidth / 2 : 600,
      isWholeDocument: true,
      notes,
      file: null,
      documentText: '',
      documentTitle: null,
      docType: null,
    });
  }

  function acceptPendingAiEdit() {
    if (!pendingAiEdit) return;
    const cleared = clearPendingMarkers($draftEditorHtml);
    $draftEditorHtml = cleared;
    draftEditor?.setHTML(cleared);
    pendingAiEdit = null;
    draftEditor?.clearSelectionHighlight();
  }

  function editPendingAiEditAgain() {
    if (!pendingAiEdit) return;
    const { paragraphIds, quotedText, top, left, originalHtml, isWholeDocument } = pendingAiEdit;
    $draftEditorHtml = originalHtml;
    draftEditor?.setHTML(originalHtml);
    pendingAiEdit = null;
    draftEditor?.clearSelectionHighlight();
    selectionPopup = { paragraphIds, quotedText, top, left, isWholeDocument };
  }

  function cancelPendingAiEdit() {
    if (!pendingAiEdit) return;
    $draftEditorHtml = pendingAiEdit.originalHtml;
    draftEditor?.setHTML(pendingAiEdit.originalHtml);
    pendingAiEdit = null;
    draftEditor?.clearSelectionHighlight();
  }

  $: quickIncorporateApi = activeType?.tool === 'appeal' ? appealIncorporateTargeted : paIncorporateTargeted;

  const AI_POPOVER_WIDTH = 320;
  $: aiPopoverLeft = pendingAiEdit
    ? Math.min(Math.max(pendingAiEdit.left - AI_POPOVER_WIDTH / 2, 16), (typeof window !== 'undefined' ? window.innerWidth : 1200) - AI_POPOVER_WIDTH - 16)
    : 0;
  // Guess at the popover's height before it's measured (see bind:clientHeight
  // on .ai-edit-control) so it doesn't visibly jump on the first frame.
  let aiPopoverHeight = 110;
  // Opens below the selection as usual, but when there isn't room below (a
  // highlight near the end of a long draft), just vertically center it in the
  // viewport instead — pinning it just above the selection tended to push it
  // up near the top of the screen, far from where the user was looking.
  $: aiPopoverTop = (() => {
    if (!pendingAiEdit) return 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const margin = 16;
    if (pendingAiEdit.top + 8 + aiPopoverHeight <= vh - margin) return pendingAiEdit.top + 8;
    return Math.max((vh - aiPopoverHeight) / 2, margin);
  })();

  // ── Draft paragraph comments (sticky notes) ───────────────────────────────
  let draftComments = [];
  let commentsPanelOpen = false;
  $: draftKind = activeType?.tool === 'appeal' ? 'appeal' : 'planning_application';
  // Appeal drafts carry a prefixed frontend-only id ("appeal_8") to disambiguate
  // them from planning-application ids in the same $draftTypes list — every
  // backend call needs the raw numeric id underneath instead.
  $: apiDraftTypeId = activeType?.tool === 'appeal' && $activeDraftTypeId
    ? parseInt($activeDraftTypeId.replace('appeal_', ''), 10)
    : $activeDraftTypeId;
  $: if ($activeDraftTypeId && $activeDraftTypeId !== 'blank') { loadDraftComments(); } else { draftComments = []; }

  async function loadDraftComments() {
    try {
      draftComments = await getDraftComments(project.id, draftKind, apiDraftTypeId);
    } catch (err) {
      console.error('Failed to load draft comments:', err);
    }
  }

  async function toggleCommentResolved(comment) {
    try {
      await updateDraftComment(comment.id, { resolved: !comment.resolved });
      await loadDraftComments();
    } catch (err) {
      console.error('Failed to update comment:', err);
    }
  }

  async function removeDraftComment(comment) {
    try {
      await deleteDraftComment(comment.id);
      await loadDraftComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  }

  // ── Batch "send comments to AI" review ────────────────────────────────────
  // Sends several comments to the AI one after another (not in parallel —
  // each edit rewrites the whole draft HTML and re-derives paragraph ids, so
  // the next comment in the queue must resolve against the post-edit
  // document). Every result is written straight into the draft, pending-
  // highlighted like a single quick edit, but nothing is finalised until the
  // user reviews and accepts/rejects each one here — batching only removes
  // the wait between edits, not the review step.
  // { items: [{ commentId, paragraphId, quotedText, notes, documentText, documentTitle, docType, status, originalHtml, error }], running } | null
  let batchReview = null;

  async function handleSendCommentsBatch(comments) {
    if (!comments?.length || batchReview) return;
    batchReview = {
      items: comments.map(c => ({
        commentId: c.id,
        paragraphId: c.paragraph_id,
        quotedText: c.quoted_text,
        notes: c.body,
        // A document attached while composing the comment (see SelectionPopup's
        // handleComment) — without this, a comment sent later in a batch would
        // have nothing but the note text to work from, even if a specialist
        // report was pasted/uploaded when it was written.
        documentText: c.document_text ?? '',
        documentTitle: c.document_title ?? null,
        docType: c.doc_type ?? null,
        status: 'queued',
        originalHtml: null,
        error: null,
      })),
      running: true,
    };

    for (const item of batchReview.items) {
      item.status = 'processing';
      batchReview = { ...batchReview, items: [...batchReview.items] };
      try {
        const allParagraphs = splitAllParagraphs($draftEditorHtml);
        const target = allParagraphs.find(p => p.id === item.paragraphId);
        if (!target) throw new Error("Can't find this passage anymore — it may have moved or been removed.");
        item.originalHtml = target.html;
        const notesForApi = [
          item.quotedText?.trim() ? `The user highlighted this exact text: "${item.quotedText.trim()}"` : null,
          item.notes?.trim() ? `Their instruction: ${item.notes.trim()}` : null,
        ].filter(Boolean).join('\n\n') || null;
        const result = await quickIncorporateApi(project.id, apiDraftTypeId, {
          file: null,
          documentText: item.documentText,
          documentTitle: item.documentTitle,
          paragraphs: [target],
          userNotes: notesForApi,
          docType: item.docType,
        });
        const updatedP = (result.updated ?? []).find(p => p.id === item.paragraphId) ?? result.updated?.[0];
        if (!updatedP) throw new Error('No update returned.');
        const taggedHtml = markChangedWordsPending(target.html, updatedP.html);
        const mergedHtml = mergeParagraphUpdates(allParagraphs, [{ id: item.paragraphId, html: taggedHtml }]);
        $draftEditorHtml = mergedHtml;
        draftEditor?.setHTML(mergedHtml);
        $draftSaved = false;
        item.status = 'done';
      } catch (err) {
        item.status = 'error';
        item.error = err.message;
      }
      batchReview = { ...batchReview, items: [...batchReview.items] };
    }
    batchReview = { ...batchReview, running: false };
  }

  function removeBatchItem(item) {
    if (!batchReview) return;
    const items = batchReview.items.filter(i => i !== item);
    batchReview = items.length ? { ...batchReview, items } : null;
  }

  function acceptBatchItem(item) {
    const allParagraphs = splitAllParagraphs($draftEditorHtml);
    const target = allParagraphs.find(p => p.id === item.paragraphId);
    if (target) {
      const mergedHtml = mergeParagraphUpdates(allParagraphs, [{ id: item.paragraphId, html: clearPendingMarkers(target.html) }]);
      $draftEditorHtml = mergedHtml;
      draftEditor?.setHTML(mergedHtml);
    }
    updateDraftComment(item.commentId, { resolved: true }).then(loadDraftComments).catch(err => console.error('Failed to resolve comment:', err));
    removeBatchItem(item);
  }

  function rejectBatchItem(item) {
    if (item.originalHtml != null) {
      const allParagraphs = splitAllParagraphs($draftEditorHtml);
      const mergedHtml = mergeParagraphUpdates(allParagraphs, [{ id: item.paragraphId, html: item.originalHtml }]);
      $draftEditorHtml = mergedHtml;
      draftEditor?.setHTML(mergedHtml);
    }
    removeBatchItem(item);
  }

  function acceptAllBatch() {
    for (const item of (batchReview?.items ?? []).filter(i => i.status === 'done')) acceptBatchItem(item);
  }

  function rejectAllBatch() {
    for (const item of (batchReview?.items ?? []).filter(i => i.status === 'done')) rejectBatchItem(item);
  }

  function toggleCheckPanel() {
    if (checkPanelOpen) { checkPanelOpen = false; return; }
    commentsPanelOpen = false;
    createPanelOpen = false;
    checkPanelOpen = true;
  }

  function toggleCreatePanel() {
    if (createPanelOpen) { createPanelOpen = false; return; }
    commentsPanelOpen = false;
    checkPanelOpen = false;
    createPanelOpen = true;
  }

  function handleCustomDraftGenerated(e) {
    const { html } = e.detail;
    $draftEditorHtml = html;
    draftEditor?.setHTML(html);
    $draftSaved = false;
  }
</script>

<div class="workspace">

  <!-- Header -->
  <div class="workspace-header">
    <div class="header-info">
      <h1>{project.project_name}</h1>
      {#if project.project_id}<span class="project-ref">{project.project_id}</span>{/if}
    </div>
  </div>

  <!-- Tabs — Planning Issues hidden for now, not needed currently. Draft
       Document stays the only tab, so the bar itself is hidden too. -->

  <!-- Body -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading...</span>
    </div>

  {:else if loadError}
    <div class="error-state">
      <i class="las la-exclamation-circle"></i>
      <p>{loadError}</p>
      <button on:click={load}>Retry</button>
    </div>

  {:else if activeTab === 'draft'}
    <!-- ── Tab 3: Draft Document ── -->
    {#if $activeDraftTypeId !== null}
      <!-- Two-panel editor view -->
      {@const activeType = $draftTypes.find(t => t.id === $activeDraftTypeId)}
      <div class="draft-editor-bar">
        <button class="reset-btn" on:click={closeDraftWithSave}><i class="las la-arrow-left"></i> Documents</button>
        <span class="draft-editor-title">{activeType?.name ?? 'Blank Document'}</span>
        <div class="draft-editor-actions">
          {#if $activeDraftTypeId !== 'blank'}
          <button class="draft-regen-btn" disabled={$draftGenerating === $activeDraftTypeId} on:click={() => requestGenerate($activeDraftTypeId, undefined, true)}>
            {#if $draftGenerating === $activeDraftTypeId}<div class="mini-spinner"></div> Generating...{:else}<i class="las la-sync"></i> Regenerate{/if}
          </button>
          {/if}
          {#if $activeDraftTypeId !== 'blank'}
          <button class="draft-save-btn" disabled={$draftSaving} on:click={handleSaveDraft}>
            {#if $draftSaving}Saving...{:else if $draftSaved}<i class="las la-check"></i> Saved{:else}Save{/if}
          </button>
          {/if}
          {#if $activeDraftTypeId === 'blank'}
          <button class="draft-save-btn" disabled={savingToDeliverables} on:click={handleSaveToDeliverables}>
            {#if savingToDeliverables}<div class="mini-spinner"></div> Saving...{:else}<i class="las la-save"></i> Save{/if}
          </button>
          {/if}
          <button class="draft-save-btn" disabled={exportingWord} on:click={handleExportToWord}>
            {#if exportingWord}<div class="mini-spinner"></div> Exporting...{:else}<i class="las la-file-word"></i> Export{/if}
          </button>
        </div>
      </div>

      <!-- Two-panel layout -->
      <div class="draft-two-panel">
        <div class="draft-left-panel">
          <RichTextEditor
            bind:this={draftEditor}
            content={$draftEditorHtml}
            enableSelectionPopup={activeType?.tool !== 'stage1' && activeType?.tool !== 'hlpv'}
            highlightBracketPlaceholders
            on:change={onDraftChange}
            on:textselected={handleTextSelected}
          />
        </div>
        <div class="draft-right-panel">
        <div class="draft-right-card">
          <div class="draft-right-panel-header">
            <button class="draft-context-btn" class:active={createPanelOpen} on:click={toggleCreatePanel} title="Create a document from a custom prompt">
              <i class="las la-magic"></i> Create
            </button>
            <button class="draft-context-btn" class:active={checkPanelOpen} on:click={toggleCheckPanel} title="Check the draft against the guiding brief, project information, and grammar">
              <i class="las la-clipboard-check"></i> Check
            </button>
            {#if $activeDraftTypeId !== 'blank'}
              <button class="draft-context-btn" class:active={commentsPanelOpen} on:click={() => { commentsPanelOpen = !commentsPanelOpen; if (commentsPanelOpen) { checkPanelOpen = false; createPanelOpen = false; } }} title="Comments left on this draft">
                <i class="las la-comment-alt"></i> Comments
                {#if draftComments.filter(c => !c.resolved).length > 0}<span class="comments-badge">{draftComments.filter(c => !c.resolved).length}</span>{/if}
              </button>
            {/if}
          </div>
          <div class="draft-right-panel-body">
            {#if batchReview}
              <div class="batch-review-panel">
                <div class="batch-review-header">
                  <span class="batch-review-title">
                    <i class="las la-magic"></i>
                    {#if batchReview.running}Sending to AI…{:else}Review AI edits{/if}
                    ({batchReview.items.filter(i => i.status === 'done' || i.status === 'error').length}/{batchReview.items.length})
                  </span>
                  {#if !batchReview.running && batchReview.items.some(i => i.status === 'done')}
                    <div class="batch-review-actions">
                      <button class="btn btn-secondary btn-sm" on:click={rejectAllBatch}>Reject All</button>
                      <button class="btn btn-primary btn-sm" on:click={acceptAllBatch}>Accept All</button>
                    </div>
                  {/if}
                </div>
                <div class="batch-review-list">
                  {#each batchReview.items as item (item.commentId)}
                    <div class="batch-review-item">
                      <button class="comment-quote-btn" on:click={() => draftEditor?.highlightText(item.quotedText)} title="Find this passage in the draft">
                        <i class="las la-quote-left"></i> {item.quotedText}
                      </button>
                      {#if item.status === 'queued' || item.status === 'processing'}
                        <div class="ai-edit-status"><div class="mini-spinner"></div> {item.status === 'processing' ? 'Writing...' : 'Queued'}</div>
                      {:else if item.status === 'error'}
                        <p class="ai-edit-error">{item.error}</p>
                        <div class="batch-review-item-actions">
                          <button class="btn btn-secondary btn-sm" on:click={() => removeBatchItem(item)}>Dismiss</button>
                        </div>
                      {:else}
                        <div class="batch-review-item-actions">
                          <button class="btn btn-secondary btn-sm" on:click={() => rejectBatchItem(item)}>Reject</button>
                          <button class="btn btn-primary btn-sm" on:click={() => acceptBatchItem(item)}>Accept</button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {:else if createPanelOpen}
              <DraftCreatePanel
                getDraftHtml={() => draftEditor?.getHTML() ?? $draftEditorHtml}
                on:generated={handleCustomDraftGenerated}
                on:reviseall={handleReviseAll}
                on:close={() => createPanelOpen = false}
              />
            {:else if checkPanelOpen}
              <DraftCheckPanel
                {project}
                docTypeSlug={activeType?.slug ?? 'planning_statement'}
                developmentType={developmentType || null}
                getDraftHtml={() => draftEditor?.getHTML() ?? $draftEditorHtml}
                locateText={(text) => draftEditor?.highlightText(text) ?? false}
                on:close={() => checkPanelOpen = false}
              />
            {:else if commentsPanelOpen}
              <DraftCommentsList
                comments={draftComments}
                on:resolve={(e) => toggleCommentResolved(e.detail)}
                on:delete={(e) => removeDraftComment(e.detail)}
                on:locate={(e) => draftEditor?.highlightText(e.detail.quotedText)}
                on:sendbatch={(e) => handleSendCommentsBatch(e.detail)}
                on:close={() => commentsPanelOpen = false}
              />
            {/if}
          </div>
        </div>
        </div>
      </div>

      {#if selectionPopup}
        <SelectionPopup
          {project}
          {draftKind}
          draftTypeId={apiDraftTypeId}
          paragraphIds={selectionPopup.paragraphIds}
          quotedText={selectionPopup.quotedText}
          top={selectionPopup.top}
          left={selectionPopup.left}
          defaultDocType={activeType?.slug === 'planning_statement_v3' ? 'specialist_report' : null}
          on:commented={handleSelectionCommented}
          on:sendtoai={handleSendToAi}
          on:close={closeSelectionPopup}
        />
      {/if}

      {#if pendingAiEdit}
        <div class="ai-edit-control" bind:clientHeight={aiPopoverHeight} style="top:{aiPopoverTop}px; left:{aiPopoverLeft}px; width:{AI_POPOVER_WIDTH}px;">
          {#if pendingAiEdit.loading}
            <div class="ai-edit-status"><div class="mini-spinner"></div> Writing...</div>
          {:else if pendingAiEdit.error}
            <p class="ai-edit-error">{pendingAiEdit.error}</p>
            <div class="ai-edit-actions">
              <button class="btn btn-secondary" on:click={cancelPendingAiEdit}>Dismiss</button>
            </div>
          {:else}
            <span class="ai-edit-label"><i class="las la-magic"></i> AI-written — not yet reviewed</span>
            <div class="ai-edit-actions">
              <button class="btn btn-secondary" on:click={editPendingAiEditAgain}>Edit Again</button>
              <button class="btn btn-primary" on:click={acceptPendingAiEdit}>Accept</button>
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <!-- Document type list -->
      <div class="tab-body">
        <div class="draft-types-list">

          <!-- ── Planning statement + other draft type cards ── -->
          {#each visibleDraftTypes as type (type.id)}
            {@const draft = $drafts[type.id]}
            {@const isExpanded = $cardExpandedTypeId === type.id}
            {@const typeSections = $cardSections[type.id] ?? []}
            {@const typeLoading = $cardSectionsLoading[type.id] ?? false}
            <div class="card draft-type-card">
              <div class="draft-type-main">
                <div class="draft-type-info">
                  <span class="draft-type-name">{type.name}<span class="beta-badge">BETA</span></span>
                  {#if draft?.generated_at}
                    <span class="draft-type-meta">Last generated {new Date(draft.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {/if}
                </div>
                <div class="draft-type-actions">
                  {#if draft}
                    <button class="draft-open-btn" on:click={() => openDraft(type.id)}>Open</button>
                  {/if}
                  <button class="draft-generate-btn" disabled={$draftGenerating === type.id} on:click={() => requestGenerate(type.id, { developmentType: appealCardDevTypes[type.id] || null, provider: draftProviderByType[type.id] || '' }, !!draft)}>
                    {#if $draftGenerating === type.id}
                      <div class="mini-spinner"></div> Generating...
                    {:else}
                      <i class="las la-magic"></i> {draft ? 'Regenerate' : 'Generate'}
                    {/if}
                  </button>
                  {#if type.tool === 'appeal'}
                    <button class="draft-setting-btn" title="Upload starting documents for this draft" on:click={() => startingDocsType = { id: type.id, slug: type.slug, name: type.name }}>
                      <i class="las la-file-import"></i> Starting docs
                    </button>
                    {#if DRAFTING_ISSUES_SLUGS.includes(type.slug)}
                      <button class="draft-setting-btn" title="View / edit the drafting issues this draft is generated from" on:click={() => draftingIssuesType = { id: type.id, slug: type.slug, name: type.name }}>
                        <i class="las la-list-alt"></i> Issues
                      </button>
                    {/if}
                  {:else if type.tool === 'stage1'}
                    <button class="draft-setting-btn" title="Upload starting documents for this draft" on:click={() => startingDocsType = { id: type.id, slug: type.slug, name: type.name, tool: type.tool }}>
                      <i class="las la-file-import"></i> Starting docs
                    </button>
                    {#if DRAFTING_ISSUES_SLUGS.includes(type.slug)}
                      <button class="draft-setting-btn" title="View / edit the drafting issues feeding this draft" on:click={() => draftingIssuesType = { id: type.id, slug: type.slug, name: type.name }}>
                        <i class="las la-list-alt"></i> Issues
                      </button>
                    {/if}
                  {:else if type.tool === 'hlpv'}
                    <button class="draft-setting-btn" title="Upload starting documents for this draft" on:click={() => startingDocsType = { id: type.id, slug: type.slug, name: type.name }}>
                      <i class="las la-file-import"></i> Starting docs
                    </button>
                    {#if DRAFTING_ISSUES_SLUGS.includes(type.slug)}
                      <button class="draft-setting-btn" title="View / edit the drafting issues feeding this draft" on:click={() => draftingIssuesType = { id: type.id, slug: type.slug, name: type.name }}>
                        <i class="las la-list-alt"></i> Issues
                      </button>
                    {/if}
                  {/if}

                  <!-- Config — everything else (LLM choice, dev type, version, Meeting
                       Guide, the generation prompt itself) tucked behind one toggle so
                       the card's primary actions above aren't crowded out. -->
                  <div class="draft-config-group" use:clickOutside={() => { if (configOpenTypeId === type.id) configOpenTypeId = null; }}>
                    <button class="draft-config-btn" on:click={(e) => toggleConfig(e, type.id)}>
                      <i class="las la-cog"></i> Config <i class="las la-angle-down"></i>
                    </button>
                    {#if configOpenTypeId === type.id}
                      <div class="draft-config-dropdown" style={configDropdownStyle}>
                        {#if type.slug === 'hlpv_narrative'}
                          <div class="draft-config-row">
                            <span class="draft-config-label">Dev type</span>
                            <select
                              class="card-dev-type-select"
                              value={appealCardDevTypes[type.id] ?? ''}
                              on:change={(e) => { appealCardDevTypes[type.id] = e.target.value; appealCardDevTypes = appealCardDevTypes; }}
                              title="Development type, selects which guiding brief to use"
                            >
                              <option value="">Dev type...</option>
                              {#each DEV_TYPES as dt}
                                <option value={dt}>{dt}</option>
                              {/each}
                            </select>
                          </div>
                        {/if}
                        <div class="draft-config-row">
                          <span class="draft-config-label">AI Model</span>
                          <select class="card-dev-type-select" bind:value={draftProviderByType[type.id]} title="AI model used to generate this draft - Default uses the AI Providers admin setting">
                            <option value="">Default</option>
                            <option value="anthropic">Claude</option>
                            <option value="openai">GPT-5.6</option>
                          </select>
                        </div>
                        {#if (type.tool === 'appeal' || type.tool === 'stage1' || type.tool === 'hlpv') && DRAFTING_ISSUES_SLUGS.includes(type.slug)}
                          <button class="draft-config-item" on:click={() => { configOpenTypeId = null; openMeetingGuide({ id: type.id, slug: type.slug, name: type.name }); }}>
                            <i class="las la-clipboard-list"></i> Meeting Guide
                          </button>
                        {/if}
                        {#if type.tool === 'appeal'}
                          <button class="draft-config-item" on:click={() => { configOpenTypeId = null; openAppealPrompt(type.id); }}>
                            <i class="las la-sliders-h"></i> Edit Prompt
                          </button>
                        {:else if type.tool === 'stage1' || type.tool === 'hlpv'}
                          <button class="draft-config-item" on:click={() => { configOpenTypeId = null; openActionPrompt(type.slug); }}>
                            <i class="las la-sliders-h"></i> Edit Prompt
                          </button>
                        {:else}
                          <button class="draft-config-item" on:click={() => { configOpenTypeId = null; openSectionsModal(type.id); }}>
                            <i class="las la-sliders-h"></i> Edit Section Prompts
                          </button>
                        {/if}
                        {#if type.slug === 'planning_statement_v3' && legacyPlanningStatementTypes.length}
                          <div class="draft-config-row">
                            <span class="draft-config-label">Version</span>
                            <select class="card-dev-type-select" bind:value={visibleLegacyPlanningStatementSlug} title="Show an older Planning Statement version as its own card">
                              <option value="">v3 only</option>
                              {#each legacyPlanningStatementTypes as t (t.id)}
                                <option value={t.slug}>{LEGACY_PLANNING_STATEMENT_LABELS[t.slug] ?? t.name}</option>
                              {/each}
                            </select>
                          </div>
                        {:else if type.slug === 'stage1_review_v3' && legacyStage1Types.length}
                          <div class="draft-config-row">
                            <span class="draft-config-label">Version</span>
                            <select class="card-dev-type-select" bind:value={visibleLegacyStage1Slug} title="Show an older Stage 1 Review version as its own card">
                              <option value="">v3 only</option>
                              {#each legacyStage1Types as t (t.id)}
                                <option value={t.slug}>{LEGACY_STAGE1_LABELS[t.slug] ?? t.name}</option>
                              {/each}
                            </select>
                          </div>
                        {:else if type.slug === 'hlpv_v3' && legacyHlpvTypes.length}
                          <div class="draft-config-row">
                            <span class="draft-config-label">Version</span>
                            <select class="card-dev-type-select" bind:value={visibleLegacyHlpvSlug} title="Show an older HLPV version as its own card">
                              <option value="">v3 only</option>
                              {#each legacyHlpvTypes as t (t.id)}
                                <option value={t.slug}>{LEGACY_HLPV_LABELS[t.slug] ?? t.name}</option>
                              {/each}
                            </select>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Context bar -->
              {#if cardContextPct[type.id] != null}
                {@const pct = cardContextPct[type.id]}
                {@const colour = pct >= 75 ? '#dc2626' : pct >= 50 ? '#d97706' : '#16a34a'}
                <div class="card-context-bar" title="~{pct}% of context window used (prompt + guiding brief + project brief + documents)">
                  <span class="card-context-label">~{pct}% context</span>
                  <div class="card-context-track">
                    <div class="card-context-fill" style="width:{pct}%; background:{colour}"></div>
                  </div>
                </div>
              {/if}


              <!-- Sections toggle row — hidden for appeal, stage1 and hlpv types (broad-prompt
                   generation), except v3, which carves Policy/Assessment out into their own
                   dedicated prompts -->
              {#if type.tool !== 'stage1' && type.tool !== 'hlpv' && (type.tool !== 'appeal' || type.slug === 'planning_statement_v3')}
              <button class="draft-sections-toggle" on:click={() => toggleCardExpand(type.id)}>
                <i class="las la-layer-group"></i>
                Sections
                <i class="las {isExpanded ? 'la-angle-up' : 'la-angle-down'} toggle-chevron"></i>
              </button>

              {#if isExpanded}
                <div class="draft-inline-sections">
                  {#if typeLoading}
                    <div class="draft-inline-loading"><div class="mini-spinner"></div><span>Loading...</span></div>
                  {:else if typeSections.length === 0}
                    <p class="draft-inline-empty">No sections yet. <button class="inline-link" on:click={() => openSectionsModal(type.id)}>Add one</button></p>
                  {:else}
                    {#each typeSections as section (section.id)}
                      <div class="draft-inline-section">
                        <span class="draft-inline-section-name">{section.name}</span>
                        <div class="draft-inline-section-actions">
                          <button
                            class="section-generate-btn"
                            disabled={$sectionGenerating === section.id}
                            title="Generate entire section"
                            on:click={() => handleGenerateSection(section.id, type.id, draftProviderByType[type.id] || '')}
                          >
                            {#if $sectionGenerating === section.id}<div class="mini-spinner"></div>{:else}<i class="las la-magic"></i>{/if}
                          </button>
                        </div>
                      </div>
                      {#if type.tool !== 'appeal' && section.slug === 'planning_assessment' && $assessmentIssues.length > 0}
                        <div class="assessment-issues-list">
                          {#if $assessmentIssuesLoading}
                            <div class="draft-inline-loading"><div class="mini-spinner"></div><span>Loading issues...</span></div>
                          {:else}
                            {#each $assessmentIssues as issue (issue.id)}
                              <div class="assessment-issue-row">
                                <span class="assessment-issue-label">{issue.label}{issue.discipline ? `, ${issue.discipline}` : ''}</span>
                                <button
                                  class="issue-generate-btn"
                                  disabled={$issueGenerating === issue.id}
                                  title="Regenerate this issue only"
                                  on:click={() => handleGenerateAssessmentIssue(type.id, section.id, issue.id, issue.label)}
                                >
                                  {#if $issueGenerating === issue.id}<div class="mini-spinner"></div>{:else}<i class="las la-magic"></i>{/if}
                                </button>
                              </div>
                            {/each}
                          {/if}
                        </div>
                      {/if}
                    {/each}
                  {/if}
                  <button class="draft-setting-btn draft-configure-btn" on:click={() => openSectionsModal(type.id)}>
                    <i class="las la-cog"></i> Configure sections
                  </button>
                </div>
              {/if}
              {/if}
            </div>
          {/each}

          <!-- ── Certificate B Notice — Coming Soon ── -->
          <div class="card draft-type-card draft-type-card--coming-soon">
            <div class="draft-type-main">
              <div class="draft-type-info">
                <span class="draft-type-name">Certificate B Notice <span class="coming-soon-badge">Coming Soon</span></span>
                <span class="draft-type-desc">Article 13 DMPO 2015 ownership certificate, merged from project data.</span>
              </div>
            </div>
          </div>

          <!-- ── Cover Letter — Coming Soon ── -->
          <div class="card draft-type-card draft-type-card--coming-soon">
            <div class="draft-type-main">
              <div class="draft-type-info">
                <span class="draft-type-name">Cover Letter <span class="coming-soon-badge">Coming Soon</span></span>
                <span class="draft-type-desc">Covering letter for submission, merged from project data.</span>
              </div>
            </div>
          </div>

          <!-- ── Site Justification — Coming Soon ── -->
          <div class="card draft-type-card draft-type-card--coming-soon">
            <div class="draft-type-main">
              <div class="draft-type-info">
                <span class="draft-type-name">Site Justification <span class="coming-soon-badge">Coming Soon</span></span>
                <span class="draft-type-desc">LLM-generated site justification drawing on project data and planning context.</span>
              </div>
            </div>
          </div>

          <!-- ── Blank Document ── -->
          <div class="card draft-type-card">
            <div class="draft-type-main">
              <div class="draft-type-info">
                <span class="draft-type-name">Blank Document</span>
                <span class="draft-type-desc">Open an empty editor: paste in any document to use Check, Export, and Doc Chat.</span>
              </div>
              <div class="draft-type-actions">
                <button class="draft-open-btn" on:click={openBlankDoc}>Open</button>
              </div>
            </div>
          </div>

          <!-- ── Saved custom documents (from the blank editor's Save button) ── -->
          {#each customDeliverables as cd (cd.id)}
            <div class="card draft-type-card">
              <div class="draft-type-main">
                <div class="draft-type-info">
                  <span class="draft-type-name">{cd.deliverable_name}</span>
                  <span class="draft-type-desc">Custom document</span>
                  <span class="draft-type-meta">Last updated {new Date(cd.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div class="draft-type-actions">
                  <button class="draft-open-btn" on:click={() => openCustomDeliverable(cd)}>Open</button>
                  <button class="draft-setting-btn" title="Delete this document" on:click={() => handleDeleteCustomDeliverable(cd)}>
                    <i class="las la-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          {/each}

        </div>
      </div>
    {/if}

  {/if}

</div>

<!-- Draft arguments from briefing modal -->
{#if $briefingDraftOpen}
  <BriefingDraftModal {project} />
{/if}

<!-- Upload new briefing note modal -->
{#if $briefingUploadOpen}
  <BriefingUploadModal {project} />
{/if}

<!-- Draft key issue notes from briefing modal -->
{#if $keyIssueDraftOpen}
  <KeyIssueDraftModal />
{/if}

<!-- Save to log modal -->
{#if $logModalOpen}
  <DocumentLogEntryModal {project} />
{/if}

<!-- Edit log entry modal -->
{#if $editModalOpen}
  <DocumentLogEditModal />
{/if}

<!-- Sections manager modal -->
{#if $sectionsModalOpen}
  <DraftSectionsModal {draftProviderByType} />
{/if}

<!-- Section example sub-modal -->
{#if $sectionExampleModalOpen}
  <SectionExampleModal />
{/if}

<!-- Suggestion prompt modal -->
{#if $suggestPromptOpen}
  <SuggestPromptModal />
{/if}

<!-- Action prompt edit modals -->
<PromptEditModal
  open={$draftKeyState.open}
  title="Edit Prompt: Draft Issue Notes from Briefing"
  promptText={$draftKeyState.text}
  contextTemplate={$draftKeyState.contextTemplate}
  loading={$draftKeyState.loading}
  saving={$draftKeyState.saving}
  saved={$draftKeyState.saved}
  on:close={() => closeActionPrompt('draft_key_summaries')}
  on:change={(e) => setPromptText('draft_key_summaries', e.detail)}
  on:save={() => saveActionPromptStore('draft_key_summaries')}
  on:reset={() => resetActionPromptStore('draft_key_summaries')}
/>

<PromptEditModal
  open={$draftArgsState.open}
  title="Edit Prompt: Draft Arguments from Briefing"
  promptText={$draftArgsState.text}
  contextTemplate={$draftArgsState.contextTemplate}
  loading={$draftArgsState.loading}
  saving={$draftArgsState.saving}
  saved={$draftArgsState.saved}
  on:close={() => closeActionPrompt('draft_arguments_from_briefing')}
  on:change={(e) => setPromptText('draft_arguments_from_briefing', e.detail)}
  on:save={() => saveActionPromptStore('draft_arguments_from_briefing')}
  on:reset={() => resetActionPromptStore('draft_arguments_from_briefing')}
/>


<PromptEditModal
  open={$stage1PromptState.open}
  title="Edit Prompt: Generate Stage 1 Review"
  promptText={$stage1PromptState.text}
  contextTemplate={$stage1PromptState.contextTemplate}
  loading={$stage1PromptState.loading}
  saving={$stage1PromptState.saving}
  saved={$stage1PromptState.saved}
  on:close={() => closeActionPrompt('stage1_review')}
  on:change={(e) => setPromptText('stage1_review', e.detail)}
  on:save={() => saveActionPromptStore('stage1_review')}
  on:reset={() => resetActionPromptStore('stage1_review')}
/>

<PromptEditModal
  open={$stage1v2PromptState.open}
  title="Edit Prompt: Generate Stage 1 Review v2"
  promptText={$stage1v2PromptState.text}
  contextTemplate={$stage1v2PromptState.contextTemplate}
  loading={$stage1v2PromptState.loading}
  saving={$stage1v2PromptState.saving}
  saved={$stage1v2PromptState.saved}
  on:close={() => closeActionPrompt('stage1_review_v2')}
  on:change={(e) => setPromptText('stage1_review_v2', e.detail)}
  on:save={() => saveActionPromptStore('stage1_review_v2')}
  on:reset={() => resetActionPromptStore('stage1_review_v2')}
/>

<PromptEditModal
  open={$stage1v3PromptState.open}
  title="Edit Prompt: Generate Stage 1 Review v3"
  promptText={$stage1v3PromptState.text}
  contextTemplate={$stage1v3PromptState.contextTemplate}
  loading={$stage1v3PromptState.loading}
  saving={$stage1v3PromptState.saving}
  saved={$stage1v3PromptState.saved}
  on:close={() => closeActionPrompt('stage1_review_v3')}
  on:change={(e) => setPromptText('stage1_review_v3', e.detail)}
  on:save={() => saveActionPromptStore('stage1_review_v3')}
  on:reset={() => resetActionPromptStore('stage1_review_v3')}
/>

<PromptEditModal
  open={$hlpvV3PromptState.open}
  title="Edit Prompt: Generate High-Level Planning View v3"
  promptText={$hlpvV3PromptState.text}
  contextTemplate={$hlpvV3PromptState.contextTemplate}
  loading={$hlpvV3PromptState.loading}
  saving={$hlpvV3PromptState.saving}
  saved={$hlpvV3PromptState.saved}
  on:close={() => closeActionPrompt('hlpv_v3')}
  on:change={(e) => setPromptText('hlpv_v3', e.detail)}
  on:save={() => saveActionPromptStore('hlpv_v3')}
  on:reset={() => resetActionPromptStore('hlpv_v3')}
/>

{#if startingDocsType}
  <StartingDocsModal
    {project}
    typeId={startingDocsType.id}
    typeSlug={startingDocsType.slug}
    typeName={startingDocsType.name}
    tool={startingDocsType.tool ?? 'appeal'}
    on:close={() => { startingDocsType = null; loadCardContextPcts(); }}
  />
{/if}

{#if draftingIssuesType}
  <DraftingIssuesModal
    {project}
    on:close={() => draftingIssuesType = null}
  />
{/if}

<MeetingGuideModal
  show={!!meetingGuideType}
  {project}
  docTypeSlug={meetingGuideType?.slug ?? null}
  docTypeLabel={meetingGuideType?.name ?? null}
  issueTracks={meetingGuideIssues}
  onClose={() => { meetingGuideType = null; meetingGuideIssues = []; }}
/>

<!-- Regenerate confirmation modal -->
{#if regenPending}
  <RegenerateConfirmModal on:close={() => regenPending = null} on:confirm={confirmRegen} />
{/if}

<PromptEditModal
  open={$appealPromptOpen}
  title="Edit Generation Prompt: {appealPromptTitle}"
  promptText={$appealPromptText}
  contextTemplate={`↑ YOUR INSTRUCTIONS (editable above)\n━━━ Dynamic context injected automatically ━━━\nUse {{GUIDING_BRIEF}} anywhere above to embed the guiding brief inline.\nThe project brief and working argument notes by issue are always appended below your prompt.`}
  loading={$appealPromptLoading}
  saving={$appealPromptSaving}
  saved={$appealPromptSaved}
  on:close={closeAppealPrompt}
  on:change={(e) => { $appealPromptText = e.detail; }}
  on:save={saveAppealPrompt}
  on:reset={resetAppealPrompt}
/>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-slate-50);
  }

  .workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    gap: 1rem;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .header-info h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .project-ref {
    font-size: 0.8rem;
    color: var(--color-slate-400);
    background: var(--color-slate-100);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  /* Tabs */
  .tabs {
    display: flex;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    padding: 0 1.5rem;
    flex-shrink: 0;
  }

  .tab {
    padding: 0.75rem 1.25rem;
    border: none;
    background: transparent;
    color: var(--color-slate-500);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .tab.active { color: var(--color-primary-600); border-bottom-color: var(--color-primary-600); }
  .tab:hover:not(.active) { color: var(--color-slate-700); }

  /* Tab body */
  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  /* ── Argument Structure two-panel ── */
  .argument-body {
    display: grid;
    grid-template-columns: 3fr 2fr;
    align-items: start;
    padding: 1.5rem;
    gap: 1.5rem;
    min-height: 600px;
  }

  .argument-panel {
    padding: 0;
    background: transparent;
  }

  .input-panel {
    display: flex;
    flex-direction: column;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    overflow: hidden;
    position: sticky;
    top: 1.5rem;
  }

  .analyse-btn {
    padding: 0.625rem 1rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .analyse-btn:hover:not(:disabled) { background: var(--color-primary-700); }
  .analyse-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .idle-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }

  .form-label-hint {
    font-weight: 400;
    color: var(--color-slate-400);
  }

  .doc-type-select {
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    background: white;
    color: var(--color-slate-800);
  }

  .doc-type-select:focus { outline: none; border-color: var(--color-primary-600); }

  .direction-toggle {
    display: flex;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    overflow: hidden;
  }

  .direction-btn {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: none;
    background: white;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-slate-500);
    cursor: pointer;
    transition: all 0.15s;
  }

  .direction-btn:first-child { border-right: 1px solid var(--color-slate-200); }

  .direction-btn.active {
    background: var(--color-slate-800);
    color: white;
    font-weight: 600;
  }

  .user-notes-field {
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: white;
    resize: vertical;
    min-height: 80px;
    line-height: 1.5;
  }

  .user-notes-field:focus { outline: none; border-color: var(--color-primary-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07); }
  .user-notes-field::placeholder { color: var(--color-slate-400); }

  .issue-checks {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .issue-check-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    cursor: pointer;
  }

  .issue-check-label input[type="checkbox"] { cursor: pointer; accent-color: var(--color-primary-600); }

  .upload-zone.has-file { border-color: var(--color-primary-600); background: var(--color-blue-50); }
  .upload-zone.has-file i { color: var(--color-primary-600); }

  .analysis-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--color-slate-500);
    padding: 2rem;
  }

  .analysis-loading p { margin: 0; font-size: 0.875rem; }

  .analysis-error {
    margin: 0.75rem 1rem 0;
    font-size: 0.8125rem;
    color: var(--color-red-500);
  }

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .results-title { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.625rem;
    background: transparent;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.8rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
  }

  .reset-btn:hover { background: var(--color-slate-100); }

  .results-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .results-empty i { font-size: 2rem; color: var(--color-emerald-600); }
  .results-empty p { margin: 0; font-size: 0.875rem; }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem;
    overflow-y: auto;
  }

  .result-summary {
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 7px;
    padding: 0.875rem 1rem;
  }

  .result-summary p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.6;
  }

  .result-group { display: flex; flex-direction: column; gap: 0.625rem; }

  .result-group-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-slate-500);
  }

  .result-subgroup { display: flex; flex-direction: column; gap: 0.5rem; }

  .result-subgroup-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-slate-800);
    padding-top: 0.25rem;
  }

  .coverage-row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
  }

  .coverage-issue { font-size: 0.8rem; font-weight: 600; color: var(--color-slate-800); }
  .coverage-text  { font-size: 0.8rem; color: var(--color-slate-500); line-height: 1.4; }

  .result-card {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 7px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .result-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .result-field-tag {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .result-field-tag.against { background: var(--color-red-100); color: var(--color-red-800); }
  .result-field-tag.for     { background: var(--color-primary-100); color: var(--color-primary-700); }

  .result-point {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    line-height: 1.5;
  }

  .result-citation {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.375rem 0.5rem;
    background: var(--color-slate-50);
    border-radius: 4px;
    border-left: 2px solid var(--color-slate-200);
  }

  .result-citation-quote {
    font-size: 0.75rem;
    color: var(--color-slate-600);
    font-style: italic;
    line-height: 1.4;
  }

  .result-citation-ref {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-slate-400);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .result-actions { display: flex; gap: 0.4rem; }

  .result-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    background: white;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.15s;
  }

  .result-btn.accept { color: var(--color-emerald-600); }
  .result-btn.accept:hover { background: var(--color-slate-100); border-color: var(--color-slate-400); }
  .result-btn.dismiss { color: var(--color-slate-400); }
  .result-btn.dismiss:hover { background: var(--color-slate-50); border-color: var(--color-slate-300); }

  /* ── Argument Structure ── */
  .argument-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 800px;
  }

  .argument-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .argument-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .argument-title-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .argument-issue-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }

  .note-status {
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .note-status.saving { color: var(--color-slate-400); }
  .note-status.saved  { color: var(--color-emerald-600); }

  .note-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .note-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .note-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-500);
  }

  /* Loading / error / empty */
  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-slate-500);
  }

  .error-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--color-slate-500);
    padding: 2rem;
  }

  .error-state i { font-size: 2.5rem; color: var(--color-red-500); }

  .error-state button {
    padding: 0.5rem 1.25rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 2rem;
    color: var(--color-slate-400);
    text-align: center;
  }

  .empty-state i { font-size: 3rem; }
  .empty-state p { margin: 0; font-size: 0.9rem; max-width: 360px; }

  .spinner {
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-primary-600);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .mini-spinner {
    width: 0.75rem;
    height: 0.75rem;
    border: 1.5px solid var(--color-slate-300);
    border-top-color: var(--color-slate-400);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Draft Document tab ── */
  .draft-types-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
    gap: 0.75rem;
  }

  .draft-type-card {
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .draft-type-main {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .draft-type-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .draft-type-name { font-size: 0.9375rem; font-weight: 600; color: var(--color-slate-800); }
  .beta-badge { display: inline-block; margin-left: 6px; font-size: 0.65rem; font-weight: 700; color: var(--color-violet-600); background: var(--color-violet-100); border: 1px solid var(--color-violet-300); border-radius: 4px; padding: 1px 5px; vertical-align: middle; letter-spacing: 0.02em; }
  .draft-type-desc { font-size: 0.8125rem; color: var(--color-slate-500); }
  .draft-type-meta { font-size: 0.75rem; color: var(--color-slate-400); }

  .draft-type-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .card-dev-type-select {
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: white;
    cursor: pointer;
    max-width: 130px;
  }

  .card-dev-type-select:focus { outline: none; border-color: var(--color-primary-600); }

  .draft-open-btn {
    padding: 0.4rem 0.875rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-open-btn:hover { background: var(--color-slate-100); }

  .draft-generate-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.875rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .draft-generate-btn:hover:not(:disabled) { background: var(--color-primary-700); }
  .draft-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .card-context-bar {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0;
  }

  .card-context-label {
    font-size: 0.72rem;
    color: var(--color-slate-400);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .card-context-track {
    flex: 1;
    height: 4px;
    background: var(--color-slate-200);
    border-radius: 99px;
    overflow: hidden;
  }

  .card-context-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.4s ease, background 0.3s;
  }

  .draft-sections-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.5rem 0;
    border: none;
    border-top: 1px solid var(--color-slate-100);
    background: transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: color 0.15s;
  }
  .draft-sections-toggle:hover { color: var(--color-slate-700); }
  .toggle-chevron { margin-left: auto; font-size: 0.75rem; }

  .draft-inline-sections {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.375rem;
  }

  .draft-inline-context {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.625rem 0.875rem 0.5rem;
    border-top: 1px solid var(--color-slate-100);
  }

  .ctx-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    font-size: 0.8125rem;
  }

  .ctx-label {
    font-weight: 600;
    color: var(--color-slate-500);
    min-width: 7rem;
    flex-shrink: 0;
  }

  .ctx-value { color: var(--color-slate-600); }
  .ctx-set { color: var(--color-emerald-600); }
  .ctx-missing { color: var(--color-slate-400); font-style: italic; }

  .stage1-briefing-group { position: relative; }

  .stage1-error {
    margin: 0;
    padding: 0.375rem 0.875rem;
    font-size: 0.8125rem;
    color: var(--color-red-600);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .draft-inline-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    font-size: 0.8rem;
    color: var(--color-slate-400);
  }

  .draft-inline-empty {
    margin: 0;
    padding: 0.5rem 0;
    font-size: 0.8rem;
    color: var(--color-slate-400);
  }

  .inline-link {
    background: none;
    border: none;
    color: var(--color-primary-600);
    font-size: inherit;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    text-decoration: underline;
  }

  .draft-inline-section {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4rem 0.625rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
  }

  .draft-inline-section-name {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-slate-800);
    min-width: 0;
  }

  .draft-inline-section-actions { display: flex; gap: 0.375rem; align-items: center; }

  .assessment-issues-list {
    margin: 0.125rem 0 0.25rem 1rem;
    border-left: 2px solid var(--color-primary-200);
    padding-left: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .assessment-issue-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: var(--color-blue-50);
  }

  .assessment-issue-label {
    flex: 1;
    font-size: 0.75rem;
    color: var(--color-primary-800);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .issue-generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 1px solid var(--color-blue-200);
    border-radius: 4px;
    background: white;
    color: var(--color-primary-600);
    cursor: pointer;
    font-size: 0.8125rem;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .issue-generate-btn:hover:not(:disabled) { background: var(--color-primary-50); border-color: var(--color-blue-600); }
  .issue-generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .draft-configure-btn {
    margin-top: 0.25rem;
    align-self: flex-start;
  }

  .draft-type-settings {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-slate-100);
  }

  .draft-setting-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.625rem;
    background: transparent;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-setting-btn:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  /* Draft editor view */
  .draft-editor-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 1.5rem;
    background: white;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .draft-editor-title {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .draft-editor-actions { display: flex; gap: 0.5rem; }

  .draft-regen-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-regen-btn:hover:not(:disabled) { background: var(--color-slate-100); }
  .draft-regen-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .draft-save-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.875rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .draft-save-btn:hover:not(:disabled) { background: var(--color-primary-700); }
  .draft-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }


  .draft-editor-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background: var(--color-slate-50);
  }

  /* ── Two-panel layout ── */
  .draft-two-panel {
    flex: 1;
    display: flex;
    min-height: 600px;
    height: calc(100vh - 120px);
  }

  .draft-left-panel {
    flex: 1;
    min-width: 0;
    padding: 1.5rem;
    background: var(--color-slate-50);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Fill the full half of the two-panel layout (not a fixed page-width card)
     and stretch to the panel's full height so the editor card matches the
     right-hand card exactly — text scrolls inside .editor-content itself
     rather than the whole card overflowing. Font-size is bumped ~20% for
     on-screen readability; this only affects the editing view, the .docx
     export has its own separate styling and is untouched. */
  .draft-left-panel :global(.rich-text-editor) {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .draft-left-panel :global(.toolbar) {
    flex-shrink: 0;
  }
  .draft-left-panel :global(.editor-content.trp-document-content) {
    flex: 1;
    min-height: 0;
    max-height: none;
    font-size: 1rem; /* 12pt */
  }
  .draft-left-panel :global(.editor-content.trp-document-content p),
  .draft-left-panel :global(.editor-content.trp-document-content ul),
  .draft-left-panel :global(.editor-content.trp-document-content ol) {
    font-size: 1rem; /* 12pt */
  }
  .draft-left-panel :global(.editor-content.trp-document-content h1) { font-size: 2.4rem; }  /* 2rem × 1.2 */
  .draft-left-panel :global(.editor-content.trp-document-content h2) { font-size: 1.6rem; }  /* 1.333rem × 1.2 */
  .draft-left-panel :global(.editor-content.trp-document-content h3) { font-size: 1.3rem; }  /* 1.083rem × 1.2 */
  .draft-left-panel :global(.editor-content.trp-document-content h4) { font-size: 1.6rem; }  /* 1.333rem × 1.2 */

  .draft-right-panel {
    flex: 1;
    min-width: 0;
    padding: 1.5rem;
    background: var(--color-slate-50);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Matches .rich-text-editor's own card styling, so the two panels read as a
     pair — but sized to its own content by default (not stretched to match
     the editor's full height) rather than leaving a tall empty card when
     there's not much to show. max-height/overflow-y are a safety net for
     when content (e.g. a long Check result) genuinely exceeds the available
     height — it scrolls internally instead of breaking the layout. */
  .draft-right-card {
    display: flex;
    flex-direction: column;
    max-height: 100%;
    overflow-y: auto;
    border: 1px solid var(--color-slate-300);
    border-radius: 8px;
    background: white;
  }

  .draft-right-panel-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-slate-200);
    background: var(--color-slate-50);
    flex-shrink: 0;
  }
  .draft-right-panel-body {
    padding-bottom: 1rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Context button ── */
  .draft-context-btn {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.35rem 0.75rem;
    background: white; color: var(--color-slate-700);
    border: 1px solid var(--color-slate-200); border-radius: 5px;
    font-size: 0.8rem; font-weight: 500;
    cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .draft-context-btn:hover { background: var(--color-primary-100); }
  .draft-context-btn.active { background: var(--color-primary-600); color: white; border-color: var(--color-primary-600); }

  .comments-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.3rem;
    border-radius: var(--radius-pill);
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
    font-size: 0.65rem;
    font-weight: 700;
  }

  /* ── Quick AI edit control (Accept / Edit Again, follows a highlight) ── */
  .ai-edit-control {
    position: fixed;
    max-width: calc(100vw - 2rem);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem 0.7rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    z-index: 1000;
  }
  .ai-edit-status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--color-slate-600);
  }
  .ai-edit-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-600);
  }
  .ai-edit-error {
    font-size: 0.78rem;
    color: var(--color-red-500);
    margin: 0;
  }
  .ai-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }
  .ai-edit-actions button {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
  }

  /* ── Batch "send comments to AI" review panel (right panel body) ── */
  .batch-review-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .batch-review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .batch-review-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-slate-800);
  }
  .batch-review-actions { display: flex; gap: 0.4rem; }
  .batch-review-actions button { font-size: 0.75rem; padding: 0.3rem 0.6rem; }
  .batch-review-list { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; overflow-y: auto; }
  .batch-review-item {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    background: white;
  }
  .batch-review-item-actions { display: flex; justify-content: flex-end; gap: 0.4rem; }
  .batch-review-item-actions button { font-size: 0.75rem; padding: 0.3rem 0.6rem; }
  .comment-quote-btn {
    display: block;
    text-align: left;
    width: 100%;
    font-size: 0.75rem;
    font-style: italic;
    color: var(--color-slate-500);
    background: var(--color-slate-50);
    border: none;
    border-left: 3px solid var(--color-slate-300);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    cursor: pointer;
    max-height: 4rem;
    overflow-y: auto;
    font-family: inherit;
  }
  .comment-quote-btn:hover { background: var(--color-slate-100); }

  /* Analyse row */
  .analyse-row {
    display: flex;
    gap: 0.5rem;
    margin: 0 1.25rem 1.25rem;
  }

  .analyse-row .analyse-btn {
    margin: 0;
    flex: 1;
  }

  .prompt-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.625rem 0.875rem;
    background: white;
    color: var(--color-slate-500);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .prompt-btn:hover:not(:disabled) { background: var(--color-slate-100); border-color: var(--color-slate-300); color: var(--color-slate-700); }
  .prompt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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

  /* ── Draft from briefing ── */
  .btn-from-issue-notes {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4rem 0.875rem;
    background: var(--color-slate-100);
    border: 1px solid var(--color-emerald-100);
    border-radius: 6px;
    color: var(--color-green-800);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .btn-from-issue-notes:hover { background: var(--color-emerald-100); border-color: var(--color-slate-400); }

  .draft-config-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.625rem;
    background: transparent;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .draft-config-btn:hover { background: var(--color-slate-100); color: var(--color-slate-700); }

  .draft-config-dropdown {
    /* top/left or top/right set inline per-open from the button's actual
       on-screen position — see toggleConfig() — so it can flip to open
       rightward near the left edge instead of running under the sidebar. */
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.65rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    min-width: 220px;
    z-index: 100;
  }

  .draft-config-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .draft-config-row .card-dev-type-select { flex: 1; min-width: 0; }

  .draft-config-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-slate-500);
    flex-shrink: 0;
  }

  .draft-config-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.4rem 0.55rem;
    background: transparent;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    font-size: 0.78rem;
    color: var(--color-slate-600);
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: all 0.15s;
  }
  .draft-config-item:hover { background: var(--color-slate-100); color: var(--color-slate-800); }

  /* ── Results header actions ── */
  .results-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .log-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.625rem;
    background: var(--color-primary-100);
    border: 1px solid var(--color-blue-200);
    border-radius: 5px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-primary-700);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .log-btn:hover { background: var(--color-primary-200); }

  /* ── Chat / suggestion UI ── */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
    flex-shrink: 0;
  }

  .chat-thread {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }

  .chat-msg {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 100%;
  }

  .chat-msg.assistant {
    align-self: flex-start;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }

  .chat-msg.user {
    align-self: flex-end;
    background: var(--color-primary-100);
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
    max-width: 85%;
  }

  .chat-msg.user p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-indigo-800);
    white-space: pre-wrap;
  }

  .chat-msg.loading-msg {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-slate-400);
    font-size: 0.85rem;
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
  }

  .chat-prose {
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .chat-msg-actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.25rem;
  }

  .accept-multi {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .accept-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--color-primary-600);
    background: white;
    color: var(--color-primary-600);
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    align-self: flex-start;
  }

  .accept-btn:hover:not(.accepted) { background: var(--color-primary-100); }

  .accept-btn.accepted {
    background: var(--color-slate-100);
    border-color: var(--color-emerald-600);
    color: var(--color-emerald-600);
    cursor: default;
  }

  .accept-btn-sm {
    font-size: 0.75rem;
    padding: 0.25rem 0.6rem;
  }

  .chat-input-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-slate-200);
    flex-shrink: 0;
    align-items: flex-end;
  }

  .chat-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: none;
    line-height: 1.4;
    color: var(--color-slate-700);
  }

  .chat-input:focus { outline: none; border-color: var(--color-primary-600); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07); }

  .chat-send-btn {
    padding: 0.5rem 0.75rem;
    background: var(--color-primary-600);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .chat-send-btn:hover:not(:disabled) { background: var(--color-primary-700); }
  .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .doc-title-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.45rem 0.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--color-slate-700);
    background: var(--color-slate-50);
  }

  .doc-title-input:focus { outline: none; border-color: var(--color-primary-600); background: white; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.07); }

  /* ── Document log tab ── */
  .log-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 800px;
  }

  .log-card {
    background: white;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .log-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .log-card-title-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .log-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--color-slate-800); }
  .log-card-code {
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-slate-100);
    color: var(--color-slate-500);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }
  .log-card-header-right {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .log-card-date { font-size: 0.75rem; color: var(--color-slate-400); white-space: nowrap; flex-shrink: 0; }

  .log-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.625rem;
    height: 1.625rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 5px;
    background: white;
    color: var(--color-slate-400);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .log-action-btn:hover { background: var(--color-slate-100); color: var(--color-slate-700); border-color: var(--color-slate-300); }
  .log-action-btn.log-action-delete:hover { background: var(--color-red-100); border-color: var(--color-red-200); color: var(--color-red-800); }

  .log-card-summary {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-600);
    line-height: 1.5;
    padding: 0.625rem 0.75rem;
    background: var(--color-slate-50);
    border-radius: 6px;
    border: 1px solid var(--color-slate-200);
  }

  .log-points {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .log-point {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-slate-50);
    border: 1px solid var(--color-slate-200);
    border-radius: 6px;
  }

  .log-point-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .log-point-text {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    line-height: 1.5;
  }

  /* Letter doc modal */
  .letter-modal {
    width: 90vw;
    max-width: 900px;
    height: 85vh;
    background: white;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  }

  .letter-modal-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
    background: white;
  }

  .letter-modal-body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Coming soon card */
  .draft-type-card--coming-soon {
    opacity: 0.55;
    pointer-events: none;
  }


  .coming-soon-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--color-slate-200);
    color: var(--color-slate-500);
    border-radius: 4px;
    padding: 1px 6px;
    vertical-align: middle;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-left: 0.4rem;
  }
</style>
