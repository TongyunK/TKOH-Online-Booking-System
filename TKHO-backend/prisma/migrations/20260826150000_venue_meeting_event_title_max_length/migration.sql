INSERT INTO "system_settings" ("setting_key", "setting_value", "description", "updated_at")
VALUES
  (
    'venue_meeting_event_title_max_length',
    '80',
    'Maximum characters allowed for Venue Meeting / Event Title',
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("setting_key") DO NOTHING;
