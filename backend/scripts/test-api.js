// Quick test script for Projects API
// Run with: node test-api.js

async function testProjectsAPI() {
  const BASE_URL = 'http://localhost:8080';

  console.log('🧪 Testing Projects API...\n');

  try {
    // Test 1: Create a project
    console.log('1️⃣ Creating test project...');
    const createResponse = await fetch(`${BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'TEST-001',
        project_name: 'Test Solar Farm',
        client: 'Acme Energy',
        local_planning_authority: ['Westminster', 'Camden'],
        project_lead: 'John Smith'
      })
    });

    const createData = await createResponse.json();
    console.log('✅ Create Response:', JSON.stringify(createData, null, 2));

    // Test 2: Get all projects
    console.log('\n2️⃣ Fetching all projects...');
    const getAllResponse = await fetch(`${BASE_URL}/api/projects`);
    const allProjects = await getAllResponse.json();
    console.log('✅ All Projects:', JSON.stringify(allProjects, null, 2));

    // Test 3: Get single project
    if (createData.success && createData.project) {
      console.log('\n3️⃣ Fetching single project...');
      const getOneResponse = await fetch(`${BASE_URL}/api/projects/${createData.project.id}`);
      const oneProject = await getOneResponse.json();
      console.log('✅ Single Project:', JSON.stringify(oneProject, null, 2));
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testProjectsAPI();
