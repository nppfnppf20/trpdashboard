# Complete Layer Implementation Guide - HLPV Tool

## 📋 Table of Contents
1. [HLPV Tool Overview](#hlpv-tool-overview)
2. [System Architecture](#system-architecture)
3. [Complete Layer Implementation Steps](#complete-layer-implementation-steps)
4. [Validation: National Parks Example](#validation-national-parks-example)
5. [Common Pitfalls](#common-pitfalls)
6. [Quick Reference Checklist](#quick-reference-checklist)

---

## 🎯 HLPV Tool Overview

### What It Does
The **High-Level Planning View (HLPV)** tool is a planning assessment system that analyzes development sites against various planning constraints to provide risk-based recommendations for early-stage development decisions.

### How It Works
1. **User draws a polygon** on a Leaflet map to define a development site
2. **SQL spatial analysis** runs against geospatial datasets (Heritage, Landscape, Ecology, AgLand, Renewables)
3. **Business rules engine** processes results and assigns risk levels (7-level framework)
4. **Map layers render** analysis results with color-coded features
5. **Findings panel displays** summary cards and detailed results
6. **Report generator** creates comprehensive planning assessment reports

### Key Features
- ✅ PostGIS spatial queries with distance buckets (on-site, 50m, 100m, 250m, 500m, 1km, 3km, 5km)
- ✅ 7-level risk framework (Showstopper → Low Risk)
- ✅ Interactive map with toggleable layers
- ✅ Real-time findings panel updates
- ✅ Automated report generation with recommendations
- ✅ Project integration and TRP report editing

---

## 🏗️ System Architecture

### Data Flow: User Action → Results Display

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: User draws polygon on map (Leaflet + leaflet-draw)  │
└────────────────────────┬────────────────────────────────────────┘
                         │ GeoJSON polygon
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: API call to /analyze/landscape (or other discipline) │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND: Express route → Controller → SQL query builder        │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL function call
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE: PostGIS spatial analysis (analyze_national_parks)    │
│  - Convert GeoJSON → Geometry (SRID 4326 → 27700)              │
│  - Calculate distances using ST_Distance, ST_DWithin            │
│  - Determine direction using ST_Azimuth                         │
│  - Return features with distance buckets                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL result (JSON)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND: Aggregator function combines multiple layers          │
│  (e.g., analyze_site_landscape → green_belt + aonb + parks)    │
└────────────────────────┬────────────────────────────────────────┘
                         │ Combined JSON
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND: Business rules engine (processNationalParksRules)     │
│  - Apply distance-based rules                                   │
│  - Assign risk levels (EXTREMELY_HIGH_RISK, HIGH_RISK, etc.)   │
│  - Generate findings and recommendations                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ Rules assessment
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND: Controller builds response object                     │
│  - Include raw data (national_parks: [...])     ⚠️ CRITICAL!   │
│  - Include rules (rules: [...])                                 │
│  - Include risk assessment (overallRisk, recommendations)       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP Response (JSON)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: Dashboard receives landscapeResult                   │
│  - Stores in state: landscapeResult = { green_belt, aonb,      │
│    national_parks, rules, overallRisk, ... }                   │
└────────────────┬────────────────┬──────────────────────────────┘
                 │                │
                 ▼                ▼
┌────────────────────────┐  ┌──────────────────────────────────┐
│  MAP DISPLAY           │  │  FINDINGS PANEL DISPLAY          │
│  - Map.svelte receives │  │  - FindingsPanel passes props    │
│    landscapeData       │  │    to LandscapeResults  ⚠️ KEY!  │
│  - Reactive updates    │  │  - LandscapeResults renders:     │
│    populate layers     │  │    * Summary cards               │
│  - setLayerData()      │  │    * Expandable sections         │
│    with risk filtering │  │    * Detailed feature lists      │
│  - Purple polygons on  │  │  - Shows status (Yes/Nearby/No)  │
│    map (toggleable)    │  │  - Distance & direction badges   │
└────────────────────────┘  └──────────────────────────────────┘
```

---

## 📝 Complete Layer Implementation Steps

### ⚠️ CRITICAL STEPS OFTEN MISSED
The following steps are ESSENTIAL but were missing from earlier documentation:
- **Step 8**: Update backend controller to include new layer in response
- **Step 9**: Pass new layer data to frontend display components
- **Step 10**: Update Results component to display new layer

---

### **Step 0: Table Verification** ⚠️ DO THIS FIRST!

**Why**: Wrong table/column names cause deployment failures that are hard to debug.

#### 0.1 Create verification script

```javascript
// backend/scripts/check-[layer-name].js
import 'dotenv/config';
import pg from 'pg';

async function check() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Search for tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND LOWER(table_name) LIKE '%search_term%'
    `);
    
    console.log('Tables found:', tables.rows);
    
    // Check structure
    const tableName = 'exact_table_name_here';
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    
    console.log('Columns:', columns.rows);
    
    // Get sample data
    const sample = await pool.query(`
      SELECT *, ST_GeometryType(geom) as geom_type, ST_SRID(geom) as srid
      FROM "${tableName}" LIMIT 3
    `);
    
    console.log('Sample:', sample.rows);
  } finally {
    await pool.end();
  }
}

check();
```

#### 0.2 Run and verify

```bash
cd backend
node scripts/check-[layer-name].js
```

#### 0.3 Document findings
- ✅ Exact table name (with quotes if needed)
- ✅ ID column name and type
- ✅ Geometry column name
- ✅ SRID (should be 27700 for accurate distance calculations)
- ✅ Name/description columns
- ✅ Any special fields needed

**Example: National Parks**
- Table: `"National parks England"` (note spaces, requires quotes)
- OBJECTID: `bigint`
- geom: `MultiPolygon`, SRID 27700
- NAME: `character varying`

---

### **Step 1: SQL Analysis Function**

Create individual layer analysis function with standard distance buckets.

**File**: `backend/sql/[discipline]_analysis/analyze_[layer_name].sql`

```sql
-- Example: National Parks
CREATE OR REPLACE FUNCTION analyze_national_parks(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  dist_m INTEGER,
  on_site BOOLEAN,
  within_50m BOOLEAN,
  within_100m BOOLEAN,
  within_250m BOOLEAN,
  within_500m BOOLEAN,
  within_1km BOOLEAN,
  within_3km BOOLEAN,
  within_5km BOOLEAN,
  direction TEXT,
  geometry JSON
) AS $$
WITH
-- Convert GeoJSON to geometry (4326)
site AS (
  SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)) AS geom
),
-- Transform to British National Grid (27700)
site_metric AS (
  SELECT ST_Transform(geom, 27700) AS geom FROM site
),
-- Reference point for direction
site_ref AS (
  SELECT sm.geom, ST_PointOnSurface(sm.geom) AS ref_pt FROM site_metric sm
),
-- Your layer data
layer_features AS (
  SELECT
    ST_MakeValid(
      CASE WHEN ST_SRID(f.geom) = 27700 THEN f.geom 
           ELSE ST_Transform(f.geom, 27700) END
    ) AS geom,
    f."OBJECTID"::INTEGER AS id,
    f."NAME" AS name
  FROM public."National parks England" f
  WHERE f.geom IS NOT NULL
),
-- Calculate distances and buffers
with_measures AS (
  SELECT
    p.id,
    p.name,
    p.geom,
    sr.geom AS site_geom,
    sr.ref_pt,
    ROUND(ST_Distance(sr.geom, p.geom))::INTEGER AS dist_m,
    ST_Intersects(sr.geom, p.geom) AS on_site,
    ST_DWithin(sr.geom, p.geom, 50.0) AS within_50m,
    ST_DWithin(sr.geom, p.geom, 100.0) AS within_100m,
    ST_DWithin(sr.geom, p.geom, 250.0) AS within_250m,
    ST_DWithin(sr.geom, p.geom, 500.0) AS within_500m,
    ST_DWithin(sr.geom, p.geom, 1000.0) AS within_1km,
    ST_DWithin(sr.geom, p.geom, 3000.0) AS within_3km,
    ST_DWithin(sr.geom, p.geom, 5000.0) AS within_5km,
    DEGREES(ST_Azimuth(sr.ref_pt, ST_ClosestPoint(p.geom, sr.site_geom))) AS az_deg
  FROM layer_features p
  CROSS JOIN site_ref sr
)
SELECT
  id, name, dist_m,
  on_site, within_50m, within_100m, within_250m,
  within_500m, within_1km, within_3km, within_5km,
  -- Convert azimuth to cardinal direction
  CASE
    WHEN on_site THEN 'N/A'
    WHEN az_deg >= 337.5 OR az_deg < 22.5 THEN 'N'
    WHEN az_deg >= 22.5 AND az_deg < 67.5 THEN 'NE'
    WHEN az_deg >= 67.5 AND az_deg < 112.5 THEN 'E'
    WHEN az_deg >= 112.5 AND az_deg < 157.5 THEN 'SE'
    WHEN az_deg >= 157.5 AND az_deg < 202.5 THEN 'S'
    WHEN az_deg >= 202.5 AND az_deg < 247.5 THEN 'SW'
    WHEN az_deg >= 247.5 AND az_deg < 292.5 THEN 'W'
    WHEN az_deg >= 292.5 AND az_deg < 337.5 THEN 'NW'
    ELSE 'N/A'
  END AS direction,
  ST_AsGeoJSON(ST_Transform(geom, 4326))::JSON AS geometry
FROM with_measures
WHERE within_5km = TRUE
ORDER BY dist_m;
$$ LANGUAGE sql STABLE;
```

#### Test the SQL function

```javascript
// backend/scripts/test-[layer]-sql.js
const result = await pool.query('SELECT * FROM analyze_national_parks($1)', [
  JSON.stringify(testPolygon)
]);
console.log('Results:', result.rows);
```

---

### **Step 2: Domain Aggregator Integration**

Add new layer to the discipline's aggregator function.

**File**: `backend/sql/create_analysis_functions.sql`

```sql
-- Example: Landscape aggregator
CREATE OR REPLACE FUNCTION analyze_site_landscape(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  green_belt_result JSON;
  aonb_result JSON;
  national_parks_result JSON;  -- ADD THIS
  combined_result JSON;
BEGIN
  -- Existing layers
  SELECT json_agg(row_to_json(t)) INTO green_belt_result
  FROM (SELECT * FROM analyze_green_belt(polygon_geojson)) t;
  
  SELECT json_agg(row_to_json(t)) INTO aonb_result
  FROM (SELECT * FROM analyze_aonb(polygon_geojson)) t;
  
  -- NEW LAYER
  SELECT json_agg(row_to_json(t)) INTO national_parks_result
  FROM (SELECT * FROM analyze_national_parks(polygon_geojson)) t;
  
  -- Combine results
  SELECT json_build_object(
    'green_belt', COALESCE(green_belt_result, '[]'::json),
    'aonb', COALESCE(aonb_result, '[]'::json),
    'national_parks', COALESCE(national_parks_result, '[]'::json)  -- ADD THIS
  ) INTO combined_result;
  
  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;
```

#### Test the aggregator

```javascript
const result = await pool.query(
  'SELECT analyze_site_landscape($1) as analysis_result',
  [JSON.stringify(testPolygon)]
);
const data = result.rows[0].analysis_result;
console.log('National Parks:', data.national_parks);
```

---

### **Step 3: Business Rules Engine**

Create risk assessment rules for the layer.

**File**: `backend/src/rules/[discipline]/[layerName]RulesRich.js`

```javascript
import { RISK_LEVELS, isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

// Rule functions (one per distance bucket)
export function checkNationalParkOnSite(nationalParks) {
  const onSite = (nationalParks || []).filter(np => np.on_site);
  if (onSite.length === 0) return { triggered: false };

  const level = RISK_LEVELS.EXTREMELY_HIGH_RISK;
  return {
    id: 'national_park_on_site',
    triggered: true,
    level,
    rule: 'National Park On-Site',
    findings: `${onSite.length} National Park${onSite.length > 1 ? 's' : ''} intersecting site`,
    recommendation: buildDesignationRecommendation('aonbNationalParks', isRiskMediumOrAbove(level)),
    areas: onSite
  };
}

// ... more rules for within_50m, within_100m, etc.
// Each rule follows the same pattern:
//   const level = RISK_LEVELS.XXX;
//   recommendation: buildDesignationRecommendation('designationKey', isRiskMediumOrAbove(level))

// Main processing function
export function processNationalParksRules(analysisData) {
  const nationalParks = analysisData?.national_parks || [];
  const triggeredRules = [];

  const pipeline = [
    checkNationalParkOnSite,
    checkNationalParkWithin50m,
    checkNationalParkWithin100m,
    // ... etc
  ];

  for (const rule of pipeline) {
    const result = rule(nationalParks);
    if (result.triggered) triggeredRules.push(result);
  }

  return {
    triggered: triggeredRules.length > 0,
    rules: triggeredRules,
    national_parks: nationalParks
  };
}
```

#### Recommendation System

The recommendation system uses a central file (`backend/src/rules/recommendations.js`) with two layers:

1. **Designation-level recommendations** - Specific to each constraint type (e.g., National Parks, SSSI)
   - `intro`: Always shown (can be null)
   - `mediumOrAbove`: Shown when risk is MEDIUM_RISK or higher
   - `mediumLowOrBelow`: Shown when risk is MEDIUM_LOW_RISK or lower

2. **Discipline-level recommendations** - One per discipline (Heritage, Landscape, Ecology, Trees)
   - `anyTrigger`: Shown when ANY rules in the discipline triggered
   - `noTrigger`: Shown when NO rules triggered

The `buildDesignationRecommendation(key, isMediumOrAbove)` function combines intro + risk-appropriate text.

---

### **Step 3b: Add Designation to Recommendations File** (If NEW designation)

If adding a NEW designation type (not reusing an existing one), add an entry to the central recommendations file.

**File**: `backend/src/rules/recommendations.js`

```javascript
export const RECOMMENDATIONS = {
  // ... existing disciplines ...

  designations: {
    // ... existing designations ...

    // ADD YOUR NEW DESIGNATION
    yourNewDesignation: {
      intro: `Introduction text that is always shown when this designation triggers.
This explains what the designation is and its policy significance.`,

      mediumOrAbove: `Additional text shown when risk level is MEDIUM_RISK or higher.
This typically describes higher planning sensitivity and stricter requirements.`,

      mediumLowOrBelow: `Additional text shown when risk level is MEDIUM_LOW_RISK or lower.
This typically notes reduced risk due to distance while maintaining some caution.`
    }
  }
};
```

**Existing designation keys you can reuse:**
- Heritage: `gradeIAndIIStar`, `gradeII`, `conservationAreas`, `scheduledMonuments`, `worldHeritageSites`
- Landscape: `greenBelt`, `aonbNationalParks`
- Ecology: `sssi`, `ramsar`
- Trees: `ancientWoodland`

**Tips:**
- `intro` can be `null` if no intro text is needed
- `mediumOrAbove` can be empty string `''` if no additional text for high risk
- Use `\n\n` for paragraph breaks within text
- Keep text factual and policy-referenced (e.g., "NPPF para. 213")

---

### **Step 4: Domain Rules Integration**

Integrate layer rules into the discipline-level processor.

**File**: `backend/src/rules/[discipline]/index.js`

```javascript
import { processGreenBeltRules } from './greenBeltRulesRich.js';
import { processAONBRules } from './aonbRulesRich.js';
import { processNationalParksRules } from './nationalParksRulesRich.js';  // ADD
import { RISK_LEVELS, RISK_HIERARCHY } from '../riskLevels.js';
import { getDisciplineRecommendation } from '../recommendations.js';

export function processLandscapeRules(analysisData) {
  const gb = processGreenBeltRules(analysisData);
  const ab = processAONBRules(analysisData);
  const np = processNationalParksRules(analysisData);  // ADD

  let rules = [...gb.rules, ...ab.rules, ...np.rules].map(r => ({ ...r }));  // ADD

  // CRITICAL: Sort by risk level (highest to lowest)
  rules.sort((a, b) => RISK_HIERARCHY.indexOf(a.level) - RISK_HIERARCHY.indexOf(b.level));

  // SHOWSTOPPER LOGIC: If any rule is a showstopper, only show showstopper rules
  const showstopperRules = rules.filter(r => r.level === RISK_LEVELS.SHOWSTOPPER);
  if (showstopperRules.length > 0) {
    rules = showstopperRules;
  }

  const overallRisk = rules.length > 0 ? rules[0].level : RISK_LEVELS.LOW_RISK;

  // Determine if ANY rules triggered
  const hasTriggeredRules = rules.length > 0;

  // Get discipline-level recommendation from central file
  const disciplineRecommendation = getDisciplineRecommendation('landscape', hasTriggeredRules);

  return {
    rules,
    overallRisk,
    green_belt: gb.green_belt,
    aonb: ab.aonb,
    national_parks: np.national_parks,  // ADD
    // New structure: single discipline recommendation
    disciplineRecommendation,
    hasAnyTrigger: hasTriggeredRules,
    // Keep old structure for backward compatibility
    defaultTriggeredRecommendations: hasTriggeredRules ? [disciplineRecommendation] : [],
    defaultNoRulesRecommendations: hasTriggeredRules ? [] : [disciplineRecommendation]
  };
}
```

---

### **Step 5: ⚠️ Backend Controller Response** (CRITICAL!)

**This step is ESSENTIAL but easy to miss!**

**File**: `backend/src/controllers/analysis.controller.js`

```javascript
export async function analyzeLandscape(req, res) {
  try {
    const { polygon } = req.body;
    const { text, values } = buildLandscapeAnalysisQuery(polygon);
    const result = await pool.query(text, values);
    
    const analysisResult = result.rows[0]?.analysis_result || {};
    
    // Debug logging
    const npArr = Array.isArray(analysisResult.national_parks) ? analysisResult.national_parks : [];
    console.log('[Landscape] national_parks count:', npArr.length);
    
    const rulesAssessment = processLandscapeRules(analysisResult);
    
    const response = {
      green_belt: analysisResult.green_belt || [],
      aonb: analysisResult.aonb || [],
      national_parks: analysisResult.national_parks || [],  // ⚠️ ADD THIS!
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk,
      defaultTriggeredRecommendations: rulesAssessment.defaultTriggeredRecommendations || [],
      defaultNoRulesRecommendations: rulesAssessment.defaultNoRulesRecommendations || [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRulesProcessed: 18,  // Update count
        rulesTriggered: rulesAssessment.rules.length,
        rulesVersion: 'landscape-rules-v3'  // Update version
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Landscape analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**⚠️ CRITICAL**: If you don't include the layer in the response object, the frontend will NEVER receive the data!

---

### **Step 6: Frontend Map Layer**

#### 6a. Layer Factory Function

**File**: `frontend/src/lib/utils/layerFactory.js`

```javascript
export function createNationalParksLayer(L) {
  return L.geoJSON(null, {
    style: { 
      color: '#a855f7',      // Purple
      weight: 3, 
      fillOpacity: 0.2 
    },
    onEachFeature: (f, layer) => {
      const name = f?.properties?.name || 'National Park';
      layer.bindPopup(`${name}<br><strong>National Park</strong>`);
    }
  });
}
```

#### 6b. Risk Assessment Function

**File**: `frontend/src/lib/utils/mapRiskAssessment.js`

```javascript
export function getNationalParksRiskLevel(nationalPark) {
  if (nationalPark.on_site) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
  if (nationalPark.within_50m) return RISK_LEVELS.HIGH_RISK;
  if (nationalPark.within_100m) return RISK_LEVELS.HIGH_RISK;
  if (nationalPark.within_250m) return RISK_LEVELS.MEDIUM_HIGH_RISK;
  if (nationalPark.within_500m) return RISK_LEVELS.MEDIUM_RISK;
  if (nationalPark.within_1km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  if (nationalPark.within_3km) return RISK_LEVELS.LOW_RISK;
  if (nationalPark.within_5km) return RISK_LEVELS.LOW_RISK;
  return RISK_LEVELS.LOW_RISK;
}
```

#### 6c. Map Component Integration

**File**: `frontend/src/lib/components/hlpv/Map.svelte`

```javascript
// 1. Import functions
import {
  createNationalParksLayer,  // ADD
  getNationalParksRiskLevel  // ADD
} from '$lib/utils/...';

// 2. Declare layer variable
let nationalParksLayer = null;

// 3. Create layer in onMount
onMount(async () => {
  L = (await import('leaflet')).default;
  await import('leaflet-draw');
  
  map = L.map(mapContainer).setView([51.505, -0.09], 13);
  // ...
  
  nationalParksLayer = createNationalParksLayer(L);  // ADD
});

// 4. Reactive data updates
$: if (landscapeData?.national_parks) {
  console.log('🟣 National Parks data received:', landscapeData.national_parks);
  setLayerData(nationalParksLayer, landscapeData.national_parks, (r) => ({
    name: r.name || 'National Park',
    riskLevel: getNationalParksRiskLevel(r)
  }), true, riskFilters);
}

// 5. Update layer visibility function
function updateLayerVisibility() {
  // ... existing layers
  
  if (landscapeData?.national_parks) {
    setLayerData(nationalParksLayer, landscapeData.national_parks, (r) => ({
      name: r.name || 'National Park',
      riskLevel: getNationalParksRiskLevel(r)
    }), true, riskFilters);
  }
}
```

---

### **Step 7: Map Layer Controls**

**File**: `frontend/src/lib/components/hlpv/MapControls.svelte`

```javascript
// 1. Add to exports
export let nationalParksLayer = null;

// 2. Add to discipline groups
const disciplineGroups = {
  landscape: {
    title: 'Landscape',
    layers: [
      { layer: greenBeltLayer, name: 'Green Belt', style: '...', shape: 'rect' },
      { layer: aonbLayer, name: 'AONB', style: '...', shape: 'rect' },
      { 
        layer: nationalParksLayer, 
        name: 'National Parks', 
        style: 'rgba(168, 85, 247, 0.2); border: 3px solid #a855f7; border-radius: 3px;', 
        shape: 'rect' 
      }
    ]
  }
};
```

**File**: `frontend/src/lib/components/hlpv/Map.svelte` (pass to controls)

```javascript
<MapControls
  {nationalParksLayer}  // ADD
  // ... other props
/>
```

---

### **Step 8: ⚠️ Findings Panel Display** (CRITICAL!)

**This step is ESSENTIAL but was missing from initial documentation!**

**File**: `frontend/src/lib/components/hlpv/FindingsPanel.svelte`

```javascript
<!-- Landscape Analysis -->
{#if landscapeResult}
  <LandscapeResults 
    greenBelt={landscapeResult?.green_belt}
    aonb={landscapeResult?.aonb}
    nationalParks={landscapeResult?.national_parks}  <!-- ⚠️ ADD THIS! -->
    title="Landscape Analysis"
    loading={false}
    error={errorMsg}
  />
{/if}
```

**⚠️ CRITICAL**: If you don't pass the prop here, the data won't reach the display component!

---

### **Step 9: Results Component Display**

**File**: `frontend/src/lib/components/hlpv/Results ribbons/LandscapeResults.svelte`

```javascript
<script>
  // 1. Add prop
  export let nationalParks = null;
  
  // 2. Add state
  let nationalParksExpanded = false;
  
  // 3. Add computed values
  $: nationalParksItems = Array.isArray(nationalParks) ? nationalParks : [];
  $: nationalParksOnSiteCount = nationalParksItems.filter(np => np.on_site).length;
  $: nationalParksWithin1kmCount = nationalParksItems.filter(np => !np.on_site && np.within_1km).length;
  $: nationalParksStatus = nationalParksOnSiteCount > 0 ? 'Yes' : (nationalParksWithin1kmCount > 0 ? 'Nearby' : 'No');
  $: nationalParksNearest = (() => {
    const candidates = nationalParksItems.filter(np => !np.on_site);
    if (candidates.length === 0) return null;
    return candidates.reduce((min, np) => (np.dist_m < min.dist_m ? np : min), candidates[0]);
  })();
</script>

<!-- 4. Add summary card -->
<div class="summary-card">
  <h3>National Parks</h3>
  <p class="summary-value">{nationalParksStatus}</p>
  {#if nationalParksStatus === 'Yes'}
    <p style="font-size: 0.875rem; color: #059669; margin: 0.25rem 0 0 0;">
      On site
    </p>
  {:else if nationalParksStatus === 'Nearby'}
    <p style="font-size: 0.875rem; color: #d97706; margin: 0.25rem 0 0 0;">
      Within 1km
    </p>
  {:else if nationalParksNearest}
    <p style="font-size: 0.875rem; color: #6b7280; margin: 0.25rem 0 0 0;">
      Nearest: {nationalParksNearest.distance_m}m away
    </p>
  {/if}
</div>

<!-- 5. Add detailed section -->
{#if nationalParksStatus !== 'No' || nationalParksNearest}
  <div class="results-section" style="margin-top: 1rem;">
    <div class="section-header clickable" 
         on:click={() => nationalParksExpanded = !nationalParksExpanded}>
      <div class="section-header-content">
        <h3 class="section-title">National Parks</h3>
        {#if nationalParksStatus === 'Yes'}
          <span class="section-subtitle">On site</span>
        {/if}
      </div>
      <span class="expand-icon">{nationalParksExpanded ? '▼' : '▶'}</span>
    </div>
    
    {#if nationalParksExpanded}
      <div class="results-grid">
        {#each nationalParksItems as park}
          <div class="result-item">
            <div class="item-header">
              <h4 class="item-title">{park.name}</h4>
              <div class="status-badges">
                {#each getStatusBadges(park) as badge}
                  <span class="badge {badge.class}">{badge.text}</span>
                {/each}
              </div>
            </div>
            <div class="item-details">
              <div class="detail-row">
                <span class="detail-label">Distance</span>
                <span class="detail-value">{formatDistance(park.dist_m, park.on_site)}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
```

---

## ✅ Validation: National Parks Example

### What We Implemented
- ✅ SQL function: `analyze_national_parks()`
- ✅ Aggregator: Added to `analyze_site_landscape()`
- ✅ Business rules: `processNationalParksRules()`
- ✅ Domain integration: Updated `processLandscapeRules()`
- ✅ **Backend response**: Added `national_parks` to controller
- ✅ Map layer: Purple-bordered polygons
- ✅ Layer controls: Toggle in Landscape section
- ✅ **Findings panel**: Props passed through
- ✅ **Results display**: Summary card + detailed section

### Test Results
**Test polygon**: Peak District area
- ✅ Found 1 National Park (Peak District)
- ✅ Distance: 0m (on-site)
- ✅ Risk level: EXTREMELY_HIGH_RISK
- ✅ Rule triggered: "National Park On-Site"
- ✅ Map display: Purple polygon visible
- ✅ Findings panel: Shows "Yes" status with expandable details
- ✅ Report: Includes National Parks rules and recommendations

---

## ⚠️ Common Pitfalls

### 1. **Backend Controller Missing Layer in Response** 🔥 CRITICAL
**Symptom**: Frontend never receives the data, console shows `undefined`  
**Cause**: Forgot to add `national_parks: analysisResult.national_parks || []` to response  
**Fix**: Always add the layer to the controller's response object!

### 2. **FindingsPanel Not Passing Props** 🔥 CRITICAL
**Symptom**: Map shows data but Findings Panel is empty  
**Cause**: `FindingsPanel.svelte` doesn't pass the layer prop to Results component  
**Fix**: Add `nationalParks={landscapeResult?.national_parks}` to the Results component call

### 3. **Results Component Missing Display Logic**
**Symptom**: Data exists but nothing renders in UI  
**Cause**: Results component doesn't have summary card or detailed section  
**Fix**: Add both summary card and expandable section following the pattern

### 4. **Wrong Table Name**
**Symptom**: SQL function fails with "relation does not exist"  
**Cause**: Table names with spaces/special characters need quotes  
**Solution**: Always verify table name with Step 0 script first!

### 5. **Apostrophes in Strings**
**Symptom**: JavaScript syntax error in rules file  
**Cause**: Single quotes inside single-quoted strings (e.g., `'Site's location'`)  
**Solution**: Use double quotes for strings with apostrophes: `"Site's location"`

### 6. **Not Sorting Rules by Risk Level**
**Symptom**: Overall risk is incorrect  
**Cause**: Rules not sorted before picking overallRisk  
**Solution**: Always sort rules by risk hierarchy before determining overall risk

### 7. **Layer Not Added to MapControls Props**
**Symptom**: Layer toggle doesn't appear  
**Cause**: Forgot to pass `{nationalParksLayer}` prop to MapControls  
**Solution**: Add to both MapControls exports and Map.svelte component

### 8. **Missing Reactive Updates**
**Symptom**: Data comes in but map doesn't update  
**Cause**: No `$: if (landscapeData?.national_parks)` reactive statement  
**Solution**: Add reactive statement to trigger setLayerData when data changes

### 9. **Risk Filter Not Applied**
**Symptom**: All features show regardless of risk filter settings  
**Cause**: `setLayerData()` not called with riskFilters parameter  
**Solution**: Always pass `riskFilters` to setLayerData: `setLayerData(layer, data, mapper, true, riskFilters)`

### 10. **Metadata Not Updated**
**Symptom**: Report shows wrong rule counts
**Cause**: Forgot to update `totalRulesProcessed` and `rulesVersion`
**Solution**: Update metadata when adding layers

### 11. **Using Old Recommendations Format** 🔥 NEW
**Symptom**: Recommendations don't appear in report, or appear as `[object Object]`
**Cause**: Using `recommendations: [...]` array instead of `recommendation:` string
**Solution**: Use the new format:
```javascript
import { isRiskMediumOrAbove } from '../riskLevels.js';
import { buildDesignationRecommendation } from '../recommendations.js';

const level = RISK_LEVELS.HIGH_RISK;
return {
  // ...
  recommendation: buildDesignationRecommendation('designationKey', isRiskMediumOrAbove(level)),
  // NOT: recommendations: ['text', 'text']
};
```

### 12. **Missing Designation in recommendations.js**
**Symptom**: Recommendation text is empty or undefined
**Cause**: Using a `designationKey` that doesn't exist in `recommendations.js`
**Solution**: Either use an existing key (see Step 3b) or add your new designation to `recommendations.js`

---

## 📋 Quick Reference Checklist

### Backend (6 steps)
- [ ] **Step 0**: Verify table structure with check script
- [ ] **Step 1**: Create SQL analysis function
- [ ] **Step 2**: Add to domain aggregator function
- [ ] **Step 3**: Create business rules file (use `recommendation:` not `recommendations:[]`)
- [ ] **Step 3b**: Add designation to `recommendations.js` (if NEW designation)
- [ ] **Step 4**: Integrate into domain rules index (include `disciplineRecommendation`)
- [ ] **Step 5**: ⚠️ **Add to controller response object** (CRITICAL!)

### Frontend Map (2 steps)
- [ ] **Step 6**: Create layer factory, risk assessment, Map.svelte integration
- [ ] **Step 7**: Add to MapControls (exports + discipline groups + props)

### Frontend Display (2 steps) ⚠️ CRITICAL!
- [ ] **Step 8**: ⚠️ **Pass prop in FindingsPanel** (CRITICAL!)
- [ ] **Step 9**: ⚠️ **Add display logic in Results component** (CRITICAL!)

### Testing
- [ ] Run SQL test script
- [ ] Run aggregator test script
- [ ] Run business rules test script
- [ ] Test frontend with real polygon
- [ ] Verify map layer appears and toggles
- [ ] Verify findings panel shows data
- [ ] Verify report includes layer

---

## 🎯 Success Criteria

Your layer implementation is complete when:

1. ✅ **SQL**: Function returns features with distance buckets
2. ✅ **Aggregator**: Layer data included in domain response
3. ✅ **Rules**: Risk levels assigned correctly with `recommendation:` field
4. ✅ **Recommendations**: Designation added to `recommendations.js` (if new)
5. ✅ **Backend**: Controller returns layer in response object
6. ✅ **Map**: Purple/colored polygons visible on map
7. ✅ **Controls**: Layer toggle appears in correct discipline
8. ✅ **Findings**: Summary card shows status (Yes/Nearby/No)
9. ✅ **Findings**: Expandable section shows detailed list
10. ✅ **Report**: Layer appears with designation + discipline recommendations
11. ✅ **Console**: Debug logs show data flowing through system

---

## 📝 Summary

**Total Steps**: 11 (0-9, with 3b)
**Critical Steps**: 3 (Step 5, 8, 9 - Easy to miss!)
**Estimated Time**: 2-3 hours per layer (after first one)

**Key Takeaways**:
- The implementation follows a clear pattern from database → backend → frontend map → frontend display
- The most common mistakes are forgetting to include the layer in the backend controller response and forgetting to pass props through the display components
- **Recommendations are now centralized** in `backend/src/rules/recommendations.js` - use `recommendation:` (single string) not `recommendations:[]` (array)
- Each rule uses `buildDesignationRecommendation(key, isRiskMediumOrAbove(level))` to get risk-appropriate text

---

*Document last updated: January 2025 - Updated for centralized recommendations system*

