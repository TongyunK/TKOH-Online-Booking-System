-- Split user.name into first_name + last_name; add employee_no and rank.
-- Existing full name values are kept in last_name; first_name starts empty.

ALTER TABLE "user" RENAME COLUMN "name" TO "last_name";
ALTER TABLE "user" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "user" ADD COLUMN "employee_no" TEXT;
ALTER TABLE "user" ADD COLUMN "rank" TEXT;

ALTER TABLE "pending_users" RENAME COLUMN "name" TO "last_name";
ALTER TABLE "pending_users" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "pending_users" ADD COLUMN "employee_no" TEXT;
ALTER TABLE "pending_users" ADD COLUMN "rank" TEXT;
