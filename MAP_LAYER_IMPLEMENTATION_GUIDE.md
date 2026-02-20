# Map Layer Implementation Guide

Complete step-by-step guide for implementing new map layers in the HLPV web application.

## Overview

This guide covers the complete data flow from SQL analysis to interactive map visualization with risk-based filtering.

## Data Flow Architecture

```
SQL Database → Backend API → Frontend Processing → Map Visualization
     ↓              ↓              ↓                    ↓
1. Analysis     2. REST API    3. Data Transform    4. Leaflet Layer
   Function        Endpoint       & Risk Calc         & Filtering
```

---

## Step 1: Backend SQL Analysis Function

### 1.1 Create SQL Analysis Function

**Location**: `backend/sql/[domain]_analysis/analyze_[layer_name].sql`

**Critical Requirements**:
- MUST return lat/lng coordinates for map display
- Include proximity flags (on_site, within_50m, etc.)
- Return all data needed for risk assessment

```sql
-- Example: analyze_your_layer.sql
CREATE OR REPLACE FUNCTION analyze_your_layer(polygon_geojson TEXT)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  -- Add your specific fields here
  status TEXT,
  category TEXT,
  -- Distance and proximity flags
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
  -- CRITICAL: Must include coordinates for mapping
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
) AS $$
WITH
-- Convert input polygon
site AS (
  SELECT ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(polygon_geojson), 4326)) AS geom
),

-- Transform to metric for distance calculations
site_metric AS (
  SELECT ST_Transform(geom, 27700) AS geom FROM site
),

-- Your data points with distance calculations
your_points AS (
  SELECT
    yd.id,
    yd.name,
    yd.status,
    yd.category,
    -- Ensure correct SRID and transform to metric
    ST_MakeValid(
      CASE WHEN ST_SRID(yd.geom) = 27700
           THEN yd.geom
           ELSE ST_Transform(yd.geom, 27700)
      END
    ) AS geom
  FROM public."Your_Data_Table" yd
  WHERE yd.geom IS NOT NULL
    AND yd.status IN ('Active', 'Proposed', 'Under Review')
),

-- Calculate distances and proximity flags
with_metrics AS (
  SELECT
    yp.*,
    ROUND(ST_Distance(sm.geom, yp.geom))::INTEGER AS dist_m,
    ST_Intersects(sm.geom, yp.geom) AS on_site,
    ST_DWithin(sm.geom, yp.geom, 50.0) AS within_50m,
    ST_DWithin(sm.geom, yp.geom, 100.0) AS within_100m,
    ST_DWithin(sm.geom, yp.geom, 250.0) AS within_250m,
    ST_DWithin(sm.geom, yp.geom, 500.0) AS within_500m,
    ST_DWithin(sm.geom, yp.geom, 1000.0) AS within_1km,
    ST_DWithin(sm.geom, yp.geom, 3000.0) AS within_3km,
    ST_DWithin(sm.geom, yp.geom, 5000.0) AS within_5km,
    degrees(ST_Azimuth(ST_PointOnSurface(sm.geom), yp.geom)) AS az_deg,
    -- CRITICAL: Extract lat/lng coordinates for frontend mapping
    ST_Y(ST_Transform(yp.geom, 4326)) AS lat,
    ST_X(ST_Transform(yp.geom, 4326)) AS lng
  FROM your_points yp
  CROSS JOIN site_metric sm
)

SELECT
  wm.id,
  wm.name,
  wm.status,
  wm.category,
  wm.dist_m,
  wm.on_site,
  wm.within_50m,
  wm.within_100m,
  wm.within_250m,
  wm.within_500m,
  wm.within_1km,
  wm.within_3km,
  wm.within_5km,
  -- Direction calculation
  CASE
    WHEN wm.on_site THEN 'N/A'
    WHEN wm.az_deg >= 337.5 OR wm.az_deg < 22.5 THEN 'N'
    WHEN wm.az_deg >= 22.5 AND wm.az_deg < 67.5 THEN 'NE'
    WHEN wm.az_deg >= 67.5 AND wm.az_deg < 112.5 THEN 'E'
    WHEN wm.az_deg >= 112.5 AND wm.az_deg < 157.5 THEN 'SE'
    WHEN wm.az_deg >= 157.5 AND wm.az_deg < 202.5 THEN 'S'
    WHEN wm.az_deg >= 202.5 AND wm.az_deg < 247.5 THEN 'SW'
    WHEN wm.az_deg >= 247.5 AND wm.az_deg < 292.5 THEN 'W'
    WHEN wm.az_deg >= 292.5 AND wm.az_deg < 337.5 THEN 'NW'
    ELSE NULL
  END AS direction,
  -- CRITICAL: Must return coordinates
  wm.lat,
  wm.lng
FROM with_metrics wm
WHERE
  wm.on_site
  OR wm.within_50m
  OR wm.within_100m
  OR wm.within_250m
  OR wm.within_500m
  OR wm.within_1km
  OR wm.within_3km
  OR wm.within_5km
ORDER BY wm.on_site DESC, wm.dist_m ASC;

$$ LANGUAGE sql STABLE;
```

### 1.2 Create Composite Analysis Function

**Location**: `backend/sql/create_analysis_functions.sql`

```sql
-- Add to create_analysis_functions.sql
CREATE OR REPLACE FUNCTION analyze_site_your_layer(polygon_geojson TEXT)
RETURNS JSON AS $$
DECLARE
  your_layer_result JSON;
  combined_result JSON;
BEGIN
  -- Get your layer analysis
  SELECT json_agg(row_to_json(t)) INTO your_layer_result
  FROM (
    SELECT * FROM analyze_your_layer(polygon_geojson)
  ) t;

  -- Build result object
  SELECT json_build_object(
    'your_layer_items', COALESCE(your_layer_result, '[]'::json)
  ) INTO combined_result;

  RETURN combined_result;
END;
$$ LANGUAGE plpgsql STABLE;
```

### 1.3 Deploy SQL Functions

```bash
# Deploy functions to database
npm run deploy-functions
```

**Important**: If changing function signature, you must drop first:
```sql
-- Add to top of your SQL file
DROP FUNCTION IF EXISTS analyze_your_layer(TEXT);
```

---

## Step 2: Backend API Integration

### 2.1 Add Query Builder

**Location**: `backend/src/queries.js`

```javascript
// Add to queries.js
export function buildYourLayerAnalysisQuery(geojsonPolygon) {
  const text = `SELECT analyze_site_your_layer($1) as analysis_result;`;
  const values = [JSON.stringify(geojsonPolygon)];
  return { text, values };
}
```

### 2.2 Add API Endpoint

**Location**: `backend/src/server.js`

```javascript
// Add to server.js
app.post('/analyze/your-layer', async (req, res) => {
  try {
    const { polygon } = req.body;
    if (!polygon) {
      return res.status(400).json({ error: 'polygon is required (GeoJSON Polygon or MultiPolygon)' });
    }

    const { text, values } = buildYourLayerAnalysisQuery(polygon);
    const result = await pool.query(text, values);

    // Extract the JSON result from the PostgreSQL function
    const analysisResult = result.rows[0]?.analysis_result || {};

    // Debug: log data to verify data flow
    try {
      const itemsArr = Array.isArray(analysisResult.your_layer_items) ? analysisResult.your_layer_items : [];
      console.log('[YourLayer] count:', itemsArr.length, 'on_site:', itemsArr.filter(r => r?.on_site).length);
    } catch {}

    // Compute rules and overall risk on the server
    const rulesAssessment = processYourLayerRules(analysisResult);

    // Build enriched response for the frontend
    const response = {
      your_layer_items: analysisResult.your_layer_items || [],
      rules: rulesAssessment.rules || [],
      overallRisk: rulesAssessment.overallRisk || null,
      metadata: {
        generatedAt: new Date().toISOString(),
        dataSource: 'Your Data Source Q1 2025',
        analysisType: 'your-layer-analysis',
        totalRulesProcessed: rulesAssessment.metadata?.totalRulesProcessed || 0,
        rulesTriggered: (rulesAssessment.rules || []).length,
        rulesVersion: rulesAssessment.metadata?.rulesVersion || 'your-layer-rules-v1'
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Your layer analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Step 3: Frontend API Service

### 3.1 Add API Function

**Location**: `frontend/src/lib/services/api.js`

```javascript
// Add to api.js
export async function analyzeYourLayer(/** @type {any} */ polygonGeoJSON) {
  const res = await fetch(`${BASE_URL}/analyze/your-layer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon: polygonGeoJSON })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Your layer analysis failed: ${res.status} ${text}`);
  }
  return res.json();
}
```

---

## Step 4: Frontend Data Processing

### 4.1 Create Data Processor

**Location**: `frontend/src/lib/utils/dataProcessor.js`

```javascript
// Add to dataProcessor.js

/**
 * Convert your layer data to include geometry for map display
 * @param {any[]} items - Raw your layer data
 * @returns {any[]} - Items with geometry objects
 */
export function processYourLayerData(items) {
  return (items || [])
    .filter(item => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lng);
      const isValid = !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
      if (!isValid) {
        console.log('⚠️ Filtering out item with invalid coordinates:', item.name, 'lat:', item.lat, 'lng:', item.lng);
      }
      return isValid;
    })
    .map(item => ({
      ...item,
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(item.lng), parseFloat(item.lat)]
      }
    }));
}
```

### 4.2 Create Risk Assessment Function

**Location**: `frontend/src/lib/utils/mapRiskAssessment.js`

```javascript
// Add to mapRiskAssessment.js

/**
 * Determine risk level for your layer based on status and proximity
 * Mirrors the logic from backend/src/rules/your-layer/yourLayerRulesRich.js
 * @param {any} item
 */
export function getYourLayerRiskLevel(item) {
  const {
    status,
    category,
    on_site, within_50m, within_100m, within_250m,
    within_500m, within_1km, within_3km, within_5km
  } = item;

  // Mirror the exact logic from backend rules
  if (status === 'Rejected' || status === 'Withdrawn') {
    if (within_5km) return RISK_LEVELS.LOW_RISK;
  } else if (status === 'Proposed' || status === 'Under Review') {
    if (on_site || within_50m || within_100m || within_250m) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (within_500m || within_1km) return RISK_LEVELS.HIGH_RISK;
    if (within_3km) return RISK_LEVELS.MEDIUM_RISK;
    if (within_5km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  } else if (status === 'Active' || status === 'Operational') {
    if (on_site || within_50m || within_100m || within_250m) return RISK_LEVELS.SHOWSTOPPER;
    if (within_500m || within_1km) return RISK_LEVELS.EXTREMELY_HIGH_RISK;
    if (within_3km) return RISK_LEVELS.MEDIUM_HIGH_RISK;
    if (within_5km) return RISK_LEVELS.MEDIUM_LOW_RISK;
  }

  return RISK_LEVELS.LOW_RISK; // Default fallback
}
```

### 4.3 Create Layer Factory Function

**Location**: `frontend/src/lib/utils/layerFactory.js`

```javascript
// Add to layerFactory.js

/**
 * Create a Leaflet layer for your layer items
 * @param {import('leaflet')} L - Leaflet instance
 * @returns {import('leaflet').GeoJSON} Configured layer
 */
export function createYourLayerLayer(L) {
  return L.geoJSON(null, {
    pointToLayer: function (feature, latlng) {
      const props = feature.properties;

      // Customize styling based on your layer properties
      let color = '#10b981'; // Default green
      let radius = 8;

      // Example: Color by status
      if (props.status === 'Active') color = '#dc2626'; // Red
      if (props.status === 'Proposed') color = '#f59e0b'; // Orange
      if (props.status === 'Under Review') color = '#3b82f6'; // Blue

      // Example: Size by category
      if (props.category === 'Large') radius = 12;
      if (props.category === 'Medium') radius = 8;
      if (props.category === 'Small') radius = 6;

      return L.circleMarker(latlng, {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });
    },
    onEachFeature: function (feature, layer) {
      const props = feature.properties;

      // Create popup with relevant information
      const popupContent = `
        <div class="popup-content">
          <h3>${props.name || 'Unknown'}</h3>
          <p><strong>Status:</strong> ${props.status || 'N/A'}</p>
          <p><strong>Category:</strong> ${props.category || 'N/A'}</p>
          <p><strong>Distance:</strong> ${props.dist_m ? props.dist_m + 'm' : 'On site'}</p>
          <p><strong>Risk Level:</strong> <span class="risk-${props.riskLevel}">${props.riskLevel?.replace('_', ' ') || 'Unknown'}</span></p>
        </div>
      `;

      layer.bindPopup(popupContent);
    }
  });
}
```

---

## Step 5: Dashboard Integration

### 5.1 Add to Dashboard Analysis

**Location**: `frontend/src/lib/components/Dashboard.svelte`

```javascript
// Add import
import { analyzeYourLayer } from '$lib/services/api.js';

// Add state variable
/** @type {Record<string, any> | null} */
let yourLayerResult = null;

// Add to handlePolygonDrawn function
async function handlePolygonDrawn(geometry) {
  console.log('🎯 Polygon drawn, starting analysis...', geometry);
  errorMsg = '';
  heritageResult = null;
  landscapeResult = null;
  agLandResult = null;
  renewablesResult = null;
  ecologyResult = null;
  yourLayerResult = null; // Add this line
  loading = true;

  try {
    console.log('🚀 Starting analysis requests...');
    // Add your layer to Promise.all
    const [heritageData, landscapeData, agLandData, renewablesData, ecologyData, yourLayerData] = await Promise.all([
      analyzeHeritage(geometry).then(data => { console.log('✅ Heritage analysis complete'); return data; }),
      analyzeLandscape(geometry).then(data => { console.log('✅ Landscape analysis complete'); return data; }),
      analyzeAgLand(geometry).then(data => { console.log('✅ AgLand analysis complete'); return data; }),
      analyzeRenewables(geometry).then(data => { console.log('✅ Renewables analysis complete'); return data; }),
      analyzeEcology(geometry).then(data => { console.log('✅ Ecology analysis complete'); return data; }),
      analyzeYourLayer(geometry).then(data => { console.log('✅ Your layer analysis complete'); return data; }) // Add this line
    ]);
    console.log('🎉 All analyses complete!');

    // Add debug logging
    console.log('📊 Your layer structure details:', yourLayerData);
    if (yourLayerData && yourLayerData.your_layer_items) {
      console.log('🔍 First your layer item:', yourLayerData.your_layer_items[0]);
      console.log('🔍 Your layer item keys:', Object.keys(yourLayerData.your_layer_items[0] || {}));
    }

    // Set results
    heritageResult = heritageData;
    landscapeResult = landscapeData;
    agLandResult = agLandData;
    renewablesResult = renewablesData;
    ecologyResult = ecologyData;
    yourLayerResult = yourLayerData; // Add this line
  } catch (/** @type {any} */ err) {
    errorMsg = err?.message || String(err);
  } finally {
    loading = false;
  }
}

// Pass to MapPanel
<MapPanel
  onPolygonDrawn={handlePolygonDrawn}
  {loading}
  heritageData={heritageResult}
  landscapeData={landscapeResult}
  renewablesData={renewablesResult}
  yourLayerData={yourLayerResult}
/>
```

---

## Step 6: Map Component Integration

### 6.1 Add to MapPanel

**Location**: `frontend/src/lib/components/MapPanel.svelte`

```javascript
// Add prop
/** @type {Record<string, any> | null} */
export let yourLayerData = null;

// Pass to Map component
<Map {onPolygonDrawn} {heritageData} {landscapeData} {renewablesData} {yourLayerData} />
```

### 6.2 Integrate into Map Component

**Location**: `frontend/src/lib/components/Map.svelte`

```javascript
// Add imports
import { createYourLayerLayer } from '../utils/layerFactory.js';
import { processYourLayerData } from '../utils/dataProcessor.js';
import { getYourLayerRiskLevel } from '../utils/mapRiskAssessment.js';

// Add prop
/** @type {Record<string, any> | null} */
export let yourLayerData = null;

// Add debug logging
$: console.log('🔍 Map received yourLayerData:', yourLayerData);

// Add layer variable
/** @type {import('leaflet').GeoJSON | null} */
let yourLayerLayer = null;

// Create layer in onMount
onMount(async () => {
  // ... existing code ...

  // Create all layers using factory functions
  conservationAreasLayer = createConservationAreasLayer(L);
  listedBuildingsGradeILayer = createListedBuildingsLayer(L, 'I');
  // ... other layers ...
  yourLayerLayer = createYourLayerLayer(L); // Add this line

  // ... rest of onMount ...
});

// Add reactive data processing
$: if (yourLayerData?.your_layer_items) {
  console.log('📊 Your layer data received:', yourLayerData.your_layer_items);
  console.log('📊 Your layer count:', yourLayerData.your_layer_items.length);
  console.log('🔍 First your layer item structure:', yourLayerData.your_layer_items[0]);

  const itemsWithGeometry = processYourLayerData(yourLayerData.your_layer_items);

  console.log('🔧 Converted your layer with geometry:', itemsWithGeometry.length > 0 ? itemsWithGeometry[0] : 'No data');

  if (yourLayerLayer) {
    setLayerData(yourLayerLayer, itemsWithGeometry, (r) => ({
      name: r.name,
      status: r.status,
      category: r.category,
      riskLevel: getYourLayerRiskLevel(r)
    }), true, riskFilters);
  }
}

// CRITICAL: Add to updateLayerVisibility function
function updateLayerVisibility() {
  if (!conservationAreasLayer || !listedBuildingsGradeILayer || !listedBuildingsGradeIIStarLayer ||
      !listedBuildingsGradeIILayer || !scheduledMonumentsLayer) return;

  console.log('🔄 Updating layer visibility...');

  // ... existing layers ...

  // CRITICAL: Add your layer here or risk filtering won't work
  if (yourLayerData?.your_layer_items) {
    const itemsWithGeometry = processYourLayerData(yourLayerData.your_layer_items);
    setLayerData(yourLayerLayer, itemsWithGeometry, (r) => ({
      name: r.name,
      status: r.status,
      category: r.category,
      riskLevel: getYourLayerRiskLevel(r)
    }), true, riskFilters);
  }
}

// Pass layer to MapControls
<MapControls
  bind:this={mapControls}
  {map}
  {riskFilters}
  onRiskFilterChange={updateLayerVisibility}
  {conservationAreasLayer}
  {listedBuildingsGradeILayer}
  {listedBuildingsGradeIIStarLayer}
  {listedBuildingsGradeIILayer}
  {scheduledMonumentsLayer}
  {greenBeltLayer}
  {aonbLayer}
  {renewablesLayer}
  {yourLayerLayer}
/>
```

---

## Step 7: Map Controls Integration

### 7.1 Add to MapControls

**Location**: `frontend/src/lib/components/MapControls.svelte`

```javascript
// Add prop
export let yourLayerLayer = null;

// Add to createLayerControl function
export function createLayerControl(L, base) {
  if (!map) return;

  layerControl = L.control.layers(
    { 'OSM': base },
    {
      // ... existing layers ...
      '<span style="display: inline-flex; align-items: center;"><span style="display: inline-block; width: 12px; height: 12px; background: #10b981; border-radius: 50%; margin-right: 8px;"></span>Your Layer</span>': yourLayerLayer
    },
    { collapsed: false }
  ).addTo(map);
}
```

---

## Step 8: Testing Checklist

### Backend Testing
- [ ] SQL function returns expected data structure
- [ ] Function includes lat/lng coordinates
- [ ] API endpoint responds correctly
- [ ] Backend logs show correct data counts

### Frontend Testing
- [ ] Data flows through Dashboard → MapPanel → Map
- [ ] Debug logs show correct data structure
- [ ] Coordinates are valid (no NaN errors)
- [ ] Layer appears on map after analysis

### Risk Filtering Testing
- [ ] Risk levels calculated correctly
- [ ] Layer respects initial risk filter settings
- [ ] Unchecking all risk filters hides all items
- [ ] Individual risk level toggles work correctly
- [ ] Layer updates when risk filters change

### Map Integration Testing
- [ ] Layer appears in layer control
- [ ] Layer can be toggled on/off
- [ ] Popups display correct information
- [ ] Styling matches design requirements

---

## Common Issues & Solutions

### "Invalid LatLng (NaN, NaN)" Error
**Cause**: SQL function not returning lat/lng or invalid coordinates
**Solution**: Ensure SQL includes coordinate extraction and validate in data processor

### Risk Filtering Not Working
**Cause**: Layer missing from `updateLayerVisibility()` function
**Solution**: Add layer processing to both reactive statement AND `updateLayerVisibility()`

### Layer Not Appearing
**Cause**: Layer not created or not added to layer control
**Solution**: Verify layer creation in `onMount()` and addition to `createLayerControl()`

### "Cannot change return type" SQL Error
**Cause**: Changing function signature without dropping first
**Solution**: Add `DROP FUNCTION IF EXISTS function_name(TEXT);` before CREATE

### Data Not Updating on Filter Change
**Cause**: Layer missing from `updateLayerVisibility()` function
**Solution**: Always include new layers in BOTH places where `setLayerData()` is called

---

## File Checklist

When implementing a new layer, you should modify these files:

### Backend
- [ ] `backend/sql/[domain]_analysis/analyze_[layer].sql`
- [ ] `backend/sql/create_analysis_functions.sql`
- [ ] `backend/src/queries.js`
- [ ] `backend/src/server.js`

### Frontend
- [ ] `frontend/src/lib/services/api.js`
- [ ] `frontend/src/lib/utils/dataProcessor.js`
- [ ] `frontend/src/lib/utils/mapRiskAssessment.js`
- [ ] `frontend/src/lib/utils/layerFactory.js`
- [ ] `frontend/src/lib/components/Dashboard.svelte`
- [ ] `frontend/src/lib/components/MapPanel.svelte`
- [ ] `frontend/src/lib/components/Map.svelte`
- [ ] `frontend/src/lib/components/MapControls.svelte`

Following this guide ensures your new layer will integrate seamlessly with the existing map visualization and risk filtering system.