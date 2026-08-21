ALTER TABLE "venues"
  ADD COLUMN IF NOT EXISTS "user_defined_upload_event_title" BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN "venues"."user_defined_upload_event_title" IS '管理员开关：是否允许用户自行选择是否将会议标题投射到大屏/官网';
