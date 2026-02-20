<script>
  import { onMount } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import ChartDataLabels from 'chartjs-plugin-datalabels';

  Chart.register(...registerables, ChartDataLabels);

  /** @type {any | undefined} */
  export let socioeconomicsResult = undefined;
  /** @type {any[]} */
  export let flattenedData = [];

  let chartCanvas;
  let chartInstance;
  let warnings = [];

  onMount(() => {
    if (socioeconomicsResult) {
      prepareChartData();
    }

    return () => {
      if (chartInstance) {
        chartInstance.destroy();
      }
    };
  });

  /**
   * Parse percentage values - handles both "65%" format and plain numbers
   */
  function parsePercentage(value) {
    if (value === undefined || value === null || value === '') return null;
    const stringValue = String(value).replace('%', '').trim();
    const numValue = parseFloat(stringValue);
    return isNaN(numValue) ? null : numValue;
  }

  function prepareChartData() {
    warnings = [];
    const datasets = [];

    console.log('=== Unemployment Rate Chart Data ===');
    console.log('Total flattened rows:', flattenedData.length);

    // Define years and corresponding column names
    const years = [
      { label: 'Jul 2019 - Jun 2020', column: 'Master sheet2_Jul19-20UEP' },
      { label: 'Jul 2020 - Jun 2021', column: 'Master sheet2_Jul20-21UEP' },
      { label: 'Jul 2021 - Jun 2022', column: 'Master sheet2_Jul21-Jun22UEP' },
      { label: 'Jul 2022 - Jun 2023', column: 'Master sheet2_Jul22-Jun23UEP' },
      { label: 'Jul 2023 - Jun 2024', column: 'Master sheet2_Jul23-Jun24UEP' },
      { label: 'Jul 2024 - Jun 2025', column: 'Master sheet2_Jul24-Jun25UEP' }
    ];

    const yearLabels = years.map(y => y.label);

    // Colors for each geography type
    const colors = {
      'Country': 'rgba(255, 99, 132, 0.8)',
      'Region': 'rgba(54, 162, 235, 0.8)',
      'LAD': 'rgba(75, 192, 192, 0.8)'
    };

    // Get Countries data
    const countries = flattenedData.filter(row => row.layer_name === 'countries');
    countries.forEach(country => {
      const values = years.map(year => parsePercentage(country[year.column]));
      console.log(`Country ${country.geo_name}:`, values);

      // Only add to chart if there's at least one non-null value
      const hasData = values.some(v => v !== null && v !== undefined);
      if (hasData) {
        datasets.push({
          label: `${country.geo_name} (Country)`,
          data: values,
          borderColor: colors['Country'].replace('0.8', '1'),
          backgroundColor: colors['Country'],
          borderWidth: 2,
          tension: 0.1,
          fill: false
        });
      }
    });

    // Get Regions data
    const regions = flattenedData.filter(row => row.layer_name === 'regions');
    console.log('Regions found:', regions.length);
    console.log('Regions data:', regions);

    regions.forEach(region => {
      const values = years.map(year => parsePercentage(region[year.column]));
      console.log(`Region ${region.geo_name}:`, values);
      console.log('Region raw data sample:', {
        'Jul19-20UEP': region['Master sheet2_Jul19-20UEP'],
        'Jul20-21UEP': region['Master sheet2_Jul20-21UEP']
      });

      // Only add to chart if there's at least one non-null value
      const hasData = values.some(v => v !== null && v !== undefined);
      if (hasData) {
        datasets.push({
          label: `${region.geo_name} (Region)`,
          data: values,
          borderColor: colors['Region'].replace('0.8', '1'),
          backgroundColor: colors['Region'],
          borderWidth: 2,
          tension: 0.1,
          fill: false
        });
      }
    });

    // Get LAD25 data
    const lad25Data = flattenedData.filter(row => row.layer_name === 'lad25');
    lad25Data.forEach(lad => {
      const values = years.map(year => parsePercentage(lad[year.column]));
      console.log(`LAD25 ${lad.geo_name}:`, values);

      // Only add to chart if there's at least one non-null value
      const hasData = values.some(v => v !== null && v !== undefined);
      if (hasData) {
        datasets.push({
          label: `${lad.geo_name} (LAD)`,
          data: values,
          borderColor: colors['LAD'].replace('0.8', '1'),
          backgroundColor: colors['LAD'],
          borderWidth: 2,
          tension: 0.1,
          fill: false
        });
      }
    });

    console.log('Final datasets:', datasets);
    createChart(yearLabels, datasets);
  }

  function createChart(yearLabels, datasets) {
    if (!chartCanvas) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    // Find the maximum value across all datasets
    let maxValue = 0;
    datasets.forEach(dataset => {
      dataset.data.forEach(value => {
        if (value !== null && value !== undefined && value > maxValue) {
          maxValue = value;
        }
      });
    });

    // Round up to the nearest 10%
    const yAxisMax = Math.ceil(maxValue / 10) * 10;

    chartInstance = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: yearLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Unemployment Rate, Age 16-64, Annual Population Survey',
            font: {
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + (context.parsed.y?.toFixed(1) || 'N/A') + '%';
              }
            }
          },
          datalabels: {
            display: false // Turn off data labels for line charts to avoid clutter
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Year'
            }
          },
          y: {
            beginAtZero: true,
            max: yAxisMax,
            title: {
              display: true,
              text: 'Unemployment Rate (%)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  }
</script>

<div class="chart-wrapper">
  {#if warnings.length > 0}
    <div class="warnings">
      <h4>Warnings:</h4>
      <ul>
        {#each warnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="chart-container">
    <canvas bind:this={chartCanvas}></canvas>
  </div>
</div>

<style>
  .chart-wrapper {
    width: 100%;
    height: 100%;
  }

  .warnings {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .warnings h4 {
    margin: 0 0 0.5rem 0;
    color: #856404;
    font-size: 1rem;
  }

  .warnings ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #856404;
  }

  .warnings li {
    margin: 0.25rem 0;
  }

  .chart-container {
    height: 600px;
    width: 100%;
  }
</style>
