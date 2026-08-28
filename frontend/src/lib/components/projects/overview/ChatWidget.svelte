<script>
  import { tick } from 'svelte';
  import { getChatSources, sendProjectChat } from '$lib/api/projectChat.js';
  import { openProjectModal } from '$lib/stores/projectViewModal.js';

  export let project;
  $: projectId = project?.id;

  let messages = [];
  let input = '';
  let sending = false;
  let error = null;
  let scrollEl;

  // Lazily resolved once, the first time a message is sent — same default
  // source selection ProjectChatTab.svelte seeds its own picker with
  // (project details + briefing transcripts), just without a picker UI here.
  let sourcesPayload = null;

  async function resolveDefaultSources() {
    if (sourcesPayload) return sourcesPayload;
    const data = await getChatSources(project.id);
    const groups = data.groups || [];
    const docGroup = groups.find(g => g.key === 'documents');
    sourcesPayload = {
      project_details: groups.some(g => g.key === 'project_details'),
      document_ids: (docGroup?.items ?? []).filter(d => d.doc_type === 'briefing_transcript').map(d => d.id),
      meeting_ids: [],
      groups: [],
    };
    return sourcesPayload;
  }

  async function send() {
    const question = input.trim();
    if (!question || sending) return;

    error = null;
    messages = [...messages, { role: 'user', content: question }];
    input = '';
    sending = true;
    await scrollToBottom();

    try {
      const sources = await resolveDefaultSources();
      const result = await sendProjectChat(project.id, {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        sources,
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

<div class="widget">
  <div class="widget-head">
    <div class="widget-title">
      <i class="las la-comment-dots"></i>
      Project Chat
    </div>
    <button class="widget-expand" on:click={() => openProjectModal(projectId, 'project_chat', 'details')}>
      Open <i class="las la-angle-right"></i>
    </button>
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
        placeholder="Ask about this project…"
        bind:value={input}
        on:keydown={handleKeydown}
        disabled={sending}
      ></textarea>
      <button class="cw-send" on:click={send} disabled={!input.trim() || sending} title="Send">
        <i class="las la-arrow-right"></i>
      </button>
    </div>
  </div>
</div>

<style>
  .cw-body { display: flex; flex-direction: column; gap: 8px; height: 100%; }
  .cw-messages { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .cw-empty { font-size: 0.78rem; color: var(--color-slate-400); text-align: center; margin: auto; }

  .cw-bubble { max-width: 88%; font-size: 11.5px; padding: 8px 11px; line-height: 1.5; }
  .cw-bubble-user { align-self: flex-end; background: var(--color-primary-600); color: var(--color-white); border-radius: 11px 11px 2px 11px; }
  .cw-bubble-assistant { align-self: flex-start; background: var(--color-slate-100); color: var(--color-slate-700); border-radius: 11px 11px 11px 2px; }
  .cw-thinking { display: flex; align-items: center; gap: 6px; }

  .cw-error { font-size: 0.72rem; color: var(--color-red-600); }

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
</style>
