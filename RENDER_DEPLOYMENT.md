# Render Deployment Guide

## Environment Variables to Set

### **Frontend Environment Variables**
Set these in Render for your frontend service:

```
PUBLIC_SUPABASE_URL=your_supabase_url_here
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### **Backend Environment Variables**
Set these in Render for your backend service:

```
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
DATABASE_URL=your_postgres_connection_string_here
NODE_ENV=production
FRONTEND_URL=http://localhost:5173
PRODUCTION_FRONTEND_URL=https://your-frontend-name.onrender.com
```

**Note:** You'll get `PRODUCTION_FRONTEND_URL` after deploying the frontend.

---

## Quick Start

1. Push your code to GitHub
2. Deploy backend to Render
3. Deploy frontend to Render
4. Update backend's `PRODUCTION_FRONTEND_URL` with frontend URL
5. Configure Supabase redirect URLs
6. Test!

See below for detailed step-by-step instructions.
