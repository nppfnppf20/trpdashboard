<script>
  export let section; // { title, feedsLabel, questions: string[] }

  let open = true;
</script>

<div class="guide-section">
  <button class="section-header" on:click={() => (open = !open)}>
    <div class="header-left">
      <i class="las la-{open ? 'chevron-down' : 'chevron-right'} chevron"></i>
      <span class="section-title">{section.title}</span>
    </div>
    {#if section.feedsLabel}
      <span class="feeds-tag">feeds → {section.feedsLabel}</span>
    {/if}
  </button>

  {#if open}
    <ol class="questions">
      {#each section.questions as q}
        <li>{q}</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .guide-section {
    border: 1px solid #e2e8f0;
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
    background: #f8fafc;
    border: none;
    cursor: pointer;
    text-align: left;
  }

  .section-header:hover {
    background: #f1f5f9;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chevron {
    font-size: 0.9rem;
    color: #94a3b8;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1e293b;
  }

  .feeds-tag {
    font-size: 0.7rem;
    color: #7c3aed;
    background: #f3e8ff;
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
    border-top: 1px solid #f1f5f9;
  }

  .questions li {
    font-size: 0.825rem;
    color: #475569;
    line-height: 1.5;
  }
</style>
