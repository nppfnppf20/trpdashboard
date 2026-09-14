<script>
  import { createEventDispatcher } from 'svelte';

  export let comments = [];

  const dispatch = createEventDispatcher();

  $: open = comments.filter(c => !c.resolved);
  $: resolved = comments.filter(c => c.resolved);

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

<div class="comments-panel">
  <div class="comments-panel-header">
    <span class="comments-panel-title"><i class="las la-comment-alt"></i> Comments</span>
    <button class="comments-panel-close" aria-label="Close comments panel" on:click={() => dispatch('close')}><i class="las la-times"></i></button>
  </div>
  <div class="comments-panel-body">
    {#if !comments.length}
      <p class="comments-empty">No comments yet. Highlight text in the draft and choose "Comment" to leave one.</p>
    {:else}
      {#each open as comment (comment.id)}
        <div class="comment-card">
          <button class="comment-quote" on:click={() => dispatch('locate', comment)} title="Find this passage in the draft">
            <i class="las la-quote-left"></i> {comment.quoted_text}
          </button>
          <p class="comment-body">{comment.body}</p>
          <div class="comment-meta">
            <span>{comment.author_name} &middot; {formatDate(comment.created_at)}</span>
            <div class="comment-meta-actions">
              <button class="comment-action-btn" on:click={() => dispatch('resolve', comment)}><i class="las la-check-circle"></i> Resolve</button>
              <button class="comment-action-btn comment-action-btn--danger" on:click={() => dispatch('delete', comment)}><i class="las la-trash-alt"></i></button>
            </div>
          </div>
        </div>
      {/each}
      {#if resolved.length}
        <div class="comments-resolved-divider">Resolved ({resolved.length})</div>
        {#each resolved as comment (comment.id)}
          <div class="comment-card comment-card--resolved">
            <button class="comment-quote" on:click={() => dispatch('locate', comment)} title="Find this passage in the draft">
              <i class="las la-quote-left"></i> {comment.quoted_text}
            </button>
            <p class="comment-body">{comment.body}</p>
            <div class="comment-meta">
              <span>{comment.author_name} &middot; {formatDate(comment.created_at)}</span>
              <div class="comment-meta-actions">
                <button class="comment-action-btn" on:click={() => dispatch('resolve', comment)}><i class="las la-undo"></i> Reopen</button>
                <button class="comment-action-btn comment-action-btn--danger" on:click={() => dispatch('delete', comment)}><i class="las la-trash-alt"></i></button>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  .comments-panel { height: 100%; overflow-y: auto; }

  .comments-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-slate-200);
  }
  .comments-panel-title { font-size: 0.8rem; font-weight: 700; color: var(--color-slate-800); display: flex; align-items: center; gap: 0.375rem; }
  .comments-panel-close { background: none; border: none; color: var(--color-slate-400); cursor: pointer; padding: 0.2rem; font-size: 1rem; line-height: 1; }
  .comments-panel-close:hover { color: var(--color-slate-700); }

  .comments-panel-body { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem; }

  .comments-empty { font-size: 0.8rem; color: var(--color-slate-400); text-align: center; padding: 1.5rem 0.5rem; }

  .comment-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    background: white;
  }
  .comment-card--resolved { opacity: 0.65; }

  .comment-quote {
    display: block;
    text-align: left;
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
  }
  .comment-quote:hover { background: var(--color-slate-100); }

  .comment-body { font-size: 0.85rem; color: var(--color-slate-800); margin: 0; line-height: 1.45; }

  .comment-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.7rem;
    color: var(--color-slate-400);
  }
  .comment-meta-actions { display: flex; align-items: center; gap: 0.5rem; }

  .comment-action-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    color: var(--color-slate-500);
    font-size: 0.7rem;
    cursor: pointer;
    padding: 0.15rem 0.3rem;
  }
  .comment-action-btn:hover { color: var(--color-primary-600); }
  .comment-action-btn--danger:hover { color: var(--color-red-500); }

  .comments-resolved-divider {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-slate-400);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-top: 0.5rem;
  }
</style>
