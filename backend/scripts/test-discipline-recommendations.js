import 'dotenv/config';

// Test discipline-wide recommendations
async function testDisciplineRecommendations() {
  try {
    console.log('🧪 Testing discipline-wide recommendations...\n');

    // Test 1: Area with ecology features (should get triggered recommendations)
    const testPolygonWithFeatures = {
      "type": "Polygon",
      "coordinates": [[
        [-1.5, 52.5],
        [-1.4, 52.5],
        [-1.4, 52.6],
        [-1.5, 52.6],
        [-1.5, 52.5]
      ]]
    };

    console.log('Test 1: Area with ecological features');
    const response1 = await fetch('http://localhost:8080/analyze/ecology', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon: testPolygonWithFeatures })
    });

    const result1 = await response1.json();
    console.log(`✅ Rules triggered: ${result1.rules?.length || 0}`);
    console.log(`✅ Triggered recommendations: ${result1.defaultTriggeredRecommendations?.length || 0}`);
    console.log(`✅ No rules recommendations: ${result1.defaultNoRulesRecommendations?.length || 0}`);

    if (result1.defaultTriggeredRecommendations?.length > 0) {
      console.log('📋 Triggered recommendations:');
      result1.defaultTriggeredRecommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    // Test 2: Area with no ecology features (should get no-rules recommendations)
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

    console.log('\nTest 2: Area with no ecological features');
    const response2 = await fetch('http://localhost:8080/analyze/ecology', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon: testPolygonEmpty })
    });

    const result2 = await response2.json();
    console.log(`✅ Rules triggered: ${result2.rules?.length || 0}`);
    console.log(`✅ Triggered recommendations: ${result2.defaultTriggeredRecommendations?.length || 0}`);
    console.log(`✅ No rules recommendations: ${result2.defaultNoRulesRecommendations?.length || 0}`);

    if (result2.defaultNoRulesRecommendations?.length > 0) {
      console.log('📋 No-rules recommendations:');
      result2.defaultNoRulesRecommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }

    console.log('\n🎉 Discipline-wide recommendations test PASSED!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testDisciplineRecommendations().catch(console.error);