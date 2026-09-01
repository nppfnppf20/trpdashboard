<script>
  import { onMount, tick } from 'svelte';
  import { getChatSources, sendProjectChat } from '$lib/api/projectChat.js';
  import { renderReply, buildSourceLabels, stripCitations } from '$lib/utils/chatMarkdown.js';
  import ProjectDateSuggestionCard from '$lib/components/projects/ProjectDateSuggestionCard.svelte';

  export let project;
  export let onAcceptDateSuggestion = null; // async (field, date) => boolean

  const CONTEXT_BUDGET = 200000;

  // Source catalogue
  let groups = [];
  let loading = true;
  let loadError = null;

  // Selection state
  let detailsSelected = false;
  let selectedGroups = new Set();      // table-shaped group keys
  let selectedMeetingIds = new Set();
  let expandedGroups = new Set(['trackers', 'meetings']);

  // Groups hidden from the picker entirely — 'documents' (Project Docs) is
  // being phased out as a chat source, so it's dropped here too even though
  // the backend still returns it in the catalogue.
  const HIDDEN_GROUP_KEYS = ['key_issues', 'actions', 'documents'];
  const TRACKER_KEYS = ['consultation', 'conditions', 'issues_tracker'];

  // Chat state
  let messages = [];                   // { role, content, citations? }
  let input = '';
  let sending = false;
  let sendError = null;
  let chatScroll;
  let expandedCitations = new Set();   // message indices with citations open

  onMount(loadSources);

  async function loadSources() {
    loading = true;
    loadError = null;
    try {
      const data = await getChatSources(project.id);
      groups = data.groups;

      // Default selection: project details, plus whichever tracker has the
      // most content for this project (highest char/token count).
      detailsSelected = groups.some(g => g.key === 'project_details');
      const biggestTracker = TRACKER_KEYS
        .map(k => groups.find(g => g.key === k))
        .filter(g => g && g.count > 0)
        .reduce((a, b) => (!a || b.chars > a.chars ? b : a), null);
      if (biggestTracker) selectedGroups = new Set([...selectedGroups, biggestTracker.key]);
    } catch (err) {
      console.error('Error loading chat sources:', err);
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Selection helpers ──────────────────────────────────────────────────────
  // Tick order: Project Details, then Trackers (grouped like Meeting Notes),
  // then Meeting Notes, then everything else as flat rows.

  $: meetingGroup = groups.find(g => g.key === 'meetings');
  $: detailsGroup = groups.find(g => g.key === 'project_details');
  $: trackerGroups = TRACKER_KEYS.map(k => groups.find(g => g.key === k)).filter(Boolean);
  // Everything else, flat — Planning History, Policies, Policy Documents,
  // Public Comments, Surveyor Management, etc.
  $: otherGroups = groups.filter(g =>
    !['project_details', 'meetings', ...TRACKER_KEYS, ...HIDDEN_GROUP_KEYS].includes(g.key)
  );
  // Every selectable table-shaped group key, wherever it appears in the UI
  $: selectableGroupKeys = [
    ...trackerGroups.filter(g => g.count > 0).map(g => g.key),
    ...otherGroups.filter(g => g.count > 0).map(g => g.key),
  ];

  function toggleGroupExpand(key) {
    expandedGroups = expandedGroups.has(key)
      ? new Set([...expandedGroups].filter(k => k !== key))
      : new Set([...expandedGroups, key]);
  }

  function toggleItem(id) {
    const next = new Set(selectedMeetingIds);
    next.has(id) ? next.delete(id) : next.add(id);
    selectedMeetingIds = next;
  }

  function toggleMeetingsGroup() {
    const ids = (meetingGroup?.items ?? []).map(i => i.id);
    const allSel = ids.length > 0 && ids.every(id => selectedMeetingIds.has(id));
    selectedMeetingIds = allSel ? new Set() : new Set(ids);
  }

  function toggleTableGroup(key) {
    const next = new Set(selectedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    selectedGroups = next;
  }

  function toggleSelectAll() {
    if (allSelected) {
      detailsSelected = false;
      selectedGroups = new Set();
      selectedMeetingIds = new Set();
    } else {
      detailsSelected = !!detailsGroup;
      selectedGroups = new Set(selectableGroupKeys);
      selectedMeetingIds = new Set((meetingGroup?.items ?? []).map(m => m.id));
    }
  }

  $: allSelected =
    (!detailsGroup || detailsSelected) &&
    (meetingGroup?.items ?? []).every(m => selectedMeetingIds.has(m.id)) &&
    selectableGroupKeys.every(k => selectedGroups.has(k)) &&
    groups.length > 0;

  // Trackers group-level checkbox (select/deselect Consultation + Conditions + Project Tracker together)
  $: trackerSelectableKeys = trackerGroups.filter(g => g.count > 0).map(g => g.key);
  $: trackerAllSelected = trackerSelectableKeys.length > 0 && trackerSelectableKeys.every(k => selectedGroups.has(k));
  $: trackerAnySelected = trackerSelectableKeys.some(k => selectedGroups.has(k));

  function toggleTrackersGroup() {
    const next = new Set(selectedGroups);
    if (trackerAllSelected) { for (const k of trackerSelectableKeys) next.delete(k); }
    else { for (const k of trackerSelectableKeys) next.add(k); }
    selectedGroups = next;
  }

  $: anySelected = detailsSelected || selectedGroups.size > 0 || selectedMeetingIds.size > 0;

  // ── Context meter (same pattern as StartingDocsModal) ─────────────────────

  $: detailsChars = detailsSelected ? (detailsGroup?.chars ?? 0) : 0;
  $: meetingChars = (meetingGroup?.items ?? []).filter(m => selectedMeetingIds.has(m.id)).reduce((acc, m) => acc + (m.chars ?? 0), 0);
  $: tableChars = groups.filter(g => selectedGroups.has(g.key)).reduce((acc, g) => acc + (g.chars ?? 0), 0);
  $: totalChars = detailsChars + meetingChars + tableChars;
  $: contextPct = Math.min(100, Math.round(totalChars / CONTEXT_BUDGET * 100));
  $: contextColour = contextPct >= 75 ? '#dc2626' : contextPct >= 50 ? '#d97706' : '#16a34a';
  $: overBudget = totalChars > CONTEXT_BUDGET;

  // ── Source labels for citation chips ───────────────────────────────────────

  $: sourceLabels = buildSourceLabels(groups);

  function toggleCitations(idx) {
    expandedCitations = expandedCitations.has(idx)
      ? new Set([...expandedCitations].filter(i => i !== idx))
      : new Set([...expandedCitations, idx]);
  }

  let copiedIdx = null;

  async function copyReply(idx, content) {
    try {
      await navigator.clipboard.writeText(stripCitations(content));
      copiedIdx = idx;
      setTimeout(() => { if (copiedIdx === idx) copiedIdx = null; }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  function buildSourcesPayload() {
    return {
      project_details: detailsSelected,
      document_ids: [], // Project Docs is being phased out as a chat source
      meeting_ids: [...selectedMeetingIds],
      groups: [...selectedGroups],
    };
  }

  async function send() {
    const question = input.trim();
    if (!question || sending || overBudget || !anySelected) return;

    sendError = null;
    messages = [...messages, { role: 'user', content: question }];
    input = '';
    sending = true;
    await scrollToBottom();

    try {
      const result = await sendProjectChat(project.id, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        sources: buildSourcesPayload(),
      });
      messages = [...messages, { role: 'assistant', content: result.reply, citations: result.citations ?? [], suggestions: result.suggestions ?? [] }];
    } catch (err) {
      console.error('Project chat error:', err);
      sendError = err.message;
      // Drop the failed user turn so the history sent next time stays valid
      messages = messages.slice(0, -1);
      input = question;
    } finally {
      sending = false;
      await scrollToBottom();
    }
  }

  async function scrollToBottom() {
    await tick();
    if (chatScroll) chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const fmtChars = c => c >= 1000 ? `${Math.round(c / 1000)}k` : `${c}`;
</script>

<div class="pc-layout">
  <!-- Source picker -->
  <div class="pc-sources">
    {#if loading}
      <div class="pc-sources-loading"><div class="mini-spinner"></div> Loading sources…</div>
    {:else if loadError}
      <div class="pc-sources-error">
        <p>{loadError}</p>
        <button on:click={loadSources}>Retry</button>
      </div>
    {:else}
      <div class="pc-sources-scroll">
        <label class="pc-row pc-row-all">
          <input type="checkbox" checked={allSelected} on:change={toggleSelectAll} />
          <span>Select all</span>
        </label>

        {#if detailsGroup}
          <label class="pc-row">
            <input type="checkbox" bind:checked={detailsSelected} />
            <span>Project Details</span>
            <span class="pc-chars">{fmtChars(detailsGroup.chars)}</span>
          </label>
        {/if}

        {#if trackerGroups.length}
          <div class="pc-group">
            <div class="pc-row pc-row-group">
              <input
                type="checkbox"
                checked={trackerAllSelected}
                indeterminate={trackerAnySelected && !trackerAllSelected}
                disabled={trackerSelectableKeys.length === 0}
                on:change={toggleTrackersGroup}
              />
              <button class="pc-group-toggle" on:click={() => toggleGroupExpand('trackers')}>
                <i class="las {expandedGroups.has('trackers') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span>Trackers</span>
              </button>
            </div>
            {#if expandedGroups.has('trackers')}
              {#each trackerGroups as group}
                <label class="pc-row pc-row-item" class:pc-row-disabled={group.count === 0}>
                  <input
                    type="checkbox"
                    checked={selectedGroups.has(group.key)}
                    disabled={group.count === 0}
                    on:change={() => toggleTableGroup(group.key)}
                  />
                  <span class="pc-item-label">{group.label} ({group.count})</span>
                  {#if group.chars > 0}<span class="pc-chars">{fmtChars(group.chars)}</span>{/if}
                </label>
              {/each}
            {/if}
          </div>
        {/if}

        {#if meetingGroup}
          {@const ids = (meetingGroup.items ?? []).map(i => i.id)}
          <div class="pc-group">
            <div class="pc-row pc-row-group">
              <input
                type="checkbox"
                checked={ids.length > 0 && ids.every(id => selectedMeetingIds.has(id))}
                indeterminate={ids.some(id => selectedMeetingIds.has(id)) && !ids.every(id => selectedMeetingIds.has(id))}
                disabled={ids.length === 0}
                on:change={toggleMeetingsGroup}
              />
              <button class="pc-group-toggle" on:click={() => toggleGroupExpand('meetings')}>
                <i class="las {expandedGroups.has('meetings') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span>{meetingGroup.label} ({meetingGroup.items.length})</span>
              </button>
            </div>
            {#if expandedGroups.has('meetings')}
              {#each meetingGroup.items as item}
                <label class="pc-row pc-row-item">
                  <input type="checkbox" checked={selectedMeetingIds.has(item.id)} on:change={() => toggleItem(item.id)} />
                  <span class="pc-item-label" title={item.label}>{item.label}</span>
                  <span class="pc-chars">{fmtChars(item.chars)}</span>
                </label>
              {:else}
                <div class="pc-empty-items">None yet</div>
              {/each}
            {/if}
          </div>
        {/if}

        {#each otherGroups as group}
          <label class="pc-row" class:pc-row-disabled={group.count === 0}>
            <input
              type="checkbox"
              checked={selectedGroups.has(group.key)}
              disabled={group.count === 0}
              on:change={() => toggleTableGroup(group.key)}
            />
            <span>{group.label} ({group.count})</span>
            {#if group.chars > 0}<span class="pc-chars">{fmtChars(group.chars)}</span>{/if}
          </label>
        {/each}
      </div>

      <!-- Context meter -->
      <div class="pc-context-bar">
        <span class="pc-context-label">~{contextPct}% of context window used</span>
        <div class="pc-context-track">
          <div class="pc-context-fill" style="width:{contextPct}%; background:{contextColour}"></div>
        </div>
        {#if overBudget}
          <span class="pc-context-warning">Untick some sources to make room</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Chat panel -->
  <div class="pc-chat">
    <div class="pc-messages" bind:this={chatScroll}>
      {#if messages.length === 0}
        <div class="pc-chat-empty">
          <i class="las la-comments"></i>
          <p>Ask a question about this project.</p>
          <p class="pc-chat-hint">Answers come only from the sources ticked on the left, with citations showing exactly where each fact came from.</p>
        </div>
      {/if}
      {#each messages as msg, idx}
        <div class="pc-msg pc-msg-{msg.role}">
          {#if msg.role === 'user'}
            <div class="pc-bubble pc-bubble-user">{msg.content}</div>
          {:else}
            <div class="pc-bubble pc-bubble-ai">
              {@html renderReply(msg.content, sourceLabels)}
              {#if msg.citations?.length}
                <button class="pc-citations-toggle" on:click={() => toggleCitations(idx)}>
                  <i class="las {expandedCitations.has(idx) ? 'la-angle-down' : 'la-angle-right'}"></i>
                  {msg.citations.length} citation{msg.citations.length === 1 ? '' : 's'}
                </button>
                {#if expandedCitations.has(idx)}
                  <div class="pc-citations">
                    {#each msg.citations as c}
                      <div class="card pc-citation">
                        <div class="pc-citation-head">
                          <span class="cite-chip">{c.source_id}</span>
                          <span class="pc-citation-source">{sourceLabels[c.source_id] ?? c.source_id}</span>
                          {#if c.ref}<span class="pc-citation-ref">{c.ref}</span>{/if}
                        </div>
                        {#if c.quote}<div class="pc-citation-quote">"{c.quote}"</div>{/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              {/if}
              {#each msg.suggestions ?? [] as suggestion}
                <ProjectDateSuggestionCard {suggestion} onAccept={onAcceptDateSuggestion} />
              {/each}
              <button class="pc-copy-btn" on:click={() => copyReply(idx, msg.content)} title="Copy response (citations excluded)">
                <i class="las {copiedIdx === idx ? 'la-check' : 'la-copy'}"></i> {copiedIdx === idx ? 'Copied' : 'Copy'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
      {#if sending}
        <div class="pc-msg pc-msg-assistant">
          <div class="pc-bubble pc-bubble-ai pc-thinking"><div class="mini-spinner"></div> Reading sources…</div>
        </div>
      {/if}
    </div>

    {#if sendError}
      <div class="pc-send-error"><i class="las la-exclamation-circle"></i> {sendError}</div>
    {/if}

    <div class="pc-input-row">
      <textarea
        bind:value={input}
        on:keydown={handleKeydown}
        placeholder={!anySelected ? 'Tick at least one source to start…' : overBudget ? 'Untick some sources to make room…' : 'Ask a question about this project…'}
        rows="2"
        disabled={sending || loading}
      ></textarea>
      <button
        class="pc-send-btn"
        on:click={send}
        disabled={sending || loading || overBudget || !anySelected || !input.trim()}
        title={overBudget ? 'Untick some sources to make room' : 'Send'}
      >
        <i class="las la-paper-plane"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .pc-layout {
    display: flex;
    flex: 1;
    height: 100%;
    min-height: 0;
    gap: 0;
  }

  /* ── Sources panel ── */
  .pc-sources {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-slate-200);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .pc-sources-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 0.5rem;
  }

  .pc-sources-loading,
  .pc-sources-error {
    padding: 1rem;
    color: var(--color-slate-500);
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .pc-sources-error button {
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--color-slate-300);
    border-radius: 6px;
    background: white;
    cursor: pointer;
  }

  .pc-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    font-size: 0.85rem;
    color: var(--color-slate-700);
    cursor: pointer;
  }

  .pc-row:hover { background: var(--color-slate-50); }
  .pc-row input[type="checkbox"] { flex-shrink: 0; cursor: pointer; }

  .pc-row-all {
    font-weight: 600;
    border-bottom: 1px solid var(--color-slate-200);
    border-radius: 0;
    margin-bottom: 0.4rem;
    padding-bottom: 0.5rem;
  }

  .pc-row-disabled { opacity: 0.45; cursor: default; }

  .pc-row-group { padding-right: 0.25rem; }

  .pc-group-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.85rem;
    color: var(--color-slate-700);
    cursor: pointer;
    flex: 1;
    text-align: left;
  }

  .pc-row-item {
    padding-left: 1.75rem;
  }

  .pc-item-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .pc-empty-items {
    padding: 0.2rem 0.5rem 0.2rem 1.85rem;
    font-size: 0.78rem;
    color: var(--color-slate-400);
    font-style: italic;
  }

  .pc-chars {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--color-slate-400);
    flex-shrink: 0;
  }

  /* ── Context meter (StartingDocsModal pattern) ── */
  .pc-context-bar {
    border-top: 1px solid var(--color-slate-200);
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background: var(--color-slate-50);
  }

  .pc-context-label {
    font-size: 0.75rem;
    color: var(--color-slate-500);
  }

  .pc-context-track {
    height: 6px;
    border-radius: 3px;
    background: var(--color-slate-200);
    overflow: hidden;
  }

  .pc-context-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.2s ease, background 0.2s ease;
  }

  .pc-context-warning {
    font-size: 0.72rem;
    color: var(--color-red-600);
  }

  /* ── Chat panel ── */
  .pc-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .pc-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .pc-chat-empty {
    margin: auto;
    text-align: center;
    color: var(--color-slate-400);
    max-width: 340px;
  }

  .pc-chat-empty i { font-size: 2.5rem; }
  .pc-chat-empty p { margin: 0.5rem 0 0; font-size: 0.9rem; }
  .pc-chat-hint { font-size: 0.78rem !important; }

  .pc-msg { display: flex; }
  .pc-msg-user { justify-content: flex-end; }
  .pc-msg-assistant { justify-content: flex-start; }

  .pc-bubble {
    max-width: 85%;
    padding: 0.6rem 0.85rem;
    border-radius: 12px;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .pc-bubble-user {
    background: var(--color-violet-700);
    color: white;
    border-bottom-right-radius: 4px;
  }

  .pc-bubble-ai {
    background: var(--color-slate-100);
    color: var(--color-slate-800);
    border-bottom-left-radius: 4px;
    white-space: normal;
  }

  .pc-thinking {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-slate-500);
  }

  .pc-bubble-ai :global(.cite-chip),
  .pc-citation .cite-chip {
    display: inline-block;
    background: var(--color-violet-100);
    color: var(--color-violet-700);
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0 0.35rem;
    border-radius: 4px;
    vertical-align: baseline;
    white-space: nowrap;
  }

  .pc-citations-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.5rem;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.75rem;
    color: var(--color-violet-700);
    cursor: pointer;
    font-weight: 600;
  }

  .pc-citations {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .pc-copy-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.6rem;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    cursor: pointer;
    font-weight: 600;
  }
  .pc-copy-btn:hover { color: var(--color-slate-700); }

  .pc-citation {
    padding: 0.45rem 0.6rem;
  }

  .pc-citation-head {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .pc-citation-source {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-slate-700);
  }

  .pc-citation-ref {
    font-size: 0.72rem;
    color: var(--color-slate-500);
  }

  .pc-citation-quote {
    margin-top: 0.25rem;
    font-size: 0.78rem;
    font-style: italic;
    color: var(--color-slate-600);
  }

  .pc-send-error {
    margin: 0 1.25rem 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-red-50);
    border: 1px solid var(--color-red-200);
    border-radius: 8px;
    color: var(--color-red-800);
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pc-input-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--color-slate-200);
    align-items: flex-end;
  }

  .pc-input-row textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--color-slate-300);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    line-height: 1.4;
  }

  .pc-input-row textarea:focus {
    outline: none;
    border-color: var(--color-violet-600);
  }

  .pc-send-btn {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border: none;
    border-radius: 8px;
    background: var(--color-violet-700);
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pc-send-btn:disabled {
    background: var(--color-slate-300);
    cursor: not-allowed;
  }

  .mini-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-slate-200);
    border-top-color: var(--color-violet-700);
    border-radius: 50%;
    animation: pc-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes pc-spin {
    to { transform: rotate(360deg); }
  }
</style>
