-- Add Noise and Other to the surveyor disciplines lookup, which feeds the
-- discipline dropdown in the Add Quote modal (via /api/lookups/surveyor_disciplines).

INSERT INTO admin_console.surveyor_disciplines (discipline_name)
SELECT d.name
FROM (VALUES ('Noise'), ('Other')) AS d(name)
WHERE NOT EXISTS (
  SELECT 1 FROM admin_console.surveyor_disciplines sd
  WHERE sd.discipline_name = d.name
);
