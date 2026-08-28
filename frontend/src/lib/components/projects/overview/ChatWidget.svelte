<script>
  import { onMount, tick } from 'svelte';
  import { getChatSources, sendProjectChat } from '$lib/api/projectChat.js';
  import { openProjectModal } from '$lib/stores/projectViewModal.js';

  export let project;
  $: projectId = project?.id;

  const CONTEXT_BUDGET = 200000;
  // 'documents' (Project Docs) is being phased out as a chat source, so it's
  // dropped here too even though the backend still returns it in the catalogue.
  const HIDDEN_GROUP_KEYS = ['key_issues', 'actions', 'documents'];
  const TRACKER_KEYS = ['consultation', 'conditions', 'issues_tracker'];

  let messages = [];
  let input = '';
  let sending = false;
  let error = null;
  let scrollEl;

  // ── Source catalogue + selection (compact version of ProjectChatTab's
  // picker — same payload shape and tick order, flatter UI to fit a small
  // widget). Tick order: Project Details, Trackers (grouped like Meeting
  // Notes), Meeting Notes, then everything else flat. ──────────────────────
  let groups = [];
  let sourcesLoaded = false;
  let sourcesLoading = false;
  let detailsSelected = false;
  let selectedGroups = new Set();
  let selectedMeetingIds = new Set();
  let expandedGroups = new Set(['trackers', 'meetings']);

  let sourcesOpen = false;
  let sourcesBtn;
  let popoverStyle = '';

  onMount(loadSources);

  async function loadSources() {
    if (sourcesLoaded || sourcesLoading) return;
    sourcesLoading = true;
    try {
      const data = await getChatSources(project.id);
      groups = data.groups || [];
      detailsSelected = groups.some(g => g.key === 'project_details');
      sourcesLoaded = true;
    } catch (err) {
      error = err.message;
    } finally {
      sourcesLoading = false;
    }
  }

  $: meetingGroup = groups.find(g => g.key === 'meetings');
  $: detailsGroup = groups.find(g => g.key === 'project_details');
  $: trackerGroups = TRACKER_KEYS.map(k => groups.find(g => g.key === k)).filter(Boolean);
  $: otherGroups = groups.filter(g =>
    !['project_details', 'meetings', ...TRACKER_KEYS, ...HIDDEN_GROUP_KEYS].includes(g.key)
  );

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

  $: selectableGroupKeys = [
    ...trackerGroups.filter(g => g.count > 0).map(g => g.key),
    ...otherGroups.filter(g => g.count > 0).map(g => g.key),
  ];

  $: allSelected =
    (!detailsGroup || detailsSelected) &&
    (meetingGroup?.items ?? []).every(m => selectedMeetingIds.has(m.id)) &&
    selectableGroupKeys.every(k => selectedGroups.has(k)) &&
    groups.length > 0;

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

  $: trackerSelectableKeys = trackerGroups.filter(g => g.count > 0).map(g => g.key);
  $: trackerAllSelected = trackerSelectableKeys.length > 0 && trackerSelectableKeys.every(k => selectedGroups.has(k));
  $: trackerAnySelected = trackerSelectableKeys.some(k => selectedGroups.has(k));

  function toggleTrackersGroup() {
    const next = new Set(selectedGroups);
    if (trackerAllSelected) { for (const k of trackerSelectableKeys) next.delete(k); }
    else { for (const k of trackerSelectableKeys) next.add(k); }
    selectedGroups = next;
  }

  $: selectedCount = (detailsSelected ? 1 : 0) + selectedMeetingIds.size + selectedGroups.size;
  $: anySelected = selectedCount > 0;

  $: detailsChars = detailsSelected ? (detailsGroup?.chars ?? 0) : 0;
  $: meetingChars = (meetingGroup?.items ?? []).filter(m => selectedMeetingIds.has(m.id)).reduce((acc, m) => acc + (m.chars ?? 0), 0);
  $: tableChars = groups.filter(g => selectedGroups.has(g.key)).reduce((acc, g) => acc + (g.chars ?? 0), 0);
  $: totalChars = detailsChars + meetingChars + tableChars;
  $: contextPct = Math.min(100, Math.round(totalChars / CONTEXT_BUDGET * 100));
  $: contextColour = contextPct >= 75 ? 'var(--color-red-600)' : contextPct >= 50 ? 'var(--color-amber-600)' : 'var(--color-emerald-600)';
  $: overBudget = totalChars > CONTEXT_BUDGET;

  const fmtChars = c => c >= 1000 ? `${Math.round(c / 1000)}k` : `${c}`;

  function buildSourcesPayload() {
    return {
      project_details: detailsSelected,
      document_ids: [], // Project Docs is being phased out as a chat source
      meeting_ids: [...selectedMeetingIds],
      groups: [...selectedGroups],
    };
  }

  async function toggleSourcesPopover() {
    if (!sourcesOpen) await loadSources();
    sourcesOpen = !sourcesOpen;
    if (sourcesOpen) {
      await tick();
      const rect = sourcesBtn.getBoundingClientRect();
      popoverStyle = `top:${rect.bottom + 6}px; left:${Math.max(8, rect.right - 300)}px;`;
    }
  }

  function closeSourcesPopover() {
    sourcesOpen = false;
  }

  async function send() {
    const question = input.trim();
    if (!question || sending || !anySelected || overBudget) return;

    error = null;
    messages = [...messages, { role: 'user', content: question }];
    input = '';
    sending = true;
    await scrollToBottom();

    try {
      const result = await sendProjectChat(project.id, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        sources: buildSourcesPayload(),
      });
      messages = [...messages, { role: 'assistant', content: result.reply }];
    } catch (err) {
      error = err.message;
      messages = messages.slice(0, -1);
      input = question;
    } finally {
      sending = false;
      await scrollToBottom();
    }
  }

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<svelte:window on:click={closeSourcesPopover} />

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-comment-dots"></i>
      Project Chat
    </div>
    <div class="cw-head-actions">
      <button
        class="cw-sources-btn"
        class:cw-sources-btn-active={sourcesOpen}
        bind:this={sourcesBtn}
        on:click|stopPropagation={toggleSourcesPopover}
        title="Choose which sources the chat can read from"
      >
        <i class="las la-layer-group"></i>
        Sources
        {#if sourcesLoaded}<span class="cw-sources-count">{selectedCount}</span>{/if}
      </button>
      <button class="widget-expand" on:click={() => openProjectModal(projectId, 'project_chat', 'details')}>
        Open <i class="las la-angle-right"></i>
      </button>
    </div>
  </div>
  <div class="widget-body cw-body">
    <div class="cw-messages" bind:this={scrollEl}>
      {#if !messages.length}
        <p class="cw-empty">Ask a question about this project.</p>
      {/if}
      {#each messages as m}
        <div class="cw-bubble" class:cw-bubble-user={m.role === 'user'} class:cw-bubble-assistant={m.role === 'assistant'}>
          {m.content}
        </div>
      {/each}
      {#if sending}
        <div class="cw-bubble cw-bubble-assistant cw-thinking"><span class="mini-spinner"></span> Thinking…</div>
      {/if}
    </div>
    {#if error}<div class="cw-error">{error}</div>{/if}
    <div class="cw-input-row">
      <textarea
        rows="1"
        placeholder={!anySelected ? 'Tick at least one source above…' : 'Ask about this project…'}
        bind:value={input}
        on:keydown={handleKeydown}
        disabled={sending}
      ></textarea>
      <button class="cw-send" on:click={send} disabled={!input.trim() || sending || !anySelected || overBudget} title="Send">
        <i class="las la-arrow-right"></i>
      </button>
    </div>
  </div>
</div>

{#if sourcesOpen}
  <div class="cw-sources-popover" style={popoverStyle} on:click|stopPropagation>
    {#if sourcesLoading && !sourcesLoaded}
      <div class="cw-sources-loading"><span class="mini-spinner"></span> Loading sources…</div>
    {:else}
      <div class="cw-sources-scroll">
        <label class="cw-src-row cw-src-row-all">
          <input type="checkbox" checked={allSelected} on:change={toggleSelectAll} />
          <span>Select all</span>
        </label>

        {#if detailsGroup}
          <label class="cw-src-row">
            <input type="checkbox" bind:checked={detailsSelected} />
            <span class="cw-src-label">Project Details</span>
            <span class="cw-src-chars">{fmtChars(detailsGroup.chars)}</span>
          </label>
        {/if}

        {#if trackerGroups.length}
          <div class="cw-src-group">
            <div class="cw-src-row cw-src-row-group">
              <input
                type="checkbox"
                checked={trackerAllSelected}
                indeterminate={trackerAnySelected && !trackerAllSelected}
                disabled={trackerSelectableKeys.length === 0}
                on:change={toggleTrackersGroup}
              />
              <button class="cw-src-group-toggle" on:click={() => toggleGroupExpand('trackers')}>
                <i class="las {expandedGroups.has('trackers') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span class="cw-src-label">Trackers</span>
              </button>
            </div>
            {#if expandedGroups.has('trackers')}
              {#each trackerGroups as group}
                <label class="cw-src-row cw-src-row-item" class:cw-src-row-disabled={group.count === 0}>
                  <input
                    type="checkbox"
                    checked={selectedGroups.has(group.key)}
                    disabled={group.count === 0}
                    on:change={() => toggleTableGroup(group.key)}
                  />
                  <span class="cw-src-label">{group.label} ({group.count})</span>
                </label>
              {/each}
            {/if}
          </div>
        {/if}

        {#if meetingGroup}
          {@const ids = (meetingGroup.items ?? []).map(i => i.id)}
          <div class="cw-src-group">
            <div class="cw-src-row cw-src-row-group">
              <input
                type="checkbox"
                checked={ids.length > 0 && ids.every(id => selectedMeetingIds.has(id))}
                indeterminate={ids.some(id => selectedMeetingIds.has(id)) && !ids.every(id => selectedMeetingIds.has(id))}
                disabled={ids.length === 0}
                on:change={toggleMeetingsGroup}
              />
              <button class="cw-src-group-toggle" on:click={() => toggleGroupExpand('meetings')}>
                <i class="las {expandedGroups.has('meetings') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span class="cw-src-label">{meetingGroup.label} ({meetingGroup.items.length})</span>
              </button>
            </div>
            {#if expandedGroups.has('meetings')}
              {#each meetingGroup.items as item}
                <label class="cw-src-row cw-src-row-item">
                  <input type="checkbox" checked={selectedMeetingIds.has(item.id)} on:change={() => toggleItem(item.id)} />
                  <span class="cw-src-label" title={item.label}>{item.label}</span>
                  <span class="cw-src-chars">{fmtChars(item.chars)}</span>
                </label>
              {:else}
                <div class="cw-src-empty">None yet</div>
              {/each}
            {/if}
          </div>
        {/if}

        {#each otherGroups as group}
          <label class="cw-src-row" class:cw-src-row-disabled={group.count === 0}>
            <input
              type="checkbox"
              checked={selectedGroups.has(group.key)}
              disabled={group.count === 0}
              on:change={() => toggleTableGroup(group.key)}
            />
            <span class="cw-src-label">{group.label} ({group.count})</span>
          </label>
        {/each}
      </div>

      <div class="cw-context-bar">
        <span>~{contextPct}% of context window</span>
        <div class="cw-context-track">
          <div class="cw-context-fill" style="width:{contextPct}%; background:{contextColour}"></div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .cw-body { display: flex; flex-direction: column; gap: 8px; height: 100%; }
  .cw-messages { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .cw-empty { font-size: 0.78rem; color: var(--color-slate-400); text-align: center; margin: auto; }

  .cw-bubble { max-width: 88%; font-size: 11.5px; padding: 8px 11px; line-height: 1.5; }
  .cw-bubble-user { align-self: flex-end; background: var(--color-primary-600); color: var(--color-white); border-radius: 11px 11px 2px 11px; }
  .cw-bubble-assistant { align-self: flex-start; background: var(--color-slate-100); color: var(--color-slate-700); border-radius: 11px 11px 11px 2px; }
  .cw-thinking { display: flex; align-items: center; gap: 6px; }

  .cw-error { font-size: 0.72rem; color: var(--color-red-600); }

  .cw-head-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .cw-sources-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: var(--radius-pill);
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-600);
    cursor: pointer; font-family: inherit;
  }
  .cw-sources-btn:hover { background: var(--color-slate-50); }
  .cw-sources-btn-active { border-color: var(--color-primary-200); background: var(--color-primary-50); color: var(--color-primary-700); }
  .cw-sources-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 14px; height: 14px; padding: 0 4px; border-radius: var(--radius-pill);
    background: var(--color-slate-800); color: var(--color-white); font-size: 0.625rem; font-weight: 700;
  }
  .cw-sources-btn-active .cw-sources-count { background: var(--color-primary-600); }

  .cw-input-row {
    display: flex; align-items: flex-end; gap: 6px;
    border: 1px solid var(--color-slate-200); border-radius: 9px; padding: 6px 6px 6px 10px; flex-shrink: 0;
  }
  .cw-input-row textarea {
    flex: 1; border: none; resize: none; font-family: inherit; font-size: 11.5px;
    color: var(--color-slate-800); max-height: 4.5em; background: none;
  }
  .cw-input-row textarea:focus { outline: none; }
  .cw-send {
    width: 26px; height: 26px; flex-shrink: 0; border-radius: 7px; border: none;
    background: var(--color-primary-600); color: var(--color-white); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .cw-send:disabled { opacity: 0.4; cursor: not-allowed; }

  .mini-spinner {
    display: inline-block; width: 0.8rem; height: 0.8rem;
    border: 2px solid var(--color-slate-300); border-top-color: var(--color-slate-600);
    border-radius: 50%; animation: cw-spin 0.7s linear infinite;
  }
  @keyframes cw-spin { to { transform: rotate(360deg); } }

  /* ── Sources popover — position:fixed so it escapes the widget's own
     overflow:hidden clipping; coordinates are set inline from the trigger
     button's bounding rect. ── */
  .cw-sources-popover {
    position: fixed;
    width: 300px;
    max-height: 380px;
    display: flex;
    flex-direction: column;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    z-index: 50;
  }

  .cw-sources-loading {
    padding: 1rem;
    display: flex; align-items: center; gap: 0.5rem;
    color: var(--color-slate-500); font-size: 0.8rem;
  }

  .cw-sources-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem; }

  .cw-src-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.3rem 0.4rem; border-radius: 6px;
    font-size: 0.8125rem; color: var(--color-slate-700); cursor: pointer;
  }
  .cw-src-row:hover { background: var(--color-slate-50); }
  .cw-src-row input[type="checkbox"] { flex-shrink: 0; cursor: pointer; }
  .cw-src-row-disabled { opacity: 0.45; cursor: default; }

  .cw-src-row-all {
    font-weight: 600;
    border-bottom: 1px solid var(--color-slate-200);
    border-radius: 0;
    margin-bottom: 0.3rem;
    padding-bottom: 0.45rem;
  }

  .cw-src-group { margin-bottom: 0.15rem; }
  .cw-src-row-group { font-weight: 600; cursor: default; }
  .cw-src-row-item { padding-left: 1.6rem; }

  .cw-src-group-toggle {
    display: flex; align-items: center; gap: 0.25rem;
    flex: 1; min-width: 0;
    background: none; border: none; padding: 0;
    font-family: inherit; font-size: 0.8125rem; font-weight: 600;
    color: var(--color-slate-700); cursor: pointer; text-align: left;
  }

  .cw-src-label {
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .cw-src-chars { margin-left: auto; font-size: 0.6875rem; color: var(--color-slate-400); flex-shrink: 0; }

  .cw-src-empty {
    padding: 0.15rem 0.4rem 0.15rem 1.6rem;
    font-size: 0.75rem; color: var(--color-slate-400); font-style: italic;
  }

  .cw-context-bar {
    border-top: 1px solid var(--color-slate-200);
    padding: 0.5rem 0.65rem;
    display: flex; flex-direction: column; gap: 0.3rem;
    background: var(--color-slate-50);
    font-size: 0.6875rem; color: var(--color-slate-500);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .cw-context-track { height: 5px; border-radius: 3px; background: var(--color-slate-200); overflow: hidden; }
  .cw-context-fill { height: 100%; border-radius: 3px; transition: width 0.2s ease, background 0.2s ease; }
</style>
