import 'dotenv/config';

// Test landscape discipline-wide recommendations
async function testLandscapeRecommendations() {
  try {
    console.log('🧪 Testing landscape discipline-wide recommendations...\n');

    // Test area with no landscape features (should get no-rules recommendations)
    const testPolygonEmpty = {
      "type": "Polygon",
      "coordinates": [[
        [-180, -89],
        [-179, -89],
        [-179, -88],
        [-180, -88],
        [-180, -89]
      ]]
    };

    console.log('Testing area with no landscape features...');
    const response = await fetch('http://localhost:8080/analyze/landscape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon: testPolygonEmpty })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    console.log('\n🔍 Full API Response:');
    console.log(JSON.stringify(result, null, 2));

    console.log(`\n📊 Summary:`);
    console.log(`  - Green Belt areas: ${result.green_belt?.length || 0}`);
    console.log(`  - AONB areas: ${result.aonb?.length || 0}`);
    console.log(`  - Rules triggered: ${result.rules?.length || 0}`);
    console.log(`  - Triggered recommendations: ${result.defaultTriggeredRecommendations?.length || 0}`);
    console.log(`  - No rules recommendations: ${result.defaultNoRulesRecommendations?.length || 0}`);

    if (result.defaultNoRulesRecommendations?.length > 0) {
      console.log('\n📋 No-rules recommendations:');
      result.defaultNoRulesRecommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    } else {
      console.log('\n❌ No no-rules recommendations found!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testLandscapeRecommendations().catch(console.error);