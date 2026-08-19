<script>
  import { onMount, tick } from 'svelte';
  import { getChatSources, sendProjectChat } from '$lib/api/projectChat.js';

  export let project;

  const CONTEXT_BUDGET = 200000;

  // Source catalogue
  let groups = [];
  let loading = true;
  let loadError = null;

  // Selection state
  let detailsSelected = false;
  let selectedGroups = new Set();      // table-shaped group keys
  let selectedDocIds = new Set();
  let selectedMeetingIds = new Set();
  let expandedGroups = new Set(['project_info', 'documents', 'meetings']);

  // Groups hidden from the picker entirely
  const HIDDEN_GROUP_KEYS = ['key_issues', 'actions'];

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

      // Default selection: project details + briefing transcript docs
      detailsSelected = groups.some(g => g.key === 'project_details');
      const docGroup = groups.find(g => g.key === 'documents');
      selectedDocIds = new Set(
        (docGroup?.items ?? []).filter(d => d.doc_type === 'briefing_transcript').map(d => d.id)
      );
    } catch (err) {
      console.error('Error loading chat sources:', err);
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  $: docGroup = groups.find(g => g.key === 'documents');
  $: meetingGroup = groups.find(g => g.key === 'meetings');
  $: detailsGroup = groups.find(g => g.key === 'project_details');
  $: historyGroup = groups.find(g => g.key === 'planning_history');
  $: policiesGroup = groups.find(g => g.key === 'policies');
  $: policyDocsGroup = groups.find(g => g.key === 'policy_documents');
  // Loose table groups shown below Documents/Meetings. Planning History,
  // Policies and Policy Documents live in the Project Information group
  // instead; hidden groups are dropped.
  $: tableGroups = groups.filter(g =>
    !['project_details', 'documents', 'meetings', 'planning_history', 'policies', 'policy_documents', ...HIDDEN_GROUP_KEYS].includes(g.key)
  );
  // Every selectable table-shaped group key, wherever it appears in the UI
  $: selectableGroupKeys = [
    ...(historyGroup && historyGroup.count > 0 ? ['planning_history'] : []),
    ...(policiesGroup && policiesGroup.count > 0 ? ['policies'] : []),
    ...(policyDocsGroup && policyDocsGroup.count > 0 ? ['policy_documents'] : []),
    ...tableGroups.filter(g => g.count > 0).map(g => g.key),
  ];

  function toggleGroupExpand(key) {
    expandedGroups = expandedGroups.has(key)
      ? new Set([...expandedGroups].filter(k => k !== key))
      : new Set([...expandedGroups, key]);
  }

  function toggleItem(groupKey, id) {
    const set = groupKey === 'documents' ? selectedDocIds : selectedMeetingIds;
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    if (groupKey === 'documents') selectedDocIds = next; else selectedMeetingIds = next;
  }

  function toggleItemGroup(group) {
    const ids = (group.items ?? []).map(i => i.id);
    const set = group.key === 'documents' ? selectedDocIds : selectedMeetingIds;
    const allSelected = ids.length > 0 && ids.every(id => set.has(id));
    const next = allSelected ? new Set() : new Set(ids);
    if (group.key === 'documents') selectedDocIds = next; else selectedMeetingIds = next;
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
      selectedDocIds = new Set();
      selectedMeetingIds = new Set();
    } else {
      detailsSelected = !!detailsGroup;
      selectedGroups = new Set(selectableGroupKeys);
      selectedDocIds = new Set((docGroup?.items ?? []).map(d => d.id));
      selectedMeetingIds = new Set((meetingGroup?.items ?? []).map(m => m.id));
    }
  }

  $: allSelected =
    (!detailsGroup || detailsSelected) &&
    (docGroup?.items ?? []).every(d => selectedDocIds.has(d.id)) &&
    (meetingGroup?.items ?? []).every(m => selectedMeetingIds.has(m.id)) &&
    selectableGroupKeys.every(k => selectedGroups.has(k)) &&
    groups.length > 0;

  // Project Information group (Project Details + Planning History + Policies + Policy Documents)
  $: infoGroups = [
    ['planning_history', historyGroup],
    ['policies', policiesGroup],
    ['policy_documents', policyDocsGroup],
  ].filter(([, g]) => g && g.count > 0);
  $: infoSelectableCount = (detailsGroup ? 1 : 0) + infoGroups.length;
  $: infoSelectedCount =
    (detailsSelected ? 1 : 0) +
    infoGroups.filter(([key]) => selectedGroups.has(key)).length;

  function toggleProjectInfo() {
    const selectAll = infoSelectedCount < infoSelectableCount;
    detailsSelected = selectAll && !!detailsGroup;
    const next = new Set(selectedGroups);
    for (const key of ['planning_history', 'policies', 'policy_documents']) next.delete(key);
    if (selectAll) for (const [key] of infoGroups) next.add(key);
    selectedGroups = next;
  }

  $: anySelected = detailsSelected || selectedGroups.size > 0 || selectedDocIds.size > 0 || selectedMeetingIds.size > 0;

  // ── Context meter (same pattern as StartingDocsModal) ─────────────────────

  $: detailsChars = detailsSelected ? (detailsGroup?.chars ?? 0) : 0;
  $: docChars = (docGroup?.items ?? []).filter(d => selectedDocIds.has(d.id)).reduce((acc, d) => acc + (d.chars ?? 0), 0);
  $: meetingChars = (meetingGroup?.items ?? []).filter(m => selectedMeetingIds.has(m.id)).reduce((acc, m) => acc + (m.chars ?? 0), 0);
  $: tableChars = groups.filter(g => selectedGroups.has(g.key)).reduce((acc, g) => acc + (g.chars ?? 0), 0);
  $: totalChars = detailsChars + docChars + meetingChars + tableChars;
  $: contextPct = Math.min(100, Math.round(totalChars / CONTEXT_BUDGET * 100));
  $: contextColour = contextPct >= 75 ? '#dc2626' : contextPct >= 50 ? '#d97706' : '#16a34a';
  $: overBudget = totalChars > CONTEXT_BUDGET;

  // ── Source labels for citation chips ───────────────────────────────────────

  $: sourceLabels = buildSourceLabels(groups);
  function buildSourceLabels(gs) {
    const map = { P: 'Project Details', K: 'Key Issues', C: 'Consultation', COND: 'Conditions', IT: 'Project Tracker', A: 'Actions', H: 'Planning History', POL: 'Relevant Policies', PD: 'Policy Documents', PC: 'Public Comments', S: 'Surveyor Management' };
    for (const d of gs.find(g => g.key === 'documents')?.items ?? []) map[`D${d.id}`] = d.label;
    for (const m of gs.find(g => g.key === 'meetings')?.items ?? []) map[`M${m.id}`] = m.label;
    return map;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Convert inline [D12] / [D12 §4.2] markers into chips, plus minimal
  // formatting: **bold**, markdown-style headings rendered as bold lines,
  // and */- bullets normalised to •. Everything else stays plain text.
  function renderReply(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/\[((?:D\d+|M\d+|COND|IT|POL|PD|PC|P|C|K|A|H|S)(?:\s*[§·][^\]]*)?)\]/g, (match, inner) => {
        const id = inner.split(/[\s§·]/)[0];
        const label = sourceLabels[id];
        const title = label ? ` title="${escapeHtml(label)}"` : '';
        return `<span class="cite-chip"${title}>${inner}</span>`;
      })
      .replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/^(\s*)[-*]\s+/gm, '$1• ')
      .replace(/\n/g, '<br>');
  }

  function toggleCitations(idx) {
    expandedCitations = expandedCitations.has(idx)
      ? new Set([...expandedCitations].filter(i => i !== idx))
      : new Set([...expandedCitations, idx]);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  function buildSourcesPayload() {
    return {
      project_details: detailsSelected,
      document_ids: [...selectedDocIds],
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
      messages = [...messages, { role: 'assistant', content: result.reply, citations: result.citations ?? [] }];
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

        <div class="pc-group">
          <div class="pc-row pc-row-group">
            <input
              type="checkbox"
              checked={infoSelectableCount > 0 && infoSelectedCount === infoSelectableCount}
              indeterminate={infoSelectedCount > 0 && infoSelectedCount < infoSelectableCount}
              disabled={infoSelectableCount === 0}
              on:change={toggleProjectInfo}
            />
            <button class="pc-group-toggle" on:click={() => toggleGroupExpand('project_info')}>
              <i class="las {expandedGroups.has('project_info') ? 'la-angle-down' : 'la-angle-right'}"></i>
              <span>Project Information</span>
            </button>
          </div>
          {#if expandedGroups.has('project_info')}
            {#if detailsGroup}
              <label class="pc-row pc-row-item">
                <input type="checkbox" bind:checked={detailsSelected} />
                <span class="pc-item-label">Project Details</span>
                <span class="pc-chars">{fmtChars(detailsGroup.chars)}</span>
              </label>
            {/if}
            {#if historyGroup}
              <label class="pc-row pc-row-item" class:pc-row-disabled={historyGroup.count === 0}>
                <input
                  type="checkbox"
                  checked={selectedGroups.has('planning_history')}
                  disabled={historyGroup.count === 0}
                  on:change={() => toggleTableGroup('planning_history')}
                />
                <span class="pc-item-label">Planning History ({historyGroup.count})</span>
                {#if historyGroup.chars > 0}<span class="pc-chars">{fmtChars(historyGroup.chars)}</span>{/if}
              </label>
            {/if}
            {#if policiesGroup}
              <label class="pc-row pc-row-item" class:pc-row-disabled={policiesGroup.count === 0}>
                <input
                  type="checkbox"
                  checked={selectedGroups.has('policies')}
                  disabled={policiesGroup.count === 0}
                  on:change={() => toggleTableGroup('policies')}
                />
                <span class="pc-item-label">Relevant Policies ({policiesGroup.count})</span>
                {#if policiesGroup.chars > 0}<span class="pc-chars">{fmtChars(policiesGroup.chars)}</span>{/if}
              </label>
            {/if}
            {#if policyDocsGroup}
              <label class="pc-row pc-row-item" class:pc-row-disabled={policyDocsGroup.count === 0}>
                <input
                  type="checkbox"
                  checked={selectedGroups.has('policy_documents')}
                  disabled={policyDocsGroup.count === 0}
                  on:change={() => toggleTableGroup('policy_documents')}
                />
                <span class="pc-item-label">Policy Documents ({policyDocsGroup.count})</span>
                {#if policyDocsGroup.chars > 0}<span class="pc-chars">{fmtChars(policyDocsGroup.chars)}</span>{/if}
              </label>
            {/if}
          {/if}
        </div>

        {#each [docGroup, meetingGroup].filter(Boolean) as group}
          {@const set = group.key === 'documents' ? selectedDocIds : selectedMeetingIds}
          {@const ids = (group.items ?? []).map(i => i.id)}
          <div class="pc-group">
            <div class="pc-row pc-row-group">
              <input
                type="checkbox"
                checked={ids.length > 0 && ids.every(id => set.has(id))}
                indeterminate={ids.some(id => set.has(id)) && !ids.every(id => set.has(id))}
                disabled={ids.length === 0}
                on:change={() => toggleItemGroup(group)}
              />
              <button class="pc-group-toggle" on:click={() => toggleGroupExpand(group.key)}>
                <i class="las {expandedGroups.has(group.key) ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span>{group.label} ({group.items.length})</span>
              </button>
            </div>
            {#if expandedGroups.has(group.key)}
              {#each group.items as item}
                <label class="pc-row pc-row-item">
                  <input type="checkbox" checked={set.has(item.id)} on:change={() => toggleItem(group.key, item.id)} />
                  <span class="pc-item-label" title={item.label}>
                    {item.label}
                    {#if item.doc_type_label}<span class="pc-doc-type">{item.doc_type_label}</span>{/if}
                  </span>
                  <span class="pc-chars">{fmtChars(item.chars)}</span>
                </label>
              {:else}
                <div class="pc-empty-items">None yet</div>
              {/each}
            {/if}
          </div>
        {/each}

        {#each tableGroups as group}
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
              {@html renderReply(msg.content)}
              {#if msg.citations?.length}
                <button class="pc-citations-toggle" on:click={() => toggleCitations(idx)}>
                  <i class="las {expandedCitations.has(idx) ? 'la-angle-down' : 'la-angle-right'}"></i>
                  {msg.citations.length} citation{msg.citations.length === 1 ? '' : 's'}
                </button>
                {#if expandedCitations.has(idx)}
                  <div class="pc-citations">
                    {#each msg.citations as c}
                      <div class="pc-citation">
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
    border-right: 1px solid #e2e8f0;
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
    color: #64748b;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .pc-sources-error button {
    padding: 0.3rem 0.75rem;
    border: 1px solid #cbd5e1;
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
    color: #334155;
    cursor: pointer;
  }

  .pc-row:hover { background: #f8fafc; }
  .pc-row input[type="checkbox"] { flex-shrink: 0; cursor: pointer; }

  .pc-row-all {
    font-weight: 600;
    border-bottom: 1px solid #e2e8f0;
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
    color: #334155;
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

  .pc-doc-type {
    display: inline-block;
    margin-left: 0.35rem;
    font-size: 0.68rem;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.05rem 0.35rem;
    border-radius: 4px;
  }

  .pc-empty-items {
    padding: 0.2rem 0.5rem 0.2rem 1.85rem;
    font-size: 0.78rem;
    color: #94a3b8;
    font-style: italic;
  }

  .pc-chars {
    margin-left: auto;
    font-size: 0.72rem;
    color: #94a3b8;
    flex-shrink: 0;
  }

  /* ── Context meter (StartingDocsModal pattern) ── */
  .pc-context-bar {
    border-top: 1px solid #e2e8f0;
    padding: 0.6rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background: #fafbfc;
  }

  .pc-context-label {
    font-size: 0.75rem;
    color: #64748b;
  }

  .pc-context-track {
    height: 6px;
    border-radius: 3px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .pc-context-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.2s ease, background 0.2s ease;
  }

  .pc-context-warning {
    font-size: 0.72rem;
    color: #dc2626;
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
    color: #94a3b8;
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
    background: #6d28d9;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .pc-bubble-ai {
    background: #f1f5f9;
    color: #1e293b;
    border-bottom-left-radius: 4px;
    white-space: normal;
  }

  .pc-thinking {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #64748b;
  }

  .pc-bubble-ai :global(.cite-chip),
  .pc-citation .cite-chip {
    display: inline-block;
    background: #ede9fe;
    color: #6d28d9;
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
    color: #6d28d9;
    cursor: pointer;
    font-weight: 600;
  }

  .pc-citations {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .pc-citation {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
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
    color: #334155;
  }

  .pc-citation-ref {
    font-size: 0.72rem;
    color: #64748b;
  }

  .pc-citation-quote {
    margin-top: 0.25rem;
    font-size: 0.78rem;
    font-style: italic;
    color: #475569;
  }

  .pc-send-error {
    margin: 0 1.25rem 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #b91c1c;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .pc-input-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid #e2e8f0;
    align-items: flex-end;
  }

  .pc-input-row textarea {
    flex: 1;
    resize: none;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    line-height: 1.4;
  }

  .pc-input-row textarea:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  .pc-send-btn {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border: none;
    border-radius: 8px;
    background: #6d28d9;
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pc-send-btn:disabled {
    background: #cbd5e1;
    cursor: not-allowed;
  }

  .mini-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #e2e8f0;
    border-top-color: #6d28d9;
    border-radius: 50%;
    animation: pc-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes pc-spin {
    to { transform: rotate(360deg); }
  }
</style>
