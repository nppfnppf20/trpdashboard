/**
 * Test script for rate limiting
 * Tests both general API limit and analysis-specific limit
 */

const API_URL = 'http://localhost:8080';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';

// Test polygon (small area for quick testing)
const testPolygon = {
  type: "Polygon",
  coordinates: [[
    [-1.5, 53.8],
    [-1.4, 53.8],
    [-1.4, 53.9],
    [-1.5, 53.9],
    [-1.5, 53.8]
  ]]
};

async function testGeneralRateLimit() {
  console.log('\n🧪 Testing General API Rate Limit (100 req/15min)...\n');
  console.log('⚠️  Note: This requires a valid auth token. Testing with /api/projects endpoint.\n');
  
  if (!TEST_TOKEN || TEST_TOKEN === 'your-test-token-here') {
    console.log('⏭️  Skipping general API test (no TEST_TOKEN environment variable set)');
    console.log('💡 Set TEST_TOKEN to test: TEST_TOKEN=your-token node test-rate-limiting.js\n');
    return;
  }
  
  let successCount = 0;
  let rateLimitedCount = 0;
  
  // Try 110 requests rapidly
  for (let i = 1; i <= 110; i++) {
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`
        }
      });
      
      if (response.status === 200) {
        successCount++;
        if (i % 10 === 0) console.log(`✅ Request ${i}: Success (${successCount} total)`);
      } else if (response.status === 429) {
        rateLimitedCount++;
        const data = await response.json();
        console.log(`⛔ Request ${i}: Rate limited! Message: "${data.message}"`);
        
        // Check rate limit headers
        console.log(`   Rate Limit Info:`);
        console.log(`   - Limit: ${response.headers.get('RateLimit-Limit')}`);
        console.log(`   - Remaining: ${response.headers.get('RateLimit-Remaining')}`);
        console.log(`   - Reset: ${response.headers.get('RateLimit-Reset')}`);
        
        // No need to continue after first rate limit
        break;
      }
    } catch (error) {
      console.error(`❌ Request ${i} failed:`, error.message);
    }
  }
  
  console.log(`\n📊 Results: ${successCount} successful, ${rateLimitedCount} rate-limited`);
  console.log(`✅ General rate limiting is ${rateLimitedCount > 0 ? 'WORKING' : 'NOT WORKING'}`);
}

async function testAnalysisRateLimit() {
  console.log('\n🧪 Testing Analysis Rate Limit (20 req/15min)...\n');
  console.log('⚠️  Note: This requires a valid auth token. Skipping if no token provided.\n');
  
  if (!TEST_TOKEN || TEST_TOKEN === 'your-test-token-here') {
    console.log('⏭️  Skipping analysis test (no TEST_TOKEN environment variable set)');
    return;
  }
  
  let successCount = 0;
  let rateLimitedCount = 0;
  
  // Try 25 analysis requests
  for (let i = 1; i <= 25; i++) {
    try {
      const response = await fetch(`${API_URL}/analyze/heritage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_TOKEN}`
        },
        body: JSON.stringify({ polygon: testPolygon })
      });
      
      if (response.status === 200) {
        successCount++;
        console.log(`✅ Analysis ${i}: Success`);
      } else if (response.status === 429) {
        rateLimitedCount++;
        const data = await response.json();
        console.log(`⛔ Analysis ${i}: Rate limited! Message: "${data.message}"`);
        
        // Check rate limit headers
        console.log(`   Rate Limit Info:`);
        console.log(`   - Limit: ${response.headers.get('RateLimit-Limit')}`);
        console.log(`   - Remaining: ${response.headers.get('RateLimit-Remaining')}`);
        console.log(`   - Reset: ${response.headers.get('RateLimit-Reset')}`);
        
        break;
      } else {
        console.log(`⚠️  Analysis ${i}: Status ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Analysis ${i} failed:`, error.message);
    }
  }
  
  console.log(`\n📊 Results: ${successCount} successful, ${rateLimitedCount} rate-limited`);
  console.log(`✅ Analysis rate limiting is ${rateLimitedCount > 0 ? 'WORKING' : 'NOT WORKING'}`);
}

async function runTests() {
  console.log('🚀 Starting Rate Limiting Tests\n');
  console.log('================================================');
  
  await testGeneralRateLimit();
  await testAnalysisRateLimit();
  
  console.log('\n================================================');
  console.log('✅ Rate limiting tests complete!\n');
  console.log('💡 Tip: Set TEST_TOKEN env variable to test analysis limits');
  console.log('   Example: TEST_TOKEN=your-token node test-rate-limiting.js\n');
}

runTests().catch(console.error);
