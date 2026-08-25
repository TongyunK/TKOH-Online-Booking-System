INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
VALUES
  (
    'data_backup_sending_email_host',
    'mail.wisesystemtech.com',
    'SMTP host for data backup sender email (admin UI hidden)',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("setting_key") DO NOTHING;
