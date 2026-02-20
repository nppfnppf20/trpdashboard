# Database Tables Reference

This file lists all available tables in the HLPV planning database with detailed column information for reference when adding new analysis layers.

**Note: This is a reference file only - not functional code**

## Heritage Assets

### `listed_building` (MultiPoint, SRID: 27700) - ✅ Currently implemented
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry  
- ListEntry (integer) - Historic England list entry number
- Name (character varying) - Building name
- Grade (character varying) - Listed building grade (I, II*, II)
- ListDate (timestamp) - Date listed
- AmendDate (timestamp) - Last amendment date
- CaptureScale (character varying) - Data capture scale
- Easting (double precision) - British National Grid easting
- Northing (double precision) - British National Grid northing

### `conservation_area` (MultiPolygon, SRID: 27700) - ✅ Currently implemented  
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry
- UID (double precision) - Unique ID
- NAME (character varying) - Conservation area name
- DATE_OF_DE (character varying) - Date of designation
- DATE_UPDAT (character varying) - Last update date
- LPA (character varying) - Local Planning Authority
- CAPTURE_SC (character varying) - Capture scale
- x (integer) - X coordinate
- y (integer) - Y coordinate

### `Scheduled monuments ` (Point, SRID: 27700) - Available for implementation
- fid (bigint) - Feature ID
- geom (geometry) - Spatial geometry
- OBJECTID (integer) - Object identifier
- List entry number (integer) - Historic England list entry
- Name (character varying) - Monument name
- Schedule date (character varying) - Date scheduled
- Amendment date (character varying) - Last amendment
- Capture scale (character varying) - Data capture scale
- NHLE link (character varying) - National Heritage List link
- Area (ha) (double precision) - Area in hectares
- National Grid Reference (character varying) - Grid reference
- Easting (integer) - British National Grid easting
- Northing (integer) - British National Grid northing

## Landscape Designations

### `AONB` (MultiPolygon, SRID: 27700) - ✅ Currently implemented
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry
- CODE (character varying) - AONB code
- NAME (character varying) - AONB name
- DESIG_DATE (character varying) - Designation date
- HOTLINK (character varying) - Reference link
- STAT_AREA (double precision) - Statutory area
- GlobalID (character varying) - Global identifier

### `Green_belt` (MultiPolygon, SRID: 27700) - ✅ Currently implemented
- fid (bigint) - Feature ID
- geom (geometry) - Spatial geometry
- dataset (character varying) - Dataset name
- end-date (character varying) - End date
- entity (character varying) - Entity reference
- entry-date (date) - Entry date
- name (character varying) - Green Belt name
- organisation-entity (character varying) - Organisation
- prefix (character varying) - Reference prefix
- reference (character varying) - Reference number
- start-date (character varying) - Start date
- typology (character varying) - Green Belt typology
- green-belt-core (character varying) - Core designation
- local-authority-district (character varying) - Local authority

### `National parks England` (MultiPolygon, SRID: 27700) - Available for implementation
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry
- CODE (integer) - National Park code
- NAME (character varying) - National Park name
- MEASURE (double precision) - Area measurement
- DESIG_DATE (timestamp) - Designation date
- HOTLINK (character varying) - Reference link
- STATUS (character varying) - Current status

## Environmental/Ecological Designations

### `SSSI` (MultiPolygon, SRID: 27700) - Available for implementation
- id (integer) - Primary key
- geom (geometry) - Spatial geometry
- fid (bigint) - Feature ID
- OBJECTID (integer) - Object identifier
- REF_CODE (character varying) - Reference code
- NAME (character varying) - SSSI name
- MEASURE (double precision) - Area measurement
- LABEL (character varying) - Display label
- HYPERLINK (character varying) - Reference link
- CONTACT_NO (character varying) - Contact number
- GlobalID (character varying) - Global identifier

### `Ramsar` (Polygon, SRID: 27700) - Available for implementation
- fid (bigint) - Feature ID
- geom (geometry) - Spatial geometry
- OBJECTID (integer) - Object identifier
- NAME (character varying) - Ramsar site name
- CODE (character varying) - Site code
- AREA (double precision) - Area measurement
- GRID_REF (character varying) - Grid reference
- EASTING (double precision) - Easting coordinate
- NORTHING (double precision) - Northing coordinate
- LATITUDE (character varying) - Latitude
- LONGITUDE (character varying) - Longitude
- STATUS (character varying) - Current status
- [Additional metadata fields...]

### `Local nature reserves England` (MultiPolygon, SRID: 27700) - Available for implementation
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry
- REF_CODE (character varying) - Reference code
- NAME (character varying) - Reserve name
- MEASURE (double precision) - Area measurement
- LABEL (character varying) - Display label
- GlobalID (character varying) - Global identifier

### `National nature reserves England` (MultiPolygon, SRID: 27700) - Available for implementation
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry
- REF_CODE (character varying) - Reference code
- NAME (character varying) - Reserve name
- MEASURE (double precision) - Area measurement
- LABEL (character varying) - Display label
- GlobalID (character varying) - Global identifier

### `Ancient woodland` (MultiPolygon, SRID: 27700) - Available for implementation
- OBJECTID (bigint) - Unique identifier
- geom (geometry) - Spatial geometry
- NAME (character varying) - Woodland name
- THEME (character varying) - Theme classification
- THEMNAME (character varying) - Theme name
- THEMID (double precision) - Theme ID
- STATUS (character varying) - Current status
- PERIMETER (double precision) - Perimeter length
- AREA (double precision) - Area measurement
- X_COORD (integer) - X coordinate
- Y_COORD (integer) - Y coordinate
- GlobalID (character varying) - Global identifier

## Species/Biodiversity Data

### `GCN_Class_Survey_Licence_Returns_England` (Point, SRID: 27700) - Great Crested Newt data
- OBJECTID_1 (bigint) - Primary object ID
- geom (geometry) - Spatial geometry
- OBJECTID (integer) - Object identifier
- GCN_Presen (character varying) - GCN presence status
- Survey_Dat (timestamp) - Survey date
- OS_Grid_Re (character varying) - OS grid reference
- X (integer) - X coordinate
- Y (integer) - Y coordinate
- GlobalID (character varying) - Global identifier

## Agricultural Land

### `provisional_alc` (MultiPolygon, SRID: 27700) - Agricultural Land Classification
- fid (bigint) - Feature ID
- geom (geometry) - Spatial geometry
- dataset (character varying) - Dataset name
- end-date (character varying) - End date
- entity (character varying) - Entity reference
- entry-date (date) - Entry date
- name (character varying) - ALC area name
- organisation-entity (character varying) - Organisation
- prefix (character varying) - Reference prefix
- reference (character varying) - Reference number
- start-date (character varying) - Start date
- typology (character varying) - Classification typology
- agricultural-land-classification-grade (character varying) - ALC grade (1, 2, 3a, 3b, 4, 5)

## Infrastructure

### `Renewable Energy developments Q1 2025` (Point, SRID: 27700) - Renewable energy projects
- id (integer) - Primary key
- geom (geometry) - Spatial geometry
- Ref ID (integer) - Reference ID
- Record Last Updated (timestamp) - Last update
- Operator (character varying) - Project operator
- Site Name (character varying) - Site name
- Technology Type (character varying) - Technology type (Solar, Wind, etc.)
- Installed Capacity (MWelec) (character varying) - Capacity
- Development Status (character varying) - Current status
- Address (character varying) - Site address
- County (character varying) - County
- Region (character varying) - Region
- Planning Authority (character varying) - Planning authority
- Planning Application Reference (character varying) - Planning ref
- X-coordinate (double precision) - X coordinate
- Y-coordinate (double precision) - Y coordinate
- [Many additional project-specific fields...]

### `Substations` (Point, SRID: 27700) - Electrical substations
- id (integer) - Primary key
- geom (geometry) - Spatial geometry
- SUBST_ID (integer) - Substation ID
- COMPANY_ID (character varying) - Company identifier
- SUBST_NAME (character varying) - Substation name
- COMPANY (character varying) - Operating company
- REGIONAL_SERVICE_AREA (character varying) - Service area
- ASSET_TYPE (character varying) - Asset type
- VOLTAGE_HIGH (integer) - High voltage level
- VOLTAGE_LOW (integer) - Low voltage level
- CONSTRAINT STATUS (character varying) - Constraint status
- EASTING (integer) - Easting coordinate
- NORTHING (integer) - Northing coordinate

---

## Implementation Status

### ✅ Currently Implemented
- **Heritage Domain**: Listed Buildings, Conservation Areas
- **Landscape Domain**: Green Belt, AONB

### 🎯 High Priority for Implementation
- **Scheduled Monuments** - Critical heritage constraint (Point geometry)
- **SSSI** - Key environmental designation (MultiPolygon)
- **National Parks** - Major landscape constraint (MultiPolygon)
- **Ancient Woodland** - Irreplaceable habitat (MultiPolygon)

### 📋 Future Domains to Consider
- **Agricultural**: ALC grades (food security constraints)
- **Ecological**: Species records, nature reserves
- **Infrastructure**: Renewable energy, substations (capacity constraints)

---

## Key Field Notes

### Common Identifier Fields
- Most tables have `OBJECTID` or `fid` as primary keys
- `NAME` field is standard across most tables
- `geom` is the spatial geometry column (USER-DEFINED type)

### Spatial References
- All main tables use British National Grid (SRID: 27700)
- Some boundary tables use WGS84 (SRID: 4326)

### Important Fields for Analysis
- **Heritage**: `Grade` (for risk weighting), `ListEntry` (for identification)
- **Environmental**: `REF_CODE`, `STATUS` (for designation status)
- **Agricultural**: `agricultural-land-classification-grade` (1-5 scale)
- **Infrastructure**: `VOLTAGE_HIGH/LOW` (for constraint analysis)

### Data Quality Notes
- Tables with spaces in names need quotes: `"Ancient woodland"`
- Some date fields are character varying, others are timestamps
- GlobalID fields provide cross-dataset linkage where available

Generated: September 10, 2025