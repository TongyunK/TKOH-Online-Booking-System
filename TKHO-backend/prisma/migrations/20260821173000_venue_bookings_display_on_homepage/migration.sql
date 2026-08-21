-- RenameColumn
ALTER TABLE "venue_bookings" RENAME COLUMN "display_title_public" TO "display_on_homepage";

COMMENT ON COLUMN "venue_bookings"."display_on_homepage" IS '是否将会议标题上传到 TKOH 官网 Upcoming Events（Display on Homepage）';
