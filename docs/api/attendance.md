# Attendance & leave API — contract used by the frontend

Live backend contract (no mock). Envelope: `{ statusCode, message, data }`;
errors `{ statusCode, message, details }` — the UI shows `message` (e.g.
"already checked in today", "overlapping leave request"). A 401 whose body is
`"Unauthorized access."` means *forbidden*, not an expired session.

All times are Cairo time. Zone-less timestamps are read as Cairo wall-clock
and converted to UTC instants once, in
`features/attendance/data/attendance.mapper.ts`. Every number shown in the UI
(hours, day counts, totals) is the server's — the client never re-derives it.

## Me (every employee)

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/Attendance/Today` | | `{ date, checkedIn, checkedOut, onLeave, record }` |
| POST | `/api/Attendance/CheckIn` | `{ note }` (optional) | record |
| POST | `/api/Attendance/CheckOut` | `{ note }` (optional) | record |
| GET | `/api/Attendance/My?year=&month=` | | `{ presentDays, totalHours, leaveDays, missingCheckOuts, records[], leaves[] }` |
| POST | `/api/Attendance/Leaves` | `{ type, startDate, endDate, reason (≤1000) }` | request |
| GET | `/api/Attendance/Leaves/My?year=` | | requests[] |
| DELETE | `/api/Attendance/Leaves/{id}` | | cancels a **pending** request |

`record` = `{ workDate, checkInAt, checkOutAt, workedHours, checkInNote, checkOutNote }`.
Leave `type`: `Annual | Sick | Casual | Unpaid | Other`.
Leave `status`: `Pending | Approved | Rejected | Cancelled`.
Request = `{ id, type, startDate, endDate, days, reason, status, reviewedByName, reviewedAt, reviewNote, createdAt }`.

## Admin (others get 403)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/Attendance/TodayAll` | `[{ userId, fullName, checkInAt, checkOutAt, workedHours }]` |
| GET | `/api/Attendance/Monthly?year=&month=&userId=` | same shape as `/My` per employee, plus `userId`, `fullName` |
| GET | `/api/Attendance/Leaves?status=&userId=&year=` | requests with `fullName`; UI sorts pending first |
| PUT | `/api/Attendance/Leaves/{id}/Review` | `{ approve: true\|false, note }` — the employee is notified by the server |

## Notifications

| Type | Who | Opens |
|---|---|---|
| `LeaveRequestSubmitted` | Admin | `/attendance/requests` (also refreshes the sidebar pending badge) |
| `LeaveRequestReviewed` | employee | `/attendance/leaves` (and refetches my requests / month) |

## Frontend routes

`/attendance` (my attendance) · `/attendance/leaves` · `/attendance/team` (Admin) · `/attendance/requests` (Admin).
The header time clock (check in / out from any page) shares state with the page.
