import { Pipe, PipeTransform } from '@angular/core';
import { resolveAssetUrl } from '../../core/utils/asset-url.util';

/**
 * Turns a server-relative upload path into an absolute URL.
 *
 *   <img [src]="entry.attachmentUrl | assetUrl">
 */
@Pipe({ name: 'assetUrl', standalone: true })
export class AssetUrlPipe implements PipeTransform {
  transform(path: string | null | undefined): string | null {
    return resolveAssetUrl(path);
  }
}
