<script>
  /** @type {any | undefined} */
  export let socioeconomicsResult = undefined;
  /** @type {any[]} */
  export let flattenedData = [];

  let tableData = [];
  let columns = [];
  let warnings = [];
  let geographies = [];

  $: {
    if (socioeconomicsResult) {
      prepareTableData();
    }
  }

  function prepareTableData() {
    warnings = [];
    tableData = [];
    columns = [];
    geographies = [];

    console.log('=== Economic Inactivity Table Data ===');
    console.log('Total flattened rows:', flattenedData.length);

    // Collect only Region geographies (this is the only data we have for economic inactivity)
    const regions = flattenedData.filter(row => row.layer_name === 'regions');
    regions.forEach(region => {
      geographies.push({
        name: region.geo_name,
        type: 'Region',
        data: region
      });
    });

    console.log('Geographies found:', geographies);

    // Define economic inactivity categories
    const categories = [
      { name: 'Student', numberCol: 'APEIRSno', percentCol: 'APEIRSp' },
      { name: 'Looking after family or home', numberCol: 'APEIRFno', percentCol: 'APEIRFp' },
      { name: 'Temporary sick', numberCol: 'APEIRTSno', percentCol: 'APEIRTSp' },
      { name: 'Long-term sick', numberCol: 'APEIRLTno', percentCol: 'APEIRLTp' },
      { name: 'Discouraged', numberCol: 'APEIRDno', percentCol: 'APEIRDp' },
      { name: 'Retired', numberCol: 'APEIRTno_1', percentCol: 'APEIRTp_1' },
      { name: 'Other', numberCol: 'APEIRTno_2', percentCol: 'APEIRTp_2' }
    ];

    // Build table data - one row per category
    categories.forEach(category => {
      const row = {
        category: category.name
      };

      geographies.forEach(geo => {
        const numberCol = `Master sheet2_${category.numberCol}`;
        const percentCol = `Master sheet2_${category.percentCol}`;

        row[`${geo.name}_number`] = geo.data[numberCol] ?? '';
        row[`${geo.name}_percent`] = geo.data[percentCol] ?? '';
      });

      tableData.push(row);
    });

    // Add Total row
    const totalRow = {
      category: 'Total'
    };
    geographies.forEach(geo => {
      totalRow[`${geo.name}_number`] = geo.data['Master sheet2_APEIRTno'] ?? '';
      totalRow[`${geo.name}_percent`] = geo.data['Master sheet2_APEIRTp'] ?? '';
    });
    tableData.push(totalRow);

    console.log('Table data prepared:', tableData);
  }
</script>

<div class="table-wrapper">
  <div class="table-header">
    <h3>Economic Inactivity by Reason, Annual Population Survey, Jul 2024 - Jun 2025</h3>
  </div>

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

  {#if tableData.length === 0}
    <div class="no-data">
      <p>No economic inactivity data available</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <!-- First header row: Geography names -->
          <tr>
            <th rowspan="2" class="category-header">Reason</th>
            {#each geographies as geo}
              <th colspan="2" class="geo-header">{geo.name} ({geo.type})</th>
            {/each}
          </tr>
          <!-- Second header row: number and % -->
          <tr>
            {#each geographies as geo}
              <th class="sub-header">number</th>
              <th class="sub-header">%</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each tableData as row}
            <tr>
              <td class="category-cell">{row.category}</td>
              {#each geographies as geo}
                <td class="number-cell">{row[`${geo.name}_number`]}</td>
                <td class="percent-cell">{row[`${geo.name}_percent`]}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .table-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .table-header {
    margin-bottom: 1rem;
  }

  .table-header h3 {
    margin: 0;
    color: #2c3e50;
    font-size: 1.25rem;
    font-weight: 600;
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

  .no-data {
    text-align: center;
    padding: 3rem 2rem;
    background: #f8f9fa;
    border-radius: 4px;
    color: #7f8c8d;
  }

  .table-container {
    overflow: auto;
    max-height: 600px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    flex: 1;
  }

  .data-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.85rem;
  }

  .data-table thead {
    position: sticky;
    top: 0;
    z-index: 15;
  }

  .data-table th {
    background: #f8f9fa;
    padding: 0.75rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid #dee2e6;
    border-right: 1px solid #dee2e6;
    font-weight: 600;
    color: #2c3e50;
  }

  .category-header {
    position: sticky;
    left: 0;
    top: 0;
    z-index: 20;
    background: #f8f9fa;
    text-align: left;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    min-width: 300px;
  }

  .geo-header {
    z-index: 10;
    background: #e9ecef;
  }

  .sub-header {
    z-index: 11;
    background: #f8f9fa;
    font-size: 0.8rem;
    border-top: 1px solid #dee2e6 !important;
  }

  .data-table td {
    padding: 0.5rem;
    border-bottom: 1px solid #dee2e6;
    border-right: 1px solid #dee2e6;
    color: #495057;
    background: #fafbfc;
    text-align: right;
  }

  .category-cell {
    position: sticky;
    left: 0;
    background: #fafbfc;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    z-index: 5;
    font-weight: 500;
    text-align: left;
    min-width: 300px;
  }

  .number-cell {
    text-align: right;
  }

  .percent-cell {
    text-align: right;
  }

  .data-table tr:hover td {
    background: #f1f3f5;
  }

  .data-table tr:hover .category-cell {
    background: #f1f3f5;
  }
</style>
