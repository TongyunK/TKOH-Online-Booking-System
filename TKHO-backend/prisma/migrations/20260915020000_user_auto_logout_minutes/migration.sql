INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
VALUES
  (
    'user_auto_logout_minutes',
    '30',
    'Minutes of idle time without user activity before automatic logout',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("setting_key") DO NOTHING;
