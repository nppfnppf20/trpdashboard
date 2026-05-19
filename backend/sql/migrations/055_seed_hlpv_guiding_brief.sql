-- Seed a Guiding Brief for the HLPV narrative (Renewables / Solar)
-- guidance_content: injected into LLM when generating the narrative
-- review_checklist: used by the "Check brief" button to assess the draft

DELETE FROM admin_console.guiding_briefs
  WHERE document_type = 'hlpv';

INSERT INTO admin_console.guiding_briefs
  (name, document_type, development_type, guidance_content, review_checklist, sort_order)
VALUES (
  'Renewables HLPV — Solar',
  'hlpv',
  'Solar',

  -- ───────────────────────────────────────────────────────────────────────────
  -- GUIDANCE CONTENT
  -- ───────────────────────────────────────────────────────────────────────────
  $guidance$
## High-Level Planning View — Solar Development

### 1. Planning Policy
Check local planning policy — does the renewables policy include anything unusual or does it simply follow NPPF and say that solar will be supported subject to addressing some or all of the criteria below? Are there any planning designations, e.g. Green Belt or site allocations?

Check any nearby applications, consents, refusals.

### 2. Landscape and Visual
Landscape and visual effects — this will often be the main issue:

**Landscape:** You are placing a large semi-industrial development into the landscape and so you are looking to see whether existing landscape features will help or hinder our argument. Check for designated landscapes (AONBs, etc.). Look at topography, size of fields, land cover on the site and surrounding area, and surrounding land uses (large, flat fields with good screening tend to be better than small, undulating landscapes). Are there any large pieces of existing infrastructure that may detract from the landscape (e.g. overhead pylons, wind turbines, industrial estates)?

**Visual:** The question you are asking is what public viewpoints can the development be seen from and is this a problem? Look for footpaths and other public rights of way (PRoW) within and near the site — these are high sensitivity as people are moving slower and their surroundings are more important to them; we should normally avoid building too close to them. Roads and railways are lower sensitivity but can be important. Generally, the more receptors there are, the higher the sensitivity.

Also look at private receptors, such as residential properties, as these can raise the risk of objection to an application.

Consider longer range views into the site (1–3km). Use OS maps to understand the topography and where cross-valley or longer range views are likely. Identify sensitive receptors within these views, e.g. designated areas, listed buildings, long-distance footpaths, PRoW, roads and settlements.

A landscape and visual impact assessment will almost always be necessary, along with photomontage (CGI images).

**Green Belt Sites:** Are there any particular GB constraints that make a site problematic or more suitable, i.e. clear openness issues or against the 5 purposes of GB? Are there any potential VSCs in addition to those standard ones of climate and RE generation — focus on ecological benefits or possible opportunities to improve the PRoW network? Are there any other planning constraints that might impede development in addition to GB designation, e.g. some are clearly very hilly when you look at an OS?

### 3. Heritage and Archaeology
**Heritage:** Identify any listed buildings (including their grade), registered parks and gardens or scheduled monuments on and near the site. Think about what might constitute their setting and how important that is to the significance of the asset. A rural church will often have a large setting so check if there is intervisibility with the site (i.e. are there unrestricted views between, or does topography or vegetation restrict them?) and whether PRoW pass through the site to the church. Many rural listed buildings will be farms and so the farm itself will comprise its setting.

**Archaeology:** Harder to assess without acquiring data and so specialist input is often needed. However, there may be obvious designations like registered battlefields. These will typically also have a setting.

A heritage statement and/or archaeological assessment will normally be required if you have identified assets which might be affected. A geophysical survey may also be necessary as part of the application.

Note: https://www.heritagegateway.org.uk/gateway/advanced_search.aspx is an additional website for reviewing archaeological data (non-designated) when there is no information found on Magic relating to archaeology.

### 4. Agricultural Land
The NPPF requires that solar developers use non-agricultural or previously developed land in preference to agricultural land. This is not usually possible and so policy then requires they use lower grade land in preference to higher grade (appeal decisions generally define these as grades 3b, 4 and 5, and 1, 2 and 3a respectively) unless there are "the most compelling" reasons not to. Unless the site has been surveyed in detail (and therefore shows up on Magic) the Natural England maps are very crude and don't distinguish between 3a and 3b. At this stage you should note the grade and the likelihood of containing "best and most versatile" (BMV) land. A site-specific survey will normally be required for the application.

### 5. Flood Risk
Ideally avoid areas outside of flood zone 1, but it is possible to solar develop in zones 2 and 3 as it is usually defined as "essential infrastructure", which the NPPG states is acceptable subject to passing the sequential and exceptions tests. In such cases, a feasibility study is recommended.

However, if flood zone 3 is directly adjacent to a river then take care as it may be defined as "functional floodplain" (i.e. 3b — check this in the Council's Strategic Flood Risk Assessment), which is more likely to result in an Environment Agency objection.

A flood risk assessment will always be required for solar as sites are more than 0.5ha in size.

Also look at surface water flooding. The low (1:1000 year), medium (1:100) and high risk (1:30) water depth dropdown options give a reasonable steer on where the riskier areas are. Solar panels are normally set around 80cm off the ground to allow sheep to graze and so some surface flooding can be okay, but sensitive equipment such as inverters and transformers should avoid riskier areas.

FRAs require topo data. Unless required for other purposes (e.g. tree surveys) at application stage, digital data such as Lidar should be sufficient.

### 6. Ecology
Are there any designated assets on or near the site, e.g. SSSIs, Special Protection Areas, Ramsar, Special Areas of Conservation or Local Nature Reserves? These should be avoided on site, but often are not major constraints beyond the site. This depends on what the asset is designated for — a key exception is birds, as these tend to use suitable habitat beyond the designation itself and the proposed site may constitute such habitat. Ramsar sites are important ones to note and are often located around estuaries.

Look for obvious signs of ponds on or within 250m of the site — if present then great crested newt surveys may be necessary. You can also identify through Magic whether recent surveys have been done and whether GCN were found. GCN are important for solar as surveys can only be carried out April–late June and can be expensive to mitigate if found.

A preliminary ecological appraisal (PEA) will always be needed, and often separate GCN or skylark surveys are needed in addition (the PEA will confirm these).

### 7. Drinking Water and Source Protection
Ideally sites should be located outside Source Protection Zones 1 and 2, which are the most sensitive to risk of pollution entering the drinking water supply. Safeguard zones are less sensitive but will still require additional pollution control measures.

Check with the client whether proposed solar/BESS plant will have PFAS (per and polyfluoroalkyl substances) present — water companies (e.g. Wessex Water) are increasingly requiring documentation verifying that solar panels and associated electrical equipment do not contain PFAS, to protect groundwater and drinking water quality.

### 8. Transport
Operational traffic will be negligible; you are only concerned with construction traffic. Look at whether the access to the site from the trunk road network is likely to be suitable — roads with few tight bends or narrow (single track) sections, ideally avoiding passing through small villages. Also consider whether access to the fields themselves is straightforward. Most challenges can be overcome so this is rarely a showstopper. A construction traffic management plan is normally commissioned for the application.

### 9. Aviation and Glint & Glare
Solar farms can produce some glint and glare. This is rarely a major issue as solar panels are designed to absorb rather than reflect light. Nonetheless, note proximity to obviously sensitive receptors such as nearby airports or airfields.

### 10. Noise / Amenity
Solar panels make no noise, but transformers and inverters do during operations (daylight hours). Some projects include battery energy storage (BESS) — these can be noisy and operate at night, which can be problematic in quiet rural locations. As a crude rule of thumb, noise is unlikely to be an issue if the receptor is more than 250m away.

### 11. Trees
Solar farms will almost always be sited within existing field boundaries to avoid damage to hedges and trees. However, where trees need removing or pruning (e.g. to allow for site or field access) a tree survey may be required. Use aerial photography and Street View to form an initial view. Note: a topo survey will be required for a tree survey — Lidar or drone surveys will not be sufficient.

### 12. Writing the Summary
Start with whether the site is acceptable in terms of planning permission. The client wants to know: what the issues are; what is the risk; is it high or low; can it be mitigated; and what do they need to do next. Don't be too definitive — always recommend surveys when not sure. Separate into different sub-topics for a clearer explanation on the topic, its risks and how it can be mitigated. Keep it concise — this is an initial review.

**Surveys — all applications will need:** LVIA; Preliminary Ecological Appraisal (PEA) (plus any follow-up protected species surveys); Flood Risk Assessment.
**Most will need:** archaeology and/or heritage; Agricultural Land Classification Survey; Construction Traffic Management Plan.
**Some will need:** glint and glare; noise; contaminated land.
$guidance$,

  -- ───────────────────────────────────────────────────────────────────────────
  -- REVIEW CHECKLIST
  -- ───────────────────────────────────────────────────────────────────────────
  $checklist$
## HLPV Narrative Review Checklist

### Planning Policy
- Local planning policy on renewables is addressed (NPPF compliance, any unusual local policies)
- Any Green Belt designation is identified and addressed
- Nearby applications, consents or refusals are mentioned where relevant

### Landscape and Visual
- Landscape context is described (topography, field size, land cover, screening features)
- Designated landscapes (AONB, National Parks, etc.) are addressed if present
- Public viewpoints and PRoW near the site are considered
- Residential and other private receptors near the site are noted
- Longer-range views (1–3km) are considered where topography allows
- LVIA and photomontage are recommended as required surveys

### Heritage and Archaeology
- Listed buildings on or near the site are identified, including their grade
- Registered parks and gardens or scheduled monuments are identified if present
- The setting of heritage assets is considered, including intervisibility with the site
- Heritage statement and/or archaeological assessment is recommended where assets are identified

### Agricultural Land
- ALC grade of the site is stated
- Whether the site is likely to contain BMV land (grades 1, 2, 3a) is noted
- Site-specific ALC survey is recommended

### Flood Risk
- Flood zone of the site is identified
- Functional floodplain risk (zone 3b) is flagged if flood zone 3 is present
- Surface water flood risk is considered
- Flood Risk Assessment is recommended

### Ecology
- SSSIs, SPAs, SACs, Ramsar sites or other ecological designations are noted if present
- Potential for GCN (ponds within 250m) or other protected species is identified
- Preliminary Ecological Appraisal (PEA) is recommended

### Drinking Water
- Source Protection Zones or drinking water safeguard zones are noted if present

### Transport
- Construction traffic access to the site is assessed
- Road network suitability (bends, width, village routes) is considered

### Aviation / Glint & Glare
- Proximity to airports or airfields is noted if relevant

### Noise / Amenity
- BESS or noisy equipment near residential receptors is flagged if relevant

### Summary
- Key risks are clearly summarised and prioritised
- Each identified risk is given a risk level or steer (high / low / manageable)
- Required surveys are clearly listed
- Overall planning acceptability or risk is addressed
$checklist$,

  10
);

