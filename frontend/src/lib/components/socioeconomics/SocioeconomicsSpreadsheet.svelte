<script>
  import SocioeconomicsCharts from './SocioeconomicsCharts.svelte';

  /**
   * @typedef {Object} SocioeconomicsData
   * @property {Object} Countries - Countries data
   * @property {Object} LAD11 - Local Authority Districts 2011 data
   * @property {Object} LAD19 - Local Authority Districts 2019 data
   * @property {Object} LAD25 - Local Authority Districts 2025 data
   * @property {Object} Regions - Regions data
   */

  /** @type {any | undefined} */
  export let socioeconomicsResult = undefined;
  /** @type {string} */
  export let title = 'Socioeconomic Analysis Results';
  /** @type {boolean} */
  export let loading = false;
  /** @type {string} */
  export let error = '';
  /** @type {{totalLayers: number, layersWithData: number, generatedAt: string} | undefined} */
  export let summaryStats = undefined;

  /** @type {string[]} */
  let allColumns = [];
  /** @type {string[]} */
  let displayColumns = [];
  /** @type {any[]} */
  let flattenedData = [];
  /** @type {boolean} */
  let showCharts = false;

  // Columns to hide from display (but keep in export/copy data)
  const hiddenColumns = [
    'feature_index',
    'geo_code',
    'FID',
    'CTRY24CD',
    'CTRY24NM',
    'CTRY24NMW',
    'BNG_E',
    'BNG_N',
    'LONG',
    'LAT',
    'GlobalID',
    'Master sheet2_Geography Level',
    'Master sheet2_Name',
    'Master sheet2_field_279',
    'Master sheet2_field_280',
    'Master sheet2_field_281',
    'Master sheet2_field_282',
    'Master sheet2_field_283',
    'Master sheet2_field_284',
    'Master sheet2_field_285',
    'OBJECTID',
    'lad11cd',
    'lad11cdo',
    'lad11nm',
    'lad11nmw',
    'lad19cd',
    'lad19nm',
    'lad19nmw',
    'bng_e',
    'bng_n',
    'long',
    'lat',
    'field_7',
    'field_8',
    'field_9',
    'Master sheet2_field_7',
    'Master sheet2_field_8',
    'Master sheet2_field_9',
    'LAD25CD',
    'LAD25NM',
    'LAD25NMW',
    'RGN24CD',
    'RGN24NM',
    'geom' // Hide geometry data if present
  ];

  $: {
    if (socioeconomicsResult) {
      processResultsData();
    }
  }

  function processResultsData() {
    if (!socioeconomicsResult) return;

    // Flatten all data and collect all unique column names
    flattenedData = [];
    const columnsSet = new Set();

    Object.entries(socioeconomicsResult).forEach(([layerName, layerData]) => {
      if (layerName !== 'metadata' && Array.isArray(layerData) && layerData.length > 0) {
        layerData.forEach((feature, index) => {
          // Add layer and feature info
          const row = {
            layer_name: layerName,
            feature_index: index + 1,
            ...feature
          };

          // Map LAD11 census data to standard column names
          // If LAD11 has the long QS103EW column names, copy to the standard shorter names
          if (layerName === 'LAD11') {
            if (row['QS103EW - Age by single year 2011 census_Total 2011 census'] !== undefined) {
              // Map to both with and without Master sheet2_ prefix
              row['Total 2011 census'] = row['QS103EW - Age by single year 2011 census_Total 2011 census'];
              row['Master sheet2_Total 2011 census'] = row['QS103EW - Age by single year 2011 census_Total 2011 census'];
            }
            if (row['QS103EW - Age by single year 2011 census_Age 16-64 2011'] !== undefined) {
              row['Age 16-64 2011'] = row['QS103EW - Age by single year 2011 census_Age 16-64 2011'];
              row['Master sheet2_Age 16-64 2011'] = row['QS103EW - Age by single year 2011 census_Age 16-64 2011'];
            }
            if (row['QS103EW - Age by single year 2011 census_Working age percent 20'] !== undefined) {
              row['Working age percent 2011'] = row['QS103EW - Age by single year 2011 census_Working age percent 20'];
              row['Master sheet2_Working age percent 2011'] = row['QS103EW - Age by single year 2011 census_Working age percent 20'];
            }
          }

          // Map LAD19 population projection data to standard column names
          if (layerName === 'LAD19') {
            // 2018 data mapping
            if (row['Population projections LAD19_2018 All Ages'] !== undefined) {
              row['2018 All Ages'] = row['Population projections LAD19_2018 All Ages'];
            }
            if (row['Population projections LAD19_2018 Aged 0 to 15'] !== undefined) {
              row['2018 Aged 0 to 15'] = row['Population projections LAD19_2018 Aged 0 to 15'];
            }
            if (row['Population projections LAD19_2018 Aged 16 to 64'] !== undefined) {
              row['2018 Aged 16 to 64'] = row['Population projections LAD19_2018 Aged 16 to 64'];
            }
            if (row['Population projections LAD19_2018 Aged 65+'] !== undefined) {
              row['2018 Aged 65+'] = row['Population projections LAD19_2018 Aged 65+'];
            }

            // 2043 data mapping
            if (row['Population projections LAD19_2043 All Ages'] !== undefined) {
              row['2043 All Ages'] = row['Population projections LAD19_2043 All Ages'];
            }
            if (row['Population projections LAD19_2043 Aged 0 to 15'] !== undefined) {
              row['2043 Aged 0 to 15'] = row['Population projections LAD19_2043 Aged 0 to 15'];
            }
            if (row['Population projections LAD19_2043 Aged 16 to 64'] !== undefined) {
              row['2043 Aged 16 to 64'] = row['Population projections LAD19_2043 Aged 16 to 64'];
            }
            if (row['Population projections LAD19_2043 Aged 65+'] !== undefined) {
              row['2043 Aged 65+'] = row['Population projections LAD19_2043 Aged 65+'];
            }
          }

          // Collect all column names
          Object.keys(row).forEach(key => columnsSet.add(key));

          flattenedData.push(row);
        });
      }
    });

    // Convert Set to Array for easier iteration
    allColumns = Array.from(columnsSet);

    // Create filtered column list for display (exclude hidden columns)
    const filteredColumns = allColumns.filter(col => !hiddenColumns.includes(col));

    // Reorder columns: layer_type first, geo_name second, then the rest
    displayColumns = [];

    // Add layer_type if it exists
    if (filteredColumns.includes('layer_type')) {
      displayColumns.push('layer_type');
    }

    // Add geo_name if it exists
    if (filteredColumns.includes('geo_name')) {
      displayColumns.push('geo_name');
    }

    // Add remaining columns
    const remainingColumns = filteredColumns.filter(col =>
      col !== 'layer_type' && col !== 'geo_name'
    );
    displayColumns.push(...remainingColumns);

    // Sort rows by layer_type in the specified order
    const layerOrder = ['Countries', 'Regions', 'LAD25', 'LAD19', 'LAD11'];
    flattenedData.sort((a, b) => {
      const aIndex = layerOrder.indexOf(a.layer_type);
      const bIndex = layerOrder.indexOf(b.layer_type);

      // If both are in the order array, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one is in the order array, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // If neither is in the order array, sort alphabetically
      return (a.layer_type || '').localeCompare(b.layer_type || '');
    });
  }

  /**
   * Clean up column name by removing prefixes like "Master sheet2_"
   */
  function cleanColumnName(columnName) {
    if (!columnName) return columnName;

    // BRES column name mappings
    const bresMapping = {
      'BRES': 'Business Register and Employment Survey',
      'A number': 'A Agriculture forestry and fishing (number)',
      'A percent': 'A Agriculture forestry and fishing (%)',
      'B number': 'B Mining and quarrying (number)',
      'B percent': 'B Mining and quarrying (%)',
      'C number': 'C Manufacturing (number)',
      'C percent': 'C Manufacturing (%)',
      'D number': 'D Electricity gas steam and air conditioning supply (number)',
      'D percent': 'D Electricity gas steam and air conditioning supply (%)',
      'E number': 'E Water supply sewerage waste management and remediation activities (number)',
      'E percent': 'E Water supply sewerage waste management and remediation activities (%)',
      'F number': 'F Construction (number)',
      'F percent': 'F Construction (%)',
      'G number': 'G Wholesale and retail trade repair of motor vehicles and motorcycles (number)',
      'G percent': 'G Wholesale and retail trade repair of motor vehicles and motorcycles (%)',
      'H number': 'H Transportation and storage (number)',
      'H percent': 'H Transportation and storage (%)',
      'I number': 'I Accommodation and food service activities (number)',
      'I percent': 'I Accommodation and food service activities (%)',
      'J number': 'J Information and communication (number)',
      'J percent': 'J Information and communication (%)',
      'K number': 'K Financial and insurance activities (number)',
      'K percent': 'K Financial and insurance activities (%)',
      'L number': 'L Real estate activities (number)',
      'L percent': 'L Real estate activities (%)',
      'M number': 'M Professional scientific and technical activities (number)',
      'M percent': 'M Professional scientific and technical activities (%)',
      'N number': 'N Administrative and support service activities (number)',
      'N percent': 'N Administrative and support service activities (%)',
      'O number': 'O Public administration and defence compulsory social security (number)',
      'O percent': 'O Public administration and defence compulsory social security (%)',
      'P number': 'P Education (number)',
      'P percent': 'P Education (%)',
      'Q number': 'Q Human health and social work activities (number)',
      'Q percent': 'Q Human health and social work activities (%)',
      'R number': 'R Arts entertainment and recreation (number)',
      'R percent': 'R Arts entertainment and recreation (%)',
      'S number': 'S Other service activities (number)',
      'S percent': 'S Other service activities (%)',
      'BRES Total': 'Total'
    };

    // Annual population survey - Economic Inactivity mappings
    const apsMapping = {
      'Annual population survey - EIBY': 'Reason for Economic Inactivity',
      'APEIRSno': 'Student (number)',
      'APEIRSp': 'Student (%)',
      'APEIRFno': 'Looking after family or home (number)',
      'APEIRFp': 'Looking after family or home (%)',
      'APEIRTSno': 'Temporary sick (number)',
      'APEIRTSp': 'Temporary sick (%)',
      'APEIRLTno': 'Long-term sick (number)',
      'APEIRLTp': 'Long-term sick (%)',
      'APEIRDno': 'Discouraged (number)',
      'APEIRDp': 'Discouraged (%)',
      'APEIRTno': 'Total (number)',
      'APEIRTp': 'Total (%)',
      'APEIRTno_1': 'Retired (number)',
      'APEIRTp_1': 'Retired (%)',
      'APEIRTno_2': 'Other (number)',
      'APEIRTp_2': 'Other (%)'
    };

    // Annual population survey - EA and UE mappings (16-64 age group)
    const apsEAUEMapping = {
      'Annual pop survey EA and UE - 16-64': 'Annual Population Survey - Economically Active and Unemployment (16-64)',
      // Jul17-Jun18
      'Jul17-Jun18': 'Jul17-Jun18 total',
      'Jul17-Jun18EA': 'Jul17-Jun18 Economically Active',
      'Jul17-Jun18EAP': 'Jul17-Jun18 Economically Active %',
      'Jul17-18UE': 'Jul17-18 Unemployment',
      'Jul17-18UEP': 'Jul17-18 Unemployment %',
      // Jul18-Jun19
      'Jul18-Jun19': 'Jul18-Jun19 total',
      'Jul18-Jun19EA': 'Jul18-Jun19 Economically Active',
      'Jul18-Jun19EAP': 'Jul18-Jun19 Economically Active %',
      'Jul18-19UE': 'Jul18-19 Unemployment',
      'Jul18-19UEP': 'Jul18-19 Unemployment %',
      // Jul19-Jun20
      'Jul19-Jun20': 'Jul19-Jun20 total',
      'Jul19-Jun20EA': 'Jul19-Jun20 Economically Active',
      'Jul19-Jun20EAP': 'Jul19-Jun20 Economically Active %',
      'Jul19-20UE': 'Jul19-20 Unemployment',
      'Jul19-20UEP': 'Jul19-20 Unemployment %',
      // Jul20-Jun21
      'Jul20-Jun21': 'Jul20-Jun21 total',
      'Ju20-Jun21EA': 'Jul20-Jun21 Economically Active',
      'Ju20-Jun21EAP': 'Jul20-Jun21 Economically Active %',
      'Jul20-21UE': 'Jul20-21 Unemployment',
      'Jul20-21UEP': 'Jul20-21 Unemployment %',
      // Jul21-Jun22
      'Jul21-Jun22': 'Jul21-Jun22 total',
      'Jul21-Jun22EA': 'Jul21-Jun22 Economically Active',
      'Jul21-Jun22EAP': 'Jul21-Jun22 Economically Active %',
      'Jul21-Jun22UE': 'Jul21-Jun22 Unemployment',
      'Jul21-Jun22UEP': 'Jul21-Jun22 Unemployment %',
      // Jul22-Jun23
      'Jul22-Jun23': 'Jul22-Jun23 total',
      'Jul22-Jun23EA': 'Jul22-Jun23 Economically Active',
      'Jul22-Jun23EAP': 'Jul22-Jun23 Economically Active %',
      'Jul22-Jun23UE': 'Jul22-Jun23 Unemployment',
      'Jul22-Jun23UEP': 'Jul22-Jun23 Unemployment %',
      // Jul23-Jun24
      'Jul23-Jun24': 'Jul23-Jun24 total',
      'Jul23-Jun24EA': 'Jul23-Jun24 Economically Active',
      'Jul23-Jun24EAP': 'Jul23-Jun24 Economically Active %',
      'Jul23-Jun24UE': 'Jul23-Jun24 Unemployment',
      'Jul23-Jun24UEP': 'Jul23-Jun24 Unemployment %',
      // Jul24-Jun25
      'Jul24-Jun25': 'Jul24-Jun25 total',
      'Jul24-Jun25EA': 'Jul24-Jun25 Economically Active',
      'Jul24-Jun25EAP': 'Jul24-Jun25 Economically Active %',
      'Jul24-Jun25UE': 'Jul24-Jun25 Unemployment',
      'Jul24-Jun25UEP': 'Jul24-Jun25 Unemployment %'
    };

    // Remove "Master sheet2_" prefix (case insensitive)
    let cleaned = columnName.replace(/^Master\s*sheet2?_/i, '');

    // Check if this is a BRES column that needs mapping
    if (bresMapping[cleaned]) {
      return bresMapping[cleaned];
    }

    // Check if this is an APS column that needs mapping
    if (apsMapping[cleaned]) {
      return apsMapping[cleaned];
    }

    // Check if this is an APS EA/UE column that needs mapping
    if (apsEAUEMapping[cleaned]) {
      return apsEAUEMapping[cleaned];
    }

    // You can add more cleaning rules here if needed
    // For example: cleaned = cleaned.replace(/^some_other_prefix_/i, '');

    return cleaned;
  }

  async function copyToClipboard() {
    if (!flattenedData.length) return;

    // Create TSV content (tab-separated for better clipboard compatibility)
    // Use displayColumns to only export visible columns with cleaned names
    const headers = displayColumns.map(col => cleanColumnName(col)).join('\t');
    const rows = flattenedData.map(row =>
      displayColumns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // Replace tabs and newlines to avoid breaking the format
        return stringValue.replace(/[\t\n\r]/g, ' ');
      }).join('\t')
    );

    const tsvContent = [headers, ...rows].join('\n');

    try {
      await navigator.clipboard.writeText(tsvContent);
      alert('Data copied to clipboard! You can now paste it into a spreadsheet.');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try the CSV export instead.');
    }
  }

  function exportToCSV() {
    if (!flattenedData.length) return;

    // Create CSV content
    // Use displayColumns to only export visible columns with cleaned names
    const headers = displayColumns.map(col => {
      const cleaned = cleanColumnName(col);
      // Escape commas and quotes in headers
      if (cleaned.includes(',') || cleaned.includes('"')) {
        return `"${cleaned.replace(/"/g, '""')}"`;
      }
      return cleaned;
    }).join(',');

    const rows = flattenedData.map(row =>
      displayColumns.map(col => {
        const value = row[col];
        // Handle null/undefined values and escape commas/quotes
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socioeconomic_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
</script>

{#if loading}
  <div class="analysis-results">
    <div class="results-loading">
      <p>Analyzing socioeconomic data…</p>
    </div>
  </div>
{:else if error}
  <div class="results-error">
    <strong>Analysis Error:</strong> {error}
  </div>
{:else if !socioeconomicsResult || flattenedData.length === 0}
  <div class="analysis-results">
    <h2>{title}</h2>
    <div class="no-data">
      <p>No geographic features intersect with your polygon.</p>
    </div>
  </div>
{:else}
  <div class="analysis-results">
    <div class="results-header">
      <div class="title-section">
        <h2>{title}</h2>
      </div>
      <div class="action-buttons">
        <button class="copy-button" on:click={copyToClipboard}>
          Copy to Clipboard
        </button>
        <button class="export-button" on:click={exportToCSV}>
          Export to CSV
        </button>
        <button class="charts-button" on:click={() => showCharts = true}>
          View Charts
        </button>
      </div>
    </div>

    <div class="summary">
      <p><strong>Total Features Found:</strong> {flattenedData.length}</p>
      <p><strong>Geographic Layers:</strong> {Object.keys(socioeconomicsResult).filter(key => key !== 'metadata').join(', ')}</p>
    </div>

    <div class="table-container">
      <table class="results-table">
        <thead>
          <tr>
            {#each displayColumns as column}
              <th>{cleanColumnName(column)}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each flattenedData as row}
            <tr>
              {#each displayColumns as column}
                <td>
                  {row[column] ?? ''}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

{#if showCharts}
  <SocioeconomicsCharts
    {socioeconomicsResult}
    {flattenedData}
    onClose={() => showCharts = false}
  />
{/if}

<style>
  .analysis-results {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  h2 {
    margin: 0 0 1rem 0;
    color: #2c3e50;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .results-header h2 {
    margin: 0;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .copy-button {
    padding: 0.5rem 1rem;
    border: 1px solid #2196f3;
    background: #2196f3;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .copy-button:hover {
    background: #1976d2;
    border-color: #1976d2;
  }

  .export-button {
    padding: 0.5rem 1rem;
    border: 1px solid #4caf50;
    background: #4caf50;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .export-button:hover {
    background: #45a049;
    border-color: #45a049;
  }

  .charts-button {
    padding: 0.5rem 1rem;
    border: 1px solid #ff9800;
    background: #ff9800;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .charts-button:hover {
    background: #f57c00;
    border-color: #f57c00;
  }

  .results-loading {
    text-align: center;
    padding: 2rem;
    color: #7f8c8d;
  }

  .results-error {
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    padding: 1rem;
    color: #c33;
    margin-bottom: 1rem;
  }

  .summary {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
    border-left: 4px solid #3498db;
  }

  .summary p {
    margin: 0.5rem 0;
    color: #2c3e50;
  }

  .no-data {
    text-align: center;
    padding: 3rem 2rem;
    background: #f8f9fa;
    border-radius: 4px;
    color: #7f8c8d;
  }

  .table-container {
    overflow: auto;
    max-height: 500px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
  }

  .results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .results-table th {
    background: #f8f9fa;
    padding: 0.75rem 0.5rem;
    text-align: left;
    border-bottom: 2px solid #dee2e6;
    border-right: 1px solid #dee2e6;
    font-weight: 600;
    color: #2c3e50;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .results-table td {
    padding: 0.5rem;
    border-bottom: 1px solid #dee2e6;
    border-right: 1px solid #dee2e6;
    vertical-align: top;
    max-width: 200px;
    word-wrap: break-word;
    color: #495057;
    background: #fafbfc;
  }

  .results-table tr:hover td {
    background: #f1f3f5;
  }

  /* Sticky first column (layer_name) */
  .results-table th:first-child,
  .results-table td:first-child {
    position: sticky !important;
    left: 0 !important;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    isolation: isolate;
    width: 150px !important;
    min-width: 150px !important;
    max-width: 150px !important;
    border-right: 1px solid #dee2e6 !important;
    box-sizing: border-box !important;
  }

  .results-table th:first-child {
    z-index: 100;
    background: #f8f9fa !important;
  }

  .results-table td:first-child {
    z-index: 50;
    background: #fafbfc !important;
    font-weight: 500;
  }

  .results-table tr:hover td:first-child {
    background: #f1f3f5 !important;
  }

  /* Sticky second column (geo_name) - Absolutely positioned */
  .results-table th:nth-child(2),
  .results-table td:nth-child(2) {
    position: sticky !important;
    left: 151px !important; /* 150px (first column) + 1px (border) */
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    isolation: isolate;
    width: 200px !important;
    min-width: 200px !important;
    max-width: 200px !important;
    z-index: 98;
    box-sizing: border-box !important;
    border-left: 1px solid #dee2e6 !important;
    border-right: 1px solid #dee2e6 !important;
    transform: translateX(0) translateY(0) translateZ(0) !important;
    position-sticky: supported !important;
  }

  .results-table th:nth-child(2) {
    z-index: 99 !important;
    background: #f8f9fa !important;
  }

  .results-table td:nth-child(2) {
    z-index: 98 !important;
    background: #fafbfc !important;
    font-weight: 500;
  }

  .results-table tr:hover td:nth-child(2) {
    background: #f1f3f5 !important;
  }

  /* Sticky second column (geo_name) - Absolutely positioned */
  .results-table th:nth-child(2),
  .results-table td:nth-child(2) {
    position: sticky !important;
    left: 151px !important; /* 150px (first column) + 1px (border) */
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    isolation: isolate;
    width: 200px !important;
    min-width: 200px !important;
    max-width: 200px !important;
    z-index: 98;
    box-sizing: border-box !important;
    border-left: 1px solid #dee2e6 !important;
    border-right: 1px solid #dee2e6 !important;
    transform: translateX(0) translateY(0) translateZ(0) !important;
    position-sticky: supported !important;
  }

  .results-table th:nth-child(2) {
    z-index: 99 !important;
    background: #f8f9fa !important;
  }

  .results-table td:nth-child(2) {
    z-index: 98 !important;
    background: #fafbfc !important;
    font-weight: 500;
  }

  .results-table tr:hover td:nth-child(2) {
    background: #f1f3f5 !important;
  }

  .title-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-stats {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .stat {
    color: #64748b;
    font-size: 0.875rem;
  }

  .stat strong {
    color: #1e293b;
    font-weight: 600;
  }
</style>