/**
 * Analysis Session Service
 * Handles saving and retrieving normalized analysis data
 */

import { supabaseAdmin as supabase } from '../supabase.js';

/**
 * Feature type mappings for each discipline
 */
const DISCIPLINE_FEATURE_TYPES = {
  heritage: ['listed_building', 'conservation_area', 'scheduled_monument', 'registered_park_garden', 'world_heritage_site'],
  landscape: ['green_belt', 'aonb', 'national_park'],
  ecology: ['sssi', 'sac', 'spa', 'ramsar', 'national_nature_reserve', 'gcn', 'os_priority_pond', 'drinking_water'],
  trees: ['ancient_woodland'],
  renewables: ['renewable_development'],
  airfields: ['uk_airport'],
  ag_land: ['agricultural_land']
};

/**
 * Map raw feature array key to normalized feature_type
 */
const FEATURE_KEY_TO_TYPE = {
  listed_buildings: 'listed_building',
  conservation_areas: 'conservation_area',
  scheduled_monuments: 'scheduled_monument',
  registered_parks_gardens: 'registered_park_garden',
  world_heritage_sites: 'world_heritage_site',
  green_belt: 'green_belt',
  aonb: 'aonb',
  national_parks: 'national_park',
  sssi: 'sssi',
  sac: 'sac',
  spa: 'spa',
  ramsar: 'ramsar',
  national_nature_reserves: 'national_nature_reserve',
  gcn: 'gcn',
  os_priority_ponds: 'os_priority_pond',
  drinking_water: 'drinking_water',
  ancient_woodland: 'ancient_woodland',
  renewables: 'renewable_development',
  uk_airports: 'uk_airport',
  ag_land: 'agricultural_land'
};

/**
 * Create a new analysis session and save all data
 * @param {Object} data - The analysis data to save
 * @returns {Promise<Object>} The saved session
 */
export async function createAnalysisSession(data) {
  const {
    projectId,
    siteName,
    polygonGeojson,
    heritageData,
    landscapeData,
    ecologyData,
    treesData,
    renewablesData,
    airfieldsData,
    agLandData,
    userId
  } = data;

  // 1. Create the session
  const { data: session, error: sessionError } = await supabase
    .from('analysis_sessions')
    .insert({
      project_id: projectId || null,
      site_name: siteName,
      polygon_geojson: typeof polygonGeojson === 'string' ? polygonGeojson : JSON.stringify(polygonGeojson),
      created_by: userId || null
    })
    .select()
    .single();

  if (sessionError) {
    console.error('Error creating analysis session:', sessionError);
    throw new Error(`Failed to create analysis session: ${sessionError.message}`);
  }

  const sessionId = session.id;
  console.log(`✅ Created analysis session: ${sessionId}`);

  // 2. Save all discipline data in parallel
  const savePromises = [];

  if (heritageData) {
    savePromises.push(saveDisciplineData(sessionId, 'heritage', heritageData));
  }
  if (landscapeData) {
    savePromises.push(saveDisciplineData(sessionId, 'landscape', landscapeData));
  }
  if (ecologyData) {
    savePromises.push(saveDisciplineData(sessionId, 'ecology', ecologyData));
  }
  if (treesData) {
    savePromises.push(saveDisciplineData(sessionId, 'trees', treesData));
  }
  if (renewablesData) {
    savePromises.push(saveDisciplineData(sessionId, 'renewables', renewablesData));
  }
  if (airfieldsData) {
    savePromises.push(saveDisciplineData(sessionId, 'airfields', airfieldsData));
  }
  if (agLandData) {
    savePromises.push(saveDisciplineData(sessionId, 'ag_land', agLandData));
  }

  await Promise.all(savePromises);

  console.log(`✅ All discipline data saved for session: ${sessionId}`);
  return session;
}

/**
 * Save data for a single discipline
 */
async function saveDisciplineData(sessionId, discipline, data) {
  const promises = [];

  // Save discipline summary
  promises.push(saveDisciplineSummary(sessionId, discipline, data));

  // Save triggered rules
  if (data.rules && data.rules.length > 0) {
    promises.push(saveRulesTriggered(sessionId, discipline, data.rules));
  }

  // Save findings (features)
  promises.push(saveFindings(sessionId, discipline, data));

  await Promise.all(promises);
}

/**
 * Save discipline summary
 */
async function saveDisciplineSummary(sessionId, discipline, data) {
  const { error } = await supabase
    .from('analysis_discipline_summary')
    .insert({
      session_id: sessionId,
      discipline,
      overall_risk: data.overallRisk || null,
      discipline_recommendation: data.disciplineRecommendation || null,
      default_triggered_recommendations: data.defaultTriggeredRecommendations || [],
      default_no_rules_recommendations: data.defaultNoRulesRecommendations || [],
      rules_version: data.metadata?.rulesVersion || null,
      total_rules_processed: data.metadata?.totalRulesProcessed || null,
      rules_triggered_count: data.rules?.length || 0
    });

  if (error) {
    console.error(`Error saving ${discipline} summary:`, error);
    throw error;
  }
}

/**
 * Save triggered rules
 */
async function saveRulesTriggered(sessionId, discipline, rules) {
  const ruleRecords = rules.map(rule => ({
    session_id: sessionId,
    discipline,
    rule_id: rule.id || null,
    rule_name: rule.rule || rule.name || 'Unknown Rule',
    risk_level: rule.level || rule.risk_level || 'unknown',
    findings_text: rule.findings || null,
    recommendation: rule.recommendation || null,
    recommendations: rule.recommendations || []
  }));

  const { error } = await supabase
    .from('analysis_rules_triggered')
    .insert(ruleRecords);

  if (error) {
    console.error(`Error saving ${discipline} rules:`, error);
    throw error;
  }
}

/**
 * Save findings (features) for a discipline
 */
async function saveFindings(sessionId, discipline, data) {
  const findings = [];

  // Map of feature array keys to process
  const featureKeys = Object.keys(FEATURE_KEY_TO_TYPE);

  for (const key of featureKeys) {
    if (data[key] && Array.isArray(data[key]) && data[key].length > 0) {
      const featureType = FEATURE_KEY_TO_TYPE[key];

      for (const feature of data[key]) {
        findings.push(mapFeatureToFinding(sessionId, discipline, featureType, feature));
      }
    }
  }

  if (findings.length > 0) {
    // Insert in batches of 100 to avoid payload limits
    const batchSize = 100;
    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      const { error } = await supabase
        .from('analysis_findings')
        .insert(batch);

      if (error) {
        console.error(`Error saving ${discipline} findings batch:`, error);
        throw error;
      }
    }
    console.log(`✅ Saved ${findings.length} findings for ${discipline}`);
  }
}

/**
 * Map a raw feature to a finding record
 */
function mapFeatureToFinding(sessionId, discipline, featureType, feature) {
  return {
    session_id: sessionId,
    discipline,
    feature_type: featureType,
    feature_name: feature.name || feature.site_name || feature.sitename || feature.project_name || null,
    feature_id: feature.list_entry || feature.listentry || feature.reference || feature.id || null,
    grade: feature.grade || null,
    distance_m: feature.dist_m || feature.distance_m || null,
    direction: feature.direction || null,
    on_site: feature.on_site || false,
    within_50m: feature.within_50m || false,
    within_100m: feature.within_100m || false,
    within_250m: feature.within_250m || false,
    within_500m: feature.within_500m || false,
    within_1km: feature.within_1km || false,
    within_3km: feature.within_3km || false,
    within_5km: feature.within_5km || false,
    percentage_coverage: feature.percentage_coverage || feature.coverage_percent || null,
    additional_data: extractAdditionalData(feature)
  };
}

/**
 * Extract additional data fields that don't fit standard columns
 */
function extractAdditionalData(feature) {
  const standardFields = [
    'name', 'site_name', 'sitename', 'project_name',
    'list_entry', 'listentry', 'reference', 'id',
    'grade', 'dist_m', 'distance_m', 'direction',
    'on_site', 'within_50m', 'within_100m', 'within_250m',
    'within_500m', 'within_1km', 'within_3km', 'within_5km',
    'percentage_coverage', 'coverage_percent',
    'geometry', 'geojson', 'geom', 'the_geom', 'shape'
  ];

  const additional = {};
  for (const [key, value] of Object.entries(feature)) {
    if (!standardFields.includes(key) && value !== null && value !== undefined) {
      additional[key] = value;
    }
  }

  return Object.keys(additional).length > 0 ? additional : null;
}

/**
 * Get analysis session by project ID
 */
export async function getSessionByProjectId(projectId) {
  const { data: session, error } = await supabase
    .from('analysis_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching session:', error);
    throw error;
  }

  return session || null;
}

/**
 * Get full analysis data for a session
 */
export async function getFullSessionData(sessionId) {
  const [session, summaries, rules, findings, edits] = await Promise.all([
    supabase.from('analysis_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('analysis_discipline_summary').select('*').eq('session_id', sessionId),
    supabase.from('analysis_rules_triggered').select('*').eq('session_id', sessionId),
    supabase.from('analysis_findings').select('*').eq('session_id', sessionId),
    supabase.from('analysis_edits').select('*').eq('session_id', sessionId)
  ]);

  if (session.error) {
    throw new Error(`Failed to fetch session: ${session.error.message}`);
  }

  return {
    session: session.data,
    summaries: summaries.data || [],
    rules: rules.data || [],
    findings: findings.data || [],
    edits: edits.data || []
  };
}

/**
 * Reconstruct discipline data from normalized tables (for frontend compatibility)
 */
export async function getReconstructedAnalysisData(sessionId) {
  const fullData = await getFullSessionData(sessionId);

  const result = {
    sessionId: fullData.session.id,
    projectId: fullData.session.project_id,
    siteName: fullData.session.site_name,
    createdAt: fullData.session.created_at
  };

  // Group data by discipline
  const disciplines = ['heritage', 'landscape', 'ecology', 'trees', 'renewables', 'airfields', 'ag_land'];

  for (const discipline of disciplines) {
    const summary = fullData.summaries.find(s => s.discipline === discipline);
    const disciplineRules = fullData.rules.filter(r => r.discipline === discipline);
    const disciplineFindings = fullData.findings.filter(f => f.discipline === discipline);
    const edit = fullData.edits.find(e => e.discipline === discipline);

    if (summary || disciplineRules.length > 0 || disciplineFindings.length > 0) {
      result[`${discipline}Data`] = reconstructDisciplineData(
        discipline,
        summary,
        disciplineRules,
        disciplineFindings,
        edit
      );
    }
  }

  return result;
}

/**
 * Reconstruct a single discipline's data structure
 */
function reconstructDisciplineData(discipline, summary, rules, findings, edit) {
  const data = {
    // Use edited values if available, otherwise use original
    overallRisk: edit?.edited_overall_risk || summary?.overall_risk || null,
    disciplineRecommendation: summary?.discipline_recommendation || null,
    defaultTriggeredRecommendations: summary?.default_triggered_recommendations || [],
    defaultNoRulesRecommendations: summary?.default_no_rules_recommendations || [],
    rules: rules.map(r => ({
      id: r.rule_id || null,
      rule: r.rule_name,
      level: r.risk_level,
      findings: r.findings_text,
      recommendation: r.recommendation || null,
      recommendations: r.recommendations || []
    })),
    metadata: {
      rulesVersion: summary?.rules_version,
      totalRulesProcessed: summary?.total_rules_processed,
      rulesTriggered: summary?.rules_triggered_count
    }
  };

  // Group findings by feature type and reconstruct arrays
  const findingsByType = {};
  for (const finding of findings) {
    if (!findingsByType[finding.feature_type]) {
      findingsByType[finding.feature_type] = [];
    }
    findingsByType[finding.feature_type].push(reconstructFeature(finding));
  }

  // Map back to original key names
  const typeToKey = {
    listed_building: 'listed_buildings',
    conservation_area: 'conservation_areas',
    scheduled_monument: 'scheduled_monuments',
    registered_park_garden: 'registered_parks_gardens',
    world_heritage_site: 'world_heritage_sites',
    green_belt: 'green_belt',
    aonb: 'aonb',
    national_park: 'national_parks',
    sssi: 'sssi',
    sac: 'sac',
    spa: 'spa',
    ramsar: 'ramsar',
    national_nature_reserve: 'national_nature_reserves',
    gcn: 'gcn',
    os_priority_pond: 'os_priority_ponds',
    drinking_water: 'drinking_water',
    ancient_woodland: 'ancient_woodland',
    renewable_development: 'renewables',
    uk_airport: 'uk_airports',
    agricultural_land: 'ag_land'
  };

  for (const [featureType, features] of Object.entries(findingsByType)) {
    const key = typeToKey[featureType] || featureType;
    data[key] = features;
  }

  return data;
}

/**
 * Reconstruct a single feature from a finding record
 */
function reconstructFeature(finding) {
  const feature = {
    name: finding.feature_name,
    dist_m: finding.distance_m,
    direction: finding.direction,
    on_site: finding.on_site,
    within_50m: finding.within_50m,
    within_100m: finding.within_100m,
    within_250m: finding.within_250m,
    within_500m: finding.within_500m,
    within_1km: finding.within_1km,
    within_3km: finding.within_3km,
    within_5km: finding.within_5km
  };

  if (finding.feature_id) feature.list_entry = finding.feature_id;
  if (finding.grade) feature.grade = finding.grade;
  if (finding.percentage_coverage) feature.percentage_coverage = finding.percentage_coverage;

  // Merge additional data
  if (finding.additional_data) {
    Object.assign(feature, finding.additional_data);
  }

  return feature;
}

/**
 * Save an edit to a discipline
 */
export async function saveEdit(sessionId, discipline, editedRisk, editedRecommendations, userId) {
  const { data, error } = await supabase
    .from('analysis_edits')
    .upsert({
      session_id: sessionId,
      discipline,
      edited_overall_risk: editedRisk,
      edited_recommendations: editedRecommendations,
      updated_by: userId
    }, {
      onConflict: 'session_id,discipline'
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving edit:', error);
    throw error;
  }

  return data;
}

/**
 * Log a change to the audit trail
 */
export async function logChange(sessionId, discipline, fieldPath, oldValue, newValue, reason, userId) {
  const { error } = await supabase
    .from('analysis_change_log')
    .insert({
      session_id: sessionId,
      discipline,
      field_path: fieldPath,
      old_value: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue),
      new_value: typeof newValue === 'string' ? newValue : JSON.stringify(newValue),
      reason,
      changed_by: userId
    });

  if (error) {
    console.error('Error logging change:', error);
    throw error;
  }
}

/**
 * Get change log for a session
 */
export async function getChangeLog(sessionId) {
  const { data, error } = await supabase
    .from('analysis_change_log')
    .select('*')
    .eq('session_id', sessionId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('Error fetching change log:', error);
    throw error;
  }

  return data || [];
}
