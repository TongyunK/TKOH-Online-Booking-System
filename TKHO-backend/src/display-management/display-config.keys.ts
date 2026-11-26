/** Global display settings stored in display_config_settings (config_key / config_value). */
export const DisplayConfigKey = {
  venueDisplayMode: 'venue_display_mode',
  evDisplayMode: 'ev_display_mode',
  mergePanelTitleText: 'merge.panel_title_text',
  mergeFooterTickerText: 'merge.footer_ticker_text',
  mergeQrCodeImage: 'merge.qr_code_image',
  evFooterTickerText: 'ev.footer_ticker_text',
  teaNoRequestCompleted: 'tea.no_request_completed',
  metaUpdatedBy: 'meta.updated_by',
  metaUpdatedAt: 'meta.updated_at',
} as const;

export type DisplayConfigKeyName =
  (typeof DisplayConfigKey)[keyof typeof DisplayConfigKey];

/** Keys editable on Admin Display Management UI; used by backup Excel sheet filter */
export const DISPLAY_CONFIG_UI_EDITABLE_KEYS: DisplayConfigKeyName[] = [
  DisplayConfigKey.venueDisplayMode,
  DisplayConfigKey.evDisplayMode,
  DisplayConfigKey.mergePanelTitleText,
  DisplayConfigKey.mergeFooterTickerText,
  DisplayConfigKey.mergeQrCodeImage,
  DisplayConfigKey.evFooterTickerText,
];

export const DISPLAY_CONFIG_DEFAULTS: Record<DisplayConfigKeyName, string> = {
  [DisplayConfigKey.venueDisplayMode]: 'mixed',
  [DisplayConfigKey.evDisplayMode]: 'single',
  [DisplayConfigKey.mergePanelTitleText]:
    'Conference Room | 8/F Ambulatory Care Block\n會議室 | 日間醫療大樓8樓',
  [DisplayConfigKey.mergeFooterTickerText]: '',
  [DisplayConfigKey.mergeQrCodeImage]: '',
  [DisplayConfigKey.evFooterTickerText]:
    '請依照已預約之時段及車位泊車，並於離場前移走車輛。',
  [DisplayConfigKey.teaNoRequestCompleted]: '{}',
  [DisplayConfigKey.metaUpdatedBy]: 'System',
  [DisplayConfigKey.metaUpdatedAt]: '',
};
