-- Migration: Move High-Level Planning View to display_order 1
-- Kick-off Meeting moves to display_order 2
-- Uses a temporary value to avoid the UNIQUE(display_order) constraint during the swap

BEGIN;

-- Step 1: move HLPV out of the way temporarily
UPDATE admin_console.project_stage_definitions
SET display_order = 99
WHERE name = 'High-Level Planning View';

-- Step 2: Kick-off Meeting takes position 2
UPDATE admin_console.project_stage_definitions
SET display_order = 2
WHERE name = 'Kick-off Meeting';

-- Step 3: HLPV lands at position 1
UPDATE admin_console.project_stage_definitions
SET display_order = 1
WHERE name = 'High-Level Planning View';

COMMIT;
