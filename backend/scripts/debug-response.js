import 'dotenv/config';

// Debug the full API response
async function debugResponse() {
  try {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon: testPolygon })
    });

    const result = await response.json();

    console.log('🔍 Full API Response:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugResponse();