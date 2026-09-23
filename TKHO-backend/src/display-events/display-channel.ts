export const DISPLAY_CHANNELS = [
  'venue',
  'venue-merge',
  'tea',
  'ev',
] as const;

export type DisplayChannel = (typeof DISPLAY_CHANNELS)[number];

export function isDisplayChannel(value: string): value is DisplayChannel {
  return (DISPLAY_CHANNELS as readonly string[]).includes(value);
}

export type DisplayInvalidateEvent = {
  channels: DisplayChannel[];
  reason?: string;
  at: string;
};
