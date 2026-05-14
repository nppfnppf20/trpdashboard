-- Replace the generation_prompt on the policy_context section with a
-- template_html. This gives a fixed, deterministic structure with
-- programmatic variable slots and no LLM structure drift.

UPDATE planning_applications.draft_sections
SET
  template_html = $tpl$<h2>Planning Policy</h2>
<p>This section identifies relevant national and development plan policy. The proposed development is assessed against these policies in the subsequent sections.</p>

<h3>Local Planning Policy</h3>
<p>Section 38(6) of the Planning and Compulsory Purchase Act 2004 states that: <em>"If regard is to be had to the development plan for the purpose of any determination to be made under the planning acts the determination must be made in accordance with the development plan unless material considerations indicate otherwise."</em></p>
<p>The current Development Plan comprises:</p>
<p class="draft-placeholder">[List the development plan documents that apply to this application]</p>
<p>The following are considered the key policies for this application:</p>
{{LOCAL_POLICIES_KEY}}
<p>The following policies of the adopted Development Plan are also considered relevant to this application:</p>
{{LOCAL_POLICIES_OTHER}}

<h4>Neighbourhood Plan</h4>
<p class="draft-placeholder">[Insert if a Neighbourhood Plan applies to the application site, otherwise delete this section]</p>

<h4>Supplementary Planning Documents (SPDs)</h4>
{{SUPPLEMENTARY_POLICIES}}

<h3>National Planning Policy</h3>

<h4>National Planning Policy Framework</h4>
{{NPPF_TEXT}}

<h4>National Planning Practice Guidance (NPPG)</h4>
{{NPPG_TEXT}}

<h4>Other National Policy</h4>
{{OTHER_NATIONAL_TEXT}}

<h3>Other Policy and Guidance</h3>
{{OTHER_GUIDANCE_TEXT}}$tpl$,
  generation_prompt = NULL
WHERE slug = 'policy_context'
  AND draft_type_id = (
    SELECT id FROM planning_applications.draft_types WHERE slug = 'planning_statement'
  );
