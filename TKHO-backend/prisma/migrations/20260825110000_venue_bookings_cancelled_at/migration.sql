-- AlterTable
ALTER TABLE "venue_bookings" ADD COLUMN "cancelled_at" TIMESTAMPTZ(6);

COMMENT ON COLUMN "venue_bookings"."cancelled_at" IS '取消/释放时间。';
