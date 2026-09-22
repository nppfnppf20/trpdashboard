-- Canonical NPPF policy library — see [[project_nppf_policy_bank]].
--
-- A one-off, admin-maintained store of the NPPF's own policies (reference,
-- name, verbatim wording), populated once via an AI-assisted extract +
-- verbatim-check pass (same recipe as Conditions Tracker's decision-notice
-- extraction) and reviewed by hand. Once populated, this replaces re-asking
-- an LLM to transcribe NPPF wording from a re-uploaded copy every time a
-- project cites it — project code instead does a plain, deterministic
-- lookup by reference/name against this table.
--
-- Not project-scoped: this is a single shared library used across every
-- project, the same way admin_console.issue_types is.

CREATE TABLE IF NOT EXISTS admin_console.nppf_policies (
  id               serial PRIMARY KEY,
  policy_reference text NOT NULL,
  policy_name      text NOT NULL,
  policy_text      text NOT NULL,
  sort_order       integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nppf_policies_reference ON admin_console.nppf_policies (lower(policy_reference));
CREATE INDEX IF NOT EXISTS idx_nppf_policies_name ON admin_console.nppf_policies (lower(policy_name));
