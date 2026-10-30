-- 用户按自然年的额度上限覆盖（已用次数仍由预订表按 booking_date 年实时统计）
CREATE TABLE IF NOT EXISTS "user_yearly_quotas" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" BIGINT NOT NULL,
  "year" INTEGER NOT NULL,
  "annual_quota_ev" INTEGER,
  "annual_quota_venue" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_yearly_quotas_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_yearly_quotas_user_year"
  ON "user_yearly_quotas" ("user_id", "year");

CREATE INDEX IF NOT EXISTS "idx_user_yearly_quotas_year"
  ON "user_yearly_quotas" ("year");

-- 加速按用户+年统计 EV / Venue 已用
CREATE INDEX IF NOT EXISTS "idx_ev_bookings_date_status"
  ON "ev_bookings" ("booking_date", "status");

CREATE INDEX IF NOT EXISTS "idx_venue_bookings_reserved_by_date"
  ON "venue_bookings" ("reserved_by", "booking_date");
