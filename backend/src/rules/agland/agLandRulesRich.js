import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';

/** @param {any[]} agLandAreas */
export function checkGrade1OnSite(agLandAreas) {
  const grade1Areas = (agLandAreas || []).filter(a => a.grade === 'Grade 1' || a.grade === '1');
  if (grade1Areas.length === 0) return { triggered: false };

  const totalCoverage = grade1Areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);

  // Grade 1 thresholds: 100-60% = showstopper, 60-20% = extremely high
  if (totalCoverage < 20) return { triggered: false };

  let riskLevel, riskDescription;
  if (totalCoverage >= 60) {
    riskLevel = RISK_LEVELS.SHOWSTOPPER;
    riskDescription = 'showstopper risk';
  } else {
    riskLevel = RISK_LEVELS.EXTREMELY_HIGH_RISK;
    riskDescription = 'extremely high risk';
  }

  return {
    id: 'grade_1_on_site',
    triggered: true,
    level: riskLevel,
    rule: 'Grade 1 Agricultural Land On-Site',
    findings: `${totalCoverage.toFixed(1)}% of site consists of Grade 1 agricultural land`,
    areas: grade1Areas
  };
}

/** @param {any[]} agLandAreas */
export function checkGrade2OnSite(agLandAreas) {
  const grade2Areas = (agLandAreas || []).filter(a => a.grade === 'Grade 2' || a.grade === '2');
  if (grade2Areas.length === 0) return { triggered: false };

  const totalCoverage = grade2Areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);

  // Grade 2 thresholds: 100-80% = high, 60-40% = medium-high, 40-20% = medium
  if (totalCoverage < 20) return { triggered: false };

  let riskLevel, riskDescription;
  if (totalCoverage >= 80) {
    riskLevel = RISK_LEVELS.HIGH_RISK;
    riskDescription = 'high risk';
  } else if (totalCoverage >= 40) {
    riskLevel = RISK_LEVELS.MEDIUM_HIGH_RISK;
    riskDescription = 'medium-high risk';
  } else {
    riskLevel = RISK_LEVELS.MEDIUM_RISK;
    riskDescription = 'medium risk';
  }

  return {
    id: 'grade_2_on_site',
    triggered: true,
    level: riskLevel,
    rule: 'Grade 2 Agricultural Land On-Site',
    findings: `${totalCoverage.toFixed(1)}% of site consists of Grade 2 agricultural land`,
    areas: grade2Areas
  };
}

/** @param {any[]} agLandAreas */
export function checkGrade3OnSite(agLandAreas) {
  const grade3Areas = (agLandAreas || []).filter(a => a.grade === 'Grade 3' || a.grade === '3');
  if (grade3Areas.length === 0) return { triggered: false };

  const totalCoverage = grade3Areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);

  // Grade 3 thresholds: 100-20% = medium
  if (totalCoverage < 20) return { triggered: false };

  return {
    id: 'grade_3_on_site',
    triggered: true,
    level: RISK_LEVELS.MEDIUM_RISK,
    rule: 'Grade 3 Agricultural Land On-Site',
    findings: `${totalCoverage.toFixed(1)}% of site consists of Grade 3 agricultural land`,
    areas: grade3Areas
  };
}


/** @param {any[]} agLandAreas */
export function checkGrade4Or5OnlyOnSite(agLandAreas) {
  const allAreas = agLandAreas || [];

  // Check if there are any higher quality grades (1, 2, 3) present with significant coverage (>=20%)
  const higherGrades = allAreas.filter(a => {
    const isHigherGrade = a.grade === 'Grade 1' || a.grade === '1' ||
                         a.grade === 'Grade 2' || a.grade === '2' ||
                         a.grade === 'Grade 3' || a.grade === '3';
    return isHigherGrade && (a.percentage_coverage || 0) >= 20;
  });

  // If higher grades with significant coverage are present, this rule doesn't apply
  if (higherGrades.length > 0) return { triggered: false };

  // Check for Grade 4 or 5 areas
  const grade4Or5Areas = allAreas.filter(a =>
    a.grade === 'Grade 4' || a.grade === '4' ||
    a.grade === 'Grade 5' || a.grade === '5'
  );

  if (grade4Or5Areas.length === 0) return { triggered: false };

  const totalCoverage = grade4Or5Areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);

  // Grade 4 & 5 thresholds: 100-20% = low risk
  if (totalCoverage < 20) return { triggered: false };

  const grade4Areas = grade4Or5Areas.filter(a => a.grade === 'Grade 4' || a.grade === '4');
  const grade5Areas = grade4Or5Areas.filter(a => a.grade === 'Grade 5' || a.grade === '5');

  const gradeBreakdown = [];
  if (grade4Areas.length > 0) {
    const grade4Coverage = grade4Areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);
    gradeBreakdown.push(`Grade 4 (${grade4Coverage.toFixed(1)}%)`);
  }
  if (grade5Areas.length > 0) {
    const grade5Coverage = grade5Areas.reduce((sum, area) => sum + (area.percentage_coverage || 0), 0);
    gradeBreakdown.push(`Grade 5 (${grade5Coverage.toFixed(1)}%)`);
  }

  return {
    id: 'grade_4_or_5_only_on_site',
    triggered: true,
    level: RISK_LEVELS.LOW_RISK,
    rule: 'Grade 4 or 5 Agricultural Land Only',
    findings: `Site consists only of lower quality agricultural land: ${gradeBreakdown.join(', ')}`,
    areas: grade4Or5Areas
  };
}

/**
 * Build site breakdown string from agricultural land data
 * @param {any[]} agLand
 * @returns {string}
 */
function buildSiteBreakdown(agLand) {
  if (!agLand || agLand.length === 0) return '';

  const gradesSummary = agLand
    .sort((a, b) => {
      const gradeOrder = { '1': 1, 'Grade 1': 1, '2': 2, 'Grade 2': 2, '3': 3, 'Grade 3': 3, '4': 4, 'Grade 4': 4, '5': 5, 'Grade 5': 5 };
      return (gradeOrder[a.grade] || 99) - (gradeOrder[b.grade] || 99);
    })
    .map(area => `${area.percentage_coverage?.toFixed(0) || 0}% ${area.grade}`)
    .join(', ');

  return `Site breakdown: ${gradesSummary}`;
}

/**
 * Check if BMV land (Grades 1-3) is present with significant coverage
 * @param {any[]} agLand
 * @returns {boolean}
 */
function hasBMVLand(agLand) {
  if (!agLand || agLand.length === 0) return false;

  return agLand.some(a => {
    const isBMV = a.grade === 'Grade 1' || a.grade === '1' ||
                  a.grade === 'Grade 2' || a.grade === '2' ||
                  a.grade === 'Grade 3' || a.grade === '3';
    return isBMV && (a.percentage_coverage || 0) >= 20;
  });
}

/**
 * Build discipline recommendation based on BMV presence
 * @param {any[]} agLand
 * @param {boolean} isBMVPresent
 * @returns {string}
 */
function buildAgLandDisciplineRecommendation(agLand, isBMVPresent) {
  const siteBreakdown = buildSiteBreakdown(agLand);

  if (isBMVPresent) {
    // Medium or above (BMV present)
    const parts = [];
    if (siteBreakdown) parts.push(siteBreakdown);
    parts.push('Presence of Best and Most Versatile land (Grades 1–3) is a significant planning consideration. Strong justification will be needed for development on BMV land.');
    parts.push('Early engagement with Natural England is recommended.');
    parts.push('Additional supporting material such as a Site Justification Document, farm diversification/business case, and policy justification will likely be required.');
    parts.push('Natural England ALC mapping is only indicative; an ALC survey will be required to confirm the actual land grade on-site.');
    return parts.join('\n\n');
  } else {
    // Medium-low or below (no BMV land)
    const parts = [];
    if (siteBreakdown) parts.push(siteBreakdown);
    parts.push('The provisional mapping indicates no BMV land on site (Grades 1–3). Planning risk is typically lower.');
    parts.push('Natural England ALC mapping is only indicative; an ALC survey will be required to confirm the actual land grade on-site.');
    return parts.join('\n\n');
  }
}

/**
 * Process all agricultural land rules and return triggered ones
 * @param {{ ag_land?: any[] }} analysisData
 */
export function processAgLandRules(analysisData) {
  const agLand = analysisData?.ag_land || [];
  let triggeredRules = [];

  // Order: most restrictive grades first
  const agLandRules = [
    checkGrade1OnSite,
    checkGrade2OnSite,
    checkGrade3OnSite,
    checkGrade4Or5OnlyOnSite
  ];

  for (const rule of agLandRules) {
    const result = rule(agLand);
    if (result.triggered) triggeredRules.push(result);
  }

  // Determine overall risk based on highest risk rule triggered
  const overallRisk = triggeredRules.length > 0 ? triggeredRules[0].level : RISK_LEVELS.LOW_RISK;

  // Check if BMV land is present
  const isBMVPresent = hasBMVLand(agLand);

  // Build discipline recommendation
  const disciplineRecommendation = agLand.length > 0
    ? buildAgLandDisciplineRecommendation(agLand, isBMVPresent)
    : null;

  return {
    rules: triggeredRules,
    overallRisk,
    agLand,
    disciplineRecommendation,
    hasAnyTrigger: triggeredRules.length > 0,
    // Keep old structure for backward compatibility
    defaultTriggeredRecommendations: [],
    defaultNoRulesRecommendations: [],
    metadata: {
      totalRulesProcessed: 4,
      rulesTriggered: triggeredRules.length,
      rulesVersion: 'agland-rules-v4'
    }
  };
}