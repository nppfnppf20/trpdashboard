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
    const chartData = [];

    // Debug: Log available columns
    console.log('=== DEBUGGING CHART DATA ===');
    console.log('Total flattened rows:', flattenedData.length);

    if (flattenedData.length > 0) {
      console.log('All columns in first row:', Object.keys(flattenedData[0]));

      // Show columns that contain "2021" or "working" or "age"
      const relevantColumns = Object.keys(flattenedData[0]).filter(key =>
        key.toLowerCase().includes('2021') ||
        key.toLowerCase().includes('2020') ||
        key.toLowerCase().includes('working') ||
        key.toLowerCase().includes('age') ||
        key.toLowerCase().includes('census') ||
        key.toLowerCase().includes('percent')
      );
      console.log('Relevant columns (containing census/age/working/percent):', relevantColumns);

      // Show sample of each layer type
      const layerTypes = [...new Set(flattenedData.map(row => row.layer_name))];
      console.log('Layer types found:', layerTypes);

      layerTypes.forEach(layerType => {
        const sample = flattenedData.find(row => row.layer_name === layerType);
        console.log(`Sample ${layerType} row:`, sample);
      });
    }

    // Get Countries data - only has 2021 census data
    const countries = flattenedData.filter(row => row.layer_name === 'countries');
    console.log('Countries filtered count:', countries.length);

    if (countries.length > 0) {
      console.log('First country full data:', countries[0]);
      console.log('Columns in first country:', Object.keys(countries[0]));
    }

    countries.forEach(country => {
      const data2011 = country['Master sheet2_Working age percent 2011'];
      const data2021 = country['Master sheet2_percent working age 2021 census'];
      const parsed2011 = parsePercentage(data2011);
      const parsed2021 = parsePercentage(data2021);

      console.log(`Country ${country.geo_name}:`, {
        data2011,
        data2021,
        parsed2011,
        parsed2021
      });

      // Only add if at least one parsed value is not null
      if (parsed2011 !== null || parsed2021 !== null) {
        chartData.push({
          name: country.geo_name,
          type: 'Country',
          value2011: parsed2011,
          value2021: parsed2021
        });
      }
    });

    // Get Regions data - has both 2011 and 2021 census data
    const regions = flattenedData.filter(row => row.layer_name === 'regions');
    regions.forEach(region => {
      const data2011 = region['Master sheet2_Working age percent 2011'];
      const data2021 = region['Master sheet2_percent working age 2021 census'];
      const parsed2011 = parsePercentage(data2011);
      const parsed2021 = parsePercentage(data2021);

      // Only add if at least one parsed value is not null
      if (parsed2011 !== null || parsed2021 !== null) {
        chartData.push({
          name: region.geo_name,
          type: 'Region',
          value2011: parsed2011,
          value2021: parsed2021
        });
      }
    });

    // Match LAD11 (2011 data) with LAD25 (2021 data) by geo_name
    const lad11Data = flattenedData.filter(row => row.layer_name === 'lad11');
    const lad25Data = flattenedData.filter(row => row.layer_name === 'lad25');

    console.log('LAD11 rows found:', lad11Data.length);
    console.log('LAD25 rows found:', lad25Data.length);

    // Create maps for matching
    const lad25Map = new Map();
    lad25Data.forEach(lad => {
      lad25Map.set(lad.geo_name, lad);
    });

    const lad11Map = new Map();
    lad11Data.forEach(lad => {
      lad11Map.set(lad.geo_name, lad);
    });

    // Track which LADs have been matched
    const matchedLADs = new Set();

    // Process LAD11 data
    lad11Data.forEach(lad11 => {
      const lad25 = lad25Map.get(lad11.geo_name);

      if (lad25) {
        // MATCHED: Both LAD11 and LAD25 have the same geo_name
        matchedLADs.add(lad11.geo_name);

        // Debug: Show all columns containing relevant keywords
        console.log(`LAD11 ${lad11.geo_name} columns with 'working/age/percent':`,
          Object.keys(lad11).filter(k =>
            k.toLowerCase().includes('working') ||
            k.toLowerCase().includes('age') ||
            k.toLowerCase().includes('percent') ||
            k.toLowerCase().includes('2011')
          )
        );
        console.log(`LAD25 ${lad25.geo_name} columns with 'working/age/percent':`,
          Object.keys(lad25).filter(k =>
            k.toLowerCase().includes('working') ||
            k.toLowerCase().includes('age') ||
            k.toLowerCase().includes('percent') ||
            k.toLowerCase().includes('2021')
          )
        );

        // LAD11 uses a different column name than Countries/Regions
        const data2011 = lad11['QS103EW - Age by single year 2011 census_Working age percent 20'];
        const data2021 = lad25['Master sheet2_percent working age 2021 census'];
        const parsed2011 = parsePercentage(data2011);
        const parsed2021 = parsePercentage(data2021);

        console.log(`✓ Matched LAD ${lad11.geo_name}:`, {
          data2011,
          data2021,
          parsed2011,
          parsed2021
        });

        // Only add if at least one parsed value is not null
        if (parsed2011 !== null || parsed2021 !== null) {
          chartData.push({
            name: lad11.geo_name,
            type: 'LAD',
            value2011: parsed2011,
            value2021: parsed2021
          });
        }
      } else {
        // UNMATCHED: LAD11 exists but no matching LAD25
        const data2011 = lad11['QS103EW - Age by single year 2011 census_Working age percent 20'];
        const parsed2011 = parsePercentage(data2011);

        console.log(`✗ Unmatched LAD11 ${lad11.geo_name} (2011 only)`);

        // Only add if parsed value is not null
        if (parsed2011 !== null) {
          warnings.push(`Boundary change: "${lad11.geo_name}" exists in 2011 census but not in 2021 census (shown with 2011 data only)`);

          chartData.push({
            name: `${lad11.geo_name} (2011 only)`,
            type: 'LAD',
            value2011: parsed2011,
            value2021: null
          });
        }
      }
    });

    // Process unmatched LAD25 data
    lad25Data.forEach(lad25 => {
      if (!matchedLADs.has(lad25.geo_name)) {
        // UNMATCHED: LAD25 exists but no matching LAD11
        const data2021 = lad25['Master sheet2_percent working age 2021 census'];
        const parsed2021 = parsePercentage(data2021);

        console.log(`✗ Unmatched LAD25 ${lad25.geo_name} (2021 only)`);

        // Only add if parsed value is not null
        if (parsed2021 !== null) {
          warnings.push(`Boundary change: "${lad25.geo_name}" exists in 2021 census but not in 2011 census (shown with 2021 data only)`);

          chartData.push({
            name: `${lad25.geo_name} (2021 only)`,
            type: 'LAD',
            value2011: null,
            value2021: parsed2021
          });
        }
      }
    });

    console.log('Final chart data:', chartData);
    createChart(chartData);
  }

  function createChart(data) {
    if (!chartCanvas) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const labels = data.map(d => `${d.name} (${d.type})`);
    const values2011 = data.map(d => d.value2011);
    const values2021 = data.map(d => d.value2021);

    chartInstance = new Chart(chartCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '2011 Census',
            data: values2011,
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: '2021 Census',
            data: values2021,
            backgroundColor: 'rgba(255, 99, 132, 0.8)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Working Age Population Percentage (2011 vs 2021)',
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
            title: {
              display: true,
              text: 'Working Age Percentage (%)'
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
              text: 'Geographic Area'
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
      <h4>Boundary Change Warnings:</h4>
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
