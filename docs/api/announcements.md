# Announcements API — contract used by the frontend

Live backend contract (no mock). Envelope: `{ statusCode, message, data }`;
errors `{ statusCode, message, details }` — the UI shows `message`.
A 401 whose body is `"Unauthorized access."` means *forbidden*, not an expired
session (no logout). Dates/times are Cairo time; zone-less timestamps are
treated as Cairo wall-clock and normalised to UTC in
`features/announcements/data/announcement.mapper.ts`.

## Model

```json
{
  "id": 7, "title": "…", "body": "…",
  "targetRole": "Sales",            // null = everyone; Sales | Support | Marketing | Developer | Admin
  "isPinned": true,
  "startDate": "2026-11-05", "endDate": "2026-11-07",   // inclusive
  "isActive": true,                  // live today for this audience (server decides)
  "isRead": false,
  "createdByName": "…", "createdAt": "2026-11-05T09:00:00",
  "readCount": 3, "targetCount": 12  // Admin only
}
```

## Endpoints

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/Announcements?includeExpired=true&search=` | all | scoped to the caller; "Current only" sends `includeExpired=false` |
| GET | `/api/Announcements/Active` | all | the banner: live today for the caller, pinned first |
| POST | `/api/Announcements` | Admin | `{ title (≤200), body (≤4000), targetRole, isPinned, startDate, endDate }` |
| PUT | `/api/Announcements/{id}` | Admin | same body |
| DELETE | `/api/Announcements/{id}` | Admin | |
| POST | `/api/Announcements/{id}/Read` | all | read receipt (opening an announcement also sends it) |
| GET | `/api/Announcements/{id}/Readers` | Admin | `[{ userId, fullName, hasRead, readAt }]` — UI lists unread first |

Delivery (in-app notification + push) is done by the server when an
announcement **starts** — the frontend never fans out notifications.

## Real time — `/hubs/app` (shared app hub)

| Event | Payload | Frontend reaction |
|---|---|---|
| `announcement` | announcement | add to banner (if live) + board, toast "📢 New announcement" |
| `announcementUpdated` | announcement | replace by id (drops from the banner if no longer live) |
| `announcementRemoved` | `{ id }` | remove from banner + board |

After a reconnect, on every new Cairo day and hourly as a safety net the
frontend reloads `/Active`.

## Notifications

`type = Announcement`, `relatedEntityType = "Announcement"`,
`relatedEntityId = <id>` → opens `/announcements/<id>`.
