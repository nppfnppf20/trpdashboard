-- Documents (decision notices, officer reports, consultee responses...) uploaded against a saved Similar Scheme.
-- The extracted text is stored so it can be read in the workspace and used as the source for the chat. The type is
-- suggested by the AI on upload and marked confirmed once the user accepts or changes it.
-- Deleting a saved scheme removes its documents.

CREATE TABLE IF NOT EXISTS public.similar_scheme_documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  planit_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other' CHECK (doc_type IN ('decision_notice', 'officer_report', 'consultee', 'other')),
  type_confirmed BOOLEAN NOT NULL DEFAULT false,
  extracted_text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  parse_warning TEXT,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, planit_name)
    REFERENCES public.similar_schemes_saved (project_id, planit_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_similar_scheme_documents_scheme
  ON public.similar_scheme_documents (project_id, planit_name);

COMMENT ON TABLE public.similar_scheme_documents IS 'Documents uploaded against a saved Similar Scheme: extracted text, AI-suggested type (confirmed flag set when the user accepts it).';
