ALTER TABLE "user" ADD COLUMN "inactived_by" TEXT;

COMMENT ON COLUMN "user"."inactived_by" IS '禁用操作者：管理员手动禁用时为操作人显示名；系统按未登录月数自动禁用时为 “by System”。';
