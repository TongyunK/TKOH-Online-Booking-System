-- employee_count on departments is unused; Access Right UI counts users live.
ALTER TABLE "departments" DROP COLUMN IF EXISTS "employee_count";
