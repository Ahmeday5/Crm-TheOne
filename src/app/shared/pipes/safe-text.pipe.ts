import { Pipe, PipeTransform } from '@angular/core';

/** Returns the value or a configurable fallback when null/empty. */
@Pipe({ name: 'safeText', standalone: true })
export class SafeTextPipe implements PipeTransform {
  transform(value: unknown, fallback: string = '—'): string {
    if (value === null || value === undefined) return fallback;
    const v = String(value).trim();
    return v.length ? v : fallback;
  }
}
