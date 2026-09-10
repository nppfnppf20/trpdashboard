<script>
  import { llmProviderStatus } from '$lib/stores/llmStatus.js';

  const PROVIDER_LABELS = { anthropic: 'Claude', openai: 'OpenAI' };

  // Session-only dismissals, keyed by provider+message so a *new* outage
  // (different message) reappears even if an earlier one was dismissed.
  let dismissed = $state(new Set());

  function keyFor(provider, entry) {
    return `${provider}:${entry.message}`;
  }

  function dismiss(key) {
    dismissed = new Set(dismissed).add(key);
  }

  let visibleIssues = $derived(
    Object.entries($llmProviderStatus)
      .filter(([, entry]) => entry)
      .map(([provider, entry]) => ({ provider, entry, key: keyFor(provider, entry) }))
      .filter(({ key }) => !dismissed.has(key))
  );
</script>

{#if visibleIssues.length}
  <div class="llm-status-banners">
    {#each visibleIssues as { provider, entry, key } (key)}
      <div class="llm-status-banner">
        <span class="llm-status-banner-text">
          <strong>{PROVIDER_LABELS[provider] ?? provider}</strong> is out of credit
          <span class="llm-status-banner-detail">{entry.message}</span>
        </span>
        <button
          type="button"
          class="llm-status-banner-dismiss"
          onclick={() => dismiss(key)}
          aria-label="Dismiss warning"
        >×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .llm-status-banners {
    display: flex;
    flex-direction: column;
  }

  .llm-status-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 1rem;
    background: var(--color-badge-warning-bg);
    color: var(--color-badge-warning-fg);
    border-bottom: 1px solid var(--color-amber-200);
    font-size: 0.8125rem;
  }

  .llm-status-banner-text {
    line-height: 1.4;
  }

  .llm-status-banner-detail {
    opacity: 0.85;
  }

  .llm-status-banner-detail::before {
    content: ' — ';
  }

  .llm-status-banner-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: inherit;
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm, 4px);
  }

  .llm-status-banner-dismiss:hover {
    background: var(--color-amber-200);
  }
</style>
