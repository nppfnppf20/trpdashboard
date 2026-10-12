<script>
  // The "Sources" button and popover for the saved-schemes chat. Same look and behaviour as the Overview page's Project
  // Chat widget (Project Details, Trackers, Meeting Notes, other groups, a context bar), with the project's relevant
  // policies listed individually so single policies can be ticked.
  import { onMount, tick } from 'svelte';
  import { getChatSources } from '$lib/api/projectChat.js';

  export let projectId;
  export let policies = []; // [{ id, policy_reference, policy_name, policy_text, relevant_supporting_text, notes }]
  export let value; // bound: { project_details: boolean, groups: string[], meeting_ids: number[], policy_ids: number[] }
  export let docChars = 0; // characters of the ticked schemes' documents, so the bar shows the whole context
  export let contextPct = 0; // bound out

  const DOC_BUDGET = 600000; // matches the server limits
  const SOURCE_BUDGET = 100000;
  const HIDDEN_GROUP_KEYS = ['key_issues', 'actions', 'documents', 'policies'];
  const TRACKER_KEYS = ['consultation', 'conditions', 'issues_tracker'];

  let groups = [];
  let loaded = false;
  let loading = false;
  let loadError = '';
  let open = false;
  let btn;
  let popoverStyle = '';
  let expanded = new Set(['trackers', 'meetings', 'policies']);

  onMount(load);

  async function load() {
    if (loaded || loading) return;
    loading = true;
    loadError = '';
    try {
      const data = await getChatSources(projectId);
      groups = data.groups || [];
      loaded = true;
    } catch (err) {
      loadError = err.message;
    } finally {
      loading = false;
    }
  }

  $: meetingGroup = groups.find(g => g.key === 'meetings');
  $: detailsGroup = groups.find(g => g.key === 'project_details');
  $: trackerGroups = TRACKER_KEYS.map(k => groups.find(g => g.key === k)).filter(Boolean);
  $: otherGroups = groups.filter(g => !['project_details', 'meetings', ...TRACKER_KEYS, ...HIDDEN_GROUP_KEYS].includes(g.key));

  $: groupSet = new Set(value.groups);
  $: meetingSet = new Set(value.meeting_ids);
  $: policySet = new Set(value.policy_ids);

  const set = (key, next) => (value = { ...value, [key]: next });
  const toggleIn = (list, id) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const toggleGroup = key => set('groups', toggleIn(value.groups, key));
  const toggleMeeting = id => set('meeting_ids', toggleIn(value.meeting_ids, id));
  const togglePolicy = id => set('policy_ids', toggleIn(value.policy_ids, id));
  const toggleExpand = key => (expanded = expanded.has(key) ? new Set([...expanded].filter(k => k !== key)) : new Set([...expanded, key]));

  $: trackerKeys = trackerGroups.filter(g => g.count > 0).map(g => g.key);
  $: trackerAll = trackerKeys.length > 0 && trackerKeys.every(k => groupSet.has(k));
  $: trackerAny = trackerKeys.some(k => groupSet.has(k));
  function toggleTrackers() {
    set('groups', trackerAll ? value.groups.filter(k => !trackerKeys.includes(k)) : [...new Set([...value.groups, ...trackerKeys])]);
  }

  $: meetingIds = (meetingGroup?.items ?? []).map(i => i.id);
  $: meetingsAll = meetingIds.length > 0 && meetingIds.every(id => meetingSet.has(id));
  $: meetingsAny = meetingIds.some(id => meetingSet.has(id));
  const toggleMeetings = () => set('meeting_ids', meetingsAll ? [] : meetingIds);

  $: policyIds = policies.map(p => p.id);
  $: policiesAll = policyIds.length > 0 && policyIds.every(id => policySet.has(id));
  $: policiesAny = policyIds.some(id => policySet.has(id));
  const togglePolicies = () => set('policy_ids', policiesAll ? [] : policyIds);

  $: selectableGroupKeys = [...trackerKeys, ...otherGroups.filter(g => g.count > 0).map(g => g.key)];
  $: allSelected =
    groups.length > 0 &&
    (!detailsGroup || value.project_details) &&
    meetingIds.every(id => meetingSet.has(id)) &&
    policyIds.every(id => policySet.has(id)) &&
    selectableGroupKeys.every(k => groupSet.has(k));

  function toggleAll() {
    if (allSelected) {
      value = { project_details: false, groups: [], meeting_ids: [], policy_ids: [] };
    } else {
      value = { project_details: !!detailsGroup, groups: selectableGroupKeys, meeting_ids: meetingIds, policy_ids: policyIds };
    }
  }

  const policyChars = p => (p.policy_text?.length ?? 0) + (p.relevant_supporting_text?.length ?? 0) + (p.notes?.length ?? 0);

  $: sourceChars =
    (value.project_details ? (detailsGroup?.chars ?? 0) : 0) +
    (meetingGroup?.items ?? []).filter(m => meetingSet.has(m.id)).reduce((n, m) => n + (m.chars ?? 0), 0) +
    groups.filter(g => groupSet.has(g.key)).reduce((n, g) => n + (g.chars ?? 0), 0) +
    policies.filter(p => policySet.has(p.id)).reduce((n, p) => n + policyChars(p), 0);
  $: usedChars = docChars + Math.min(sourceChars, SOURCE_BUDGET);
  $: contextPct = Math.min(100, Math.round((usedChars / (DOC_BUDGET + SOURCE_BUDGET)) * 100));
  $: contextColour = contextPct >= 75 ? 'var(--color-red-600)' : contextPct >= 50 ? 'var(--color-amber-600)' : 'var(--color-emerald-600)';
  $: sourcesCut = sourceChars > SOURCE_BUDGET;

  $: selectedCount = (value.project_details ? 1 : 0) + value.groups.length + value.meeting_ids.length + value.policy_ids.length;

  const fmtChars = c => (c >= 1000 ? `${Math.round(c / 1000)}k` : `${c}`);
  const policyLabel = p => `${p.policy_reference ? `${p.policy_reference} ` : ''}${p.policy_name}`;

  async function togglePopover() {
    if (!open) await load();
    open = !open;
    if (open) {
      await tick();
      const rect = btn.getBoundingClientRect();
      popoverStyle = `top:${rect.bottom + 6}px; left:${Math.max(8, rect.right - 300)}px;`;
    }
  }
</script>

<svelte:window on:click={() => (open = false)} />

<button class="ss-btn" class:ss-btn-active={open} bind:this={btn} on:click|stopPropagation={togglePopover} title="Choose which project sources the chat can read from">
  <i class="las la-layer-group"></i>
  Sources
  <span class="ss-count">{selectedCount}</span>
</button>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="ss-popover" style={popoverStyle} on:click|stopPropagation>
    {#if loading && !loaded}
      <div class="ss-loading"><span class="ss-spinner"></span> Loading sources…</div>
    {:else if loadError}
      <div class="ss-loading">{loadError}</div>
    {:else}
      <div class="ss-scroll">
        <label class="ss-row ss-row-all">
          <input type="checkbox" checked={allSelected} on:change={toggleAll} />
          <span>Select all</span>
        </label>

        {#if detailsGroup}
          <label class="ss-row">
            <input type="checkbox" checked={value.project_details} on:change={() => (value = { ...value, project_details: !value.project_details })} />
            <span class="ss-label">Project Details</span>
            <span class="ss-chars">{fmtChars(detailsGroup.chars)}</span>
          </label>
        {/if}

        {#if trackerGroups.length}
          <div class="ss-group">
            <div class="ss-row ss-row-group">
              <input type="checkbox" checked={trackerAll} indeterminate={trackerAny && !trackerAll} disabled={trackerKeys.length === 0} on:change={toggleTrackers} />
              <button class="ss-group-toggle" on:click={() => toggleExpand('trackers')}>
                <i class="las {expanded.has('trackers') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span class="ss-label">Trackers</span>
              </button>
            </div>
            {#if expanded.has('trackers')}
              {#each trackerGroups as group}
                <label class="ss-row ss-row-item" class:ss-row-disabled={group.count === 0}>
                  <input type="checkbox" checked={groupSet.has(group.key)} disabled={group.count === 0} on:change={() => toggleGroup(group.key)} />
                  <span class="ss-label">{group.label} ({group.count})</span>
                </label>
              {/each}
            {/if}
          </div>
        {/if}

        {#if policies.length}
          <div class="ss-group">
            <div class="ss-row ss-row-group">
              <input type="checkbox" checked={policiesAll} indeterminate={policiesAny && !policiesAll} on:change={togglePolicies} />
              <button class="ss-group-toggle" on:click={() => toggleExpand('policies')}>
                <i class="las {expanded.has('policies') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span class="ss-label">Relevant Policies ({policies.length})</span>
              </button>
            </div>
            {#if expanded.has('policies')}
              {#each policies as p (p.id)}
                <label class="ss-row ss-row-item">
                  <input type="checkbox" checked={policySet.has(p.id)} on:change={() => togglePolicy(p.id)} />
                  <span class="ss-label" title={policyLabel(p)}>{policyLabel(p)}</span>
                  <span class="ss-chars">{fmtChars(policyChars(p))}</span>
                </label>
              {/each}
            {/if}
          </div>
        {/if}

        {#if meetingGroup}
          <div class="ss-group">
            <div class="ss-row ss-row-group">
              <input type="checkbox" checked={meetingsAll} indeterminate={meetingsAny && !meetingsAll} disabled={meetingIds.length === 0} on:change={toggleMeetings} />
              <button class="ss-group-toggle" on:click={() => toggleExpand('meetings')}>
                <i class="las {expanded.has('meetings') ? 'la-angle-down' : 'la-angle-right'}"></i>
                <span class="ss-label">{meetingGroup.label} ({meetingGroup.items.length})</span>
              </button>
            </div>
            {#if expanded.has('meetings')}
              {#each meetingGroup.items as item}
                <label class="ss-row ss-row-item">
                  <input type="checkbox" checked={meetingSet.has(item.id)} on:change={() => toggleMeeting(item.id)} />
                  <span class="ss-label" title={item.label}>{item.label}</span>
                  <span class="ss-chars">{fmtChars(item.chars)}</span>
                </label>
              {:else}
                <div class="ss-empty">None yet</div>
              {/each}
            {/if}
          </div>
        {/if}

        {#each otherGroups as group}
          <label class="ss-row" class:ss-row-disabled={group.count === 0}>
            <input type="checkbox" checked={groupSet.has(group.key)} disabled={group.count === 0} on:change={() => toggleGroup(group.key)} />
            <span class="ss-label">{group.label} ({group.count})</span>
          </label>
        {/each}
      </div>

      <div class="ss-context-bar">
        <span>~{contextPct}% of context window{docChars ? ' (ticked scheme documents included)' : ''}</span>
        <div class="ss-context-track"><div class="ss-context-fill" style="width:{contextPct}%; background:{contextColour}"></div></div>
        {#if sourcesCut}<span>Project sources are over {fmtChars(SOURCE_BUDGET)} characters, so the later ones will be cut short.</span>{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ss-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: var(--radius-pill);
    border: 1px solid var(--color-slate-200); background: var(--color-white);
    font-size: 0.6875rem; font-weight: 600; color: var(--color-slate-600);
    cursor: pointer; font-family: inherit;
  }
  .ss-btn:hover { background: var(--color-slate-50); }
  .ss-btn-active { border-color: var(--color-primary-200); background: var(--color-primary-50); color: var(--color-primary-700); }
  .ss-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 14px; height: 14px; padding: 0 4px; border-radius: var(--radius-pill);
    background: var(--color-slate-800); color: var(--color-white); font-size: 0.625rem; font-weight: 700;
  }
  .ss-btn-active .ss-count { background: var(--color-primary-600); }

  /* position:fixed so the popover escapes the panel's overflow clipping; coordinates come from the button's rect. */
  .ss-popover {
    position: fixed;
    width: 300px;
    max-height: 380px;
    display: flex;
    flex-direction: column;
    background: var(--color-white);
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-dropdown);
    z-index: 1200;
  }

  .ss-loading { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--color-slate-500); font-size: 0.8rem; }
  .ss-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem; }

  .ss-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.3rem 0.4rem; border-radius: 6px;
    font-size: 0.8125rem; color: var(--color-slate-700); cursor: pointer;
  }
  .ss-row:hover { background: var(--color-slate-50); }
  .ss-row input[type='checkbox'] { flex-shrink: 0; cursor: pointer; }
  .ss-row-disabled { opacity: 0.45; cursor: default; }
  .ss-row-all { font-weight: 600; border-bottom: 1px solid var(--color-slate-200); border-radius: 0; margin-bottom: 0.3rem; padding-bottom: 0.45rem; }

  .ss-group { margin-bottom: 0.15rem; }
  .ss-row-group { font-weight: 600; cursor: default; }
  .ss-row-item { padding-left: 1.6rem; }

  .ss-group-toggle {
    display: flex; align-items: center; gap: 0.25rem; flex: 1; min-width: 0;
    background: none; border: none; padding: 0; font-family: inherit; font-size: 0.8125rem; font-weight: 600;
    color: var(--color-slate-700); cursor: pointer; text-align: left;
  }

  .ss-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ss-chars { margin-left: auto; font-size: 0.6875rem; color: var(--color-slate-400); flex-shrink: 0; }
  .ss-empty { padding: 0.15rem 0.4rem 0.15rem 1.6rem; font-size: 0.75rem; color: var(--color-slate-400); font-style: italic; }

  .ss-context-bar {
    border-top: 1px solid var(--color-slate-200); padding: 0.5rem 0.65rem; display: flex; flex-direction: column; gap: 0.3rem;
    background: var(--color-slate-50); font-size: 0.6875rem; color: var(--color-slate-500); border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
  .ss-context-track { height: 5px; border-radius: 3px; background: var(--color-slate-200); overflow: hidden; }
  .ss-context-fill { height: 100%; border-radius: 3px; transition: width 0.2s ease, background 0.2s ease; }

  .ss-spinner {
    display: inline-block; width: 0.8rem; height: 0.8rem; border: 2px solid var(--color-slate-300);
    border-top-color: var(--color-slate-600); border-radius: 50%; animation: ss-spin 0.7s linear infinite;
  }
  @keyframes ss-spin { to { transform: rotate(360deg); } }
</style>
