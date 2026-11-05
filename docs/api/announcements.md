# Announcements API — backend contract

The frontend is fully built against this contract. Until it is deployed, the
app runs on a browser-only mock (`MockAnnouncementsRepository`). Once these
endpoints are live, switch the adapter in
`src/app/features/announcements/data/announcements-repository.provider.ts`
to `inject(HttpAnnouncementsRepository)`. No other frontend change is needed.

All responses use the standard envelope `{ statusCode, message, data }`.
Timestamps are UTC ISO-8601. `startsOn` / `endsOn` are **calendar dates**
(`YYYY-MM-DD`, Africa/Cairo) and **both are inclusive**.

## Rules

| Rule | Detail |
|---|---|
| Who publishes | `Admin` only (create, update, delete, pin). Return `403` for everyone else. |
| Who reads | Every authenticated user. `GET` returns only what targets the caller: `audience = "all"`, or the caller's role is in `roles`. Admin gets everything. |
| Delivery | `POST` must send a notification (existing `Notifications` table + FCM push) to **every targeted employee**, excluding the publisher and other admins (except when `audience = "all"`). |
| Window | Active while `startsOn <= today(Cairo) <= endsOn`. No server job is needed, because the frontend hides expired items itself. |
| Read receipts | One row per (announcementId, userId). Idempotent. |

## Model — `AnnouncementDto`

```jsonc
{
  "id": "string",                 // GUID or int as string
  "title": "string",              // ≤ 120 chars, required
  "body": "string",               // ≤ 1000 chars, required
  "tone": "info | success | warning | danger",
  "audience": "all | roles",
  "roles": ["Sales", "Marketing", "Support", "Developer"], // [] when audience = all; ≥1 when roles
  "isPinned": false,
  "startsOn": "2026-11-05",
  "endsOn": "2026-11-11",         // >= startsOn
  "createdAt": "2026-11-05T09:12:00Z",
  "updatedAt": null,
  "author": { "id": "user-guid", "name": "Admin name" },

  // per caller
  "isRead": false,
  "readAt": null,

  // counters (meaningful for Admin; may be 0 for others)
  "readCount": 12,                // targeted users who read it
  "recipientsCount": 30           // targeted users at publish time
}
```

`AnnouncementInputDto` (create / update body) = `title, body, tone, audience, roles, isPinned, startsOn, endsOn`.

Validation errors → `400` with a human-readable `message` (shown as-is in the form):
- empty title/body, or length limits exceeded
- `audience = "roles"` with empty `roles`
- `endsOn < startsOn`
- on create only: `startsOn` earlier than today (Cairo)

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/Announcements` | — | `AnnouncementDto[]` (any order; the frontend sorts pinned first) |
| `POST` | `/api/Announcements` | `AnnouncementInputDto` | `AnnouncementDto` (with `recipientsCount` filled in) and delivers notifications |
| `PUT` | `/api/Announcements/{id}` | `AnnouncementInputDto` | `AnnouncementDto`, sets `updatedAt`, does **not** re-notify |
| `DELETE` | `/api/Announcements/{id}` | — | `200`, removes it everywhere |
| `PATCH` | `/api/Announcements/{id}/pin` | `{ "isPinned": true }` | `AnnouncementDto` |
| `POST` | `/api/Announcements/{id}/read` | — | `200`, idempotent read receipt for the caller |

## Suggested notification payload

```jsonc
{ "title": "<announcement title>", "message": "<first 160 chars of body>", "type": "<new Announcement type>" }
```

If a dedicated notification `type` is added, the bell can deep-link to
`/announcements?focus=<id>`. The board already scrolls to and highlights that card.
