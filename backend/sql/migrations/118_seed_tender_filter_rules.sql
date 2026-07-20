-- Starter relevance rules for the tender collector. All editable via /api/tenders/filter-rules.

INSERT INTO scraper.tender_filter_rules (rule_type, value) VALUES
  ('cpv_prefix', '71'),        -- architectural, construction, engineering and planning services
  ('cpv_prefix', '73'),        -- research and development services
  ('cpv_prefix', '794'),       -- business and management consultancy
  ('cpv_prefix', '79419000'),  -- evaluation consultancy services
  ('cpv_prefix', '66171000'),  -- financial consultancy services
  ('keyword', 'masterplan'),
  ('keyword', 'regeneration'),
  ('keyword', 'economic development'),
  ('keyword', 'town centre'),
  ('keyword', 'urban design'),
  ('keyword', 'local plan'),
  ('keyword', 'planning policy'),
  ('keyword', 'placemaking'),
  ('keyword', 'viability'),
  ('keyword', 'socio-economic'),
  ('keyword', 'feasibility study')
ON CONFLICT (rule_type, value) DO NOTHING;

INSERT INTO scraper.tender_filter_rules (rule_type, value) VALUES
  (
    'llm_prompt',
    'We are a planning consultancy and socio-economic consultancy operating in the built environment sector. Our services include: urban planning, town planning, masterplanning, development management, heritage assessments, landscape and visual impact assessments, environmental impact assessments, urban design, planning policy work, socio-economic assessments, viability assessments (financial viability, development viability), economic impact assessments, health impact assessments, and related built environment professional services. Review this procurement notice and decide if the contract could be for any of these services — flag it as relevant if so. Flag as NOT relevant if the notice uses the word ''planning'' only in the context of financial planning, workforce planning, business planning, procurement planning, event planning, or other non-spatial and non-built-environment uses, or if it is clearly for construction works, goods supply, IT systems, or unrelated professional services.'
  )
ON CONFLICT (rule_type, value) DO NOTHING;
