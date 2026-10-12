export const SystemSettingKey = {
  userInactiveAfterMonths: 'user_inactive_after_months',
  /** 无操作自动登出（分钟） */
  userAutoLogoutMinutes: 'user_auto_logout_minutes',
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
  /** 是否启用定时自动发送备份邮件（手动 Send now 不受此开关限制） */
  dataBackupEmailEnabled: 'data_backup_email_enabled',
  /** 在线数据保留月数；超龄且预约日已过的预订 / Inactive 用户由月度 purge 清理 */
  dataRetentionMonths: 'data_retention_months',
  /** 数据保留清理结果/失败通知的运维邮箱 */
  dataRetentionOpsEmail: 'data_retention_ops_email',
  /** Merge 大屏：场地/会议翻页间隔（毫秒） */
  mergeDisplayRotateIntervalMs: 'merge_display_rotate_interval_ms',
  /** Merge 大屏：底部 ticker 一整轮滚动时长（秒） */
  mergeDisplayTickerDurationSeconds: 'merge_display_ticker_duration_seconds',
  /** 大屏数据轮询兜底间隔（毫秒）；SSE 即时刷新之外的 HTTP 兜底 */
  displayDataPollIntervalMs: 'display_data_poll_interval_ms',
} as const;

export type SystemSettingKeyName =
  (typeof SystemSettingKey)[keyof typeof SystemSettingKey];

/** Keys not exposed to admin UI / GET settings API */
export const SYSTEM_SETTING_HIDDEN_KEYS: SystemSettingKeyName[] = [
  SystemSettingKey.dataBackupSendingEmail,
  SystemSettingKey.dataBackupSendingEmailHost,
  SystemSettingKey.dataBackupSendingEmailPassword,
  SystemSettingKey.dataRetentionMonths,
  SystemSettingKey.dataRetentionOpsEmail,
  SystemSettingKey.mergeDisplayRotateIntervalMs,
  SystemSettingKey.mergeDisplayTickerDurationSeconds,
  SystemSettingKey.displayDataPollIntervalMs,
];

export const SYSTEM_SETTING_DEFAULTS: Record<SystemSettingKeyName, string> = {
  [SystemSettingKey.userInactiveAfterMonths]: '6',
  [SystemSettingKey.userAutoLogoutMinutes]: '30',
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
  [SystemSettingKey.dataBackupEmailEnabled]: 'true',
  [SystemSettingKey.dataRetentionMonths]: '24',
  [SystemSettingKey.dataRetentionOpsEmail]: '',
  [SystemSettingKey.mergeDisplayRotateIntervalMs]: '8000',
  [SystemSettingKey.mergeDisplayTickerDurationSeconds]: '40',
  [SystemSettingKey.displayDataPollIntervalMs]: '60000',
};

export const SYSTEM_SETTING_DESCRIPTIONS: Record<SystemSettingKeyName, string> =
  {
    [SystemSettingKey.userInactiveAfterMonths]:
      'Months without login before user status becomes Inactive',
    [SystemSettingKey.userAutoLogoutMinutes]:
      'Minutes of idle time without user activity before automatic logout',
    [SystemSettingKey.hkPublicHolidaysUrl]:
      'Hong Kong public holidays reference URL',
    [SystemSettingKey.evDateUpdateTime]:
      'Daily time (HH:mm, Hong Kong) when EV booking calendar rolls forward to release the next day quota',
    [SystemSettingKey.evWeeklyBookingLimit]:
      'Maximum active EV bookings per user per week (Monday to Sunday) for non-admin users',
    [SystemSettingKey.venueBookingMinGapMinutes]:
      'Minimum gap in minutes between consecutive bookings of the same venue (for cleaning turnaround)',
    [SystemSettingKey.venueMeetingEventTitleMaxLength]:
      'Maximum units for Venue Meeting / Event Title (each Chinese character counts as 2; other characters count as 1)',
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
    [SystemSettingKey.dataBackupEmailEnabled]:
      'Whether scheduled data backup emails are sent automatically',
    [SystemSettingKey.dataRetentionMonths]:
      'Months to retain online booking/user data before monthly purge (admin UI hidden; bookings when created_at older than N months AND (booking_date before today HKT, or null for venue); inactive users by inactive_time)',
    [SystemSettingKey.dataRetentionOpsEmail]:
      'Ops email for monthly data retention purge summary and failure alerts (admin UI hidden)',
    [SystemSettingKey.mergeDisplayRotateIntervalMs]:
      'Venue Merge display: interval in ms between venue/meeting page rotations (admin UI hidden)',
    [SystemSettingKey.mergeDisplayTickerDurationSeconds]:
      'Venue Merge display: footer ticker full-loop duration in seconds (admin UI hidden)',
    [SystemSettingKey.displayDataPollIntervalMs]:
      'Public display screens: HTTP data poll fallback interval in ms (admin UI hidden; used with SSE live refresh)',
  };

export const DATA_BACKUP_EMAIL_INTERVALS = ['daily', 'weekly', 'monthly'] as const;
export type DataBackupEmailInterval =
  (typeof DATA_BACKUP_EMAIL_INTERVALS)[number];
