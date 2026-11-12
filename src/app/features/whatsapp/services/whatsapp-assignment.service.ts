import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concatMap, defer, from, last, map, of, switchMap, throwError } from 'rxjs';
import { WaInstance } from '../models/whatsapp.models';
import { isChannelActive } from '../utils/whatsapp.util';
import { WhatsAppApiService } from './whatsapp-api.service';

/**
 * Channel ↔ employee assignment on top of `PUT /users/{userId}/number`,
 * whose rules are asymmetric:
 *   - `{ instanceId }` replaces only the user's channel of the SAME type
 *     (a WhatsApp number never touches their Messenger page, and vice versa);
 *   - `{ instanceId: null }` removes ALL of the user's channels.
 *
 * So removing one channel = clear everything, then give back the channels
 * the user should keep. Moving a channel that someone else holds = release
 * it from them first (keeping their other channel), then assign; if that
 * fails, the previous owner gets it back.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppAssignmentService {
  private readonly api = inject(WhatsAppApiService);

  /** Give `channel` to `userId`. Emits the updated channel when the server returns it. */
  assign(channel: WaInstance, userId: string, all: readonly WaInstance[]): Observable<WaInstance | null> {
    const previous = channel.assignedUserId;
    // Deferred: the request must only start after the release below has finished.
    const link$ = defer(() => this.api.assignNumber(userId, { instanceId: channel.id }));
    if (!previous || previous === userId) return link$;

    return this.release(previous, channel.id, all).pipe(
      switchMap(() =>
        link$.pipe(
          catchError((err: unknown) =>
            // Roll back: the previous owner gets the channel again, then surface the original error.
            this.api.assignNumber(previous, { instanceId: channel.id }).pipe(
              catchError(() => of(null)),
              switchMap(() => throwError(() => err)),
            ),
          ),
        ),
      ),
    );
  }

  /** Take `channel` away from its owner; the owner keeps their other channel(s). */
  unassign(channel: WaInstance, all: readonly WaInstance[]): Observable<void> {
    const owner = channel.assignedUserId;
    return owner ? this.release(owner, channel.id, all) : of(undefined);
  }

  /** Clear `userId`'s channels, then re-assign every one except `channelId`. */
  private release(userId: string, channelId: string, all: readonly WaInstance[]): Observable<void> {
    const keep = all.filter((c) => c.assignedUserId === userId && c.id !== channelId && isChannelActive(c));
    const clear$ = this.api.assignNumber(userId, { instanceId: null });
    if (!keep.length) return clear$.pipe(map(() => undefined));

    return clear$.pipe(
      switchMap(() => from(keep)),
      concatMap((c) => this.api.assignNumber(userId, { instanceId: c.id })),
      last(),
      map(() => undefined),
    );
  }
}
