/**
 * Tells a "current user changed" effect apart from its first run.
 *
 * Root stores start loading at boot and also watch the signed-in user to
 * clear per-user state. The effect's initial run must not reset (and thereby
 * cancel) what boot just started — only a *different* key afterwards counts.
 *
 *   if (!this.session.changed(userId)) return;
 */
export class SessionTracker<K = unknown> {
  private key: K | undefined;
  private seen = false;

  /** `true` when `key` differs from the previous one (never on the first call). */
  changed(key: K): boolean {
    if (!this.seen) {
      this.seen = true;
      this.key = key;
      return false;
    }
    if (Object.is(key, this.key)) return false;
    this.key = key;
    return true;
  }
}
