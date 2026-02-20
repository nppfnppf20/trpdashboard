# Planning Template Placeholder Mappings

This document shows how template placeholders are mapped to project table fields.

## Current Placeholder Mappings

### Fields Mapped from Projects Table

These placeholders are automatically filled from the `projects` table:

| Template Placeholder | Database Field | Example Value | Notes |
|---------------------|----------------|---------------|-------|
| `«Project_name_name_only__eg_dont_inc»` | `project_name` | "Greenfield" | Automatically strips "Solar Farm" suffix |
| `«Site_address_including_postcode»` | `address` | "Field Lane, Wiltshire, SN1 2AB" | Full site address |
| `«Client_or_SPV_name_»` | `client_spv_name` or `client` | "Greenfield Energy Ltd" | SPV name takes priority, falls back to client |
| `«Local_planning_authority»` | `local_planning_authority` | "Wiltshire Council" | Extracted from JSONB array |
| `«LPA_abbreviation»` | `local_planning_authority` | "Wiltshire Council" | Same as full LPA for now |
| `«Detailed_Description_of_Development_»` | `project_type` | "Solar farm development" | Auto-generated from project type |

### Legacy Placeholders ({{format}})

These are also supported for backward compatibility:

| Template Placeholder | Database Field | Notes |
|---------------------|----------------|-------|
| `{{project_name}}` | `project_name` | Full project name |
| `{{client}}` | `client` | Client name |
| `{{address}}` | `address` | Site address |
| `{{local_planning_authority}}` | `local_planning_authority` | LPA name |
| `{{current_date}}` | Auto-generated | Current date in "1 January 2026" format |

### Technical Placeholders (Not Yet Mapped)

These placeholders remain as `xx` in the merged template and will be filled from another data source later:

| Template Placeholder | Current Value | Future Source |
|---------------------|---------------|---------------|
| `«Approximate__export_capacity_MW»` | `xx` | To be determined |
| `«GWh_per_year»` | `xx` | To be determined |
| `«Homes_powered_per_year»` | `xx` | To be determined |
| `«Tonnes_of_CO2_offset_per_year_»` | `xx` | To be determined |
| `«Proposed_use_duration_years»` | `xx` | To be determined |
| `«Use_duration__1_year_construction_and_1»` | `xx` | To be determined |
| `«PV_max_panel_height_m»` | `xx` | To be determined |

**Note:** These technical fields will remain as `xx` placeholders. Users can manually edit them in the rich text editor, or they will be populated automatically when the technical data source is integrated in the future.

## Template Merge Process

1. User selects a project
2. User selects a template
3. System calls `mergeTemplateWithProject(template, projectData)`
4. Basic project placeholders are replaced with actual values from the `projects` table
5. Technical placeholders remain as `xx` for manual editing
6. Result is loaded into rich text editor for user customization
7. User can edit and save as deliverable

## Example Merge

**Template:**
```
«Project_name_name_only__eg_dont_inc» Solar Farm
«Site_address_including_postcode»

The proposed solar farm will have a capacity of «Approximate__export_capacity_MW»MW.
This will generate approximately «GWh_per_year» GWh per year, enough to power 
«Homes_powered_per_year» homes.
```

**After Merge (with current project data):**
```
Greenfield Solar Farm
Field Lane, Wiltshire, SN1 2AB

The proposed solar farm will have a capacity of xxMW.
This will generate approximately xx GWh per year, enough to power 
xx homes.
```

Users can then edit the `xx` values manually in the rich text editor.

## Placeholder Fallback Values

If a field is not filled in the database, the placeholder will show:
- Mapped fields: `N/A` - indicates not applicable/not filled
- Technical fields: `xx` - indicates user needs to fill this in manually

## Adding New Project Fields (Currently Supported)

To update existing project data that maps to templates:

```sql
UPDATE projects 
SET 
  client = 'Greenfield Energy Ltd',
  client_spv_name = 'Greenfield Solar SPV Ltd',
  address = 'Field Lane, Wiltshire, SN1 2AB',
  local_planning_authority = '["Wiltshire Council"]',
  project_type = 'Solar farm'
WHERE project_id = 'YOUR_PROJECT_ID';
```

## Future Integration

When technical solar data becomes available from another source:
1. Update the `buildPlaceholderMap()` function in `backend/src/services/templateMerge.service.js`
2. Change the `xx` placeholders to pull from the new data source
3. The merge will then automatically populate these fields

