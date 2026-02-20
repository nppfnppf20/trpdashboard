import 'dotenv/config';

// Test the ecology analysis endpoint to verify Ramsar integration
async function testRamsarIntegration() {
  try {
    console.log('Testing Ramsar integration...');

    // Test polygon near a known Ramsar site (example coordinates)
    const testPolygon = {
      "type": "Polygon",
      "coordinates": [[
        [-1.5, 52.5],
        [-1.4, 52.5],
        [-1.4, 52.6],
        [-1.5, 52.6],
        [-1.5, 52.5]
      ]]
    };

    const response = await fetch('http://localhost:8080/analyze/ecology', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ polygon: testPolygon })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    console.log('\n✅ Ecology analysis successful!');
    console.log('\n📊 Response structure:');
    console.log(`  - OS Priority Ponds: ${result.os_priority_ponds?.length || 0}`);
    console.log(`  - Ramsar Sites: ${result.ramsar?.length || 0}`);
    console.log(`  - Rules triggered: ${result.rules?.length || 0}`);
    console.log(`  - Overall risk: ${result.overallRisk}`);

    if (result.ramsar && result.ramsar.length > 0) {
      console.log('\n🏞️ Sample Ramsar site:');
      const site = result.ramsar[0];
      console.log(`  - Name: ${site.name || 'N/A'}`);
      console.log(`  - Code: ${site.code || 'N/A'}`);
      console.log(`  - Distance: ${site.dist_m}m`);
      console.log(`  - On site: ${site.on_site}`);
      console.log(`  - Direction: ${site.direction}`);
    }

    if (result.rules && result.rules.length > 0) {
      console.log('\n⚠️ Rules triggered:');
      result.rules.forEach(rule => {
        console.log(`  - ${rule.rule} (${rule.level})`);
        console.log(`    ${rule.findings}`);
      });
    }

    console.log('\n🎉 Ramsar integration test PASSED!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testRamsarIntegration().catch(console.error);