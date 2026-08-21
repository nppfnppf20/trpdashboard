# Projects API Integration Instructions

## Step 1: Add Import at Top of server.js

Add this import near the top of `backend/src/server.js` (around line 23, after other imports):

```javascript
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject
} from './projectsApi.js';
```

## Step 2: Add Routes Before app.listen()

Add these routes before the `app.listen()` call (before line 717):

```javascript
// ============================================
// PROJECTS API ENDPOINTS
// ============================================

// Create new project
app.post('/api/projects', createProject);

// Get all projects
app.get('/api/projects', getAllProjects);

// Get single project by ID
app.get('/api/projects/:id', getProjectById);

// Update project
app.put('/api/projects/:id', updateProject);

// Delete project
app.delete('/api/projects/:id', deleteProject);
```

## Step 3: Install uuid package (if not already installed)

```bash
cd backend
npm install uuid
```

## Step 4: Run Database Migration

Connect to your database and run:

```bash
psql -U your_username -d your_database -f backend/sql/migrations/001_create_projects_table.sql
```

Or via Supabase SQL Editor: Copy and paste the contents of `001_create_projects_table.sql`

## Step 5: Test the API

Restart your backend server:

```bash
cd backend
npm run dev
```

Test with curl or Postman:

```bash
# Create a project
curl -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "TEST-001",
    "project_name": "Test Solar Farm",
    "client": "Acme Energy",
    "local_planning_authority": ["Westminster", "Camden"]
  }'

# Get all projects
curl http://localhost:8080/api/projects
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/projects | Create new project |
| GET | /api/projects | Get all projects |
| GET | /api/projects/:id | Get single project |
| PUT | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |

## Required Fields

- `project_id` (string, unique)
- `project_name` (string)

All other fields are optional.
