-- Project Workbook (Beta): a per-project stage-gate checklist plus RAID-style logs.
-- Adds new tables only; nothing existing is altered, so no other page is affected. Safe to re-run.
--
--   workbook_gate_questions  the stage-gate questions (scored 0-5) for a project
--   workbook_items           risks, actions, issues and decisions in one table (item_type), linked to
--                            gate questions by ref (gate_refs) and to each other by parent_id
--   workbook_progress        dated progress entries on an item (shown on actions)
--   workbook_notes           meeting notes / emails pasted into the workbook, used by Add advancement
--   workbook_advancements    record of each Add advancement that was applied
--
-- import_key holds the id a row had in the source spreadsheet / prototype, so a later import can match
-- rows by key instead of by wording. Deleting a project removes its workbook.

CREATE TABLE IF NOT EXISTS public.workbook_gate_questions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  gate SMALLINT NOT NULL DEFAULT 2,
  ref TEXT NOT NULL,
  section SMALLINT NOT NULL,
  section_title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  score SMALLINT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  import_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, gate, ref)
);

CREATE TABLE IF NOT EXISTS public.workbook_items (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('risk', 'action', 'issue', 'decision')),
  seq INTEGER NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  raised_on DATE,
  target_on DATE,
  owner TEXT NOT NULL DEFAULT '',
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'not started' CHECK (status IN ('not started', 'in progress', 'completed')),
  update_text TEXT NOT NULL DEFAULT '',
  gate_refs TEXT[] NOT NULL DEFAULT '{}',
  parent_id INTEGER REFERENCES public.workbook_items(id) ON DELETE SET NULL,
  import_key TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_type, seq)
);

CREATE TABLE IF NOT EXISTS public.workbook_progress (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES public.workbook_items(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'Note',
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workbook_notes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Meeting notes',
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'Meeting notes',
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workbook_advancements (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  note_id INTEGER REFERENCES public.workbook_notes(id) ON DELETE SET NULL,
  advancement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'Meeting notes',
  summary TEXT NOT NULL DEFAULT '',
  applied_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workbook_gate_questions_project ON public.workbook_gate_questions (project_id, gate, sort_order);
CREATE INDEX IF NOT EXISTS idx_workbook_items_project ON public.workbook_items (project_id, item_type, seq);
CREATE INDEX IF NOT EXISTS idx_workbook_items_parent ON public.workbook_items (parent_id);
CREATE INDEX IF NOT EXISTS idx_workbook_progress_item ON public.workbook_progress (item_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_workbook_notes_project ON public.workbook_notes (project_id, note_date DESC);
CREATE INDEX IF NOT EXISTS idx_workbook_advancements_project ON public.workbook_advancements (project_id, created_at DESC);

-- The app reaches these through the backend's own database connection. Row level security with no policies
-- keeps them closed to the public Supabase API (anon / authenticated keys).
ALTER TABLE public.workbook_gate_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_advancements ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.workbook_gate_questions IS 'Project Workbook: stage-gate questions with a 0-5 score, owner and comment.';
COMMENT ON TABLE public.workbook_items IS 'Project Workbook: risks, actions, issues and decisions. gate_refs link to gate question refs; parent_id links an action to a risk or an issue to an action/risk.';
COMMENT ON TABLE public.workbook_progress IS 'Project Workbook: dated progress entries on an item (used on actions).';
COMMENT ON TABLE public.workbook_notes IS 'Project Workbook: meeting notes / emails pasted in, used as the source for Add advancement.';
COMMENT ON TABLE public.workbook_advancements IS 'Project Workbook: record of each applied Add advancement.';
