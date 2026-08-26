-- Login uses corp_id only; account was a redundant duplicate.
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_account_key";
DROP INDEX IF EXISTS "user_account_key";
ALTER TABLE "user" DROP COLUMN IF EXISTS "account";
