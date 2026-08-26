-- Role is assigned when admin approves; pending applications do not store access_role_id.
ALTER TABLE "pending_users" DROP CONSTRAINT IF EXISTS "pending_users_access_role_id_fkey";
ALTER TABLE "pending_users" DROP COLUMN IF EXISTS "access_role_id";
