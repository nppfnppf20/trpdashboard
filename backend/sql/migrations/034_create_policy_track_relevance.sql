CREATE TABLE IF NOT EXISTS planning_applications.policy_track_relevance (
  policy_id INTEGER NOT NULL REFERENCES public.project_policies(id) ON DELETE CASCADE,
  track_id  INTEGER NOT NULL REFERENCES admin_console.project_issue_tracks(id) ON DELETE CASCADE,
  PRIMARY KEY (policy_id, track_id)
);
