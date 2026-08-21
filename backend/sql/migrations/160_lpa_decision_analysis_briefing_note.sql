-- Free-text scheme context the user can add to the LPA Decision Analysis tool,
-- fed into both per-document analysis and synthesis so the AI's read of
-- comparable decisions is framed against this specific scheme.

ALTER TABLE public.lpa_decision_analysis ADD COLUMN IF NOT EXISTS briefing_note TEXT;
