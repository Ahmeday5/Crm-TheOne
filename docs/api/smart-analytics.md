# Smart Analytics API — backend contract

The frontend (`/smart-analytics`) is fully built against this contract. Until
it is deployed, the app runs on a seeded, browser-only mock
(`MockSmartAnalyticsRepository`: stable sample data, reviews in
`localStorage`). Once these endpoints are live, switch the adapter in
`src/app/features/smart-analytics/data/smart-analytics-repository.provider.ts`
to `inject(HttpSmartAnalyticsRepository)`. No other frontend change is needed.
(When wiring, move `SMART_ANALYTICS_ENDPOINTS` from
`http-smart-analytics.repository.ts` into `API_ENDPOINTS`.)

All responses use the standard envelope `{ statusCode, message, data }`.
Timestamps are UTC ISO-8601. Days and hours are **Africa/Cairo** local time.

## Design principle — facts in, maths on the client

Every endpoint returns **raw facts** (counts, tickets, calls). Rates,
rankings, the health score and best/worst badges are computed in the
frontend by pure functions in `src/app/features/smart-analytics/utils/`.
The backend must **not** pre-round or pre-rank. This keeps the formula in
one place; if a future server-side score is needed (alerts, exports), port
`customer-health.util.ts` 1:1.

## Rules

| Rule | Detail |
|---|---|
| Page access | `Admin`, `Marketing`, `Sales`. Everyone else → `403`. |
| Sources, contact times, customer health | `Admin`, `Marketing`, `Sales`. Data is company-wide (not filtered to the caller's own leads). |
| Monthly performance + reviews | `Admin` only (read and write). Everyone else → `403`. |
| Week | Starts **Saturday**. `day`: `0` = Saturday … `6` = Friday. |
| Working hours | The UI shows hours `9`–`20` (buckets 09:00–20:59). Returning other hours is harmless; they're ignored. |
| Ranges | `30d`, `90d`, `12m` = rolling window ending now (Cairo). |
| Months | `YYYY-MM` (Cairo calendar). Future months → `400`. The UI offers the current month and the 11 before it. |

## 1. Source quality

`GET /api/SmartAnalytics/sources?dimension=source|campaign&range=30d|90d|12m`

One row per source (or campaign) that brought **at least one customer** in the range.

```jsonc
[
  {
    "id": "string",            // source / campaign id
    "name": "إعلانات فيسبوك",   // display name (campaign names are shown as-is)
    "dimension": "source",     // echoes the query
    "channel": "facebook",     // facebook | instagram | google | tiktok | whatsapp | website | referral | walkIn | other
    "customers": 512,          // customers created in the range with this source / campaign
    "buyers": 41               // of those, customers with ≥ 1 completed purchase (any time up to now)
  }
]
```

- `channel` drives the icon and, for `dimension=source`, the localized label. Unknown → `other`.
- Frontend: conversion = `buyers ÷ customers`; average = Σbuyers ÷ Σcustomers;
  best / weakest only among rows with **≥ 15 customers**.

## 2. Best time to contact

`GET /api/SmartAnalytics/contact-times?range=30d|90d|12m`

Outbound calls logged by sales, bucketed by Cairo day-of-week × hour.

```jsonc
[
  { "day": 3, "hour": 19, "calls": 168, "answered": 121 }
]
```

- A call is *answered* when its outcome is connected/answered (not no-answer, busy, rejected, switched off).
- Empty buckets may be omitted.
- Frontend: answer rate per bucket; buckets with **< 8 calls** are shown as
  "not enough data"; top-3 times are ranked by the **Wilson lower bound**
  (95%) of the answer rate so tiny samples can't win by luck.

## 3. Customer health

`GET /api/SmartAnalytics/customer-health`

Every customer with **any ticket opened in the last 90 days or any ticket still open**.
Customers without tickets may be omitted (they would score 100).

```jsonc
[
  {
    "customerId": "string",
    "customerName": "محمد عبد الرحمن",
    "phone": "01012345678",          // nullable
    "ownerName": "أحمد سمير",          // assigned sales rep, nullable
    "tickets": [
      {
        "id": "string",
        "priority": "low | medium | high | urgent",
        "isOpen": true,               // not resolved / closed
        "openedAt": "2026-10-20T08:15:00Z"
      }
    ]
  }
]
```

### Score formula (computed on the client — for reference)

Start at **100**, subtract four capped factors (caps sum to 100, so the score is always 0–100):

| Factor | Deduction | Cap |
|---|---|---|
| Volume | 3 × tickets opened in the last 90 days (+ older still-open ones) | 15 |
| Open | 6 × open tickets | 30 |
| Priority | per **open** ticket: low 0, medium 4, high 8, urgent 14 | 30 |
| Age | per **open** ticket by days open: > 3 → 2, > 7 → 5, > 14 → 9, > 30 → 14 | 25 |

Classes: **healthy** ≥ 70 · **at risk** 40–69 · **critical** < 40.

## 4. Monthly performance (Admin)

`GET /api/SmartAnalytics/performance?month=2026-11`

One row per active sales rep (role `Sales`) in that month.

```jsonc
[
  {
    "repId": "user-guid",
    "repName": "منة الله خالد",
    "imageUrl": null,               // relative or absolute, nullable
    "calls": 362,                   // outbound calls logged in the month
    "answeredCalls": 251,           // of those, answered
    "buyers": 43,                   // customers owned by the rep whose first purchase is in the month
    "review": {                     // null when not reviewed yet
      "repId": "user-guid",
      "month": "2026-11",
      "rating": 4,                  // 1–5
      "note": "شغل كويس جدًا…",       // ≤ 500 chars, may be ""
      "reviewedAt": "2026-12-02T09:30:00Z",
      "reviewedBy": { "id": "admin-guid", "name": "Admin name" }
    }
  }
]
```

For the current month, figures are month-to-date (the UI labels it as in progress).

### Save a review (upsert)

`PUT /api/SmartAnalytics/performance/{month}/{repId}/review`

```jsonc
{ "rating": 4, "note": "string" }
```

Returns the saved `review` object (same shape as above, `reviewedAt` = now,
`reviewedBy` = caller). One review per (repId, month); saving again overwrites.

Validation → `400` with a human-readable `message` (shown as-is in a toast):
- `rating` not an integer 1–5
- `note` longer than 500 characters (trim first)
- `month` malformed or in the future
- unknown `repId` or the user isn't a Sales rep → `404`

Optional (nice to have): notify the rep (`Notifications/send`) when their
review is saved — the frontend doesn't depend on it.

## Endpoints summary

| Method | Path | Roles | Returns |
|---|---|---|---|
| `GET` | `/api/SmartAnalytics/sources?dimension=&range=` | Admin, Marketing, Sales | `SourceQualityRow[]` |
| `GET` | `/api/SmartAnalytics/contact-times?range=` | Admin, Marketing, Sales | `ContactSlot[]` |
| `GET` | `/api/SmartAnalytics/customer-health` | Admin, Marketing, Sales | `CustomerTickets[]` |
| `GET` | `/api/SmartAnalytics/performance?month=` | Admin | `RepMonthlyPerformance[]` |
| `PUT` | `/api/SmartAnalytics/performance/{month}/{repId}/review` | Admin | `RepReview` |

TypeScript shapes: `src/app/features/smart-analytics/models/smart-analytics.models.ts`.
