-- READ ONLY. Run in Supabase SQL Editor to inspect overlapping/misclassified
-- location rows. No NPS tables or recipient records are accessed or changed.
WITH station_rows AS (
    SELECT upper(btrim(code)) AS code, to_jsonb(s) AS row_data
    FROM public.stations AS s
), branch_rows AS (
    SELECT upper(btrim(code)) AS code, to_jsonb(b) AS row_data
    FROM public.branches AS b
), confirmed_ind_branches(code) AS (
    VALUES ('AMD'), ('BLR'), ('BOM'), ('COK'), ('DEL')
)
SELECT
    coalesce(s.code, b.code) AS code,
    s.row_data ->> 'name' AS stations_name,
    b.row_data ->> 'name' AS branches_name,
    s.code IS NOT NULL AS appears_in_stations,
    b.code IS NOT NULL AS appears_in_branches,
    coalesce(b.row_data ->> 'company_code', b.row_data ->> 'parent_station_code',
             b.row_data ->> 'station_code', s.row_data ->> 'company_code',
             s.row_data ->> 'parent_station_code', s.row_data ->> 'station_code') AS stored_parent,
    CASE WHEN c.code IS NOT NULL THEN 'IND' END AS confirmed_parent,
    CASE WHEN c.code IS NOT NULL OR b.code IS NOT NULL THEN 'Branch'
         ELSE 'Inspect station metadata' END AS classification,
    s.row_data AS station_metadata,
    b.row_data AS branch_metadata
FROM station_rows AS s
FULL JOIN branch_rows AS b USING (code)
LEFT JOIN confirmed_ind_branches AS c ON c.code = coalesce(s.code, b.code)
ORDER BY coalesce(s.code, b.code);
