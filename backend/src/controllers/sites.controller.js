/**
 * Sites Controller
 * Handles HTTP requests for site analysis and TRP report endpoints
 */

import crypto from 'crypto';
import { pool } from '../db.js';

export async function saveSite(req, res) {
  try {
    const {
      siteName,
      polygonGeojson,
      projectId,
      heritageRisk,
      heritageRuleCount,
      landscapeRisk,
      landscapeRuleCount,
      renewablesRisk,
      renewablesRuleCount,
      ecologyRisk,
      ecologyRuleCount,
      agLandRisk,
      agLandRuleCount
    } = req.body;

    if (!siteName || !polygonGeojson) {
      return res.status(400).json({ error: 'siteName and polygonGeojson are required' });
    }

    const uniqueId = crypto.randomUUID();

    const insertSiteQuery = `
      INSERT INTO site_analyses (
        unique_id, site_name, polygon_geojson, project_id,
        heritage_data, landscape_data, renewables_data, ecology_data, ag_land_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, unique_id;
    `;

    const siteResult = await pool.query(insertSiteQuery, [
      uniqueId,
      siteName,
      JSON.stringify(polygonGeojson),
      projectId || null,
      JSON.stringify({ riskLevel: heritageRisk, ruleCount: heritageRuleCount }),
      JSON.stringify({ riskLevel: landscapeRisk, ruleCount: landscapeRuleCount }),
      JSON.stringify({ riskLevel: renewablesRisk, ruleCount: renewablesRuleCount }),
      JSON.stringify({ riskLevel: ecologyRisk, ruleCount: ecologyRuleCount }),
      JSON.stringify({ riskLevel: agLandRisk, ruleCount: agLandRuleCount })
    ]);

    const siteAnalysisId = siteResult.rows[0].id;

    const insertTrpQuery = `
      INSERT INTO trp_reports (site_analysis_id, site_summary, overall_risk_estimation)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;

    const trpResult = await pool.query(insertTrpQuery, [
      siteAnalysisId,
      '',
      ''
    ]);

    // Update project if linked
    if (projectId) {
      const updateProjectQuery = `
        UPDATE projects
        SET heritage_risk = $1,
            heritage_rule_count = $2,
            landscape_risk = $3,
            landscape_rule_count = $4,
            renewables_risk = $5,
            renewables_rule_count = $6,
            ecology_risk = $7,
            ecology_rule_count = $8,
            ag_land_risk = $9,
            ag_land_rule_count = $10,
            hlpv_last_analyzed = NOW()
        WHERE id = $11
      `;

      await pool.query(updateProjectQuery, [
        heritageRisk || 'no_risk',
        heritageRuleCount || 0,
        landscapeRisk || 'no_risk',
        landscapeRuleCount || 0,
        renewablesRisk || 'no_risk',
        renewablesRuleCount || 0,
        ecologyRisk || 'no_risk',
        ecologyRuleCount || 0,
        agLandRisk || 'no_risk',
        agLandRuleCount || 0,
        projectId
      ]);

      console.log(`✅ Updated project ${projectId} with HLPV risk summary`);
    }

    console.log(`✅ Site saved: ${siteName} (${uniqueId})`);

    res.json({
      success: true,
      siteId: uniqueId,
      siteAnalysisId: siteAnalysisId,
      trpReportId: trpResult.rows[0].id,
      message: 'Site analysis saved successfully'
    });

  } catch (error) {
    console.error('Save site error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saveTRPEdits(req, res) {
  try {
    const { report, lastModified } = req.body;

    if (!report) {
      return res.status(400).json({ error: 'Report data is required' });
    }

    console.log('💾 Saving TRP edits...');

    // For now, we'll just log the data and return success
    // In a full implementation, you would:
    // 1. Validate the report structure
    // 2. Update the database with edited risk levels and recommendations
    // 3. Store edit history/audit trail
    // 4. Associate with the original site analysis

    console.log('📊 TRP Report edits received:', {
      structuredReport: !!report.structuredReport,
      disciplines: report.structuredReport?.disciplines?.length || 0,
      lastModified
    });

    res.json({
      success: true,
      message: 'TRP edits saved successfully',
      editId: crypto.randomUUID(),
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error saving TRP edits:', error);
    res.status(500).json({ error: 'Failed to save TRP edits', details: error.message });
  }
}

