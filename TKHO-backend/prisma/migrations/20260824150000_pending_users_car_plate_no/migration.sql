ALTER TABLE "pending_users" ADD COLUMN "car_plate_no" TEXT;

COMMENT ON COLUMN "pending_users"."car_plate_no" IS '注册申请时填写的车牌号（可选）；仅字母与数字，最多 8 位。';
