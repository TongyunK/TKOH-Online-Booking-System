ALTER TABLE "user" ADD COLUMN "inactive_time" TIMESTAMPTZ(6);

COMMENT ON COLUMN "user"."inactive_time" IS '账号被禁用（Inactive）的时间；管理员手动禁用或系统自动禁用时写入。';
