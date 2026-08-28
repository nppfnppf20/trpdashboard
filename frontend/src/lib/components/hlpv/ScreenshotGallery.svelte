<script>
  import { onMount } from 'svelte';
  import { getScreenshots, deleteScreenshot, updateScreenshot, getScreenshotsBySection } from '$lib/services/screenshotManager.js';

  /** @type {string} */
  export let section = 'general';
  /** @type {string} */
  export let title = 'Screenshots';

  /** @type {Array<any>} */
  let screenshots = [];
  /** @type {string | null} */
  let editingId = null;
  /** @type {string} */
  let editingCaption = '';

  let refreshInterval;

  onMount(() => {
    loadScreenshots();

    // Listen for custom events when screenshots are added
    const handleScreenshotAdded = () => {
      console.log('📷 Screenshot added event received, refreshing section:', section);
      loadScreenshots();
    };

    // Also poll periodically to ensure we catch any changes
    refreshInterval = setInterval(() => {
      const currentCount = screenshots.length;
      const newScreenshots = getScreenshotsBySection(section);
      if (newScreenshots.length !== currentCount) {
        console.log(`📷 Screenshot count changed for ${section}: ${currentCount} → ${newScreenshots.length}`);
        screenshots = newScreenshots;
      }
    }, 1000); // Check every second

    window.addEventListener('screenshotAdded', handleScreenshotAdded);

    return () => {
      window.removeEventListener('screenshotAdded', handleScreenshotAdded);
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  });

  function loadScreenshots() {
    screenshots = getScreenshotsBySection(section);
    console.log(`📷 Loaded ${screenshots.length} screenshots for section: ${section}`);
  }

  function handleDelete(screenshotId) {
    if (confirm('Are you sure you want to delete this screenshot?')) {
      deleteScreenshot(screenshotId);
      loadScreenshots(); // Refresh the list
    }
  }

  function startEditing(screenshot) {
    editingId = screenshot.id;
    editingCaption = screenshot.caption || '';
  }

  function saveCaption() {
    if (editingId) {
      updateScreenshot(editingId, { caption: editingCaption });
      editingId = null;
      editingCaption = '';
      loadScreenshots(); // Refresh to show updated caption
    }
  }

  function cancelEditing() {
    editingId = null;
    editingCaption = '';
  }

  // Reactive: reload screenshots when section changes
  $: if (section) {
    loadScreenshots();
  }
</script>

<div class="screenshot-gallery">
  <h4>{title}</h4>

  {#if screenshots.length === 0}
    <div class="no-screenshots">
      <p>No screenshots captured for this section yet.</p>
      <p class="hint">Use the 📷 button on the map to capture screenshots.</p>
    </div>
  {:else}
    <div class="screenshot-grid">
      {#each screenshots as screenshot (screenshot.id)}
        <div class="screenshot-item">
          <div class="screenshot-image">
            <img src={screenshot.base64} alt={screenshot.caption || 'Map screenshot'} />
          </div>

          <div class="screenshot-info">
            <div class="screenshot-meta">
              <span class="timestamp">{new Date(screenshot.timestamp).toLocaleString()}</span>
              <span class="dimensions">{screenshot.width}×{screenshot.height}</span>
            </div>

            {#if editingId === screenshot.id}
              <div class="caption-edit">
                <input
                  type="text"
                  bind:value={editingCaption}
                  placeholder="Enter caption..."
                  class="caption-input"
                  on:keydown={(e) => e.key === 'Enter' && saveCaption()}
                />
                <div class="edit-buttons">
                  <button class="save-btn" on:click={saveCaption}>Save</button>
                  <button class="cancel-btn" on:click={cancelEditing}>Cancel</button>
                </div>
              </div>
            {:else}
              <div class="caption-display">
                <p class="caption">{screenshot.caption || 'No caption'}</p>
                <div class="action-buttons">
                  <button class="edit-btn" on:click={() => startEditing(screenshot)}>
                    ✏️ Edit
                  </button>
                  <button class="delete-btn" on:click={() => handleDelete(screenshot.id)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .screenshot-gallery {
    margin: 20px 0;
    padding: 16px;
    background: var(--color-slate-50);
    border-radius: 8px;
    border: 1px solid var(--color-slate-200);
  }

  .screenshot-gallery h4 {
    margin: 0 0 16px 0;
    color: var(--color-slate-700);
    font-size: 16px;
    font-weight: 600;
  }

  .no-screenshots {
    text-align: center;
    padding: 32px 16px;
    color: var(--color-slate-500);
  }

  .no-screenshots p {
    margin: 8px 0;
  }

  .hint {
    font-style: italic;
    font-size: 14px;
  }

  .screenshot-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .screenshot-item {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-slate-200);
  }

  .screenshot-image {
    width: 100%;
    height: 160px;
    overflow: hidden;
    background: var(--color-slate-100);
  }

  .screenshot-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .screenshot-info {
    padding: 12px;
  }

  .screenshot-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--color-slate-500);
  }

  .caption {
    margin: 0 0 8px 0;
    font-size: 14px;
    line-height: 1.4;
    color: var(--color-slate-700);
    word-wrap: break-word;
  }

  .caption-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--color-slate-300);
    border-radius: 4px;
    font-size: 14px;
    margin-bottom: 8px;
  }

  .caption-input:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .edit-buttons {
    display: flex;
    gap: 8px;
  }

  .edit-btn, .delete-btn, .save-btn, .cancel-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .edit-btn {
    background: var(--color-slate-100);
    color: var(--color-slate-700);
  }

  .edit-btn:hover {
    background: var(--color-slate-200);
  }

  .delete-btn {
    background: var(--color-red-100);
    color: var(--color-red-600);
  }

  .delete-btn:hover {
    background: var(--color-red-200);
  }

  .save-btn {
    background: var(--color-primary-100);
    color: var(--color-primary-700);
  }

  .save-btn:hover {
    background: var(--color-primary-200);
  }

  .cancel-btn {
    background: var(--color-slate-100);
    color: var(--color-slate-500);
  }

  .cancel-btn:hover {
    background: var(--color-slate-200);
  }
</style>