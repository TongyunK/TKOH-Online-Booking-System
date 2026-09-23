import { Controller, Header, Query, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Public } from '../auth/decorators/public.decorator';
import {
  DISPLAY_CHANNELS,
  DisplayChannel,
  isDisplayChannel,
} from './display-channel';
import { DisplayEventsService } from './display-events.service';

@Controller('api/display-events')
export class DisplayEventsController {
  constructor(private readonly displayEvents: DisplayEventsService) {}

  @Public()
  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  stream(
    @Query('channels') channelsRaw?: string,
  ): Observable<MessageEvent> {
    const channels = this.parseChannels(channelsRaw);
    return this.displayEvents.stream(channels);
  }

  private parseChannels(raw?: string): DisplayChannel[] {
    const parts = String(raw ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const parsed = parts.filter(isDisplayChannel);
    if (parsed.length) return Array.from(new Set(parsed));
    return [...DISPLAY_CHANNELS];
  }
}
