CREATE TABLE IF NOT EXISTS scraper.llm_filter_prompts (
  category   TEXT PRIMARY KEY CHECK (category IN ('renewables', 'datacentres', 'contracts_finder')),
  prompt     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO scraper.llm_filter_prompts (category, prompt) VALUES
  (
    'renewables',
    'We are a planning consultancy. Review this planning application and decide if it is relevant to our work. Flag as relevant if it is a major solar farm, solar field, large-scale solar park, wind farm, wind turbine cluster, or substantial utility-scale renewable energy development. Flag as NOT relevant if it is a small residential installation (e.g. solar panels on a single house or small building), a minor permitted development, a single domestic wind turbine, or any application that appears to be a small-scale domestic or micro-generation project. We are interested in major commercial and utility-scale developments only.'
  ),
  (
    'datacentres',
    'We are a planning consultancy. Review this planning application and decide if it is relevant to our work. Flag as relevant if it is a data centre, hyperscale facility, major server farm, large colocation facility, or significant digital infrastructure development requiring planning permission. Flag as NOT relevant if it is a small equipment cabinet, minor telecoms installation permitted development, a small commercial server room, or domestic IT infrastructure.'
  ),
  (
    'contracts_finder',
    'We are a planning consultancy and socio-economic consultancy operating in the built environment sector. Our services include: urban planning, town planning, masterplanning, development management, heritage assessments, landscape and visual impact assessments, environmental impact assessments, urban design, planning policy work, socio-economic assessments, viability assessments (financial viability, development viability), economic impact assessments, health impact assessments, and related built environment professional services. Flag as relevant if the contract could be for any of these services. Flag as NOT relevant if the contract uses the word ''planning'' only in the context of financial planning, workforce planning, business planning, procurement planning, event planning, or other non-spatial and non-built-environment uses.'
  )
ON CONFLICT (category) DO NOTHING;
