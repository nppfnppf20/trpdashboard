<script>
  // Read-only display for an advancement's source_type — the same badge
  // used across every tracker's timeline history. Not tied to the
  // add/edit forms, since old 'email' entries and AI-drafted 'meeting'
  // entries (set by the separate "Draft from Meeting Notes" flow) still
  // need to display correctly even though there's no UI to pick them.
  export let sourceType; // 'note' | 'email' | 'meeting' | null | undefined
  export let meetingNoteTitle = null;

  $: icon = sourceType === 'email' ? 'la-envelope' : sourceType === 'meeting' ? 'la-users' : 'la-sticky-note';
  $: label = sourceType === 'email' ? 'Email trail' : sourceType === 'meeting' ? (meetingNoteTitle || 'Meeting note') : 'Note';
</script>

<span class="asb-badge" class:asb-email={sourceType === 'email'} class:asb-meeting={sourceType === 'meeting'}>
  <i class="las {icon}"></i> {label}
</span>

<style>
  .asb-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.68rem;
    color: var(--color-slate-500);
    background: var(--color-slate-100);
    border-radius: var(--radius-pill);
    padding: 1px 8px;
  }
  .asb-email { color: var(--color-teal-600); background: var(--color-sky-100); }
  .asb-meeting { color: var(--color-violet-600); background: var(--color-violet-100); }
</style>
