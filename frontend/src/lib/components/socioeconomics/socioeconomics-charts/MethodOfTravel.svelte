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

    console.log('=== Method of Travel Table Data ===');
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

    // Define travel methods
    const travelMethods = [
      { name: 'Work mainly at or from home', numberCol: 'Work mainly at or from home', percentCol: 'Work mainly at or from home percent' },
      { name: 'Underground, metro, light rail, tram', numberCol: 'Underground, metro, light rail, tram', percentCol: 'Underground, metro, light rail, tram percent' },
      { name: 'Train', numberCol: 'Train', percentCol: 'Train percent' },
      { name: 'Bus, minibus or coach', numberCol: 'Bus, minibus or coach', percentCol: 'Bus, minibus or coach percent' },
      { name: 'Taxi', numberCol: 'Taxi', percentCol: 'Taxi percent' },
      { name: 'Motorcycle, scooter or moped', numberCol: 'Motorcycle, scooter or moped', percentCol: 'Motorcycle, scooter or moped percent' },
      { name: 'Driving a car or van', numberCol: 'Driving a car or van', percentCol: 'Driving a car or van percent' },
      { name: 'Passenger in a car or van', numberCol: 'Passenger in a car or van', percentCol: 'Passenger in a car or van percent' },
      { name: 'Bicycle', numberCol: 'Bicycle', percentCol: 'Bicycle percent' },
      { name: 'On foot', numberCol: 'On foot', percentCol: 'On foot percent' },
      { name: 'Other method of travel to work', numberCol: 'Other method of travel to work', percentCol: 'Other method of travel to work percent' },
      { name: 'Total', numberCol: '16 or over in employment week before census', percentCol: '16 or over in employment week before census perce' }
    ];

    // Build table data - one row per travel method
    travelMethods.forEach(method => {
      const row = {
        method: method.name
      };

      geographies.forEach(geo => {
        const numberCol = `Master sheet2_${method.numberCol}`;
        const percentCol = `Master sheet2_${method.percentCol}`;

        row[`${geo.name}_number`] = geo.data[numberCol] ?? '';
        row[`${geo.name}_percent`] = geo.data[percentCol] ?? '';
      });

      tableData.push(row);
    });

    console.log('Table data prepared:', tableData);
  }
</script>

<div class="table-wrapper">
  <div class="table-header">
    <h3>TS061 - Method used to travel to work, 2021 Census</h3>
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
      <p>No travel data available</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <!-- First header row: Geography names -->
          <tr>
            <th rowspan="2" class="method-header">Travel Method</th>
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
              <td class="method-cell">{row.method}</td>
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

  .method-header {
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

  .method-cell {
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

  .data-table tr:hover .method-cell {
    background: #f1f3f5;
  }
</style>
