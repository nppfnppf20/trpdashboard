<script>
  // Standalone cross-project chat — deliberately separate from
  // ChatWidget.svelte (single-project). See crossProjectChat.service.js for
  // why: citations here are qualified per-project ("57:COND") to avoid two
  // projects' identically-named trackers colliding, which the single-project
  // widget has no need for. Same flat "everything ticked goes into the
  // prompt" design, just unioned across a handful of projects — no
  // retrieval/RAG here either.
  import { tick, onMount } from 'svelte';
  import { getCrossProjectSources, sendCrossProjectChat } from '$lib/api/crossProjectChat.js';
  import { getEmailTones } from '$lib/api/emailTones.js';
  import { renderReply, buildMultiProjectSourceLabels, copyReplyToClipboard } from '$lib/utils/chatMarkdown.js';

  export let projects = []; // [{ id, project_name, ... }]

  const CONTEXT_BUDGET = 200000;
  const HIDDEN_GROUP_KEYS = ['key_issues', 'actions', 'documents'];
  const TRACKER_KEYS = ['consultation', 'conditions', 'issues_tracker'];

  let messages = [];
  let input = '';
  let sending = false;
  let error = null;
  let scrollEl;

  // catalogues: [{ id, project_name, groups }]
  let catalogues = [];
  let sourcesLoaded = false;
  let sourcesLoading = false;
  let loadedKey = null;

  // Selection, keyed by project id: { [id]: { detailsSelected, selectedGroups: Set, selectedMeetingIds: Set } }
  let selection = {};
  let expandedProjects = new Set();

  let sourcesOpen = false;
  let sourcesBtn;
  let popoverStyle = '';

  // ── Email tones — a user's saved tones for drafting emails in this chat.
  // The default tone (if any) is pre-selected; sticky for the session only,
  // not persisted. ──────────────────────────────────────────────────────────
  let tones = [];
  let tonesLoaded = false;
  let tonesLoading = false;
  let selectedToneId = null;
  let toneOpen = false;
  let toneBtn;
  let tonePopoverStyle = '';

  onMount(loadTones);

  async function loadTones() {
    if (tonesLoaded || tonesLoading) return;
    tonesLoading = true;
    try {
      tones = await getEmailTones();
      const defaultTone = tones.find(t => t.is_default);
      if (defaultTone) selectedToneId = defaultTone.id;
      tonesLoaded = true;
    } catch (err) {
      console.error('Error loading email tones:', err);
    } finally {
      tonesLoading = false;
    }
  }

  $: selectedTone = tones.find(t => t.id === selectedToneId) ?? null;

  async function toggleTonePopover() {
    if (!tonesLoaded) await loadTones();
    sourcesOpen = false;
    toneOpen = !toneOpen;
    if (toneOpen) {
      await tick();
      const rect = toneBtn.getBoundingClientRect();
      tonePopoverStyle = `top:${rect.bottom + 6}px; left:${Math.max(8, rect.right - 260)}px;`;
    }
  }

  function pickTone(id) {
    selectedToneId = id;
    toneOpen = false;
  }

  $: {
    const key = projects.map(p => p.id).sort((a, b) => a - b).join(',');
    if (key && key !== loadedKey) {
      loadedKey = key;
      loadSources();
    }
  }

  async function loadSources() {
    sourcesLoading = true;
    try {
      const projectIds = projects.map(p => p.id);
      const { projects: results } = await getCrossProjectSources(projectIds);
      catalogues = results.map(r => ({
        ...r,
        project_name: projects.find(p => p.id === r.id)?.project_name || `Project ${r.id}`,
      }));

      const nextSelection = {};
      for (const cat of catalogues) {
        const detailsGroup = cat.groups.find(g => g.key === 'project_details');
        const biggestTracker = TRACKER_KEYS
          .map(k => cat.groups.find(g => g.key === k))
          .filter(g => g && g.count > 0)
          .reduce((a, b) => (!a || b.chars > a.chars ? b : a), null);
        nextSelection[cat.id] = {
          detailsSelected: !!detailsGroup,
          selectedGroups: new Set(biggestTracker ? [biggestTracker.key] : []),
          selectedMeetingIds: new Set(),
        };
      }
      selection = nextSelection;
      expandedProjects = new Set(catalogues.map(c => c.id));
      sourcesLoaded = true;
    } catch (err) {
      error = err.message;
    } finally {
      sourcesLoading = false;
    }
  }

  $: sourceLabels = buildMultiProjectSourceLabels(catalogues);

  function projectGroups(cat, key) {
    return cat.groups.filter(g =>
      key === 'meetings' ? g.key === 'meetings' :
      key === 'other' ? !['project_details', 'meetings', ...HIDDEN_GROUP_KEYS].includes(g.key) :
      false
    );
  }

  function toggleProjectExpand(id) {
    expandedProjects = expandedProjects.has(id)
      ? new Set([...expandedProjects].filter(x => x !== id))
      : new Set([...expandedProjects, id]);
  }

  function updateSelection(projectId, patch) {
    selection = { ...selection, [projectId]: { ...selection[projectId], ...patch } };
  }

  function toggleDetails(projectId) {
    updateSelection(projectId, { detailsSelected: !selection[projectId].detailsSelected });
  }

  function toggleGroup(projectId, key) {
    const next = new Set(selection[projectId].selectedGroups);
    next.has(key) ? next.delete(key) : next.add(key);
    updateSelection(projectId, { selectedGroups: next });
  }

  function toggleMeeting(projectId, id) {
    const next = new Set(selection[projectId].selectedMeetingIds);
    next.has(id) ? next.delete(id) : next.add(id);
    updateSelection(projectId, { selectedMeetingIds: next });
  }

  $: selectedCount = Object.values(selection).reduce((sum, s) =>
    sum + (s.detailsSelected ? 1 : 0) + s.selectedGroups.size + s.selectedMeetingIds.size, 0);
  $: anySelected = selectedCount > 0;

  $: totalChars = catalogues.reduce((sum, cat) => {
    const sel = selection[cat.id];
    if (!sel) return sum;
    const detailsGroup = cat.groups.find(g => g.key === 'project_details');
    const meetingGroup = cat.groups.find(g => g.key === 'meetings');
    const detailsChars = sel.detailsSelected ? (detailsGroup?.chars ?? 0) : 0;
    const meetingChars = (meetingGroup?.items ?? [])
      .filter(m => sel.selectedMeetingIds.has(m.id))
      .reduce((acc, m) => acc + (m.chars ?? 0), 0);
    const tableChars = cat.groups.filter(g => sel.selectedGroups.has(g.key)).reduce((acc, g) => acc + (g.chars ?? 0), 0);
    return sum + detailsChars + meetingChars + tableChars;
  }, 0);
  $: contextPct = Math.min(100, Math.round(totalChars / CONTEXT_BUDGET * 100));
  $: contextColour = contextPct >= 75 ? 'var(--color-red-600)' : contextPct >= 50 ? 'var(--color-amber-600)' : 'var(--color-emerald-600)';
  $: overBudget = totalChars > CONTEXT_BUDGET;

  const fmtChars = c => c >= 1000 ? `${Math.round(c / 1000)}k` : `${c}`;

  function buildSourcesPayload() {
    const out = {};
    for (const [projectId, sel] of Object.entries(selection)) {
      if (!sel.detailsSelected && sel.selectedGroups.size === 0 && sel.selectedMeetingIds.size === 0) continue;
      out[projectId] = {
        project_details: sel.detailsSelected,
        document_ids: [],
        meeting_ids: [...sel.selectedMeetingIds],
        groups: [...sel.selectedGroups],
      };
    }
    return out;
  }

  async function toggleSourcesPopover() {
    toneOpen = false;
    sourcesOpen = !sourcesOpen;
    if (sourcesOpen) {
      await tick();
      const rect = sourcesBtn.getBoundingClientRect();
      popoverStyle = `top:${rect.bottom + 6}px; left:${Math.max(8, rect.right - 320)}px;`;
    }
  }

  function closeAllPopovers() {
    sourcesOpen = false;
    toneOpen = false;
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
      const result = await sendCrossProjectChat(projects.map(p => p.id), {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        sources: buildSourcesPayload(),
        emailToneId: selectedToneId,
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

  let copiedIdx = null;

  async function copyReply(idx, content) {
    try {
      await copyReplyToClipboard(content);
      copiedIdx = idx;
      setTimeout(() => { if (copiedIdx === idx) copiedIdx = null; }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<svelte:window on:click={closeAllPopovers} />

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-comments"></i>
      Cross-Project Chat
    </div>
    <div class="cpc-head-actions">
      <button
        class="cpc-sources-btn"
        class:cpc-sources-btn-active={sourcesOpen}
        bind:this={sourcesBtn}
        on:click|stopPropagation={toggleSourcesPopover}
        title="Choose which sources the chat can read from, per project"
      >
        <i class="las la-layer-group"></i>
        Sources
        {#if sourcesLoaded}<span class="cpc-sources-count">{selectedCount}</span>{/if}
      </button>
      <button
        class="cpc-sources-btn"
        class:cpc-sources-btn-active={toneOpen}
        bind:this={toneBtn}
        on:click|stopPropagation={toggleTonePopover}
        title="Pick the tone the assistant should use when it drafts an email"
      >
        <i class="las la-envelope"></i>
        Email
        {#if selectedTone}<span class="cpc-sources-count cpc-tone-count" title={selectedTone.label}>{selectedTone.label}</span>{/if}
      </button>
    </div>
  </div>
  <div class="widget-body cpc-body">
    <div class="cpc-messages" bind:this={scrollEl}>
      {#if !messages.length}
        <p class="cpc-empty">Ask a question across your selected projects.</p>
      {/if}
      {#each messages as m, idx}
        <div class="cpc-bubble" class:cpc-bubble-user={m.role === 'user'} class:cpc-bubble-assistant={m.role === 'assistant'}>
          {#if m.role === 'assistant'}
            {@html renderReply(m.content, sourceLabels)}
            <button class="cpc-copy-btn" on:click={() => copyReply(idx, m.content)} title="Copy response (citations excluded)">
              <i class="las {copiedIdx === idx ? 'la-check' : 'la-copy'}"></i> {copiedIdx === idx ? 'Copied' : 'Copy'}
            </button>
          {:else}
            {m.content}
          {/if}
        </div>
      {/each}
      {#if sending}
        <div class="cpc-bubble cpc-bubble-assistant cpc-thinking"><span class="mini-spinner"></span> Thinking…</div>
      {/if}
    </div>
    {#if error}<div class="cpc-error">{error}</div>{/if}
    <div class="cpc-input-row">
      <textarea
        rows="1"
        placeholder={!anySelected ? 'Tick at least one source above…' : 'Ask across your projects…'}
        bind:value={input}
        on:keydown={handleKeydown}
        disabled={sending}
      ></textarea>
      <button class="cpc-send" on:click={send} disabled={!input.trim() || sending || !anySelected || overBudget} title="Send" aria-label="Send">
        <i class="las la-arrow-right"></i>
      </button>
    </div>
  </div>
</div>

{#if sourcesOpen}
  <div class="cpc-sources-popover" style={popoverStyle} on:click|stopPropagation>
    {#if sourcesLoading && !sourcesLoaded}
      <div class="cpc-sources-loading"><span class="mini-spinner"></span> Loading sources…</div>
    {:else}
      <div class="cpc-sources-scroll">
        {#each catalogues as cat (cat.id)}
          {@const sel = selection[cat.id]}
          {@const detailsGroup = cat.groups.find(g => g.key === 'project_details')}
          {@const meetingGroup = cat.groups.find(g => g.key === 'meetings')}
          {@const otherGroups = projectGroups(cat, 'other')}
          <div class="cpc-project-group">
            <button class="cpc-project-toggle" on:click={() => toggleProjectExpand(cat.id)}>
              <i class="las {expandedProjects.has(cat.id) ? 'la-angle-down' : 'la-angle-right'}"></i>
              <span>{cat.project_name}</span>
            </button>
            {#if expandedProjects.has(cat.id) && sel}
              {#if detailsGroup}
                <label class="cpc-src-row">
                  <input type="checkbox" checked={sel.detailsSelected} on:change={() => toggleDetails(cat.id)} />
                  <span class="cpc-src-label">Project Details</span>
                  <span class="cpc-src-chars">{fmtChars(detailsGroup.chars)}</span>
                </label>
              {/if}
              {#each otherGroups as group}
                <label class="cpc-src-row" class:cpc-src-row-disabled={group.count === 0}>
                  <input
                    type="checkbox"
                    checked={sel.selectedGroups.has(group.key)}
                    disabled={group.count === 0}
                    on:change={() => toggleGroup(cat.id, group.key)}
                  />
                  <span class="cpc-src-label">{group.label} ({group.count})</span>
                </label>
              {/each}
              {#if meetingGroup}
                {#each meetingGroup.items ?? [] as item}
                  <label class="cpc-src-row cpc-src-row-item">
                    <input type="checkbox" checked={sel.selectedMeetingIds.has(item.id)} on:change={() => toggleMeeting(cat.id, item.id)} />
                    <span class="cpc-src-label" title={item.label}>{item.label}</span>
                    <span class="cpc-src-chars">{fmtChars(item.chars)}</span>
                  </label>
                {/each}
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      <div class="cpc-context-bar">
        <span>~{contextPct}% of context window</span>
        <div class="cpc-context-track">
          <div class="cpc-context-fill" style="width:{contextPct}%; background:{contextColour}"></div>
        </div>
      </div>
    {/if}
  </div>
{/if}

{#if toneOpen}
  <div class="cpc-sources-popover cpc-tone-popover" style={tonePopoverStyle} on:click|stopPropagation>
    {#if tonesLoading && !tonesLoaded}
      <div class="cpc-sources-loading"><span class="mini-spinner"></span> Loading tones…</div>
    {:else if !tones.length}
      <div class="cpc-tone-empty">
        No email tones saved yet. Add one from your profile page to have the assistant draft emails in your voice.
      </div>
    {:else}
      <div class="cpc-sources-scroll">
        <button class="cpc-tone-row" class:cpc-tone-row-active={selectedToneId === null} on:click={() => pickTone(null)}>
          <i class="las {selectedToneId === null ? 'la-dot-circle' : 'la-circle'}"></i>
          <span class="cpc-tone-row-label">None</span>
        </button>
        {#each tones as tone}
          <button class="cpc-tone-row" class:cpc-tone-row-active={selectedToneId === tone.id} on:click={() => pickTone(tone.id)}>
            <i class="las {selectedToneId === tone.id ? 'la-dot-circle' : 'la-circle'}"></i>
            <span class="cpc-tone-row-label">{tone.label}</span>
            {#if tone.is_default}<span class="cpc-tone-default">Default</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .cpc-body { display: flex; flex-direction: column; gap: 8px; height: 100%; }
  .cpc-messages { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .cpc-empty { font-size: 0.78rem; color: var(--color-slate-400); text-align: center; margin: auto; }

  .cpc-bubble { max-width: 88%; font-size: 11.5px; padding: 8px 11px; line-height: 1.5; }
  .cpc-bubble-user { align-self: flex-end; background: var(--color-primary-600); color: var(--color-white); border-radius: 11px 11px 2px 11px; }
  .cpc-bubble-assistant { align-self: flex-start; background: var(--color-slate-100); color: var(--color-slate-700); border-radius: 11px 11px 11px 2px; }
  .cpc-thinking { display: flex; align-items: center; gap: 6px; }

  .cpc-bubble-assistant :global(.cite-chip) {
    display: inline-block;
    background: var(--color-violet-100);
    color: var(--color-violet-700);
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0 0.3rem;
    border-radius: 4px;
    vertical-align: baseline;
    white-space: nowrap;
  }

  .cpc-copy-btn {
    display: flex; align-items: center; gap: 3px; margin-top: 5px;
    background: none; border: none; padding: 0;
    font-size: 0.625rem; color: var(--color-slate-500); cursor: pointer; font-weight: 600;
  }
  .cpc-copy-btn:hover { color: var(--color-slate-700); }

  .cpc-error { font-size: 0.72rem; color: var(--color-red-600); }

  .cpc-head-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .cpc-sources-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: var(--radius-pill);
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-600);
    cursor: pointer; font-family: inherit;
  }
  .cpc-sources-btn:hover { background: var(--color-slate-50); }
  .cpc-sources-btn-active { border-color: var(--color-primary-200); background: var(--color-primary-50); color: var(--color-primary-700); }
  .cpc-sources-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 14px; height: 14px; padding: 0 4px; border-radius: var(--radius-pill);
    background: var(--color-slate-800); color: var(--color-white); font-size: 0.625rem; font-weight: 700;
  }
  .cpc-sources-btn-active .cpc-sources-count { background: var(--color-primary-600); }

  .cpc-input-row {
    display: flex; align-items: flex-end; gap: 6px;
    border: 1px solid var(--color-slate-200); border-radius: 9px; padding: 6px 6px 6px 10px; flex-shrink: 0;
  }
  .cpc-input-row textarea {
    flex: 1; border: none; resize: none; font-family: inherit; font-size: 11.5px;
    color: var(--color-slate-800); max-height: 4.5em; background: none;
  }
  .cpc-input-row textarea:focus { outline: none; }
  .cpc-send {
    width: 26px; height: 26px; flex-shrink: 0; border-radius: 7px; border: none;
    background: var(--color-primary-600); color: var(--color-white); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .cpc-send:disabled { opacity: 0.4; cursor: not-allowed; }

  .mini-spinner {
    display: inline-block; width: 0.8rem; height: 0.8rem;
    border: 2px solid var(--color-slate-300); border-top-color: var(--color-slate-600);
    border-radius: 50%; animation: cpc-spin 0.7s linear infinite;
  }
  @keyframes cpc-spin { to { transform: rotate(360deg); } }

  .cpc-sources-popover {
    position: fixed;
    width: 320px;
    max-height: 420px;
    display: flex;
    flex-direction: column;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    z-index: 50;
  }

  .cpc-sources-loading {
    padding: 1rem;
    display: flex; align-items: center; gap: 0.5rem;
    color: var(--color-slate-500); font-size: 0.8rem;
  }

  .cpc-sources-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem; }

  .cpc-project-group { margin-bottom: 0.4rem; }
  .cpc-project-group + .cpc-project-group { border-top: 1px solid var(--color-slate-100); padding-top: 0.4rem; }

  .cpc-project-toggle {
    display: flex; align-items: center; gap: 0.3rem;
    width: 100%; background: none; border: none; padding: 0.2rem 0.4rem;
    font-family: inherit; font-size: 0.8125rem; font-weight: 700;
    color: var(--color-slate-800); cursor: pointer; text-align: left;
  }

  .cpc-src-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.3rem 0.4rem 0.3rem 1.6rem; border-radius: 6px;
    font-size: 0.8125rem; color: var(--color-slate-700); cursor: pointer;
  }
  .cpc-src-row:hover { background: var(--color-slate-50); }
  .cpc-src-row input[type="checkbox"] { flex-shrink: 0; cursor: pointer; }
  .cpc-src-row-disabled { opacity: 0.45; cursor: default; }
  .cpc-src-row-item { padding-left: 2rem; }

  .cpc-src-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cpc-src-chars { margin-left: auto; font-size: 0.6875rem; color: var(--color-slate-400); flex-shrink: 0; }

  .cpc-context-bar {
    border-top: 1px solid var(--color-slate-200);
    padding: 0.5rem 0.65rem;
    display: flex; flex-direction: column; gap: 0.3rem;
    background: var(--color-slate-50);
    font-size: 0.6875rem; color: var(--color-slate-500);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  .cpc-context-track { height: 5px; border-radius: 3px; background: var(--color-slate-200); overflow: hidden; }
  .cpc-context-fill { height: 100%; border-radius: 3px; transition: width 0.2s ease, background 0.2s ease; }

  /* ── Email tone popover ── */
  .cpc-tone-count {
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cpc-tone-popover { width: 260px; max-height: 320px; }

  .cpc-tone-empty {
    padding: 1rem;
    font-size: 0.78rem;
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  .cpc-tone-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.3rem 0.4rem;
    border: none;
    background: none;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.8125rem;
    color: var(--color-slate-700);
    cursor: pointer;
    text-align: left;
  }
  .cpc-tone-row:hover { background: var(--color-slate-50); }
  .cpc-tone-row-active { color: var(--color-primary-700); font-weight: 600; }
  .cpc-tone-row i { flex-shrink: 0; }

  .cpc-tone-row-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cpc-tone-default { font-size: 0.65rem; color: var(--color-slate-400); flex-shrink: 0; }
</style>
