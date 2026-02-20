-- Add status column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT;

-- Add comment for documentation
COMMENT ON COLUMN projects.status IS 'Project status: Prospective, Instructed, Submitted, Post-Submission, Closed (or custom text)';
