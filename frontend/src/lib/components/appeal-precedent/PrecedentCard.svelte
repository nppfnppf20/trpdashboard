<script>
  import { createEventDispatcher } from 'svelte';
  import { levelChip, weightChip, fmtDate, scaleLabel, TREATMENT_NAME, EFFECT_NAME } from '$lib/utils/precedentDisplay.js';

  export let record;
  export let selected = false;
  export let issueLabels = {}; // issue id -> label

  const dispatch = createEventDispatcher();
  let open = false;

  $: b = record.planning_balance;
  $: entries = [...(b.entries ?? []).filter(e => e.side === 'harm'), ...(b.entries ?? []).filter(e => e.side === 'benefit')];
  $: issueName = id => issueLabels[id] ?? (id === 'other' ? 'Other' : id);
  $: scale = scaleLabel(record);
  $: outcomeTone = record.outcome === 'Allowed' ? 'success' : record.outcome === 'Dismissed' ? 'danger' : 'neutral';
</script>

<div class="card pc" class:selected>
  <div class="top">
    <input type="checkbox" checked={selected} on:change={() => dispatch('toggle')} aria-label="Select {record.reference} to ask about" />
    <div class="score" title={record.relevanceCapped ? `Rated ${record.relevanceRaw}, capped at 5 because the scale differs by more than 10 times` : 'How useful this is as a precedent, out of 10'}>
      {record.relevance}<small>/10</small>
    </div>
    <div class="main">
      <div class="head">
        <span class="lpa">{record.lpa || 'Unknown LPA'}</span>
        <span class="tag tag-{outcomeTone}">{record.outcome}</span>
        <span class="meta">{fmtDate(record.date)} · <a href={record.url} target="_blank" rel="noopener">{record.reference} on Appealbase</a></span>
      </div>
      <p class="scheme">{record.scheme_summary}</p>
      <div class="badges">
        <span class="cov" title="Weighted share of your issues the inspector actually decided"><i><b style="width:{Math.round(record.weightedCoverage * 100)}%"></b></i>coverage {record.weightedCoverage.toFixed(2)}</span>
        {#if b.present}<span class="chip">Planning balance found</span>{/if}
        {#if scale}<span class="chip" class:warn={record.scaleCheck.level !== 'comparable'}>{scale}</span>{/if}
        {#if record.relevanceCapped}<span class="chip warn">Rating capped for scale</span>{/if}
      </div>
    </div>
    <button class="btn btn-ghost btn-sm" on:click={() => (open = !open)} aria-expanded={open}>{open ? 'Hide detail' : 'Show detail'}</button>
  </div>

  {#if open}
    <div class="detail">
      {#if record.determinative_issues?.length}
        <section>
          <h4>What it turned on</h4>
          <ul>{#each record.determinative_issues as t}<li>{t}</li>{/each}</ul>
        </section>
      {/if}

      <section>
        <h4>Planning balance</h4>
        {#if entries.length}
          <p class="note">Level is how severe the harm is, in the inspector's words. Weight is how much it counted. Both come from the decision text and show "Not stated" where the inspector doesn't say.</p>
          <div class="scroll">
            <table class="data-table">
              <thead><tr><th>Issue</th><th>What</th><th>Level of harm</th><th>Weight</th><th>Inspector's wording</th></tr></thead>
              <tbody>
                {#each entries as e}
                  {@const lv = levelChip(e)}
                  {@const wt = weightChip(e)}
                  <tr>
                    <td><span class="side side-{e.side}">{e.side}</span><br />{issueName(e.issue_id)}</td>
                    <td>{e.description}</td>
                    <td><span class="pill pill-{lv.tone}">{lv.text}</span></td>
                    <td><span class="pill pill-{wt.tone}">{wt.text}</span></td>
                    <td class="words">
                      {#each [e.level_wording, e.weight_wording].filter(Boolean) as w}&ldquo;{w}&rdquo; {/each}
                      {#if e.para}<small>para {e.para}</small>{/if}
                      {#if !e.level_wording && !e.weight_wording}<small>none quoted</small>{/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        {#if b.conclusion}<p class="body-text"><strong>Conclusion:</strong> {b.conclusion}</p>{/if}
        {#if b.quote}
          <blockquote>{b.quote}<cite>Inspector{b.para ? `, paragraph ${b.para}` : ''}. Verified against the decision text.</cite></blockquote>
        {:else if !entries.length}
          <p class="note">No planning balance was verified for this decision.</p>
        {/if}
      </section>

      <section>
        <h4>How each issue was treated</h4>
        <div class="scroll">
          <table class="data-table">
            <thead><tr><th>Issue</th><th>Treatment</th><th>Effect</th><th>Finding</th></tr></thead>
            <tbody>
              {#each record.issues as i}
                <tr>
                  <td>{issueName(i.id)}</td>
                  <td class="t-{i.treatment}">{TREATMENT_NAME[i.treatment] ?? i.treatment}</td>
                  <td class="e-{i.effect}">{EFFECT_NAME[i.effect] ?? ''}</td>
                  <td>{i.finding ?? ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      {#if record.comparability}
        <section>
          <h4>Comparability to this project</h4>
          <p class="body-text">{record.comparability}</p>
          {#if record.relevance_reason}<p class="note">Rating: {record.relevance_reason}</p>{/if}
        </section>
      {/if}

      {#if record.usable_points?.length}
        <section>
          <h4>Points you could cite or should expect</h4>
          {#each record.usable_points as p}
            <p class="body-text">{p.point}</p>
            <blockquote>{p.quote}<cite>{p.para ? `Paragraph ${p.para}. ` : ''}Verified against the decision text.</cite></blockquote>
          {/each}
        </section>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pc {
    padding: 0;
  }

  .pc.selected {
    border-color: var(--color-primary-500);
    box-shadow: var(--focus-ring-blue);
  }

  .top {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    align-items: start;
    padding: var(--space-3) var(--space-4);
  }

  .score {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--color-slate-900);
    line-height: 1;
    padding-top: 0.15rem;
    min-width: 2.6rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .score small {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-slate-500);
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.6rem;
  }

  .lpa {
    font-weight: 700;
    color: var(--color-slate-900);
  }

  .meta {
    font-size: 0.78125rem;
    color: var(--color-slate-500);
  }

  .meta a {
    color: var(--color-primary-600);
  }

  .tag {
    font-size: 0.71875rem;
    font-weight: 700;
    padding: 0.05rem 0.55rem;
    border-radius: var(--radius-pill);
  }

  .tag-success {
    background: var(--color-badge-success-bg);
    color: var(--color-badge-success-fg);
  }

  .tag-danger {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
  }

  .tag-neutral {
    background: var(--color-slate-100);
    color: var(--color-slate-600);
  }

  .scheme {
    margin: 0.3rem 0 0.4rem;
    font-size: 0.875rem;
    color: var(--color-slate-700);
    line-height: 1.45;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.75rem;
    color: var(--color-slate-500);
  }

  .chip {
    border: 1px solid var(--color-slate-200);
    border-radius: var(--radius-pill);
    padding: 0 0.55rem;
  }

  .chip.warn {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
    border-color: transparent;
  }

  .cov {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-variant-numeric: tabular-nums;
  }

  .cov i {
    display: inline-block;
    width: 54px;
    height: 5px;
    background: var(--color-slate-200);
    border-radius: 3px;
    overflow: hidden;
  }

  .cov i b {
    display: block;
    height: 100%;
    background: var(--color-primary-600);
  }

  .detail {
    border-top: 1px solid var(--color-slate-200);
    padding: var(--space-2) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  h4 {
    margin: var(--space-2) 0 var(--space-1);
    font-size: 0.71875rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-slate-500);
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.84375rem;
    color: var(--color-slate-700);
  }

  .note {
    margin: 0 0 var(--space-2);
    font-size: 0.78125rem;
    color: var(--color-slate-500);
    line-height: 1.45;
  }

  .body-text {
    margin: var(--space-1) 0;
    font-size: 0.84375rem;
    color: var(--color-slate-700);
    line-height: 1.5;
  }

  .scroll {
    overflow-x: auto;
  }

  .scroll table {
    min-width: 560px;
    font-size: 0.8125rem;
  }

  .side {
    font-size: 0.65625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .side-harm {
    color: var(--color-badge-danger-fg);
  }

  .side-benefit {
    color: var(--color-badge-success-fg);
  }

  .pill {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0 0.55rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-slate-200);
    color: var(--color-slate-600);
    white-space: nowrap;
  }

  .pill-muted {
    font-weight: 400;
    opacity: 0.75;
  }

  .pill-mid {
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
    border-color: transparent;
  }

  .pill-high {
    background: var(--color-badge-danger-bg);
    color: var(--color-badge-danger-fg);
    border-color: transparent;
  }

  .words {
    color: var(--color-slate-600);
    font-style: italic;
  }

  .words small {
    font-style: normal;
  }

  .t-substantive {
    color: var(--color-primary-700);
    font-weight: 600;
  }

  .t-mentioned,
  .t-not_addressed {
    color: var(--color-slate-500);
  }

  .e-harm {
    color: var(--color-badge-danger-fg);
    font-weight: 600;
  }

  .e-no_harm {
    color: var(--color-badge-success-fg);
    font-weight: 600;
  }

  blockquote {
    margin: var(--space-1) 0 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-slate-50);
    border-left: 3px solid var(--color-primary-500);
    font-style: italic;
    font-size: 0.84375rem;
    color: var(--color-slate-700);
  }

  blockquote cite {
    display: block;
    font-style: normal;
    font-size: 0.75rem;
    color: var(--color-slate-500);
    margin-top: 0.2rem;
  }

  @media (max-width: 640px) {
    .top {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .top .btn {
      grid-column: 2;
      justify-self: start;
    }
  }
</style>
