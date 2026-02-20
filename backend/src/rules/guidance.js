/**
 * Central guidance file for all disciplines
 * Individual discipline guidance can be imported separately or via the combined GUIDANCE object
 */

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING POLICY
// ═══════════════════════════════════════════════════════════════════════════

export const PLANNING_POLICY_GUIDANCE = {
  general: String.raw`1. Check local planning policy - does the renewables policy include anything unusual or does it simply follow NPPF and say that solar will be supported subject to addressing some or all of the criteria below? Are there any planning designations, e.g. green belt or site allocations?
`,

  nearbyApplications: String.raw`2. Check any nearby applications, consents, refusals.`
};

// ═══════════════════════════════════════════════════════════════════════════
// LANDSCAPE
// ═══════════════════════════════════════════════════════════════════════════

export const LANDSCAPE_GUIDANCE = {
  general: String.raw`Landscape and visual effects  - this will often be the main issue (you can split them out if it helps): \n\n 
1. Landscape - You are placing a large semi-industrial development into the landscape and so you are looking to see whether existing landscape features will help or hinder our argument. Check for designated landscapes (AONBs, etc.) Look at topography, size of fields, land cover on the site and surrounding area, and surrounding land uses (large, flat fields with good screening tend to be better than small, undulating landscapes). Are there any large pieces of existing infrastructure that may detract from the landscape (e.g. overhead pylons, wind turbines, industrial estates).
\n\n2. Visual - the question you are asking is what public viewpoints can the development be seen from and is this a problem? Look for footpaths and other public rights of way (PRoW) within and near the site (these are high sensitivity as people are moving slower and their surroundings are more important to them - we should normally avoid building too close to them), roads and railways (lower sensitivity but can be important. Generally, the more receptors there are, the higher the sensitivity.
Also look at private receptors, such as residential properties, as these can raise the risk of objection to an application.
\n\nConsider longer range views into the site (1-3km) particularly use OS maps to understand the topography and where cross valley or longer range views are likely, identify sensitive receptors within these views, e.g. designated areas, listed buildings, long distance footpaths, PRoW, roads and settlements.
A landscape and visual impact assessment will almost always be necessary, along with photomontage (CGI images).`,

  greenBelt: String.raw`Consider the following:

\n\nAre there any particular GB constraints that make a site problematic or more suitable  i.e. Clear openness issues or against the 5 purposes of GB?
\n\nAre there any potential VSCs in addition to those standard ones of climate and RE generation  focus on ecological benefits or possible opportunities to improve the PRoW network?
\n\nAre there any other planning constraints that might impede development in addition to GB designation, e.g. some are clearly very hilly when you look at an OS?`
};

// ═══════════════════════════════════════════════════════════════════════════
// HERITAGE
// ═══════════════════════════════════════════════════════════════════════════

export const HERITAGE_GUIDANCE = {
  general: String.raw`
1. Heritage - identify any listed buildings (including their grade), registered parks and gardens or scheduled monuments on and near the site. Think about what might constitute their setting and how important that is to the significance of the asset, e.g. a rural church will often have a large setting so check if there is intervisibility with the site (i.e. are there unrestricted views between or does topography or vegetation restrict them) and whether PRoW pass through the site to the church; many rural listed buildings will be farms and so the farm itself will comprise its setting.\n\n
2. Archaeology - harder to assess without acquiring data and so specialist input is often needed. However, there may be obvious designations like registered battlefields. These will typically also have a setting.
\n\n A heritage statement and/or archaeological assessment will normally be required if you have identified assets which might be affected. A geophysical survey may also be necessary as part of the application.

https://www.heritagegateway.org.uk/gateway/advanced_search.aspx - Additional website for reviewing Archaeological data (non-designated) when there is no information found on magic relating to arch.`
};

// ═══════════════════════════════════════════════════════════════════════════
// AGRICULTURAL LAND
// ═══════════════════════════════════════════════════════════════════════════

export const AGRICULTURAL_LAND_GUIDANCE = {
  general: String.raw`The NPPF requires that solar developers use non-agricultural or previously developed land in preference to agricultural land. This is not usually possible and so policy then requires they use lower grade land in preference to higher grade (appeal decisions generally define these as grades 3b, 4 and 5, and 1, 2 and 3a respectively) unless there are "the most compelling" reasons not to. Unless the site has been surveyed in detail (and therefore shows up on Magic) the Natural England maps are very crude and don't distinguish between 3a and 3b. At this stage you should note the grade and the Likelihood of containing "best and most versatile" (BMV) land. A site specific survey will normally be required for the application.`
};

// ═══════════════════════════════════════════════════════════════════════════
// FLOOD
// ═══════════════════════════════════════════════════════════════════════════

export const FLOOD_GUIDANCE = {
  general: String.raw`Ideally avoid areas outside of flood zone 1, but it is possible to solar develop in zones 2 and 3 as it is usually defined as "essential infrastructure", which the NPPG states is acceptable subject to passing the sequential and exceptions tests. In such cases, I would recommend a feasibility study. \n\nHowever, if the flood zone 3 is directly adjacent to a river then take care as it may be defined as "functional floodplain" (i.e. 3b - you can check this in the Council's Strategic Flood Risk Assessment), which is more likely to result in an Environment Agency objection. \n\nA flood risk assessment will always be required for solar as sites are more than 0.5ha in size.
\n\nYou should also look at surface water flooding https://flood-warning-information.service.gov.uk/long-term-flood-risk/map?easting=533160&northing=170044&address=10090381317&map=SurfaceWater - The low (1:1000 year), medium (1:100) and high risk (1:30) water depth dropdown options are useful as they should give you a reasonable steer on where the riskier areas are, i.e. Where water depths are greater. Solar panels are normally set around 80cm off the ground to allow sheep to graze and so some surface flooding can be okay, but sensitive equipment such as inverters and transformers should avoid riskier areas.
\n\nFRAs require topo data. Unless required for other purposes (e.g. Tree surveys) at application stage digital data such as Lidar should be sufficient.`
};

// ═══════════════════════════════════════════════════════════════════════════
// ECOLOGY
// ═══════════════════════════════════════════════════════════════════════════

export const ECOLOGY_GUIDANCE = {
  general: String.raw`Are there any designated assets on or near the site, e.g. SSSIs, Special Protection Areas, Ramsar, Special Areas of Conservation or Local Nature Reserves? These should be avoided on site, but often are not major constraints beyond the site. This depends on what the asset is designated for, e.g. a key exception is birds as these tend to use suitable habitat beyond the designation itself and the proposed site may constitute such habitat - Ramsar sites are important ones to note and are often located around estuaries. Otherwise, look for obvious signs of ponds on or within 250m of the site - if present then great crested newt surveys may be necessary. You can also identify through Magic whether recent surveys have been done and whether GCN were found. Other species are important too, but GCN are important for solar as surveys can only be carried out April-late June and can be expensive to mitigate if found.
A preliminary ecological appraisal (PEA) will always be needed, and often separate GCN or skylark surveys are needed in addition (the PEA will confirm these)`,

  drinkingWater: String.raw`Protection of Drinking Water Supply
In order to assist with selecting appropriate sites for renewables projects, the Environment Agency provides boundary mapping of Source Protection Zones (SPZs), which are defined around large and public potable groundwater abstraction sites. The purpose of SPZs is to provide additional protection to safeguard drinking water quality through constraining the proximity of an activity that may impact upon a drinking water abstraction (see https://www.data.gov.uk/dataset/09889a48-0439-4bbe-8f2a-87bba26fbbf5/source-protection-zones-merged for further detail).

For surface-based drinking water supply, Drinking Water Protected Areas (Surface Water) are defined as locations where raw water is abstracted for human consumption e.g. from rivers, lakes, canals and reservoirs (see https://www.data.gov.uk/dataset/3d136e9a-78cf-4452-824d-39d715ba5b69/drinking-water-protected-areas-surface-water for further details).
Alongside these protected areas, there are also designated Drinking Water Safeguard Zones for both surface water and groundwater, which are wider catchment areas established around public water supplies where additional pollution control measures are needed. (see https://www.data.gov.uk/dataset/7fe90245-d6e8-4d7c-a13a-65a87455f429/drinking-water-safeguard-zones-groundwater for further details).

All the above zones should be mapped out as part of any HLPV or detailed site appraisal. They can be found under Designations - Land-based Designations - Non-Statutory.

Ideally sites should be located outside Source Protection Zones 1 and 2, which are the most sensitive to risk of pollution entering the drinking water supply. Safeguarding zones are less sensitive but will still require additional pollution control measures.

Related to drinking water considerations, some substances involved in the manufacture of solar panels, associated cabling and batteries are of concern to water companies. As part of detailed appraisal work, it should be checked with the client if proposed solar / BESS plant will have PFAS (per and polyfluoroalkyl substances) present. Advice from Wessex Water is as follows:

"PFAS are a large group of highly fluorinated substances with a carbon backbone, produced since the 1940s and known for their beneficial water/oil-repellent and stain/heat-resistant properties. PFAS are used in a wide-ranging set of applications, including solar panel and battery manufacturing and installation. PFAS are found in the coatings on electrical wires, backing panels, tapes and adhesives, and the main concern is the use in anti-reflective coatings (ARC) and anti-soil coatings (ASC) to increase solar panel productivity.

Due to their extreme persistence in the environment, PFAS have been found in water environments around the world including in the United Kingdom. In line with regulations and guidance, the water industry continues to ensure that PFAS and other similar chemicals are minimised in drinking water. As part of this, we want to work with all stakeholders to tackle PFAS at source and minimise the impact of PFAS on our customers.

Wessex Water would like any solar developers to provide documentation verifying that the solar panels and associated electrical equipment used to construct solar parks and battery energy storage facilities do not contain PFAS, including PFOA, PFOS, GenX and PTFE. This will ensure that any risk to the environment, groundwater and drinking water quality is reduced and ultimately protects public health."`
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════

export const TRANSPORT_GUIDANCE = {
  general: String.raw`Operational traffic will be negligible and so you are only concerned with construction traffic. Look at whether the access to the site from the trunk road network is likely to be suitable, i.e. roads with few tight bends or very narrow (single track), ideally avoiding passing through small villages. Also look at whether access to the fields themselves is straightforward, e.g. wide and direct access onto the road, or might it require the creation of new access tracks? Most challenges can be overcome so this is rarely a showstopper issue. A construction traffic management plan is normally commissioned for the application.`
};

// ═══════════════════════════════════════════════════════════════════════════
// AVIATION
// ═══════════════════════════════════════════════════════════════════════════

export const AVIATION_GUIDANCE = {
  general: String.raw`Solar farms can produce some glint and glare. This is rarely a major issue as solar panels are designed to absorb rather than reflect light. Nonetheless, at  this stage just note proximity to obviously sensitive receptors, such as nearby airports or airfields.

NB. we had the Pager Power CPD so notes in there if needed.`
};

// ═══════════════════════════════════════════════════════════════════════════
// NOISE
// ═══════════════════════════════════════════════════════════════════════════

export const NOISE_GUIDANCE = {
  general: String.raw`Noise - solar panels make no noise, but the transformers and inverters do during operations (daylight hours). This is not really an issue for your initial review but may become important in some sites later on. Some projects include battery energy storage (shipping containers with batteries in them to store power until it is needed) - these can be noisy and operate at night, which can be problematic in quiet rural locations. Again, less of an issue at review stage but a survey may be required for the application. As a crude rule of thumb - noise shouldn't be an issue if the receptor is more than 250m away, therefore it is often more of a design issue than a showstopper.`
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTAMINATED LAND
// ═══════════════════════════════════════════════════════════════════════════

export const CONTAMINATED_LAND_GUIDANCE = {
  general: String.raw`11. Contaminated land - this generally isn't an issue for solar sites, but if there are any obvious potential sources of contamination on or adjacent to the site you should record these, e.g. if the site is previously developed.`
};

// ═══════════════════════════════════════════════════════════════════════════
// TREES
// ═══════════════════════════════════════════════════════════════════════════

export const TREES_GUIDANCE = {
  general: String.raw`12. Trees - almost always solar farms will be sited  within existing field boundaries to avoid damage to hedges and trees. However, where trees need removing or pruning (e.g. To allow for site or field access) a tree survey may be required. In the initial review, you should use aerial photography, streetview etc. to form an initial view on how likely this will be. If likely, then a tree survey may be needed.
Nb. A topo survey will be required for a tree survey - Lidar or drone surveys will not be sufficient.`
};

// ═══════════════════════════════════════════════════════════════════════════
// BESS (Battery Energy Storage Systems)
// ═══════════════════════════════════════════════════════════════════════════

export const BESS_GUIDANCE = {
  general: String.raw`BESS Sites: (applicable for BESS and SOLAR too as needed)

-See if BESS (or renewables) policy in Plan and be guided by what that says
-topography useful to note in site description (if needed)
-visual / landscape / possible mitigation
-PRoW
-heritage impact (setting) (if applicable)
-archaeological considerations
-fire safety (and that ties into 2 accesses, vegetation not too close to equipment, water supply)
-flood (dependant on Flood Zone)
-Surface Water Drainage
-Noise (equipment - especially if close to resi)
-ALC (loss of ag land?)
-Ecology (need for BNG areas)
 species covered by Habitat Regs
-transport / access (construction / operational)
-the issue of drinking water areas / impact on ground water is becoming more prominent (note added Nov 24) so include where the magic map layer is showing its applicable (or the proposals map is).`
};

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY & REFERENCE
// ═══════════════════════════════════════════════════════════════════════════

export const SUMMARY_GUIDANCE = {
  finalSummary: String.raw`Once you have reviewed each, you should summarise the main issues in a sentence or two. Normally there are one or two important issues. The client will only be interested in showstoppers at this stage, and whether you think they can be overcome. If you don't know then you should be recommending further feasibility work.

Key points to keep in mind when writing a final summary of your findings:

Start with whether the site is acceptable in terms of planning permission.
Need to add a conclusion to your findings.
When writing these, put yourself in the shoes of the client. They want to know: what the issues are,  what is the risk associated with those issues that you have mentioned; is it high or low; can it be mitigated, or what do they need to do to confirm this; and a summary.
Dont be too definitive as you can't be 100% sure that it may be a problem (especially with things like Visual impacts, flood risk, ecology, transport). Always refer/recommend surveys when not sure.
Separate into different sub-topics / small paragraphs for a clearer explanation on the topic, its risks and how it can be mitigated rather than combining all in one big paragraph.
Try to be as clear and to the point as possible - remember it's an initial summary; there will be surveys done at a later stage that may or may not confirm issues related to your findings. Highlight all the issues that you may have found, provide recommendations on what can be done without going into too much detail.`,

  surveysReference: String.raw`For Reference in terms of surveys requirements:
All applications will need: LVIA; Preliminary Ecological Appraisal (PEA) (plus any follow up protected species surveys); and Flood Risk Assessment.
Most will need: archaeology and/or heritage; Agricultural Land Classification Survey; and Construction Traffic Management Plan.
Some will need: glint and glare; noise; and contaminated land.`,

  finalSummaryEmail: String.raw`When sending the Final Summary Email to Client:
Send Final Summary
Sent Invitation to My Maps (when sending summary to Rob for review)
Sent a picture of the my map showing the site area(s)!`
};

// ═══════════════════════════════════════════════════════════════════════════
// COMBINED GUIDANCE OBJECT (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export const GUIDANCE = {
  // Planning Policy
  planningPolicy: PLANNING_POLICY_GUIDANCE.general,
  nearbyApplications: PLANNING_POLICY_GUIDANCE.nearbyApplications,

  // Landscape
  landscapeAndVisual: LANDSCAPE_GUIDANCE.general,
  greenBelt: LANDSCAPE_GUIDANCE.greenBelt,

  // Heritage
  heritage: HERITAGE_GUIDANCE.general,

  // Agricultural Land
  agriculturalLand: AGRICULTURAL_LAND_GUIDANCE.general,

  // Flood
  floodRiskAndDrainage: FLOOD_GUIDANCE.general,

  // Ecology
  ecology: ECOLOGY_GUIDANCE.general,
  drinkingWater: ECOLOGY_GUIDANCE.drinkingWater,

  // Transport
  transportAndConstructionTraffic: TRANSPORT_GUIDANCE.general,

  // Aviation
  glintAndGlare: AVIATION_GUIDANCE.general,

  // Noise
  noise: NOISE_GUIDANCE.general,

  // Contaminated Land
  contaminatedLand: CONTAMINATED_LAND_GUIDANCE.general,

  // Trees
  trees: TREES_GUIDANCE.general,

  // BESS
  bessSites: BESS_GUIDANCE.general,

  // Summary
  finalSummary: SUMMARY_GUIDANCE.finalSummary,
  surveysReference: SUMMARY_GUIDANCE.surveysReference,
  finalSummaryEmail: SUMMARY_GUIDANCE.finalSummaryEmail
};
