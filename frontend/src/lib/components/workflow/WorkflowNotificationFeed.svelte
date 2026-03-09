<script>
  export let items = [];

  const SOURCE_META = {
    stage_completed:    { icon: 'la-check-circle',    color: '#10b981', label: 'Stage completed' },
    stage_upcoming:     { icon: 'la-calendar',         color: '#3b82f6', label: 'Upcoming stage' },
    stage_overdue:      { icon: 'la-exclamation-circle', color: '#ef4444', label: 'Overdue stage' },
    key_issue:          { icon: 'la-flag',              color: '#f59e0b', label: 'Key issue' },
    scraper_renewables: { icon: 'la-solar-panel',       color: '#8b5cf6', label: 'Renewables' },
    scraper_datacentres:{ icon: 'la-server',            color: '#6366f1', label: 'Data centres' },
    scraper_contracts:  { icon: 'la-file-contract',     color: '#0ea5e9', label: 'Contracts' }
  };

  function getMeta(type) {
    return SOURCE_META[type] || { icon: 'la-dot-circle', color: '#94a3b8', label: type };
  }

  function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date)) return d;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusClass(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'approved' || s === 'granted') return 'status-green';
    if (s === 'overdue' || s === 'refused' || s === 'rejected') return 'status-red';
    if (s === 'upcoming' || s === 'active' || s === 'submitted') return 'status-blue';
    return 'status-grey';
  }
</script>

{#if items.length === 0}
  <div class="empty-state">
    <i class="las la-bell-slash"></i>
    <p>No notifications match the current filters.</p>
  </div>
{:else}
  <div class="feed">
    {#each items as item (item.source_type + '-' + item.source_id)}
      {@const meta = getMeta(item.source_type)}
      <div class="feed-item">
        <div class="item-icon" style="color: {meta.color}">
          <i class="las {meta.icon}"></i>
        </div>

        <div class="item-body">
          <div class="item-header">
            <span class="item-title">{item.title}</span>
            {#if item.status}
              <span class="item-status {statusClass(item.status)}">{item.status}</span>
            {/if}
          </div>

          <div class="item-meta">
            <span class="source-badge" style="color: {meta.color}">{meta.label}</span>
            {#if item.project_name}
              <span class="project-name">{item.project_name}</span>
            {/if}
            {#if item.description}
              <span class="item-desc">{item.description}</span>
            {/if}
          </div>
        </div>

        <div class="item-date">
          {formatDate(item.event_date)}
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: #94a3b8;
  }

  .empty-state i {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.75rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.9375rem;
  }

  .feed {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
    background: white;
  }

  .feed-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.1s;
  }

  .feed-item:last-child {
    border-bottom: none;
  }

  .feed-item:hover {
    background: #f8fafc;
  }

  .item-icon {
    flex-shrink: 0;
    font-size: 1.375rem;
    width: 2rem;
    text-align: center;
  }

  .item-body {
    flex: 1;
    min-width: 0;
  }

  .item-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 0.2rem;
  }

  .item-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-status {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 99px;
    text-transform: capitalize;
  }

  .status-green { background: #dcfce7; color: #166534; }
  .status-red   { background: #fee2e2; color: #991b1b; }
  .status-blue  { background: #dbeafe; color: #1e40af; }
  .status-grey  { background: #f1f5f9; color: #475569; }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .source-badge {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.85;
  }

  .project-name,
  .item-desc {
    font-size: 0.8125rem;
    color: #64748b;
  }

  .project-name {
    font-weight: 500;
  }

  .item-date {
    flex-shrink: 0;
    font-size: 0.8125rem;
    color: #94a3b8;
    white-space: nowrap;
  }
</style>
