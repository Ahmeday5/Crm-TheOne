import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, mergeMap, of, reduce, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { UsersService } from '../../../core/services/users.service';
import { AppUser } from '../../../core/models/user.model';
import { UserRole } from '../../../core/models/auth.model';
import { Announcement } from '../models/announcement.models';

/** Parallel `Notifications/send` calls — enough to be quick, polite to the API. */
const SEND_CONCURRENCY = 4;
const MESSAGE_MAX = 160;

export interface DeliveryReport {
  /** Employees the announcement targets (excluding the publisher). */
  recipients: number;
  /** Notifications the API accepted. */
  delivered: number;
}

/**
 * Client-side fan-out used while the announcements backend doesn't exist:
 * resolves the targeted employees and sends each one a real notification
 * through the existing `POST /Notifications/send` (one user per call).
 *
 * Once `POST /Announcements` ships, the server does this itself and this
 * service is no longer used (the HTTP repository never calls it).
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementDeliveryService {
  private readonly users = inject(UsersService);
  private readonly notifications = inject(NotificationsService);
  private readonly auth = inject(AuthService);

  deliver(announcement: Announcement): Observable<DeliveryReport> {
    const me = this.auth.currentUser()?.userId;
    return this.users.list().pipe(
      map((all) => all.filter((u) => u.userId !== me && this.isRecipient(u, announcement))),
      switchMap((recipients) => {
        if (recipients.length === 0) return of<DeliveryReport>({ recipients: 0, delivered: 0 });
        const payload = {
          title: announcement.title,
          message: this.excerpt(announcement.body),
        };
        return from(recipients).pipe(
          mergeMap(
            (u) =>
              this.notifications.send({ userId: u.userId, ...payload }).pipe(
                map(() => 1),
                catchError(() => of(0)),
              ),
            SEND_CONCURRENCY,
          ),
          reduce((sum, ok) => sum + ok, 0),
          map((delivered) => ({ recipients: recipients.length, delivered })),
        );
      }),
    );
  }

  private isRecipient(user: AppUser, a: Announcement): boolean {
    const role = user.role as UserRole | null;
    if (!role || role === 'Admin') return false;
    return a.audience === 'all' || (a.roles as string[]).includes(role);
  }

  private excerpt(text: string): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > MESSAGE_MAX ? `${clean.slice(0, MESSAGE_MAX - 1)}…` : clean;
  }
}
