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

    console.log('=== Occupation Table Data ===');
    console.log('Total flattened rows:', flattenedData.length);

    // Collect all geographies
    // Get Countries
    const countries = flattenedData.filter(row => row.layer_name === 'countries');
    countries.forEach(country => {
      geographies.push({
        name: country.geo_name,
        type: 'Country',
        data: country
      });
    });

    // Get Regions
    const regions = flattenedData.filter(row => row.layer_name === 'regions');
    regions.forEach(region => {
      geographies.push({
        name: region.geo_name,
        type: 'Region',
        data: region
      });
    });

    // Get LAD25
    const lad25Data = flattenedData.filter(row => row.layer_name === 'lad25');
    lad25Data.forEach(lad => {
      geographies.push({
        name: lad.geo_name,
        type: 'LAD',
        data: lad
      });
    });

    console.log('Geographies found:', geographies);

    // Define occupation categories
    const occupationCategories = [
      { name: '1. Managers, directors and senior officials', numberCol: '1. Managers, directors and senior officials', percentCol: '1. percent Managers, directors and senior officia' },
      { name: '2. Professional occupations', numberCol: '2. Professional occupations', percentCol: '2. percent Professional occupations' },
      { name: '3. Associate professional and technical occupations', numberCol: '3. Associate professional and technical occupatio', percentCol: '3. percent Associate professional and technical o' },
      { name: '4. Administrative and secretarial occupations', numberCol: '4. Administrative and secretarial occupations', percentCol: '4. percent Administrative and secretarial occupat' },
      { name: '5. Skilled trades occupations', numberCol: '5. Skilled trades occupations', percentCol: 'Skilled percent' },
      { name: '6. Caring, leisure and other service occupations', numberCol: '6. Caring, leisure and other service occupations', percentCol: '6. percent Caring, leisure and other service occu' },
      { name: '7. Sales and customer service occupations', numberCol: '7. Sales and customer service occupations', percentCol: '7. percent Sales and customer service occupations' },
      { name: '8. Process, plant and machine operatives', numberCol: '8. Process, plant and machine operatives', percentCol: '8. percent Process, plant and machine operatives' },
      { name: '9. Elementary occupations', numberCol: '9. Elementary occupations', percentCol: '9. Elementary occupations percent' }
    ];

    // Build table data - one row per occupation category
    occupationCategories.forEach(category => {
      const row = {
        occupation: category.name
      };

      geographies.forEach(geo => {
        const numberCol = `Master sheet2_${category.numberCol}`;
        const percentCol = `Master sheet2_${category.percentCol}`;

        row[`${geo.name}_number`] = geo.data[numberCol] ?? '';
        row[`${geo.name}_percent`] = geo.data[percentCol] ?? '';
      });

      tableData.push(row);
    });

    // Add Occupation Total row
    const totalRow = {
      occupation: 'Occupation Total'
    };
    geographies.forEach(geo => {
      totalRow[`${geo.name}_number`] = geo.data['Master sheet2_Occupation All usual residents'] ?? '';
      totalRow[`${geo.name}_percent`] = geo.data['Master sheet2_Occupation All usual residents percent'] ?? '';
    });
    tableData.push(totalRow);

    console.log('Table data prepared:', tableData);
  }
</script>

<div class="table-wrapper">
  <div class="table-header">
    <h3>TS063 - Occupation, 2021 Census</h3>
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
      <p>No occupation data available</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <!-- First header row: Geography names -->
          <tr>
            <th rowspan="2" class="occupation-header">Occupation</th>
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
              <td class="occupation-cell">{row.occupation}</td>
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

  .occupation-header {
    position: sticky;
    left: 0;
    top: 0;
    z-index: 20;
    background: #f8f9fa;
    text-align: left;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    min-width: 350px;
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

  .occupation-cell {
    position: sticky;
    left: 0;
    background: #fafbfc;
    box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
    z-index: 5;
    font-weight: 500;
    text-align: left;
    min-width: 350px;
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

  .data-table tr:hover .occupation-cell {
    background: #f1f3f5;
  }
</style>
