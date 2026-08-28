<script>
  export let section; // { title, feedsLabel, headerNote?, questions: string[], onFile?, priorToolNote? }

  // Collapse by default when we already have a saved document covering this
  let open = !section.onFile;
</script>

<div class="guide-section" class:on-file={section.onFile}>
  <button class="section-header" class:section-header--with-note={!!section.headerNote} on:click={() => (open = !open)}>
    <div class="header-left">
      <i class="las la-{open ? 'chevron-down' : 'chevron-right'} chevron"></i>
      <span class="section-title">{section.title}</span>
      {#if section.onFile}
        <span class="on-file-tag"><i class="las la-check-circle"></i> On file</span>
      {/if}
    </div>
    {#if section.feedsLabel}
      <span class="feeds-tag">feeds → {section.feedsLabel}</span>
    {/if}
  </button>

  {#if section.headerNote}
    <p class="header-note">{section.headerNote}</p>
  {/if}

  {#if open}
    {#if section.onFile}
      <p class="section-note">A summary for this section is already saved for this project - use these questions to confirm nothing has changed rather than covering it from scratch.</p>
    {:else if section.priorToolNote}
      <p class="section-note">{section.priorToolNote}</p>
    {/if}
    <ol class="questions">
      {#each section.questions as q}
        <li>{q}</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .guide-section {
    border: 1px solid var(--color-slate-200);
    border-radius: 8px;
    overflow: hidden;
  }

  .section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--color-slate-50);
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .section-header:hover {
    background: var(--color-slate-100);
  }

  .section-header--with-note {
    padding-bottom: 0.4rem;
  }

  .header-note {
    margin: 0;
    padding: 0 1rem 0.75rem 1rem;
    background: var(--color-slate-50);
    font-size: 0.78rem;
    color: var(--color-slate-500);
    line-height: 1.5;
  }

  .guide-section.on-file .header-note {
    background: var(--color-slate-100);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .guide-section.on-file {
    border-color: var(--color-emerald-100);
  }

  .guide-section.on-file .section-header {
    background: var(--color-slate-100);
  }

  .on-file-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-emerald-600);
    background: var(--color-emerald-100);
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    white-space: nowrap;
  }

  .section-note {
    margin: 0;
    padding: 0.625rem 1rem 0.375rem 1rem;
    font-size: 0.78rem;
    color: var(--color-slate-500);
    font-style: italic;
    line-height: 1.5;
    border-top: 1px solid var(--color-slate-100);
  }

  .section-note + .questions {
    border-top: none;
  }

  .chevron {
    font-size: 0.9rem;
    color: var(--color-slate-400);
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-slate-800);
  }

  .feeds-tag {
    font-size: 0.7rem;
    color: var(--color-violet-600);
    background: var(--color-violet-100);
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .questions {
    margin: 0;
    padding: 0.75rem 1rem 0.75rem 2.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    border-top: 1px solid var(--color-slate-100);
  }

  .questions li {
    font-size: 0.825rem;
    color: var(--color-slate-600);
    line-height: 1.5;
  }
</style>
