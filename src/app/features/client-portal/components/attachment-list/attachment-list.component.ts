import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AssetUrlPipe } from '../../../../shared/pipes/asset-url.pipe';
import { formatBytes } from '../../utils/client-portal-ui.util';
import { RequestAttachment, isImageAttachment } from '../../models/client-portal.models';

/** Attachments of a request / comment: images as thumbnails, other files as chips. */
@Component({
  selector: 'app-attachment-list',
  standalone: true,
  imports: [AssetUrlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length) {
      <ul class="al" role="list">
        @for (a of items(); track a.id) {
          <li>
            @if (isImage(a)) {
              <a class="al__img" [href]="a.fileUrl | assetUrl" target="_blank" rel="noopener" [title]="a.fileName">
                <img [src]="a.fileUrl | assetUrl" [alt]="a.fileName" loading="lazy" />
              </a>
            } @else {
              <a class="al__file" [href]="a.fileUrl | assetUrl" target="_blank" rel="noopener" download>
                <i class="fa-regular fa-file" aria-hidden="true"></i>
                <span class="al__name" dir="auto">{{ a.fileName }}</span>
                <span class="al__size">{{ size(a.sizeBytes) }}</span>
              </a>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .al { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.5rem 0 0; padding: 0; list-style: none; }
    .al__img img { display: block; width: 6rem; height: 4.5rem; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border); }
    .al__file {
      display: inline-flex; align-items: center; gap: 0.35rem; max-width: 15rem;
      padding: 0.3rem 0.6rem; border-radius: var(--radius-sm); background: var(--surface-1);
      color: var(--text-1); font-size: var(--fs-xs); text-decoration: none;
    }
    .al__file:hover { background: var(--surface-2); }
    .al__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .al__size { color: var(--text-3); flex-shrink: 0; }
  `,
})
export class AttachmentListComponent {
  readonly items = input<RequestAttachment[]>([]);
  protected readonly isImage = isImageAttachment;
  protected readonly size = formatBytes;
}
