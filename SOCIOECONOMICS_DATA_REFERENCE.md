# Socioeconomics Data Reference

Tables to update when new data is available. All tables live in the `Socioeconomics` schema.

---

## Charts and their backing tables

### Unemployment Rate (line chart)
**Component:** `frontend/src/lib/components/socioeconomics/socioeconomics-charts/UnemploymentRate.svelte`

| Table | Join key | Geographies |
|---|---|---|
| `countries_unemployment_timeseries` | `ctry24cd` | 4 rows |
| `regions_unemployment_timeseries` | `rgn24cd` | 9 rows |
| `lad25_unemployment_timeseries` | `lad23cd` | 361 rows |

Key columns: `jul19_20_uep`, `jul20_21_uep`, `jul21_jun22_uep`, `jul22_jun23_uep`, `jul23_jun24_uep`, `jul24_jun25_uep`

---

### BRES Table (employment by industry)
**Component:** `frontend/src/lib/components/socioeconomics/socioeconomics-charts/BREStable.svelte`

| Table | Join key | Geographies |
|---|---|---|
| `countries_bres` | `ctry24cd` | 4 rows |
| `regions_bres` | `rgn24cd` | 9 rows |
| `lad25_bres` | `lad23cd` | 361 rows |

Key columns: `a_number`, `a_pct` … `s_number`, `s_pct`, `bres_total` (one pair per SIC section A–S)

---

### Economic Inactivity Table
**Component:** `frontend/src/lib/components/socioeconomics/socioeconomics-charts/EconomicInactivityTable.svelte`

| Table | Join key | Geographies | Used in frontend? |
|---|---|---|---|
| `countries_economic_inactivity` | `ctry24cd` | 4 rows | No (joined but not displayed) |
| `regions_economic_inactivity` | `rgn24cd` | 9 rows | Yes |
| `lad25_economic_inactivity` | `lad23cd` | 361 rows | No (joined but not displayed) |

Key columns: `apeirt_no/p`, `apeirs_no/p`, `apeirf_no/p`, `apeirts_no/p`, `apeirlt_no/p`, `apeird_no/p`, `apeirt_no_2/p_2`, `apeirt_no_3/p_3`

---

## How the joins work

The spatial anchor tables (`Countries`, `Regions`, `LAD25`) are joined to the subject tables at query time in `backend/src/socioeconomicsQueries.js`. No data lives directly on the spatial tables for these three charts.

```
"Socioeconomics"."Regions"  →  LEFT JOIN  regions_unemployment_timeseries  ON rgn24cd
                             →  LEFT JOIN  regions_economic_inactivity      ON rgn24cd
                             →  LEFT JOIN  regions_bres                     ON rgn24cd
```

---

## Updating data

To update with a new release:

1. Truncate the relevant subject table(s):
   ```sql
   TRUNCATE "Socioeconomics".regions_unemployment_timeseries;
   ```
2. Re-import from the new source CSV/spreadsheet
3. Ensure the join key column (`ctry24cd` / `rgn24cd` / `lad23cd`) matches the codes in the spatial anchor table exactly (case-sensitive)

---

## Other charts (old system — SELECT * from spatial table)

These charts still read columns embedded directly in the spatial tables. No subject table joins involved.

| Chart | Spatial table used |
|---|---|
| Census Pop / Working Age | `LAD11`, `LAD25` |
| Cars & Vans per Household | `LAD25`, `Regions`, `Countries` |
| Highest Qualification | `LAD25`, `Regions`, `Countries` |
| General Health | `LAD25`, `Regions`, `Countries` |
| Occupation | `LAD25`, `Regions`, `Countries` |
| Method of Travel | `LAD25`, `Regions`, `Countries` |

To update data for these, the columns on the spatial tables themselves would need refreshing.
