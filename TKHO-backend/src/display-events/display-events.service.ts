import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map, merge, interval } from 'rxjs';
import {
  DisplayChannel,
  DisplayInvalidateEvent,
  isDisplayChannel,
} from './display-channel';

@Injectable()
export class DisplayEventsService {
  private readonly bus = new Subject<DisplayInvalidateEvent>();

  notify(channels: DisplayChannel[], reason?: string): void {
    const unique = Array.from(
      new Set(
        (channels ?? []).filter((channel): channel is DisplayChannel =>
          isDisplayChannel(String(channel ?? '')),
        ),
      ),
    );
    if (!unique.length) return;
    this.bus.next({
      channels: unique,
      reason: reason ? String(reason).slice(0, 120) : undefined,
      at: new Date().toISOString(),
    });
  }

  /** Keep SSE alive through proxies; clients ignore unknown event types. */
  stream(channels: DisplayChannel[]): Observable<MessageEvent> {
    const wanted = new Set(channels);
    const invalidations = this.bus.pipe(
      filter((event) => event.channels.some((channel) => wanted.has(channel))),
      map(
        (event): MessageEvent => ({
          type: 'display-invalidate',
          data: event,
        }),
      ),
    );
    const heartbeat = interval(25_000).pipe(
      map(
        (): MessageEvent => ({
          type: 'heartbeat',
          data: { at: new Date().toISOString() },
        }),
      ),
    );
    return merge(invalidations, heartbeat);
  }
}
