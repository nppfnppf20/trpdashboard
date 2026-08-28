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
    if (flattenedData.length > 0) {
      const sample = flattenedData[0];
      const eiCols = Object.keys(sample).filter(k => k.startsWith('apeir'));
      console.log('Economic inactivity columns present:', eiCols.length > 0 ? eiCols : 'NONE - JOIN likely failed');
    }

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

    // Define economic inactivity categories (using subject table column names)
    const categories = [
      { name: 'Student', numberCol: 'apeirs_no', percentCol: 'apeirs_p' },
      { name: 'Looking after family or home', numberCol: 'apeirf_no', percentCol: 'apeirf_p' },
      { name: 'Temporary sick', numberCol: 'apeirts_no', percentCol: 'apeirts_p' },
      { name: 'Long-term sick', numberCol: 'apeirlt_no', percentCol: 'apeirlt_p' },
      { name: 'Discouraged', numberCol: 'apeird_no', percentCol: 'apeird_p' },
      { name: 'Retired', numberCol: 'apeirt_no_2', percentCol: 'apeirt_p_2' },
      { name: 'Other', numberCol: 'apeirt_no_3', percentCol: 'apeirt_p_3' }
    ];

    // Build table data - one row per category
    categories.forEach(category => {
      const row = {
        category: category.name
      };

      geographies.forEach(geo => {
        row[`${geo.name}_number`] = geo.data[category.numberCol] ?? '';
        row[`${geo.name}_percent`] = geo.data[category.percentCol] ?? '';
      });

      tableData.push(row);
    });

    // Add Total row
    const totalRow = {
      category: 'Total'
    };
    geographies.forEach(geo => {
      totalRow[`${geo.name}_number`] = geo.data['apeirt_no'] ?? '';
      totalRow[`${geo.name}_percent`] = geo.data['apeirt_p'] ?? '';
    });
    tableData.push(totalRow);

    console.log('Table data prepared:', tableData);
  }
</script>

<div class="table-wrapper">
  <div class="table-header">
    <h3>Economic Inactivity by Reason, Annual Population Survey, Apr 2025 - Mar 2026</h3>
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
    color: var(--color-slate-700);
    font-size: 1.25rem;
    font-weight: 600;
  }

  .warnings {
    background: var(--color-amber-100);
    border: 1px solid var(--color-amber-500);
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .warnings h4 {
    margin: 0 0 0.5rem 0;
    color: var(--color-amber-800);
    font-size: 1rem;
  }

  .warnings ul {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--color-amber-800);
  }

  .warnings li {
    margin: 0.25rem 0;
  }

  .no-data {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--color-slate-50);
    border-radius: 4px;
    color: var(--color-slate-500);
  }

  .table-container {
    overflow: auto;
    max-height: 600px;
    border: 1px solid var(--color-slate-200);
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
    background: var(--color-slate-50);
    padding: 0.75rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid var(--color-slate-200);
    border-right: 1px solid var(--color-slate-200);
    font-weight: 600;
    color: var(--color-slate-700);
  }

  .category-header {
    position: sticky;
    left: 0;
    top: 0;
    z-index: 20;
    background: var(--color-slate-50);
    text-align: left;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    min-width: 300px;
  }

  .geo-header {
    z-index: 10;
    background: var(--color-slate-200);
  }

  .sub-header {
    z-index: 11;
    background: var(--color-slate-50);
    font-size: 0.8rem;
    border-top: 1px solid var(--color-slate-200) !important;
  }

  .data-table td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-slate-200);
    border-right: 1px solid var(--color-slate-200);
    color: var(--color-slate-600);
    background: var(--color-slate-50);
    text-align: right;
  }

  .category-cell {
    position: sticky;
    left: 0;
    background: var(--color-slate-50);
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
    background: var(--color-slate-100);
  }

  .data-table tr:hover .category-cell {
    background: var(--color-slate-100);
  }
</style>
