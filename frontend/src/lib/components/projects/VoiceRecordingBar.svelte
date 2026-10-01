<script>
  // Progress bar + clock shown while a VoiceDictationButton with a maxSeconds cap is recording,
  // with the failure reason / notice shown in its place afterwards. Feed it from the button's
  // events: `elapsed` from 'tick' (null when not recording), `error` from 'error', and `notice` from
  // 'limitreached' / 'empty'.
  export let elapsed = null;   // seconds into the current recording, or null when not recording
  export let max = 300;
  export let error = '';
  export let notice = '';

  const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
</script>

{#if elapsed !== null}
  <div class="vrb" role="progressbar" aria-valuemin="0" aria-valuemax={max} aria-valuenow={elapsed}>
    <div class="vrb-bar"><div class="vrb-fill" style="width: {Math.min(100, (elapsed / max) * 100)}%"></div></div>
    <span class="vrb-time">{clock(elapsed)} / {clock(max)}</span>
  </div>
{:else if error}
  <div class="vrb-error"><i class="las la-exclamation-triangle"></i> {error}</div>
{:else if notice}
  <div class="vrb-notice">{notice}</div>
{/if}

<style>
  .vrb { display: flex; align-items: center; gap: 8px; }
  .vrb-bar { flex: 1; height: 5px; border-radius: var(--radius-pill); background: var(--color-slate-200); overflow: hidden; }
  .vrb-fill { height: 100%; background: var(--color-red-600); transition: width 0.25s linear; }
  .vrb-time { font-size: 11px; font-weight: 600; color: var(--color-red-600); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .vrb-notice { font-size: 11px; color: var(--color-slate-500); }
  .vrb-error { font-size: 11px; color: var(--color-red-600); line-height: 1.35; }
</style>
