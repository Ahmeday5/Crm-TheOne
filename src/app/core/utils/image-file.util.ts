/** Upper bound the backend enforces for user-uploaded images. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Why a picked file was rejected — maps to `common.image.*` i18n keys. */
export type ImageFileError = 'invalidType' | 'tooLarge';

/**
 * Client-side guard run before any image upload, so the user gets an
 * immediate, specific message instead of a generic 400 from the server.
 */
export function validateImageFile(
  file: File,
  maxBytes: number = MAX_IMAGE_BYTES,
): ImageFileError | null {
  if (!file.type.startsWith('image/')) return 'invalidType';
  if (file.size > maxBytes) return 'tooLarge';
  return null;
}

/** "5 MB" style label for hints and error messages. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}
