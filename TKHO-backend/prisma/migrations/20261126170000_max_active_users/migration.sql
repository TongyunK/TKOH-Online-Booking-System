INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
VALUES
  (
    'max_active_users',
    '400',
    'Maximum number of Active users (admin UI hidden; enforced on add / pending approve / activate)',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("setting_key") DO NOTHING;
