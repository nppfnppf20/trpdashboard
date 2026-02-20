/**
 * Analysis Controller
 * Handles HTTP requests for spatial analysis endpoints
 */

import { pool } from '../db.js';
import {
  buildAnalysisQuery,
  buildHeritageAnalysisQuery,
  buildListedBuildingsQuery,
  buildConservationAreasQuery,
  buildScheduledMonumentsQuery,
  buildLandscapeAnalysisQuery,
  buildAgLandAnalysisQuery,
  buildRenewablesAnalysisQuery,
  buildEcologyAnalysisQuery,
  buildTreesAnalysisQuery,
  buildAirfieldsAnalysisQuery
} from '../queries.js';
import { processHeritageRules } from '../rules/heritage/index.js';
import { processLandscapeRules } from '../rules/landscape/index.js';
import { processRenewablesRules } from '../rules/renewables/index.js';
import { processEcologyRules } from '../rules/ecology/index.js';
import { processAgLandRules } from '../rules/agland/agLandRulesRich.js';
import { processTreesRules } from '../rules/trees/index.js';
import { processAirfieldsRules } from '../rules/airfields/index.js';
import { getSocioeconomicsQueries, getGeoIdentifiers } from '../socioeconomicsQueries.js';

// Legacy analyze endpoint
export async function analyze(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    res.json(result.rows[0] ?? {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Heritage analysis
export async function analyzeHeritage(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildHeritageAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    
    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const listedBuildingsArr = Array.isArray(analysisResult.listed_buildings) ? analysisResult.listed_buildings : [];
      const conservationAreasArr = Array.isArray(analysisResult.conservation_areas) ? analysisResult.conservation_areas : [];
      const scheduledMonumentsArr = Array.isArray(analysisResult.scheduled_monuments) ? analysisResult.scheduled_monuments : [];
      const parksGardensArr = Array.isArray(analysisResult.registered_parks_gardens) ? analysisResult.registered_parks_gardens : [];
      const worldHeritageSitesArr = Array.isArray(analysisResult.world_heritage_sites) ? analysisResult.world_heritage_sites : [];
      console.log('[Heritage] listed_buildings count:', listedBuildingsArr.length, 'on_site:', listedBuildingsArr.filter(lb => lb?.on_site).length);
      console.log('[Heritage] conservation_areas count:', conservationAreasArr.length, 'on_site:', conservationAreasArr.filter(ca => ca?.on_site).length);
      console.log('[Heritage] scheduled_monuments count:', scheduledMonumentsArr.length, 'on_site:', scheduledMonumentsArr.filter(sm => sm?.on_site).length, 'within_5km:', scheduledMonumentsArr.filter(sm => sm?.within_5km).length);
      console.log('[Heritage] registered_parks_gardens count:', parksGardensArr.length, 'on_site:', parksGardensArr.filter(pg => pg?.on_site).length, 'within_1km:', parksGardensArr.filter(pg => pg?.within_1km).length);
      console.log('[Heritage] world_heritage_sites count:', worldHeritageSitesArr.length, 'on_site:', worldHeritageSitesArr.filter(whs => whs?.on_site).length, 'within_1km:', worldHeritageSitesArr.filter(whs => whs?.within_1km).length);
    } catch {}

    const rulesAssessment = processHeritageRules(analysisResult);

    const response = {
      listed_buildings: analysisResult.listed_buildings || [],
      conservation_areas: analysisResult.conservation_areas || [],
      scheduled_monuments: analysisResult.scheduled_monuments || [],
      registered_parks_gardens: analysisResult.registered_parks_gardens || [],
      world_heritage_sites: analysisResult.world_heritage_sites || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || 0,
      disciplineRecommendation: rulesAssessment.disciplineRecommendation || null,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 12,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: 'heritage-rules-v2'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Heritage analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Listed buildings analysis
export async function analyzeListedBuildings(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildListedBuildingsQuery(polygon);
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Listed buildings analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Conservation areas analysis
export async function analyzeConservationAreas(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildConservationAreasQuery(polygon);
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Conservation areas analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Scheduled monuments analysis
export async function analyzeScheduledMonuments(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildScheduledMonumentsQuery(polygon);
    const result = await pool.query(text, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Scheduled monuments analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Landscape analysis
export async function analyzeLandscape(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildLandscapeAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    
    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const gbArr = Array.isArray(analysisResult.green_belt) ? analysisResult.green_belt : [];
      const aonbArr = Array.isArray(analysisResult.aonb) ? analysisResult.aonb : [];
      const npArr = Array.isArray(analysisResult.national_parks) ? analysisResult.national_parks : [];
      console.log('[Landscape] green_belt count:', gbArr.length, 'on_site:', gbArr.filter((x) => x?.on_site).length, 'within_1km:', gbArr.filter((x) => x?.within_1km).length);
      console.log('[Landscape] aonb count:', aonbArr.length, 'on_site:', aonbArr.filter((x) => x?.on_site).length, 'within_1km:', aonbArr.filter((x) => x?.within_1km).length);
      console.log('[Landscape] national_parks count:', npArr.length, 'on_site:', npArr.filter((x) => x?.on_site).length, 'within_1km:', npArr.filter((x) => x?.within_1km).length);
    } catch {}

    const rulesAssessment = processLandscapeRules(analysisResult);

    const response = {
      green_belt: analysisResult.green_belt || [],
      aonb: analysisResult.aonb || [],
      national_parks: analysisResult.national_parks || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || 0,
      disciplineRecommendation: rulesAssessment.disciplineRecommendation || null,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 16, // Updated: 2 Green Belt + 8 AONB + 8 National Parks = 18 rules
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: 'landscape-rules-v3'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Landscape analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Agricultural land analysis
export async function analyzeAgLand(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildAgLandAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    
    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const agLandArr = Array.isArray(analysisResult.ag_land) ? analysisResult.ag_land : [];
      console.log('[AgLand] ag_land count:', agLandArr.length, 'grades found:', agLandArr.map(a => a.grade).join(', '));
    } catch {}

    const rulesAssessment = processAgLandRules(analysisResult);

    const response = {
      ag_land: analysisResult.ag_land || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || 0,
      disciplineRecommendation: rulesAssessment.disciplineRecommendation || null,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        dataSource: 'provisional_alc',
        analysisType: 'agricultural-land-classification',
        totalRulesProcessed: rulesAssessment.metadata?.totalRulesProcessed || 0,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: rulesAssessment.metadata?.rulesVersion || 'agland-rules-v1'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Agricultural land analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Renewables analysis
export async function analyzeRenewables(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildRenewablesAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    
    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const renewablesArr = Array.isArray(analysisResult.renewables) ? analysisResult.renewables : [];
      console.log('[Renewables] count:', renewablesArr.length, 'on_site:', renewablesArr.filter(r => r?.on_site).length, 'tech types:', [...new Set(renewablesArr.map(r => r.technology_type))].join(', '));
    } catch {}

    const rulesAssessment = processRenewablesRules(analysisResult);

    const response = {
      renewables: analysisResult.renewables || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || null,
      metadata: {
        generatedAt: new Date().toISOString(),
        dataSource: 'REPD Filtered',
        analysisType: 'renewable-energy-developments',
        technologyFilter: ['Solar Photovoltaics', 'Wind Onshore', 'Battery'],
        capacityFilter: '> 10 MW',
        totalRulesProcessed: rulesAssessment.metadata?.totalRulesProcessed || 0,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: rulesAssessment.metadata?.rulesVersion || 'renewables-rules-v1'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Renewables analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Ecology analysis
export async function analyzeEcology(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildEcologyAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    
    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const pondsArr = Array.isArray(analysisResult.os_priority_ponds) ? analysisResult.os_priority_ponds : [];
      const ramsarArr = Array.isArray(analysisResult.ramsar) ? analysisResult.ramsar : [];
      const spaArr = Array.isArray(analysisResult.spa) ? analysisResult.spa : [];
      const sacArr = Array.isArray(analysisResult.sac) ? analysisResult.sac : [];
      const gcnArr = Array.isArray(analysisResult.gcn) ? analysisResult.gcn : [];
      const sssiArr = Array.isArray(analysisResult.sssi) ? analysisResult.sssi : [];
      const nnrArr = Array.isArray(analysisResult.national_nature_reserves) ? analysisResult.national_nature_reserves : [];
      const drinkingWaterArr = Array.isArray(analysisResult.drinking_water) ? analysisResult.drinking_water : [];
      console.log('[Ecology] os_priority_ponds count:', pondsArr.length, 'on_site:', pondsArr.filter(p => p?.on_site).length, 'within_250m:', pondsArr.filter(p => p?.within_250m).length);
      console.log('[Ecology] ramsar count:', ramsarArr.length, 'on_site:', ramsarArr.filter(r => r?.on_site).length, 'within_5km:', ramsarArr.filter(r => r?.within_5km).length);
      console.log('[Ecology] spa count:', spaArr.length, 'on_site:', spaArr.filter(s => s?.on_site).length, 'within_5km:', spaArr.filter(s => s?.within_5km).length);
      console.log('[Ecology] sac count:', sacArr.length, 'on_site:', sacArr.filter(s => s?.on_site).length, 'within_5km:', sacArr.filter(s => s?.within_5km).length);
      console.log('[Ecology] gcn count:', gcnArr.length, 'on_site:', gcnArr.filter(g => g?.on_site).length, 'within_250m:', gcnArr.filter(g => g?.within_250m).length);
      console.log('[Ecology] sssi count:', sssiArr.length, 'on_site:', sssiArr.filter(s => s?.on_site).length, 'within_1km:', sssiArr.filter(s => s?.within_1km).length);
      console.log('[Ecology] nnr count:', nnrArr.length, 'on_site:', nnrArr.filter(n => n?.on_site).length, 'within_1km:', nnrArr.filter(n => n?.within_1km).length);
      console.log('[Ecology] drinking_water count:', drinkingWaterArr.length, 'total_coverage:', drinkingWaterArr.reduce((sum, d) => sum + (d?.percentage_coverage || 0), 0).toFixed(1) + '%');
    } catch {}

    const rulesAssessment = processEcologyRules(analysisResult);

    const response = {
      os_priority_ponds: analysisResult.os_priority_ponds || [],
      ramsar: analysisResult.ramsar || [],
      spa: analysisResult.spa || [],
      sac: analysisResult.sac || [],
      gcn: analysisResult.gcn || [],
      sssi: analysisResult.sssi || [],
      national_nature_reserves: analysisResult.national_nature_reserves || [],
      drinking_water: analysisResult.drinking_water || [],
      rules: rulesAssessment.rules || [],
      drinkingWaterRules: rulesAssessment.drinkingWaterRules || [],
      overallRisk: rulesAssessment.overallRisk || 0,
      disciplineRecommendation: rulesAssessment.disciplineRecommendation || null,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 29,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: 'ecology-rules-v6'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Ecology analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Trees analysis
export async function analyzeTrees(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildTreesAnalysisQuery(polygon);
    const result = await pool.query(text, values);

    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const ancientWoodlandArr = Array.isArray(analysisResult.ancient_woodland) ? analysisResult.ancient_woodland : [];
      console.log('[Trees] ancient_woodland count:', ancientWoodlandArr.length, 'on_site:', ancientWoodlandArr.filter(aw => aw?.on_site).length, 'within_500m:', ancientWoodlandArr.filter(aw => aw?.within_500m).length);
    } catch {}

    const rulesAssessment = processTreesRules(analysisResult);

    const response = {
      ancient_woodland: analysisResult.ancient_woodland || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || 0,
      disciplineRecommendation: rulesAssessment.disciplineRecommendation || null,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 3,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: 'trees-rules-v1'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Trees analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Socioeconomics analysis
export async function analyzeSocioeconomics(req, res) {
  try {
    const { polygon } = req.body;

    console.log('🔍 Starting socioeconomics analysis...');

    const queries = getSocioeconomicsQueries(polygon);
    const results = {};

    for (const { name, query } of queries) {
      try {
        console.log(`📊 Running ${name} query...`);

        // Debug query for LAD layers
        if (name.includes('LAD')) {
          const debugQuery = `
            SELECT
              COUNT(*) as total_features,
              ST_IsValid(ST_GeomFromGeoJSON($1)) as input_geom_valid,
              ST_AsText(ST_Centroid(ST_Transform(ST_GeomFromGeoJSON($1), 27700))) as input_centroid_27700
          `;
          const debugResult = await pool.query(debugQuery, query.values);
          console.log(`  🔍 ${name} Debug:`, debugResult.rows[0]);
        }

        const result = await pool.query(query.text, query.values);

        const processedRows = result.rows.map((row, index) => {
          const geoIds = getGeoIdentifiers(name, row);

          if (name.includes('LAD')) {
            console.log(`  📝 ${name} feature: ${geoIds.geo_name} (code: ${geoIds.geo_code})`);
            const sampleKeys = Object.keys(row).slice(0, 10);
            console.log(`  🔑 Sample columns:`, sampleKeys.join(', '));
          }

          return {
            ...row,
            ...geoIds,
            layer_type: name,
            feature_index: index + 1
          };
        });

        results[name.toLowerCase()] = processedRows;
        console.log(`✅ ${name}: ${processedRows.length} features found`);
      } catch (error) {
        console.error(`❌ Error querying ${name}:`, {
          message: error.message,
          detail: error.detail,
          hint: error.hint,
          code: error.code,
          stack: error.stack
        });
        results[name.toLowerCase()] = [];
      }
    }

    const response = {
      ...results,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalLayers: queries.length,
        layersWithData: Object.values(results).filter(layer => layer.length > 0).length,
        analysisType: 'socioeconomic-spatial-analysis'
      }
    };

    console.log('🎉 Socioeconomics analysis complete!');
    res.json(response);

  } catch (error) {
    console.error('Socioeconomics analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Airfields analysis
export async function analyzeAirfields(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildAirfieldsAnalysisQuery(polygon);
    const result = await pool.query(text, values);

    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug logging
    try {
      const ukAirportsArr = Array.isArray(analysisResult.uk_airports) ? analysisResult.uk_airports : [];
      console.log('[Airfields] uk_airports count:', ukAirportsArr.length, 'on_site:', ukAirportsArr.filter(a => a?.on_site).length, 'within_10km:', ukAirportsArr.filter(a => a?.within_10km).length);
    } catch {}

    const rulesAssessment = processAirfieldsRules(analysisResult);

    const response = {
      uk_airports: analysisResult.uk_airports || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || 0,
      disciplineRecommendation: rulesAssessment.disciplineRecommendation || null,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 4,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: 'airfields-rules-v1'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Airfields analysis error:', {
      message: error?.message,
      detail: error?.detail,
      hint: error?.hint,
      position: error?.position,
      stack: error?.stack
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

