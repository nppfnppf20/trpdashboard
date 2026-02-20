# PostgreSQL Functions for Heritage Analysis

This directory contains PostgreSQL functions for spatial heritage analysis.

## Functions Created

### 1. `analyze_listed_buildings(polygon_geojson TEXT)`
Analyzes listed buildings relative to a drawn polygon, returning:
- `id`: Building ID
- `name`: Building name
- `grade`: Heritage grade
- `dist_m`: Distance in meters
- `on_site`: Boolean indicating if building is within the polygon
- `direction`: Compass direction (N, NE, E, etc.)

### 2. `analyze_conservation_areas(polygon_geojson TEXT)`
Analyzes conservation areas relative to a drawn polygon, returning:
- `id`: Area ID
- `name`: Area name
- `dist_m`: Distance in meters
- `on_site`: Boolean indicating if area intersects the polygon
- `within_250m`: Boolean indicating if within 250m
- `direction`: Compass direction

### 3. `analyze_site_heritage(polygon_geojson TEXT)`
Combined analysis function that returns JSON with both listed buildings and conservation areas.

## Database Schema Requirements

The functions expect these tables with underscore naming:

### `listed_building`
- `objectid` (INTEGER): Unique identifier
- `name` (TEXT): Building name
- `grade` (TEXT): Heritage grade
- `easting` (NUMERIC): Easting coordinate (BNG)
- `northing` (NUMERIC): Northing coordinate (BNG)

### `conservation_area`
- `objectid` (INTEGER): Unique identifier
- `name` (TEXT): Area name
- `geom` (GEOMETRY): Polygon geometry

## Deployment

1. Ensure your `.env` file has the correct `DATABASE_URL`
2. Run the deployment script:
   ```bash
   npm run deploy-functions
   ```

Or manually execute the SQL:
```bash
psql $DATABASE_URL -f sql/create_analysis_functions.sql
```

## API Endpoints

After deployment, these endpoints will be available:

- `POST /analyze/heritage` - Combined heritage analysis
- `POST /analyze/listed-buildings` - Listed buildings only
- `POST /analyze/conservation-areas` - Conservation areas only

All endpoints expect:
```json
{
  "polygon": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ...]]
  }
}
```
