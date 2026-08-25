-- Encrypted with AES-256-GCM (enc:v1). Decrypt using SETTINGS_ENCRYPTION_KEY or JWT_SECRET.
UPDATE "system_settings"
SET
  "setting_value" = 'enc:v1:l_py_N5n8BP7-jUQ:H6UBP0QPtONmbJhR9IqywA:XfAkmZGlrlPE6JDha4vkbA',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "setting_key" = 'data_backup_sending_email_password';

INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
SELECT
  'data_backup_sending_email_password',
  'enc:v1:l_py_N5n8BP7-jUQ:H6UBP0QPtONmbJhR9IqywA:XfAkmZGlrlPE6JDha4vkbA',
  'SMTP password for data backup sender email (admin UI hidden, encrypted at rest)',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "system_settings"
  WHERE "setting_key" = 'data_backup_sending_email_password'
);
