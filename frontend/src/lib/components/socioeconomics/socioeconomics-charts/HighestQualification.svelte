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

    console.log('=== Highest Qualification Chart Data ===');
    console.log('Total flattened rows:', flattenedData.length);

    // Define the qualification categories in order
    const categories = [
      'No qualifications',
      'Level 1 and entry level qualifications',
      'Level 2 qualifications',
      'Apprenticeship',
      'Level 3 qualifications',
      'Level 4 qualifications or above',
      'Other qualifications'
    ];

    const columnNames = [
      'Master sheet2_No qualifications percent_1',
      'Master sheet2_Level 1 and entry level qualifications percent_1',
      'Master sheet2_Level 2 qualifications percent_1',
      'Master sheet2_Apprenticeship percent_1',
      'Master sheet2_Level 3 qualifications percent_1',
      'Master sheet2_Level 4 qualifications or above percent_1',
      'Master sheet2_Other qualifications percent_1'
    ];

    // Colors for each geography type
    const colors = {
      'Country': 'rgba(255, 99, 132, 0.8)',
      'Region': 'rgba(54, 162, 235, 0.8)',
      'LAD': 'rgba(75, 192, 192, 0.8)'
    };

    // Get Countries data
    const countries = flattenedData.filter(row => row.layer_name === 'countries');
    countries.forEach(country => {
      const values = columnNames.map(col => parsePercentage(country[col]));
      console.log(`Country ${country.geo_name}:`, values);

      // Only add to chart if there's at least one non-null value
      const hasData = values.some(v => v !== null && v !== undefined);
      if (hasData) {
        datasets.push({
          label: `${country.geo_name} (Country)`,
          data: values,
          backgroundColor: colors['Country'],
          borderColor: colors['Country'].replace('0.8', '1'),
          borderWidth: 1
        });
      }
    });

    // Get Regions data
    const regions = flattenedData.filter(row => row.layer_name === 'regions');
    regions.forEach(region => {
      const values = columnNames.map(col => parsePercentage(region[col]));
      console.log(`Region ${region.geo_name}:`, values);

      // Only add to chart if there's at least one non-null value
      const hasData = values.some(v => v !== null && v !== undefined);
      if (hasData) {
        datasets.push({
          label: `${region.geo_name} (Region)`,
          data: values,
          backgroundColor: colors['Region'],
          borderColor: colors['Region'].replace('0.8', '1'),
          borderWidth: 1
        });
      }
    });

    // Get LAD25 data
    const lad25Data = flattenedData.filter(row => row.layer_name === 'lad25');
    lad25Data.forEach(lad => {
      const values = columnNames.map(col => parsePercentage(lad[col]));
      console.log(`LAD25 ${lad.geo_name}:`, values);

      // Only add to chart if there's at least one non-null value
      const hasData = values.some(v => v !== null && v !== undefined);
      if (hasData) {
        datasets.push({
          label: `${lad.geo_name} (LAD)`,
          data: values,
          backgroundColor: colors['LAD'],
          borderColor: colors['LAD'].replace('0.8', '1'),
          borderWidth: 1
        });
      }
    });

    console.log('Final datasets:', datasets);
    createChart(categories, datasets);
  }

  function createChart(categories, datasets) {
    if (!chartCanvas) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'TS067 - Highest level of qualification, 2021 Census',
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
                return context.dataset.label + ': ' + (context.parsed.x?.toFixed(1) || 'N/A') + '%';
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            formatter: function(value) {
              return value != null ? value.toFixed(1) + '%' : '';
            },
            color: '#444',
            font: {
              weight: 'bold',
              size: 11
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Percentage (%)'
            },
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Qualification Level'
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
