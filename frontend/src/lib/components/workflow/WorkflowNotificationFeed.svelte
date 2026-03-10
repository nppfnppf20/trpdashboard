<script>
  export let items = [];

  const SOURCE_META = {
    stage_completed:     { icon: 'la-check-circle',      color: '#10b981', label: 'Stage Completed' },
    stage_upcoming:      { icon: 'la-calendar',           color: '#3b82f6', label: 'Upcoming Stage' },
    stage_overdue:       { icon: 'la-exclamation-circle', color: '#ef4444', label: 'Overdue Stage' },
    key_issue:           { icon: 'la-flag',               color: '#f59e0b', label: 'Key Issue' },
    scraper_renewables:  { icon: 'la-solar-panel',        color: '#8b5cf6', label: 'Renewables' },
    scraper_datacentres: { icon: 'la-server',             color: '#6366f1', label: 'Data Centres' },
    scraper_contracts:   { icon: 'la-file-contract',      color: '#0ea5e9', label: 'Contracts' }
  };

  function getMeta(type) {
    return SOURCE_META[type] || { icon: 'la-dot-circle', color: '#94a3b8', label: type };
  }

  function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
</script>

{#if items.length === 0}
  <div class="empty-state">
    <i class="las la-bell-slash"></i>
    <p>No notifications match the current filters.</p>
  </div>
{:else}
  <div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th class="no-sort">Type</th>
          <th class="no-sort">Title</th>
          <th class="no-sort">Project</th>
          <th class="no-sort">Details</th>
          <th class="no-sort">Status</th>
          <th class="no-sort">Date</th>
        </tr>
      </thead>
      <tbody>
        {#each items as item (item.source_type + '-' + item.source_id)}
          {@const meta = getMeta(item.source_type)}
          <tr>
            <td>
              <span class="source-badge" style="color: {meta.color}">
                <i class="las {meta.icon}"></i> {meta.label}
              </span>
            </td>
            <td class="text-bold">{item.title}</td>
            <td>{item.project_name || '—'}</td>
            <td class="text-muted">{item.description || '—'}</td>
            <td>{#if item.status}<span class="status-badge status-{item.status}">{item.status}</span>{:else}—{/if}</td>
            <td class="date-cell">{formatDate(item.event_date)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .source-badge { font-size: 0.8125rem; font-weight: 600; white-space: nowrap; }
  .source-badge i { margin-right: 0.25rem; }
</style>
