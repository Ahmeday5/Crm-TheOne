import { environment } from '../../../environments/environment';

/**
 * Origin that serves uploaded files. The API answers under `…/api`, while
 * uploads (`/Images/Users/x.jpg`, `/Images/GoalPayments/y.jpg`) are served
 * from the same host *without* the `/api` suffix.
 */
const ASSET_ORIGIN = environment.apiUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '');

/**
 * Resolves a server-relative upload path to an absolute URL.
 *
 *   resolveAssetUrl('/Images/Users/a.jpg') → 'http://host/TheOneCRMAPI/Images/Users/a.jpg'
 *   resolveAssetUrl('https://cdn/x.png')   → unchanged
 *   resolveAssetUrl(null)                  → null
 *
 * `blob:` / `data:` URLs (local previews) pass through untouched.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  const value = path?.trim();
  if (!value) return null;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  return `${ASSET_ORIGIN}/${value.replace(/^\/+/, '')}`;
}
