<script>
  import { onMount } from 'svelte';
  import { getLlmSettings, updateLlmSetting } from '$lib/api/llmSettings.js';

  let settings = $state([]);
  let loading = $state(true);
  let error = $state(null);
  let savingKey = $state(null);

  const STATUS_LABEL = {
    configurable: null,
    claude_only: 'Not yet configurable',
    background: 'Background job — no per-request override',
  };
  const STATUS_ORDER = { configurable: 0, claude_only: 1, background: 2 };
  const GROUP_LABEL = {
    configurable: 'Configurable now',
    claude_only: 'Not yet configurable — hardcoded to Claude',
    background: 'Background jobs',
  };

  let grouped = $derived.by(() => {
    const groups = {};
    for (const s of settings) {
      (groups[s.status] ??= []).push(s);
    }
    return Object.keys(groups)
      .sort((a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99))
      .map(status => ({ status, label: GROUP_LABEL[status] || status, items: groups[status] }));
  });

  onMount(load);

  async function load() {
    loading = true;
    error = null;
    try {
      settings = await getLlmSettings();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function setProvider(item, provider) {
    if (item.status !== 'configurable' || item.provider === provider) return;
    savingKey = item.key;
    const previous = item.provider;
    item.provider = provider; // optimistic
    settings = settings;
    try {
      await updateLlmSetting(item.key, provider);
    } catch (err) {
      item.provider = previous;
      settings = settings;
      alert('Failed to update: ' + err.message);
    } finally {
      savingKey = null;
    }
  }
</script>

<div class="llm-settings-page">
  <div class="page-header">
    <h2><i class="las la-robot"></i> AI Providers</h2>
    <p>
      Sets the default LLM provider for each AI-assisted process. Some pages have their own
      provider toggle for a single session — that always wins over this default until the
      browser is refreshed, after which it falls back to whatever is set here.
    </p>
  </div>

  {#if loading}
    <div class="state-card"><i class="las la-circle-notch la-spin"></i> Loading…</div>
  {:else if error}
    <div class="state-card error">{error}</div>
  {:else}
    {#each grouped as group (group.status)}
      <div class="group">
        <h3>{group.label}</h3>
        <table>
          <thead>
            <tr>
              <th>Process</th>
              <th>Description</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {#each group.items as item (item.key)}
              <tr>
                <td class="process-name">{item.label}</td>
                <td class="process-desc">
                  {item.description}
                  {#if STATUS_LABEL[item.status]}
                    <span class="status-badge">{STATUS_LABEL[item.status]}</span>
                  {/if}
                </td>
                <td>
                  <div class="provider-toggle" class:disabled={item.status !== 'configurable'}>
                    <button
                      type="button"
                      class:active={item.provider === 'anthropic'}
                      disabled={item.status !== 'configurable' || savingKey === item.key}
                      onclick={() => setProvider(item, 'anthropic')}
                    >
                      Claude
                    </button>
                    <button
                      type="button"
                      class:active={item.provider === 'openai'}
                      disabled={item.status !== 'configurable' || savingKey === item.key}
                      onclick={() => setProvider(item, 'openai')}
                    >
                      OpenAI
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/each}
  {/if}
</div>

<style>
  .llm-settings-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1100px;
  }

  .page-header h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.4rem;
    font-size: 1.25rem;
    color: #1e293b;
  }

  .page-header h2 i { color: #9333ea; }

  .page-header p {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
    max-width: 70ch;
  }

  .state-card {
    padding: 2rem;
    text-align: center;
    color: #64748b;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .state-card.error { color: #dc2626; }

  .group {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .group h3 {
    margin: 0;
    padding: 0.85rem 1.1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    padding: 0.6rem 1.1rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #e2e8f0;
  }

  td {
    padding: 0.75rem 1.1rem;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.875rem;
    vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }

  .process-name {
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
  }

  .process-desc {
    color: #64748b;
  }

  .status-badge {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.1rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 600;
    color: #92400e;
    background: #fef3c7;
    border-radius: 999px;
    white-space: nowrap;
  }

  .provider-toggle {
    display: inline-flex;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
  }

  .provider-toggle.disabled { opacity: 0.5; }

  .provider-toggle button {
    padding: 0.4rem 0.85rem;
    background: white;
    border: none;
    font-size: 0.8rem;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s;
  }

  .provider-toggle button:not(:first-child) { border-left: 1px solid #cbd5e1; }
  .provider-toggle button:hover:not(:disabled) { background: #f8fafc; }
  .provider-toggle button:disabled { cursor: not-allowed; }

  .provider-toggle button.active {
    background: #3b82f6;
    color: white;
  }
</style>
