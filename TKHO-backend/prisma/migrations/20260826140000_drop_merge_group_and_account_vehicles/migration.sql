-- merge_group was never used by display APIs (merge screen lists all merge venues by id).
ALTER TABLE "display_venue_rules" DROP COLUMN IF EXISTS "merge_group";

-- Legacy table; account vehicle CRUD uses license_plates exclusively.
DROP TABLE IF EXISTS "account_vehicles";
