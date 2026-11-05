import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

/**
 * Matches `/team-chat` and `/team-chat/:conversationId` with ONE route, so
 * switching conversations re-uses the page (and its chat state) instead of
 * re-creating it.
 */
export function teamChatMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments[0]?.path !== 'team-chat') return null;
  if (segments.length === 1) return { consumed: segments };
  if (segments.length === 2) return { consumed: segments, posParams: { conversationId: segments[1] } };
  return null;
}

/** Internal team chat — open to every employee. */
export const TEAM_CHAT_ROUTES: Routes = [
  {
    matcher: teamChatMatcher,
    title: 'الدردشة الداخلية',
    loadComponent: () =>
      import('./pages/team-chat/team-chat.component').then((m) => m.TeamChatComponent),
  },
];
