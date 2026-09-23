INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
VALUES
  (
    'display_data_poll_interval_ms',
    '60000',
    'Public display screens: HTTP data poll fallback interval in ms (admin UI hidden; used with SSE live refresh)',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("setting_key") DO NOTHING;
