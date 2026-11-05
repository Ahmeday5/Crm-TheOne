# Attendance & leave API — backend contract

The frontend is built against this contract. Until it is deployed, the app
runs on a browser-only mock (`MockAttendanceRepository`, data kept in
`localStorage`). Once these endpoints are live, change two lines in
`src/app/features/attendance/data/attendance-repository.provider.ts`:

- set `USING_MOCK_ATTENDANCE` to `false`
- change the factory to `inject(HttpAttendanceRepository)`

All responses use the standard envelope `{ statusCode, message, data }`.
Timestamps are UTC ISO-8601. **Dates (`date`, `from`, `to`) are calendar days
`YYYY-MM-DD` in Africa/Cairo.** `from`/`to` are inclusive.

## Policy

These values must match the frontend `config/attendance.config.ts`.

| Rule | Value |
|---|---|
| Workday | 09:00 – 17:00 Cairo, 8 h |
| Grace | 15 minutes (check-in after 09:15 counts as late) |
| Weekly day off | Friday |
| Annual / casual / sick entitlement | 21 / 6 / 15 days per calendar year |
| Sick leave | may start up to 7 days in the past; other types cannot start in the past |
| Half day | single date only, charges 0.5 |
| Charged days | workdays only, so Fridays and public holidays are not deducted |

## Models

```jsonc
// AttendanceRecord: one per user per day
{ "id": "string", "userId": "guid", "date": "2026-11-05",
  "checkIn": "2026-11-05T07:02:00Z", "checkOut": null }

// LeaveRequest
{ "id": "string", "userId": "guid",
  "employeeName": "string", "employeeRole": "Sales|Marketing|Support|Developer|Admin",
  "employeeImageUrl": null,
  "type": "annual|sick|casual", "from": "2026-11-10", "to": "2026-11-12",
  "halfDay": false, "days": 3, "reason": "string",
  "status": "pending|approved|rejected|cancelled",
  "createdAt": "…Z", "decidedAt": null,
  "decidedBy": { "id": "guid", "name": "string" } | null,
  "rejectionReason": null }

// LeaveBalance
{ "type": "annual", "entitled": 21, "used": 4, "pending": 2, "available": 15 }

// AttendanceEmployee (admin)
{ "id": "guid", "name": "string", "email": "string", "role": "Sales", "imageUrl": null }

// PublicHoliday
{ "date": "2026-01-07", "name": { "ar": "عيد الميلاد المجيد", "en": "Coptic Christmas" } }
```

## Endpoints

### Everyone

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/Attendance/holidays` | — | `PublicHoliday[]` |
| GET | `/api/Attendance/me` | `?from=&to=` | caller's `AttendanceRecord[]` |
| POST | `/api/Attendance/check-in` | — | `AttendanceRecord`; the server stamps the time |
| POST | `/api/Attendance/check-out` | — | `AttendanceRecord` |
| GET | `/api/Attendance/leaves/me` | — | caller's `LeaveRequest[]` |
| GET | `/api/Attendance/leaves/me/balances` | `?year=2026` | `LeaveBalance[]` |
| POST | `/api/Attendance/leaves` | `{ type, from, to, halfDay, reason }` | `LeaveRequest` (`pending`); notifies admins |
| POST | `/api/Attendance/leaves/{id}/cancel` | — | `LeaveRequest`; own pending requests only |

### Admin

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/Attendance/employees` | — | `AttendanceEmployee[]` |
| GET | `/api/Attendance/team` | `?from=&to=` | everyone's `AttendanceRecord[]` |
| GET | `/api/Attendance/leaves` | — | all `LeaveRequest[]` |
| POST | `/api/Attendance/leaves/{id}/decision` | `{ approve: true }` or `{ approve: false, reason }` | `LeaveRequest`; notifies the employee |

Check-in and check-out times must come from the server clock, never from the
client.

## Errors

Return `4xx` with a `code` field. The UI translates these codes, and falls
back to `message` for anything else.

`endBeforeStart`, `startInPast`, `halfDayRange`, `noWorkingDays`, `overlap`,
`insufficientBalance`, `alreadyCheckedIn`, `alreadyCheckedOut`,
`notCheckedIn`, `notPending`, `reasonRequired`, `notFound`, `forbidden`.
