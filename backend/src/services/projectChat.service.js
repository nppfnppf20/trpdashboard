/**
 * Project Chat: grounded Q&A over user-selected project sources.
 *
 * Per-project only — no retrieval step. Every selected source is serialised
 * whole into the prompt, each block carrying a stable source ID ([P], [D12],
 * [M4], [C], …) that the model must cite. The catalogue returned by
 * getSourceCatalogue carries a char count per group/item so the frontend can
 * show a live context-window meter (same 200k-char budget as the meter in
 * StartingDocsModal); assembleContext re-checks the same budget server-side.
 */

import { pool } from '../db.js';

export const CONTEXT_BUDGET = 200000;

const stripHtml = html => (html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const fmtDate = d => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date) ? null : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-source serialisers. Each returns { text, count } or null when empty.
// The same functions drive both the catalogue char counts and chat assembly,
// so what the meter shows is exactly what the model sees.
// ─────────────────────────────────────────────────────────────────────────────

async function serializeProjectDetails(projectId) {
  const { rows } = await pool.query(`SELECT * FROM public.projects WHERE id = $1`, [projectId]);
  if (!rows.length) return null;
  const p = rows[0];

  const fields = [
    ['Project ID', p.project_id],
    ['Project Name', p.project_name],
    ['Status', p.status],
    ['Sectors', Array.isArray(p.sectors) ? p.sectors.join(', ') : p.sectors],
    ['Sub-sectors', Array.isArray(p.sub_sectors) ? p.sub_sectors.join(', ') : p.sub_sectors],
    ['Address', p.address],
    ['Area', p.area],
    ['Description of Development', p.development_description],
    ['Client', p.client],
    ['Client SPV Name', p.client_spv_name],
    ['Project Lead', p.project_lead],
    ['Project Manager', p.project_manager],
    ['Project Director', p.project_director],
    ['Local Planning Authority', Array.isArray(p.local_planning_authority) ? p.local_planning_authority.join(', ') : p.local_planning_authority],
    ['LPA Reference', p.lpa_reference],
    ['Designations on Site', p.designations_on_site],
    ['Relevant Nearby Designations', p.relevant_nearby_designations],
    ['Case Officer', p.case_officer_name],
    ['Case Officer Email', p.case_officer_email],
    ['Case Officer Phone', p.case_officer_phone_number],
    ['Submission Date', fmtDate(p.submission_date)],
    ['Validation Date', fmtDate(p.validation_date)],
    ['LPA Consultation End', fmtDate(p.lpa_consultation_end_date)],
    ['Committee Date', fmtDate(p.committee_date)],
    ['Target Determination Date', fmtDate(p.target_determination_date)],
    ['Determined Date', fmtDate(p.determined_date)],
    ['1st Stat Period Expiry', fmtDate(p.expiry_of_1st_stat_period_date)],
    ['EOT Date', fmtDate(p.eot_date)],
    ['6-Month Appeal Window', fmtDate(p.six_months_appeal_window_date)],
    ['About the Applicant', p.about_applicant],
    ['Comments', p.comments],
  ].filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');

  const text = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { text, count: 1 };
}

function serializeDocument(d) {
  const parts = [
    `Title: ${d.title}`,
    d.doc_type ? `Type: ${d.doc_type}` : null,
    d.document_ref ? `Reference: ${d.document_ref}` : null,
    d.created_at ? `Added: ${fmtDate(d.created_at)}` : null,
  ].filter(Boolean);
  const summary = stripHtml(d.summary_html);
  if (summary) parts.push(`Summary:\n${summary}`);
  if (d.transcript_text?.trim()) parts.push(`Full text:\n${d.transcript_text.trim()}`);
  return parts.join('\n');
}

async function fetchDocuments(projectId) {
  const { rows } = await pool.query(
    `SELECT id, title, document_ref, doc_type, created_at, summary_html, transcript_text
       FROM planning_applications.document_summaries
      WHERE project_id = $1
      ORDER BY created_at`,
    [projectId]
  );
  return rows;
}

function serializeMeeting(m, summariesByTranscript, actionsByTranscript) {
  const parts = [
    `Title: ${m.title}`,
    m.meeting_date ? `Date: ${fmtDate(m.meeting_date)}` : null,
    m.attendees_text ? `Attendees: ${m.attendees_text}` : null,
    m.agenda ? `Agenda: ${m.agenda}` : null,
    m.user_notes ? `User notes: ${m.user_notes}` : null,
  ].filter(Boolean);

  const summary = stripHtml(summariesByTranscript.get(m.id));
  if (summary) parts.push(`Meeting summary:\n${summary}`);

  const actions = actionsByTranscript.get(m.id) ?? [];
  if (actions.length) {
    parts.push('Actions:\n' + actions.map(a =>
      `- ${a.action_text}${a.owner ? ` (owner: ${a.owner})` : ''}${a.due_date ? ` (due: ${fmtDate(a.due_date)})` : ''} [${a.status}]`
    ).join('\n'));
  }
  if (m.transcript_text?.trim()) parts.push(`Transcript:\n${m.transcript_text.trim()}`);
  return parts.join('\n');
}

async function fetchMeetings(projectId) {
  const [{ rows: transcripts }, { rows: summaries }, { rows: actions }] = await Promise.all([
    pool.query(
      `SELECT id, title, meeting_date, attendees_text, agenda, user_notes, transcript_text
         FROM planning_applications.meeting_transcripts
        WHERE project_id = $1 ORDER BY meeting_date NULLS LAST, created_at`,
      [projectId]
    ),
    pool.query(
      `SELECT transcript_id, summary_html FROM planning_applications.meeting_summaries WHERE project_id = $1`,
      [projectId]
    ),
    pool.query(
      `SELECT transcript_id, action_text, owner, due_date, status
         FROM planning_applications.meeting_actions
        WHERE project_id = $1 AND transcript_id IS NOT NULL ORDER BY id`,
      [projectId]
    ),
  ]);

  const summariesByTranscript = new Map(summaries.map(s => [s.transcript_id, s.summary_html]));
  const actionsByTranscript = new Map();
  for (const a of actions) {
    if (!actionsByTranscript.has(a.transcript_id)) actionsByTranscript.set(a.transcript_id, []);
    actionsByTranscript.get(a.transcript_id).push(a);
  }
  return { transcripts, summariesByTranscript, actionsByTranscript };
}

async function serializeKeyIssues(projectId) {
  const [{ rows: tracks }, { rows: keyIssues }, { rows: entries }] = await Promise.all([
    pool.query(
      `SELECT id, label, track_type, last_known_risk_level
         FROM admin_console.project_issue_tracks
        WHERE project_id = $1 AND is_active ORDER BY sort_order, id`,
      [projectId]
    ),
    pool.query(
      `SELECT id, label, discipline_group, last_known_risk_level
         FROM admin_console.project_key_issues
        WHERE project_id = $1 AND is_active ORDER BY sort_order, id`,
      [projectId]
    ),
    pool.query(
      `SELECT e.issue_track_id, e.key_issue_id, e.risk_level, e.summary, e.notes, sd.name AS stage_name
         FROM admin_console.project_issue_stage_entries e
         JOIN admin_console.project_stage_instances si ON si.id = e.project_stage_instance_id
         JOIN admin_console.project_stage_definitions sd ON sd.id = si.stage_definition_id
        WHERE si.project_id = $1
        ORDER BY sd.display_order`,
      [projectId]
    ),
  ]);

  if (!tracks.length && !keyIssues.length) return null;

  const entryLines = (filterFn) => entries.filter(filterFn).map(e => {
    const bits = [e.risk_level ? `risk: ${e.risk_level.replace(/_/g, ' ')}` : null, e.summary, e.notes].filter(Boolean);
    return bits.length ? `  - ${e.stage_name}: ${bits.join(' — ')}` : null;
  }).filter(Boolean);

  const blocks = [];
  for (const t of tracks) {
    const lines = entryLines(e => e.issue_track_id === t.id);
    blocks.push(
      `Issue track: ${t.label}${t.last_known_risk_level ? ` (current risk: ${t.last_known_risk_level.replace(/_/g, ' ')})` : ''}` +
      (lines.length ? '\n' + lines.join('\n') : '')
    );
  }
  for (const k of keyIssues) {
    const lines = entryLines(e => e.key_issue_id === k.id);
    blocks.push(
      `Key issue: ${k.label}${k.discipline_group ? ` (${k.discipline_group})` : ''}${k.last_known_risk_level ? ` (current risk: ${k.last_known_risk_level.replace(/_/g, ' ')})` : ''}` +
      (lines.length ? '\n' + lines.join('\n') : '')
    );
  }

  return { text: blocks.join('\n\n'), count: tracks.length + keyIssues.length };
}

async function serializeConsultation(projectId) {
  const { rows } = await pool.query(
    `SELECT id, consultee_name, date_received, position, comments, status
       FROM planning_applications.consultation_responses
      WHERE project_id = $1 ORDER BY sort_order, id`,
    [projectId]
  );
  if (!rows.length) return null;

  const ids = rows.map(r => r.id);
  const { rows: advancements } = await pool.query(
    `SELECT response_id, advancement_date, summary
       FROM planning_applications.consultation_response_advancements
      WHERE response_id = ANY($1) ORDER BY advancement_date, id`,
    [ids]
  );

  const text = rows.map(r => {
    const advs = advancements.filter(a => a.response_id === r.id);
    return [
      `Consultee: ${r.consultee_name}${r.position ? ` — position: ${r.position}` : ''}${r.date_received ? ` (received ${fmtDate(r.date_received)})` : ''} — status: ${r.status || 'In Progress'}`,
      r.comments ? `  Comments: ${r.comments}` : null,
      advs.length ? '  Progress log:\n' + advs.map(a => `    - ${fmtDate(a.advancement_date)}: ${a.summary}`).join('\n') : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return { text, count: rows.length };
}

async function serializeConditions(projectId) {
  const { rows: conditions } = await pool.query(
    `SELECT id, condition_number, title, condition_type, wording, reason, initial_actions, status
       FROM planning_applications.conditions
      WHERE project_id = $1 ORDER BY sort_order, id`,
    [projectId]
  );
  if (!conditions.length) return null;

  const ids = conditions.map(c => c.id);
  const [{ rows: requirements }, { rows: advancements }] = await Promise.all([
    pool.query(
      `SELECT condition_id, requirement_text, requirement_type, status
         FROM planning_applications.condition_requirements
        WHERE condition_id = ANY($1) ORDER BY sort_order, id`,
      [ids]
    ),
    pool.query(
      `SELECT condition_id, advancement_date, summary
         FROM planning_applications.condition_advancements
        WHERE condition_id = ANY($1) ORDER BY advancement_date, id`,
      [ids]
    ),
  ]);

  const text = conditions.map(c => {
    const reqs = requirements.filter(r => r.condition_id === c.id);
    const advs = advancements.filter(a => a.condition_id === c.id);
    return [
      `Condition ${c.condition_number ?? '?'}: ${c.title}${c.condition_type ? ` (${c.condition_type})` : ''} — status: ${c.status}`,
      c.wording ? `  Wording: ${c.wording}` : null,
      c.reason ? `  Reason: ${c.reason}` : null,
      c.initial_actions ? `  Initial actions: ${c.initial_actions}` : null,
      reqs.length ? '  Requirements:\n' + reqs.map(r => `    - ${r.requirement_text}${r.requirement_type ? ` (${r.requirement_type})` : ''} [${r.status}]`).join('\n') : null,
      advs.length ? '  Progress log:\n' + advs.map(a => `    - ${fmtDate(a.advancement_date)}: ${a.summary}`).join('\n') : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return { text, count: conditions.length };
}

async function serializeIssuesTracker(projectId) {
  const { rows: issues } = await pool.query(
    `SELECT id, discipline, title, status
       FROM planning_applications.progress_issues
      WHERE project_id = $1 ORDER BY sort_order, id`,
    [projectId]
  );
  if (!issues.length) return null;

  const ids = issues.map(i => i.id);
  const [{ rows: subIssues }, { rows: actions }] = await Promise.all([
    pool.query(
      `SELECT issue_id, sub_issue_text, status
         FROM planning_applications.progress_sub_issues
        WHERE issue_id = ANY($1) ORDER BY sort_order, id`,
      [ids]
    ),
    pool.query(
      `SELECT a.issue_id, a.action_date, a.summary, a.source_type,
              COALESCE(psd.name, psi.custom_name) AS stage_name
         FROM planning_applications.progress_actions a
         JOIN planning_applications.progress_issues i ON i.id = a.issue_id
         LEFT JOIN admin_console.project_stage_instances psi ON psi.id = a.stage_instance_id
         LEFT JOIN admin_console.project_stage_definitions psd ON psd.id = psi.stage_definition_id
        WHERE a.issue_id = ANY($1) ORDER BY a.action_date, a.id`,
      [ids]
    ),
  ]);

  const text = issues.map(i => {
    const subs = subIssues.filter(s => s.issue_id === i.id);
    const acts = actions.filter(a => a.issue_id === i.id);
    return [
      `Issue: ${i.title}${i.discipline ? ` (${i.discipline})` : ''} — status: ${i.status}`,
      subs.length ? '  Sub-issues:\n' + subs.map(s => `    - ${s.sub_issue_text} [${s.status}]`).join('\n') : null,
      acts.length ? '  Action log:\n' + acts.map(a => `    - ${fmtDate(a.action_date)}${a.stage_name ? ` (${a.stage_name})` : ''}: ${a.summary}`).join('\n') : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return { text, count: issues.length };
}

async function serializeActions(projectId) {
  const { rows: actions } = await pool.query(
    `SELECT id, title, owner, status
       FROM planning_applications.tracker_actions
      WHERE project_id = $1 AND confirmed ORDER BY order_index, id`,
    [projectId]
  );
  if (!actions.length) return null;

  const { rows: updates } = await pool.query(
    `SELECT action_id, update_date, summary
       FROM planning_applications.action_updates
      WHERE action_id = ANY($1) ORDER BY update_date, id`,
    [actions.map(a => a.id)]
  );

  const text = actions.map(a => {
    const ups = updates.filter(u => u.action_id === a.id);
    return [
      `Action: ${a.title}${a.owner ? ` (owner: ${a.owner})` : ''} — status: ${a.status}`,
      ups.length ? ups.map(u => `  - ${fmtDate(u.update_date)}: ${u.summary}`).join('\n') : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return { text, count: actions.length };
}

async function serializePlanningHistory(projectId) {
  const { rows } = await pool.query(
    `SELECT section, planning_ref, description, decision, decision_date
       FROM public.project_planning_history
      WHERE project_id = $1 ORDER BY section, id`,
    [projectId]
  );
  if (!rows.length) return null;

  const text = rows.map(r => [
    `${r.section === 'on_site' ? 'On-site' : 'Nearby'} application${r.planning_ref ? ` ${r.planning_ref}` : ''}:`,
    r.description ? `  Description: ${r.description}` : null,
    r.decision ? `  Decision: ${r.decision}${r.decision_date ? ` (${fmtDate(r.decision_date)})` : ''}` : null,
  ].filter(Boolean).join('\n')).join('\n\n');

  return { text, count: rows.length };
}

async function serializePolicies(projectId) {
  const { rows } = await pool.query(
    `SELECT policy_reference, policy_name, policy_type, policy_text,
            relevant_supporting_text, notes, is_key_policy
       FROM project_policies
      WHERE project_id = $1
      ORDER BY is_key_policy DESC, policy_type, id`,
    [projectId]
  );
  if (!rows.length) return null;

  const text = rows.map(r => [
    `Policy${r.policy_reference ? ` ${r.policy_reference}` : ''}: ${r.policy_name}${r.policy_type ? ` (${r.policy_type})` : ''}${r.is_key_policy ? ' [key policy]' : ''}`,
    r.policy_text ? `  Policy text: ${r.policy_text}` : null,
    r.relevant_supporting_text ? `  Relevant supporting text: ${r.relevant_supporting_text}` : null,
    r.notes ? `  Notes: ${r.notes}` : null,
  ].filter(Boolean).join('\n')).join('\n\n');

  return { text, count: rows.length };
}

async function serializePolicyDocuments(projectId) {
  const { rows } = await pool.query(
    `SELECT section, plan_name, year_adopted, summary, relevance
       FROM policy_documents
      WHERE project_id = $1
      ORDER BY section, id`,
    [projectId]
  );
  if (!rows.length) return null;

  const SECTION_LABELS = {
    adopted: 'Development Plan Adopted',
    emerging: 'Development Plan Emerging',
    supplementary: 'Supplementary Guidance',
    other: 'Other Material Considerations',
  };

  const parts = [];
  for (const key of Object.keys(SECTION_LABELS)) {
    const sectionRows = rows.filter(r => r.section === key);
    if (!sectionRows.length) continue;
    parts.push(`${SECTION_LABELS[key]}:\n` + sectionRows.map(r => [
      `- ${r.plan_name}${r.year_adopted ? ` (adopted ${r.year_adopted})` : ''}`,
      r.summary ? `  Summary: ${r.summary}` : null,
      r.relevance ? `  Relevance to project: ${r.relevance}` : null,
    ].filter(Boolean).join('\n')).join('\n'));
  }

  return { text: parts.join('\n\n'), count: rows.length };
}

async function serializePublicComments(projectId) {
  const [{ rows: comments }, { rows: analysis }] = await Promise.all([
    pool.query(
      `SELECT commenter_name, date_received, position, comment, further_info
         FROM planning_applications.public_comments
        WHERE project_id = $1 ORDER BY sort_order, id`,
      [projectId]
    ),
    pool.query(
      `SELECT bullet_summary, themes FROM planning_applications.public_comment_analysis WHERE project_id = $1`,
      [projectId]
    ),
  ]);
  if (!comments.length && !analysis.length) return null;

  const parts = [];
  if (analysis.length) {
    const a = analysis[0];
    const bullets = Array.isArray(a.bullet_summary) ? a.bullet_summary : [];
    const themes = Array.isArray(a.themes) ? a.themes : [];
    if (bullets.length) parts.push('AI analysis summary:\n' + bullets.map(b => `- ${b}`).join('\n'));
    if (themes.length) parts.push('Themes:\n' + themes.map(t => `- ${t.theme} (${t.count ?? '?'} comments, ${t.sentiment ?? 'n/a'}): ${t.summary ?? ''}`).join('\n'));
  }
  if (comments.length) {
    parts.push('Individual comments:\n' + comments.map(c =>
      `- ${c.commenter_name ?? 'Anonymous'}${c.position ? ` (${c.position})` : ''}${c.date_received ? `, ${fmtDate(c.date_received)}` : ''}: ${c.comment ?? ''}${c.further_info ? ` | Further info: ${c.further_info}` : ''}`
    ).join('\n'));
  }

  return { text: parts.join('\n\n'), count: comments.length };
}

async function serializeSurveyor(projectId) {
  // Surveyor tables reference projects by unique_id (UUID), not the integer id
  const { rows: projectRows } = await pool.query(
    `SELECT unique_id FROM public.projects WHERE id = $1`,
    [projectId]
  );
  if (!projectRows.length) return null;
  const uniqueId = projectRows[0].unique_id;

  const [{ rows: quotes }, { rows: sentRequests }, { rows: keyDates }, { rows: events }] = await Promise.all([
    pool.query(
      `SELECT q.id, q.discipline, q.date AS quote_date, q.total, q.status,
              q.instruction_status, q.partially_instructed_total, q.work_status,
              q.dependencies, q.site_visit_date, q.report_draft_date,
              q.quote_notes, q.operational_notes,
              q.quality, q.responsiveness, q.delivered_on_time, q.overall_review, q.review_notes,
              so.organisation AS surveyor_organisation,
              c.name AS contact_name, c.email AS contact_email,
              json_agg(
                jsonb_build_object('item', qli.item, 'description', qli.description,
                                   'cost', qli.cost, 'is_instructed', COALESCE(qli.is_instructed, false))
                ORDER BY qli.created_at
              ) FILTER (WHERE qli.id IS NOT NULL) AS line_items
         FROM admin_console.quotes q
         LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
         LEFT JOIN admin_console.contacts c ON c.id = q.contact_id
         LEFT JOIN admin_console.quote_line_items qli ON qli.quote_id = q.id
        WHERE q.project_id = $1
        GROUP BY q.id, so.organisation, c.name, c.email
        ORDER BY q.created_at`,
      [uniqueId]
    ),
    pool.query(
      `SELECT sr.sent_date, sr.notes,
              json_agg(jsonb_build_object('organisation', so.organisation, 'contact', c.name))
                FILTER (WHERE r.id IS NOT NULL) AS recipients
         FROM admin_console.sent_quote_requests sr
         LEFT JOIN admin_console.quote_request_recipients r ON r.sent_request_id = sr.id
         LEFT JOIN admin_console.surveyor_organisations so ON so.id = r.surveyor_organisation_id
         LEFT JOIN admin_console.contacts c ON c.id = r.contact_id
        WHERE sr.project_id = $1
        GROUP BY sr.id
        ORDER BY sr.sent_date`,
      [uniqueId]
    ),
    pool.query(
      `SELECT qkd.title, qkd.date, q.discipline, so.organisation AS surveyor_organisation
         FROM admin_console.quote_key_dates qkd
         JOIN admin_console.quotes q ON q.id = qkd.quote_id
         LEFT JOIN admin_console.surveyor_organisations so ON so.id = q.surveyor_organisation_id
        WHERE q.project_id = $1
        ORDER BY qkd.date`,
      [uniqueId]
    ),
    pool.query(
      `SELECT title, date FROM admin_console.programme_events
        WHERE project_id = $1 ORDER BY date`,
      [uniqueId]
    ),
  ]);

  const quoteIds = quotes.map(q => q.id);
  const { rows: quoteActions } = quoteIds.length
    ? await pool.query(
        `SELECT quote_id, action_date, summary, stage
           FROM admin_console.quote_actions
          WHERE quote_id = ANY($1)
          ORDER BY action_date, id`,
        [quoteIds]
      )
    : { rows: [] };

  if (!quotes.length && !sentRequests.length && !events.length) return null;

  const parts = [];

  if (sentRequests.length) {
    parts.push('Quote requests sent:\n' + sentRequests.map(sr => {
      const recips = (sr.recipients ?? [])
        .map(r => `${r.organisation ?? 'Unknown org'}${r.contact ? ` (${r.contact})` : ''}`)
        .join(', ');
      return `- ${fmtDate(sr.sent_date)}: sent to ${recips || 'unknown recipients'}${sr.notes ? ` — notes: ${sr.notes}` : ''}`;
    }).join('\n'));
  }

  for (const q of quotes) {
    const lines = [
      `Quote: ${q.surveyor_organisation ?? 'Unknown organisation'}${q.discipline ? ` — ${q.discipline}` : ''}` +
      `${q.contact_name ? ` (contact: ${q.contact_name}${q.contact_email ? `, ${q.contact_email}` : ''})` : ''}`,
      `  Status: ${q.status ?? 'n/a'} | Instruction: ${q.instruction_status ?? 'n/a'} | Work: ${q.work_status ?? 'n/a'}`,
      q.total != null ? `  Total: £${q.total}${q.partially_instructed_total != null ? ` (partially instructed: £${q.partially_instructed_total})` : ''}` : null,
      q.quote_date ? `  Quote date: ${fmtDate(q.quote_date)}` : null,
      q.site_visit_date ? `  Site visit: ${fmtDate(q.site_visit_date)}` : null,
      q.report_draft_date ? `  Report draft due: ${fmtDate(q.report_draft_date)}` : null,
      q.dependencies ? `  Dependencies: ${q.dependencies}` : null,
      q.quote_notes ? `  Quote notes: ${q.quote_notes}` : null,
      q.operational_notes ? `  Operational notes: ${q.operational_notes}` : null,
    ].filter(Boolean);

    const items = Array.isArray(q.line_items) ? q.line_items : [];
    if (items.length) {
      lines.push('  Line items:\n' + items.map(li =>
        `    - ${li.item ?? ''}${li.description ? `: ${li.description}` : ''}${li.cost != null ? ` (£${li.cost})` : ''}${li.is_instructed ? ' [instructed]' : ''}`
      ).join('\n'));
    }

    const acts = quoteActions.filter(a => a.quote_id === q.id);
    if (acts.length) {
      lines.push('  Progress log:\n' + acts.map(a =>
        `    - ${fmtDate(a.action_date)}${a.stage ? ` [${a.stage} stage]` : ''}: ${a.summary}`
      ).join('\n'));
    }

    const review = [
      q.quality != null ? `quality ${q.quality}` : null,
      q.responsiveness != null ? `responsiveness ${q.responsiveness}` : null,
      q.delivered_on_time != null ? `delivered on time: ${q.delivered_on_time ? 'yes' : 'no'}` : null,
      q.overall_review != null ? `overall ${q.overall_review}` : null,
    ].filter(Boolean);
    if (review.length || q.review_notes) {
      lines.push(`  Review: ${review.join(', ')}${q.review_notes ? ` — ${q.review_notes}` : ''}`);
    }

    parts.push(lines.join('\n'));
  }

  if (keyDates.length) {
    parts.push('Survey key dates:\n' + keyDates.map(kd =>
      `- ${fmtDate(kd.date)}: ${kd.title}${kd.surveyor_organisation ? ` (${kd.surveyor_organisation}${kd.discipline ? `, ${kd.discipline}` : ''})` : ''}`
    ).join('\n'));
  }

  if (events.length) {
    parts.push('Programme events:\n' + events.map(e => `- ${fmtDate(e.date)}: ${e.title}`).join('\n'));
  }

  return { text: parts.join('\n\n'), count: quotes.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Group registry: id prefix, label, serializer
// ─────────────────────────────────────────────────────────────────────────────

const TABLE_GROUPS = [
  { key: 'key_issues',       sourceId: 'K',    label: 'Key Issues & Stage Notes', serialize: serializeKeyIssues },
  { key: 'consultation',     sourceId: 'C',    label: 'Consultation Tracker',     serialize: serializeConsultation },
  { key: 'conditions',       sourceId: 'COND', label: 'Conditions Tracker',       serialize: serializeConditions },
  { key: 'issues_tracker',   sourceId: 'IT',   label: 'Issues Tracker',           serialize: serializeIssuesTracker },
  { key: 'actions',          sourceId: 'A',    label: 'Action Tracker',           serialize: serializeActions },
  { key: 'planning_history', sourceId: 'H',    label: 'Planning History',         serialize: serializePlanningHistory },
  { key: 'policies',         sourceId: 'POL',  label: 'Relevant Policies',        serialize: serializePolicies },
  { key: 'policy_documents', sourceId: 'PD',   label: 'Policy Documents',         serialize: serializePolicyDocuments },
  { key: 'public_comments',  sourceId: 'PC',   label: 'Public Comments',          serialize: serializePublicComments },
  { key: 'surveyor',         sourceId: 'S',    label: 'Surveyor Management',      serialize: serializeSurveyor },
];

const DOC_TYPE_LABELS = {
  about_applicant: 'About the Applicant',
  proposed_development: 'Proposed Development',
  pre_app: 'Pre-app Response',
  eia_response: 'EIA Response',
  sci: 'SCI',
  site_surroundings: 'Site and Surroundings',
  briefing_transcript: 'Briefing Transcript',
  meeting_notes: 'Meeting Notes',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function getSourceCatalogue(projectId) {
  const [details, docs, meetings, ...tableResults] = await Promise.all([
    serializeProjectDetails(projectId),
    fetchDocuments(projectId),
    fetchMeetings(projectId),
    ...TABLE_GROUPS.map(g => g.serialize(projectId)),
  ]);

  const groups = [];

  if (details) {
    groups.push({ key: 'project_details', label: 'Project Details', count: 1, chars: details.text.length });
  }

  groups.push({
    key: 'documents',
    label: 'Project Docs',
    items: docs.map(d => ({
      id: d.id,
      label: d.title,
      doc_type: d.doc_type,
      doc_type_label: DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type ?? 'Other',
      has_full_text: !!d.transcript_text?.trim(),
      chars: serializeDocument(d).length,
    })),
  });

  groups.push({
    key: 'meetings',
    label: 'Meeting Notes',
    items: meetings.transcripts.map(m => ({
      id: m.id,
      label: m.title + (m.meeting_date ? ` — ${fmtDate(m.meeting_date)}` : ''),
      chars: serializeMeeting(m, meetings.summariesByTranscript, meetings.actionsByTranscript).length,
    })),
  });

  TABLE_GROUPS.forEach((g, i) => {
    const result = tableResults[i];
    groups.push({
      key: g.key,
      label: g.label,
      count: result?.count ?? 0,
      chars: result?.text.length ?? 0,
    });
  });

  return { groups, budget: CONTEXT_BUDGET };
}

/**
 * Assemble labelled source blocks for the selected sources.
 * sources: { project_details: bool, document_ids: number[], meeting_ids: number[], groups: string[] }
 * Returns { blocks: [{ sourceId, label, text }], totalChars, availableGroups }
 */
export async function assembleContext(projectId, sources = {}) {
  const blocks = [];
  const selectedGroups = new Set(sources.groups ?? []);
  const documentIds = (sources.document_ids ?? []).map(Number).filter(Number.isFinite);
  const meetingIds = (sources.meeting_ids ?? []).map(Number).filter(Number.isFinite);

  if (sources.project_details) {
    const details = await serializeProjectDetails(projectId);
    if (details) blocks.push({ sourceId: 'P', label: 'Project Details', text: details.text });
  }

  if (documentIds.length) {
    const docs = await fetchDocuments(projectId);
    for (const d of docs.filter(d => documentIds.includes(d.id))) {
      blocks.push({
        sourceId: `D${d.id}`,
        label: `Project Document — ${d.title}`,
        text: serializeDocument(d),
      });
    }
  }

  if (meetingIds.length) {
    const meetings = await fetchMeetings(projectId);
    for (const m of meetings.transcripts.filter(m => meetingIds.includes(m.id))) {
      blocks.push({
        sourceId: `M${m.id}`,
        label: `Meeting — ${m.title}`,
        text: serializeMeeting(m, meetings.summariesByTranscript, meetings.actionsByTranscript),
      });
    }
  }

  for (const g of TABLE_GROUPS) {
    if (!selectedGroups.has(g.key)) continue;
    const result = await g.serialize(projectId);
    if (result) blocks.push({ sourceId: g.sourceId, label: g.label, text: result.text });
  }

  const totalChars = blocks.reduce((acc, b) => acc + b.text.length, 0);

  return {
    blocks,
    totalChars,
    availableGroups: [
      { key: 'project_details', label: 'Project Details' },
      { key: 'documents', label: 'Project Docs' },
      { key: 'meetings', label: 'Meeting Notes' },
      ...TABLE_GROUPS.map(g => ({ key: g.key, label: g.label })),
    ],
  };
}
