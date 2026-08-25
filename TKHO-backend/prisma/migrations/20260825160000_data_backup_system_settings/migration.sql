INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
VALUES
  (
    'data_backup_receiving_email',
    '',
    'Email address that receives scheduled data backup reports',
    CURRENT_TIMESTAMP
  ),
  (
    'data_backup_sending_email',
    '',
    'SMTP sender email for data backup notifications (admin UI hidden)',
    CURRENT_TIMESTAMP
  ),
  (
    'data_backup_sending_email_password',
    '',
    'SMTP password for data backup sender email (admin UI hidden)',
    CURRENT_TIMESTAMP
  ),
  (
    'data_backup_time_span',
    '14',
    'Number of future days included in each data backup',
    CURRENT_TIMESTAMP
  ),
  (
    'data_backup_email_interval',
    'daily',
    'How often backup emails are sent (daily, weekly, monthly)',
    CURRENT_TIMESTAMP
  ),
  (
    'data_backup_email_send_time',
    '09:00',
    'Time of day (HH:mm, Hong Kong) to send backup emails',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("setting_key") DO NOTHING;
