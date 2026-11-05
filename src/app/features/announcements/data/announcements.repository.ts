import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Announcement,
  AnnouncementInput,
  AnnouncementQuery,
  AnnouncementReader,
} from '../models/announcement.models';
import { HttpAnnouncementsRepository } from './http-announcements.repository';

/**
 * Persistence port for announcements. The store and UI depend only on this
 * contract (swap it in tests with `{ provide: AnnouncementsRepository, useValue }`).
 *
 * The server owns scoping (Admin sees everything, employees what targets
 * them), the live window (`isActive`), read receipts and delivery: every
 * targeted employee is notified (in-app + push) when an announcement starts.
 */
@Injectable({ providedIn: 'root', useExisting: HttpAnnouncementsRepository })
export abstract class AnnouncementsRepository {
  abstract list(query: AnnouncementQuery): Observable<Announcement[]>;
  /** Live today for the caller (the banner), pinned first. */
  abstract active(): Observable<Announcement[]>;
  abstract create(input: AnnouncementInput): Observable<Announcement | null>;
  abstract update(id: number, input: AnnouncementInput): Observable<Announcement | null>;
  abstract remove(id: number): Observable<void>;
  abstract markRead(id: number): Observable<void>;
  /** Admin: who was targeted and who read it. */
  abstract readers(id: number): Observable<AnnouncementReader[]>;
}
