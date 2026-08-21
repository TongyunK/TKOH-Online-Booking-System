-- AlterTable
ALTER TABLE "venue_bookings" ADD COLUMN "cancelled_by" BIGINT;

-- AddForeignKey
ALTER TABLE "venue_bookings" ADD CONSTRAINT "venue_bookings_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

COMMENT ON COLUMN "venue_bookings"."cancelled_by" IS '取消/释放操作人用户 ID，关联 user.id';
