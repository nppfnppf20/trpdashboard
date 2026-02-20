<script>
  import CensusPopWorkingAge from './socioeconomics-charts/CensusPopWorkingAge.svelte';
  import CarsVansHousehold from './socioeconomics-charts/CarsVansHousehold.svelte';
  import BREStable from './socioeconomics-charts/BREStable.svelte';
  import MethodOfTravel from './socioeconomics-charts/MethodOfTravel.svelte';
  import UnemploymentRate from './socioeconomics-charts/UnemploymentRate.svelte';
  import HighestQualification from './socioeconomics-charts/HighestQualification.svelte';
  import GeneralHealthTable from './socioeconomics-charts/GeneralHealthTable.svelte';
  import OccupationTable from './socioeconomics-charts/OccupationTable.svelte';
  import EconomicInactivityTable from './socioeconomics-charts/EconomicInactivityTable.svelte';
  import html2canvas from 'html2canvas';
  import { CheckOutline, ClipboardCleanSolid } from 'flowbite-svelte-icons';

  /** @type {any | undefined} */
  export let socioeconomicsResult = undefined;
  /** @type {any[]} */
  export let flattenedData = [];
  /** @type {() => void} */
  export let onClose = () => {};

  // Chart navigation
  let currentChartIndex = 0;
  const totalCharts = 9; // Updated for 9 charts/tables

  // Copy to clipboard state
  let copyStatus = 'idle'; // 'idle' | 'copying' | 'success' | 'error'
  let chartDisplayElement;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function previousChart() {
    if (currentChartIndex > 0) {
      currentChartIndex--;
    }
  }

  function nextChart() {
    if (currentChartIndex < totalCharts - 1) {
      currentChartIndex++;
    }
  }

  async function copyChartToClipboard() {
    if (!chartDisplayElement) return;

    copyStatus = 'copying';

    try {
      // Capture the chart display area as a canvas
      const canvas = await html2canvas(chartDisplayElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true
      });

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          copyStatus = 'error';
          setTimeout(() => copyStatus = 'idle', 2000);
          return;
        }

        try {
          // Copy to clipboard using the Clipboard API
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);

          copyStatus = 'success';
          setTimeout(() => copyStatus = 'idle', 2000);
        } catch (err) {
          console.error('Failed to copy to clipboard:', err);
          copyStatus = 'error';
          setTimeout(() => copyStatus = 'idle', 2000);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture chart:', err);
      copyStatus = 'error';
      setTimeout(() => copyStatus = 'idle', 2000);
    }
  }
</script>

<div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Socioeconomics Charts</h2>
      <div class="header-buttons">
        <button
          class="copy-button"
          on:click={copyChartToClipboard}
          disabled={copyStatus === 'copying'}
          title="Copy chart to clipboard"
        >
          {#if copyStatus === 'success'}
            <CheckOutline class="w-3 h-3" />
            <span>Copied</span>
          {:else}
            <ClipboardCleanSolid class="w-3 h-3" />
            <span>Copy</span>
          {/if}
        </button>
        <button class="close-button" on:click={onClose}>&times;</button>
      </div>
    </div>
    <div class="modal-body">
      <div class="chart-viewer">
        <button
          class="nav-button nav-left"
          on:click={previousChart}
          disabled={currentChartIndex === 0}
        >
          &#8249;
        </button>

        <div class="chart-display" bind:this={chartDisplayElement}>
          {#if currentChartIndex === 0}
            <CensusPopWorkingAge
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 1}
            <CarsVansHousehold
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 2}
            <UnemploymentRate
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 3}
            <HighestQualification
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 4}
            <GeneralHealthTable
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 5}
            <OccupationTable
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 6}
            <BREStable
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 7}
            <MethodOfTravel
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else if currentChartIndex === 8}
            <EconomicInactivityTable
              {socioeconomicsResult}
              {flattenedData}
            />
          {:else}
            <div class="chart-placeholder">
              <p>Chart {currentChartIndex + 1} of {totalCharts}</p>
            </div>
          {/if}
        </div>

        <button
          class="nav-button nav-right"
          on:click={nextChart}
          disabled={currentChartIndex === totalCharts - 1}
        >
          &#8250;
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    max-width: 95%;
    max-height: 90vh;
    width: 1200px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #dee2e6;
  }

  h2 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .header-buttons {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .copy-button {
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    color: #6b7280;
    cursor: pointer;
    padding: 0.375rem 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .copy-button:hover:not(:disabled) {
    background: #f9fafb;
    color: #1f2937;
  }

  .copy-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .copy-button span {
    font-size: 0.75rem;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 2rem;
    color: #6c757d;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-button:hover {
    color: #2c3e50;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .chart-viewer {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 100%;
    min-height: 500px;
  }

  .chart-display {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: auto;
    width: 100%;
    overflow: visible;
  }

  .chart-placeholder {
    width: 100%;
    height: 600px;
    background: #f8f9fa;
    border: 2px dashed #dee2e6;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6c757d;
    font-size: 1.2rem;
  }

  .nav-button {
    background: transparent;
    color: #6c757d;
    border: none;
    width: 50px;
    height: 50px;
    font-size: 2.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .nav-button:hover:not(:disabled) {
    color: #2c3e50;
    transform: scale(1.2);
  }

  .nav-button:active:not(:disabled) {
    transform: scale(1);
  }

  .nav-button:disabled {
    color: #dee2e6;
    cursor: not-allowed;
  }

  .nav-left {
    margin-right: 0.5rem;
  }

  .nav-right {
    margin-left: 0.5rem;
  }
</style>
