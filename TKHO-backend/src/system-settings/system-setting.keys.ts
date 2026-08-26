export const SystemSettingKey = {
  userInactiveAfterMonths: 'user_inactive_after_months',
  hkPublicHolidaysUrl: 'hk_public_holidays_url',
  evDateUpdateTime: 'EV_date_update_time',
  evWeeklyBookingLimit: 'EV_weekly_booking_limit',
  venueBookingMinGapMinutes: 'venue_booking_min_gap_minutes',
  venueMeetingEventTitleMaxLength: 'venue_meeting_event_title_max_length',
  dataBackupReceivingEmail: 'data_backup_receiving_email',
  dataBackupSendingEmail: 'data_backup_sending_email',
  dataBackupSendingEmailHost: 'data_backup_sending_email_host',
  dataBackupSendingEmailPassword: 'data_backup_sending_email_password',
  dataBackupTimeSpan: 'data_backup_time_span',
  dataBackupEmailInterval: 'data_backup_email_interval',
  dataBackupEmailSendTime: 'data_backup_email_send_time',
} as const;

export type SystemSettingKeyName =
  (typeof SystemSettingKey)[keyof typeof SystemSettingKey];

/** Keys not exposed to admin UI / GET settings API */
export const SYSTEM_SETTING_HIDDEN_KEYS: SystemSettingKeyName[] = [
  SystemSettingKey.dataBackupSendingEmail,
  SystemSettingKey.dataBackupSendingEmailHost,
  SystemSettingKey.dataBackupSendingEmailPassword,
];

export const SYSTEM_SETTING_DEFAULTS: Record<SystemSettingKeyName, string> = {
  [SystemSettingKey.userInactiveAfterMonths]: '6',
  [SystemSettingKey.hkPublicHolidaysUrl]:
    'https://www.1823.gov.hk/common/ical/en.json',
  [SystemSettingKey.evDateUpdateTime]: '13:00',
  [SystemSettingKey.evWeeklyBookingLimit]: '1',
  [SystemSettingKey.venueBookingMinGapMinutes]: '15',
  [SystemSettingKey.venueMeetingEventTitleMaxLength]: '80',
  [SystemSettingKey.dataBackupReceivingEmail]: '',
  [SystemSettingKey.dataBackupSendingEmail]: '',
  [SystemSettingKey.dataBackupSendingEmailHost]: 'mail.wisesystemtech.com',
  [SystemSettingKey.dataBackupSendingEmailPassword]: '',
  [SystemSettingKey.dataBackupTimeSpan]: '14',
  [SystemSettingKey.dataBackupEmailInterval]: 'daily',
  [SystemSettingKey.dataBackupEmailSendTime]: '09:00',
};

export const SYSTEM_SETTING_DESCRIPTIONS: Record<SystemSettingKeyName, string> =
  {
    [SystemSettingKey.userInactiveAfterMonths]:
      'Months without login before user status becomes Inactive',
    [SystemSettingKey.hkPublicHolidaysUrl]:
      'Hong Kong public holidays reference URL',
    [SystemSettingKey.evDateUpdateTime]:
      'Daily time (HH:mm, Hong Kong) when EV booking calendar rolls forward to release the next day quota',
    [SystemSettingKey.evWeeklyBookingLimit]:
      'Maximum active EV bookings per user per week (Monday to Sunday) for non-admin users',
    [SystemSettingKey.venueBookingMinGapMinutes]:
      'Minimum gap in minutes between consecutive bookings of the same venue (for cleaning turnaround)',
    [SystemSettingKey.venueMeetingEventTitleMaxLength]:
      'Maximum characters allowed for Venue Meeting / Event Title',
    [SystemSettingKey.dataBackupReceivingEmail]:
      'Email address that receives scheduled data backup reports',
    [SystemSettingKey.dataBackupSendingEmail]:
      'SMTP sender email for data backup notifications (admin UI hidden)',
    [SystemSettingKey.dataBackupSendingEmailHost]:
      'SMTP host for data backup sender email (admin UI hidden)',
    [SystemSettingKey.dataBackupSendingEmailPassword]:
      'SMTP password for data backup sender email (admin UI hidden)',
    [SystemSettingKey.dataBackupTimeSpan]:
      'Number of future days included in each data backup',
    [SystemSettingKey.dataBackupEmailInterval]:
      'How often backup emails are sent (daily, weekly, monthly)',
    [SystemSettingKey.dataBackupEmailSendTime]:
      'Time of day (HH:mm, Hong Kong) to send backup emails',
  };

export const DATA_BACKUP_EMAIL_INTERVALS = ['daily', 'weekly', 'monthly'] as const;
export type DataBackupEmailInterval =
  (typeof DATA_BACKUP_EMAIL_INTERVALS)[number];
