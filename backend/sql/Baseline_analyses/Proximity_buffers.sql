-- Central proximity summary function
-- SRID: 27700 (British National Grid)
-- Distances default: 0 (intersect), 20m, 100m, 250m, 500m, 1km, 3km, 5km

CREATE SCHEMA IF NOT EXISTS analysis;

CREATE OR REPLACE FUNCTION analysis.proximity_summary(
    aoi geometry,
    layer_view regclass,
    group_cols text[] DEFAULT ARRAY[]::text[],
    distances_m integer[] DEFAULT ARRAY[0,20,100,250,500,1000,3000,5000]
)
RETURNS TABLE (
    distance_m integer,
    group_key jsonb,
    feature_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    dist integer;
    json_expr text;
    group_by text;
    predicate text;
    sql text;
BEGIN
    -- Ensure AOI is in SRID 27700
    IF ST_SRID(aoi) IS DISTINCT FROM 27700 THEN
        aoi := ST_Transform(aoi, 27700);
    END IF;

    -- Build JSON expression and GROUP BY clause for dynamic grouping
    IF array_length(group_cols, 1) IS NULL THEN
        json_expr := '''{}''::jsonb';
        group_by := NULL;
    ELSE
        json_expr := 'jsonb_build_object(' ||
            array_to_string(
                ARRAY(
                    SELECT format('%L, %I', c, c)
                    FROM unnest(group_cols) AS c
                ),
                ', '
            ) || ')';
        group_by := array_to_string(
            ARRAY(
                SELECT format('%I', c)
                FROM unnest(group_cols) AS c
            ),
            ', '
        );
    END IF;

    -- Iterate over distances
    FOREACH dist IN ARRAY distances_m LOOP
        predicate := CASE WHEN dist = 0
            THEN 'ST_Intersects(t.geom, $1)'
            ELSE format('ST_DWithin(t.geom, $1, %s)', dist)
        END;

        IF group_by IS NULL THEN
            sql := format(
                'SELECT %s AS distance_m, %s AS group_key, count(*)::bigint AS feature_count FROM %s t WHERE %s',
                dist, json_expr, layer_view, predicate
            );
        ELSE
            sql := format(
                'SELECT %s AS distance_m, %s AS group_key, count(*)::bigint AS feature_count FROM %s t WHERE %s GROUP BY %s',
                dist, json_expr, layer_view, predicate, group_by
            );
        END IF;

        RETURN QUERY EXECUTE sql USING aoi;
    END LOOP;
END;
$$;


