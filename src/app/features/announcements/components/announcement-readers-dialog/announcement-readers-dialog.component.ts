import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiError } from '../../../../core/models/api-response.model';
import { LoadErrorComponent } from '../../../../shared/components/load-error/load-error.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { CairoDatePipe } from '../../../../shared/pipes/cairo-date.pipe';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { Announcement, AnnouncementReader } from '../../models/announcement.models';
import { AnnouncementsStore } from '../../state/announcements.store';

type ReadersFilter = 'all' | 'unread' | 'read';

/** Admin: who was targeted and who read it — not-yet-read first. */
@Component({
  selector: 'app-announcement-readers-dialog',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, CairoDatePipe, UserAvatarComponent, LoadErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-readers-dialog.component.html',
  styleUrl: './announcement-readers-dialog.component.scss',
})
export class AnnouncementReadersDialogComponent implements OnInit {
  readonly announcement = input.required<Announcement>();
  readonly closed = output<void>();

  private readonly store = inject(AnnouncementsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly filters: ReadersFilter[] = ['all', 'unread', 'read'];
  readonly filter = signal<ReadersFilter>('all');
  readonly readers = signal<AnnouncementReader[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Not read yet first (A→Z), then readers by most recent read. */
  private readonly sorted = computed(() =>
    [...this.readers()].sort((a, b) => {
      if (a.hasRead !== b.hasRead) return a.hasRead ? 1 : -1;
      if (!a.hasRead) return a.fullName.localeCompare(b.fullName);
      return (b.readAt ?? '').localeCompare(a.readAt ?? '');
    }),
  );

  readonly counts = computed(() => {
    const read = this.readers().filter((r) => r.hasRead).length;
    return { all: this.readers().length, read, unread: this.readers().length - read };
  });

  readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? this.sorted() : this.sorted().filter((r) => r.hasRead === (f === 'read'));
  });

  readonly readPct = computed(() => {
    const c = this.counts();
    return c.all ? Math.round((c.read / c.all) * 100) : 0;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.store
      .readers(this.announcement().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.readers.set(rows);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.loading.set(false);
          // '' (no server message) still means "failed" — the template falls back.
          this.error.set(err?.message?.trim() ?? '');
        },
      });
  }
}
