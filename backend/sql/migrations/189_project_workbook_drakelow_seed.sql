-- Seed: Drakelow's Project Workbook, loaded from the prototype (which was built from the Drakelow spreadsheets).
-- Run after 188_project_workbook.sql. Finds the project by name, so it does nothing if "Drakelow" does not exist.
-- Safe to re-run: existing rows are left alone (matched on project + gate ref / item type + number).
-- import_key records the id each row had in the prototype so a later import can match rows by key.
-- Blank rows created while testing the prototype are not included.

DO $$
DECLARE
  pid INTEGER;
BEGIN
  SELECT id INTO pid FROM public.projects WHERE project_name = 'Drakelow' ORDER BY id LIMIT 1;
  IF pid IS NULL THEN
    RAISE NOTICE 'Project "Drakelow" not found - workbook seed skipped.';
    RETURN;
  END IF;

  INSERT INTO public.workbook_gate_questions
    (project_id, gate, ref, section, section_title, sort_order, question, owner, score, comment, import_key)
  VALUES
  (pid, 2, '1.1', 1, 'Project governance, project management and financials', 1, 'Is the agreed Roles and Responsibility Matrix up to date and shared witht the rest of the organisation?', 'Sandy', 3, '', 'g2-1-1'),
  (pid, 2, '1.2', 1, 'Project governance, project management and financials', 2, 'Is the budget to get us to the next stage gate and resource plan clear, in writing and agreed?', 'Sandy', 2, '', 'g2-1-2'),
  (pid, 2, '1.3', 1, 'Project governance, project management and financials', 3, 'Is the programme to to Planning Submission up to date and with clear dates?', 'Sandy', 3, '', 'g2-1-3'),
  (pid, 2, '1.4', 1, 'Project governance, project management and financials', 4, 'Review of project risk and opportunities register (Governance, Legal, Financial, Design and Planning)', 'Sandy', 4, '', 'g2-1-4'),
  (pid, 2, '2.1', 2, 'Legal, site and Deeley matters', 5, 'Post pre-app, has the preferred site location been confirmed (Deeleys or alternative land)? ', 'Lee', 2, 'Discussions in progress', 'g2-2-1'),
  (pid, 2, '2.2', 2, 'Legal, site and Deeley matters', 6, 'If alternative land is to be used, return to Gate 1', 'Lee / Sandy', 0, '', 'g2-2-2'),
  (pid, 2, '2.3', 2, 'Legal, site and Deeley matters', 7, 'Has the necessary level of site access been agreed with Deeleys for surveys etc.?', 'Lee / Sandy', 0, '', 'g2-2-3'),
  (pid, 2, '2.4', 2, 'Legal, site and Deeley matters', 8, 'Have any post pre-app changes to the proposed programme and planning strategy been agreed with Deeleys as far as they are needed?', 'Lee', 0, '', 'g2-2-4'),
  (pid, 2, '2.5', 2, 'Legal, site and Deeley matters', 9, 'Have land agreements/rights been secured/progressed to the level needed for a planning app? Including for use of Deeleys land, access routes and cable corridors', 'Lee', 0, 'Lee indcated that current agreement does not give PeakGen rights to deliver the access independently of Deeley (red line plan will enable independent delivery in planning terms)', 'g2-2-5'),
  (pid, 2, '2.6', 2, 'Legal, site and Deeley matters', 10, 'Has a legal review been carried out on title matters, including rights of way, restrictive covenants, highway boundary, utility easements etc. to the level needed for a planning app?', 'Lee', 0, '', 'g2-2-6'),
  (pid, 2, '2.7', 2, 'Legal, site and Deeley matters', 11, '[Lee to advise on any further matters]', 'Lee', 0, '', 'g2-2-7'),
  (pid, 2, '3.1', 3, 'Design and planning', 12, 'Has the LPA''s pre-application advice been received, reviewed and advice provided to the client team?', 'Sandy', 0, '', 'g2-3-1'),
  (pid, 2, '3.2', 3, 'Design and planning', 13, 'Have we confirmed in planning terms, whether one or both sites (Deeley''s or Vistry) are suitable? ', 'Sandy', 4, 'HLPV with comments on preference if either. Note Vistry site has some vegetation which may impact on programme and risk.
No ecology information available from Vistry. Lee can look into whether a walkover could be done - Sandy to advise Lee.
Also any other certain survey needs.', 'g2-3-2'),
  (pid, 2, '3.3', 3, 'Design and planning', 14, 'Have we agreed an appropriate planning application route and strategy?', 'Sandy', 3, '', 'g2-3-3'),
  (pid, 2, '3.4', 3, 'Design and planning', 15, 'Have we agreed whether to submit a Planning Performance Agreement and if so, have we progressed with agreeing this with the LPA?', 'Sandy', 3, '', 'g2-3-4'),
  (pid, 2, '3.5', 3, 'Design and planning', 16, 'Have we reviewed the validation checklist against the pre-application advice and confirmed the scope of the application?', 'Sandy', 3, '', 'g2-3-5'),
  (pid, 2, '3.6', 3, 'Design and planning', 17, 'Have we requested and received quotes from the necessary specialist surveys and reports for the planning application?', 'Sandy', 3, '', 'g2-3-6'),
  (pid, 2, '3.7', 3, 'Design and planning', 18, 'Have we instructed the necessary specialist surveys and reports and have the specialists confirmed they can meet programme deadlines?', 'Sandy', 0, '', 'g2-3-7'),
  (pid, 2, '3.8', 3, 'Design and planning', 19, 'Has the necessary economic evidence been prepared that we reasonably consider will address principle of development matters?', 'Sandy', 0, '', 'g2-3-8'),
  (pid, 2, '3.10', 3, 'Design and planning', 20, 'Have we confirmed the requirements, timescales and preferred lawyer for the Hillside opinion and s106?', 'Sandy', 4, '', 'g2-3-10'),
  (pid, 2, '3.11', 3, 'Design and planning', 21, 'Have we agreed a public consultation strategy?', 'Sandy', 3, '', 'g2-3-11'),
  (pid, 2, '3.13', 3, 'Design and planning', 22, 'Have we agreed a stakeholder engagement strategy (specialist consultees)?', 'Sandy', 3, '', 'g2-3-13')
  ON CONFLICT (project_id, gate, ref) DO NOTHING;

  INSERT INTO public.workbook_items
    (project_id, item_type, seq, subject, body, raised_on, target_on, owner, priority, status, update_text, gate_refs, import_key)
  VALUES
  (pid, 'risk', 1, 'Site location', 'Deeley land is not deliverable. If not available then pivot needed to Vistry land with it''s own associated delivery risks', DATE '2026-10-06', DATE '2026-10-23', 'Lee', 1, 'completed', '', ARRAY['2.1', '2.2']::text[], 'r01'),
  (pid, 'risk', 2, 'Access to land', 'Access can''t be secured for surveys or other visits', DATE '2026-10-06', DATE '2026-10-16', 'Lee', 1, 'in progress', '', ARRAY['2.3']::text[], 'r02'),
  (pid, 'risk', 3, 'Land agreements, rights and legal review', 'Land agreements and rights cannot be secured for use of land, access routes and cable corridors; rights of way, restrictive covenants, highway boundary, utility easements etc. prevent a viable scheme', DATE '2026-10-06', DATE '2026-10-16', 'Lee', 1, 'in progress', '', ARRAY['2.5', '2.6']::text[], 'r03'),
  (pid, 'risk', 4, 'Principle of development', 'Principle of development not acceptable because employment policy requirement cannot be satisfied', DATE '2026-10-06', DATE '2026-12-07', 'Sandy', 2, 'in progress', 'Waiting on pre-app response before scoping and instructing the need assessment. We don''t consider this to be a major risk but it will remain a risk until well into the planngn preparation process', ARRAY['3.8']::text[], 'r04'),
  (pid, 'risk', 5, 'NESO deadline', 'Application not consented before NESO deadline. Delays in determination, s106 not signed in time, application refused with no time for appeal', DATE '2026-10-06', DATE '2027-06-30', 'Sandy', 2, 'in progress', '', ARRAY['1.3', '3.3', '3.10']::text[], 'r05'),
  (pid, 'risk', 6, 'Specialist surveys', 'Survey windows do not align with programme to meet NESO deadline, especially ecology', DATE '2026-10-06', DATE '2026-11-13', 'Sandy', 2, 'in progress', '', ARRAY['3.7']::text[], 'r06'),
  (pid, 'risk', 7, 'Specialist surveys', 'Late requirement from specialist consultees for further survey, leading to missed NESO window', DATE '2026-10-06', DATE '2026-11-13', 'Sandy', 3, 'in progress', 'We recommend seeking initial advice from specialists, possibly pre-app with consultees and possibly taking a low risk approach (i.e. if we think we may need a survey then do it)', ARRAY['3.13']::text[], 'r07'),
  (pid, 'risk', 8, 'Scheme viability', 'Viable scheme not achievable within site constraints', DATE '2026-10-06', DATE '2026-10-23', 'Peakgen', 2, 'in progress', '', '{}'::text[], 'r08'),
  (pid, 'risk', 9, 'NESO contract', 'Other consented scheme is given NESO contract', DATE '2026-10-06', DATE '2027-06-30', 'Peakgen', 3, 'not started', '', '{}'::text[], 'r09'),
  (pid, 'risk', 10, 'Vistry - size of site', 'site too small for the proposals. Can everything fit on the Vistry site - and retain the existing trees?', DATE '2026-10-08', DATE '2026-10-23', 'Peakgen', 1, 'not started', '', ARRAY['3.2']::text[], 'r10'),
  (pid, 'risk', 11, 'Vistry - Bat Surveys', 'Surveys needed for bats, we are out of season and therefore a programme risk.', DATE '2026-10-08', DATE '2026-10-23', 'Sandy', 1, 'not started', 'Get ecologist advice on this.', ARRAY['3.2']::text[], 'r11'),
  (pid, 'risk', 12, 'Vistry - Tree Removal', 'If we remove the trees will that be an issue for bats/ trees / programme', DATE '2026-10-08', DATE '2026-10-23', 'Sandy', 1, 'not started', '', ARRAY['3.2']::text[], 'r12'),
  (pid, 'action', 1, 'DTMs and client meetings', 'Agree schedule of meetings with client', DATE '2026-10-06', DATE '2026-10-13', 'Sandy', 1, 'in progress', '', '{}'::text[], 'a01'),
  (pid, 'action', 2, 'Roles and Responsibility matrix', 'Prepare and share with client for sign off then share with full team', DATE '2026-10-06', DATE '2026-10-12', 'Sandy', 1, 'in progress', '', ARRAY['1.1']::text[], 'a02'),
  (pid, 'action', 3, 'Budget', 'Prepare and share with client for sign off', DATE '2026-10-06', DATE '2026-10-30', 'Sandy', 1, 'in progress', '', ARRAY['1.2']::text[], 'a03'),
  (pid, 'action', 4, 'Programme', 'Prepare and share with client for sign off then share with full team', DATE '2026-10-06', DATE '2026-10-12', 'Sandy', 1, 'in progress', '', ARRAY['1.3']::text[], 'a04'),
  (pid, 'action', 5, 'RAID', 'Prepare and manage as TRP internal tool', DATE '2026-10-06', DATE '2026-10-12', 'Sandy', 1, 'in progress', '', ARRAY['1.4']::text[], 'a05'),
  (pid, 'action', 6, 'Legal - Hillside and planning stategy', 'Confirm whether Vistry site has Hillside risk? And legal steer on preferred planning route (full or RM)', DATE '2026-10-06', DATE '2026-10-23', 'Sandy', 1, 'in progress', '', '{}'::text[], 'a06'),
  (pid, 'action', 7, 'Legal - Hillside', 'Agree process for legal opinion, including  preferred lawyer, timescales, lawyer and TRP fees', DATE '2026-10-07', DATE '2026-10-13', 'Sandy', 2, 'in progress', '', '{}'::text[], 'a07'),
  (pid, 'action', 8, 'S106', 'Agree process for prep of s106, including  preferred lawyer, timescales, lawyer and TRP fees', DATE '2026-10-06', DATE '2026-10-13', 'Sandy', 1, 'in progress', '', '{}'::text[], 'a08'),
  (pid, 'action', 9, 'Public consultation', 'Agree a public consultation strategy', DATE '2026-10-06', DATE '2026-10-13', 'Sandy', 2, 'in progress', '', '{}'::text[], 'a09'),
  (pid, 'action', 10, 'Principle of development', 'Build principle arguments using specialist input and planning narrative, initially to confirm site preference and then for planning statement', DATE '2026-10-06', DATE '2026-12-07', 'Sandy', 2, 'in progress', '', ARRAY['3.8']::text[], 'a10'),
  (pid, 'action', 11, 'Confirm site location', 'Prep HLPV with comments on preference if either. Note Vistry site has some vegetation which may impact on programme and risk.
No ecology information available from Vistry. Lee can look into whether a walkover could be done - Sandy to advise Lee.
Also any other certain survey needs.', DATE '2026-10-06', DATE '2026-10-16', 'Sandy', 1, 'in progress', '', ARRAY['3.2']::text[], 'a11'),
  (pid, 'action', 12, 'Vistry - Size of site', 'Is site large enough for the proposals. Can everything fit on the Vistry site - and retain the existing trees?', DATE '2026-10-08', DATE '2026-10-23', 'Sandy', 1, 'in progress', '', ARRAY['3.2']::text[], 'a12'),
  (pid, 'action', 13, 'Vistry - Bat Surveys', 'Confirm  with ecologist if surveys needed for bats (with trees retained and removed), whether we are out of season and therefore a programme risk.', DATE '2026-10-08', DATE '2026-10-23', 'Sandy', 1, 'in progress', '', ARRAY['3.2']::text[], 'a13'),
  (pid, 'action', 14, 'Vistry - Tree Removal', 'Confirm with arbo consutlant if we remove the trees will that be an issue for planning?', DATE '2026-10-08', DATE '2026-10-23', 'Sandy', 1, 'in progress', '', ARRAY['3.2']::text[], 'a14'),
  (pid, 'action', 15, 'Site access for surveyors', 'Confirm site access achievable (relates to choice of site)', DATE '2026-10-06', DATE '2026-10-16', 'Lee', 1, 'in progress', '', ARRAY['2.3']::text[], 'a15'),
  (pid, 'action', 16, 'Land agreements', 'Can land agreements be secured and legal review (in context of choice of site)', DATE '2026-10-06', DATE '2026-10-16', 'Lee', 1, 'in progress', '', ARRAY['2.5', '2.6']::text[], 'a16'),
  (pid, 'action', 17, 'Confirm site location', 'Confirm site choice', DATE '2026-10-06', DATE '2026-10-23', 'Lee', 1, 'in progress', '', ARRAY['2.1']::text[], 'a17'),
  (pid, 'action', 18, 'LPA pre-app advice', 'Chase receipt of pre-app advice, review and sumarise for client/design team', DATE '2026-10-06', DATE '2026-10-16', 'Sandy', 1, 'in progress', '', ARRAY['3.1']::text[], 'a18'),
  (pid, 'action', 19, 'Planning strategy', 'Prepare planning strategy for client sign off, including agreed planning route', DATE '2026-10-06', DATE '2026-10-23', 'Sandy', 2, 'in progress', '', ARRAY['3.3']::text[], 'a19'),
  (pid, 'action', 20, 'Validation/survey checklist', 'Review the validation checklist against the pre-application advice, plus confirm with Lee what other surverys are needed (non planning, if any) - advise client on submission pack', DATE '2026-10-06', DATE '2026-10-16', 'Sandy', 1, 'in progress', '', ARRAY['3.5']::text[], 'a20'),
  (pid, 'action', 21, 'Planning Performance Agreement', 'Confirm whether to progress with a PPA, including for pre-app  and/or determination stages; obtain LPA template or otherwise agree PPA content', DATE '2026-10-06', DATE '2026-11-06', 'Lee / Sandy', 2, 'in progress', '', ARRAY['3.4']::text[], 'a21'),
  (pid, 'action', 22, 'Specialist surveys', 'Obtain quotes for specialist surveys, recommend instructions to client and instruct on their behalf.', DATE '2026-10-06', DATE '2026-10-30', 'Sandy', 1, 'in progress', '', ARRAY['3.6', '3.7']::text[], 'a22'),
  (pid, 'action', 23, 'Specialist consultees', 'Confirm which specialist consultees we/our consultants should engage with pre-application, if any (including National Forest). Do this as part of obtaining quotes', DATE '2026-10-06', DATE '2026-10-30', 'Sandy', 2, 'in progress', '', ARRAY['3.13']::text[], 'a23'),
  (pid, 'action', 24, 'National Forest', 'Confirm design guidance and pre-app response and confirm how to address in layout and design', DATE '2026-10-08', DATE '2026-11-20', 'Sandy / Monika', 2, 'in progress', '', '{}'::text[], 'a24'),
  (pid, 'issue', 1, 'Officer hasn''t sent the pre-app response', 'Delay in certainy over site risk, scope of application and programme', DATE '2026-10-06', DATE '2026-10-23', 'Sandy', 1, 'in progress', '', ARRAY['3.1']::text[], 'i01'),
  (pid, 'issue', 2, 'Vistry - not yet seen ecology, trees or other surveys covering this land', 'Delay in certainy over site risk, scope of application and programme', DATE '2026-10-08', NULL, 'Sandy', 1, 'in progress', 'Target given as ''13/19/26'' in the spreadsheet.', ARRAY['3.2']::text[], 'i02')
  ON CONFLICT (project_id, item_type, seq) DO NOTHING;

  -- Parent links (an action under a risk, an issue under an action), matched by import_key.
  UPDATE public.workbook_items c
  SET parent_id = p.id
  FROM (VALUES
    ('a04', 'r05'),
    ('a10', 'r04'),
    ('a11', 'r10'),
    ('a12', 'r10'),
    ('a13', 'r11'),
    ('a14', 'r12'),
    ('a15', 'r02'),
    ('a16', 'r03'),
    ('a17', 'r01'),
    ('a19', 'r05'),
    ('a23', 'r07'),
    ('i01', 'a18')
  ) AS m(child_key, parent_key)
  JOIN public.workbook_items p ON p.project_id = pid AND p.import_key = m.parent_key
  WHERE c.project_id = pid AND c.import_key = m.child_key AND c.parent_id IS NULL;

  -- Progress entries on actions (the spreadsheet's Update text becomes the first entry).
  INSERT INTO public.workbook_progress (item_id, entry_date, source, body)
  SELECT i.id, v.entry_date, v.source, v.body
  FROM (VALUES
    ('a01', DATE '2026-10-06', 'Spreadsheet', 'review against programme'),
    ('a03', DATE '2026-10-06', 'Spreadsheet', 'Date TBC as need to get survey quotes etc.'),
    ('a06', DATE '2026-10-06', 'Spreadsheet', 'note legal opinion comes later in programme'),
    ('a07', DATE '2026-10-07', 'Spreadsheet', 'note legal opinion comes later in programme'),
    ('a08', DATE '2026-10-06', 'Spreadsheet', 'ideally same lawyer as Hillside. Drafting comes later in programme'),
    ('a10', DATE '2026-10-06', 'Spreadsheet', 'Waiting on pre-app response before scoping and instructing the need assessment. We don''t consider this to be a major risk but it will remain a risk until well into the planngn preparation process'),
    ('a11', DATE '2026-10-06', 'Spreadsheet', 'Drafted for discussion at client meeting'),
    ('a17', DATE '2026-10-06', 'Spreadsheet', 'When does programme mean we have to have made a decision?'),
    ('a18', DATE '2026-10-06', 'Spreadsheet', 'Officer indicated on 8/10 that they will issue next week.'),
    ('a20', DATE '2026-10-06', 'Spreadsheet', 'Note risk of post submission expections for further surveys - need to agree how to manage this- balance of belt/braces and  budget
Vistry site - arboriculture and contaminated land will be needed; lighting (discuss requirements and ideally condition against an outline lighting strategy - need ecologist input)'),
    ('a21', DATE '2026-10-06', 'Spreadsheet', 'Officers will advise in pre-app response.'),
    ('a22', DATE '2026-10-06', 'Spreadsheet', 'Fire - how do we deminstrate low risk'),
    ('a23', DATE '2026-10-06', 'Spreadsheet', 'Note those that are consultees outside of LPA:
- Derbyshire Wildlife Trust are difficult. 
- Highways - county
- LLFA
- National Forest
Q to consultants - how do we minimise risk that consultees request additional information/survey post submission? E.g. belt and braces survey, pre-app, others?
Q. Programme for surveyor work.')
  ) AS v(item_key, entry_date, source, body)
  JOIN public.workbook_items i ON i.project_id = pid AND i.import_key = v.item_key
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workbook_progress p WHERE p.item_id = i.id AND p.entry_date = v.entry_date AND p.body = v.body
  );
END $$;
