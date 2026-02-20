<script>
  import { onMount } from 'svelte';
  import { saveScreenshot, getScreenshotsBySection, deleteScreenshot, updateScreenshot } from '$lib/services/screenshotManager.js';

  /** @type {string} */
  export let sectionName = '';
  /** @type {Array<{id: string, src: string, caption: string}>} */
  let images = [];
  /** @type {string | null} */
  let dragOverId = null;

  // Load existing screenshots on mount
  onMount(() => {
    loadExistingScreenshots();
  });

  function loadExistingScreenshots() {
    const screenshots = getScreenshotsBySection(sectionName);
    images = screenshots.map(screenshot => ({
      id: screenshot.id,
      src: screenshot.dataUrl,
      caption: screenshot.caption || ''
    }));
    console.log(`📷 Loaded ${images.length} existing screenshots for ${sectionName}`);
  }

  function generateImageId() {
    return 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          addImageFile(file);
        }
      }
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    dragOverId = null;

    const files = event.dataTransfer?.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        addImageFile(file);
      }
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    dragOverId = 'drop-zone';
  }

  function handleDragLeave(event) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dragOverId = null;
    }
  }

  function addImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Save to localStorage via screenshot manager
      const screenshotData = {
        section: sectionName,
        dataUrl: e.target?.result,
        caption: '',
        filename: file.name || 'pasted-image.png'
      };

      const savedScreenshot = saveScreenshot(screenshotData);
      if (savedScreenshot) {
        const newImage = {
          id: savedScreenshot.id,
          src: e.target?.result,
          caption: ''
        };
        images = [...images, newImage];
        console.log(`📷 Added and saved image to ${sectionName} section`);
      }
    };
    reader.readAsDataURL(file);
  }

  function removeImage(imageId) {
    // Remove from localStorage
    deleteScreenshot(imageId);

    // Remove from local images array
    images = images.filter(img => img.id !== imageId);
    console.log(`🗑️ Removed image from ${sectionName} section`);
  }

  function updateCaption(imageId, newCaption) {
    // Update in localStorage
    updateScreenshot(imageId, { caption: newCaption });

    // Update local images array
    images = images.map(img =>
      img.id === imageId ? { ...img, caption: newCaption } : img
    );
  }

  function handleFileSelect(event) {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        addImageFile(file);
      }
    }

    // Clear the input so the same file can be selected again
    event.target.value = '';
  }
</script>

<div class="image-upload-section">
  <h4>{sectionName} Images</h4>

  <!-- Image Gallery - Show first if there are images -->
  {#if images.length > 0}
    <div class="image-gallery">
      {#each images as image (image.id)}
        <div class="image-item">
          <div class="image-container">
            <img src={image.src} alt="Screenshot" />
            <button
              class="remove-btn"
              on:click={() => removeImage(image.id)}
              title="Remove image"
            >
              ×
            </button>
          </div>
          <div class="image-caption">
            <input
              type="text"
              placeholder="Add caption..."
              value={image.caption}
              on:input={(e) => updateCaption(image.id, e.target.value)}
            />
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Drop Zone / Upload Area - Compact version -->
  <div
    class="drop-zone compact {dragOverId ? 'drag-over' : ''}"
    on:drop={handleDrop}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:paste={handlePaste}
    tabindex="0"
  >
    <div class="drop-zone-content">
      <span class="paste-text">📎 Paste screenshots here</span>
    </div>
  </div>
</div>

<style>
  .image-upload-section {
    margin: 20px 0;
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .image-upload-section h4 {
    margin: 0 0 16px 0;
    color: #374151;
    font-size: 16px;
    font-weight: 600;
  }

  .drop-zone {
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 12px 16px;
    text-align: center;
    background: white;
    transition: all 0.2s ease;
    cursor: pointer;
    margin-top: 16px;
  }

  .drop-zone.compact {
    padding: 12px 16px;
    border: 1px dashed #d1d5db;
  }

  .drop-zone:focus {
    outline: none;
    border-color: #3b82f6;
    background: #f0f9ff;
  }

  .drop-zone.drag-over {
    border-color: #3b82f6;
    background: #f0f9ff;
    transform: scale(1.02);
  }

  .drop-zone-content {
    color: #6b7280;
  }

  .paste-text {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
  }

  .image-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    margin-top: 16px;
  }

  .image-item {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
  }

  .image-container {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .image-container img {
    width: 100%;
    height: auto;
    display: block;
    max-width: 100%;
  }

  .remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .remove-btn:hover {
    background: rgba(220, 38, 38, 0.8);
  }

  .image-caption {
    padding: 12px;
  }

  .image-caption input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
  }

  .image-caption input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }
</style>