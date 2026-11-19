# Backend task — Client Requests v3: target selection + Admin triage gate

> **To Claude (backend):** You are working on the existing ASP.NET Core CRM API that already serves
> the client portal (`ClientPortal/*`, magic-link portal JWT) and the staff project workspace
> (`ManagerProjects/{projectId}/client-requests/*`). This task **extends** the existing
> `ClientRequest` feature — do not rewrite it, do not rename anything that already exists.
> Read the current `ClientRequest`, `ClientRequestComment`, `ClientRequestAttachment` entities,
> their controllers/services, the notification service, and the SignalR `AppHub` before you start.
> The Angular frontend is being built **in parallel against this exact contract** (on a mock),
> so every route, field name, enum name and `reason` code below is a contract — keep them
> character-for-character. If you must deviate, list the deviation in the frontend prompt you
> write at the end (section 13).

---

## 1. Business goal (why)

Today a request the customer sends from the portal goes straight to the developers. Two problems:

1. **We don't know what the request is about.** A single project often has a website, an admin
   dashboard and *several* mobile apps (customer app, delivery/driver app, vendor app…). The
   customer writes "the app crashes" and the team has to guess which one.
2. **Developers receive noise.** Duplicates, out-of-scope asks (paid changes), vague messages.

New rules:

1. When the customer creates a request they **must choose what it is about**: Website, Dashboard,
   Mobile app, or Other. If it is a mobile app they **must say which app** (customer app, driver
   app, vendor app, staff app, or another one by name). Optional: Android / iOS / both.
2. **Every new request goes to the Admin first** — developers do not see it, are not notified,
   cannot open it.
3. The Admin does one of three things:
   - **Approve** → the request enters the normal team flow (developers see it, assignee notified).
   - **Reject** → the request is cancelled: removed from every staff queue, never visible to
     developers; the customer sees it as "declined" with the reason, and it is locked.
   - **Ask for clarification** → the Admin writes a question to the customer. The request waits
     for the customer. When the customer answers, it comes back to the Admin's queue, and the
     Admin then approves / rejects / asks again.
4. Everything must be dead simple for the customer, the developers and the Admin.

---

## 2. Domain changes

### 2.1 New enums (serialize as **string names**, like every existing enum in this contract)

```csharp
public enum RequestTarget   { Website = 1, Dashboard = 2, MobileApp = 3, Other = 4 }

public enum AppAudience     { Customer = 1, Driver = 2, Vendor = 3, Staff = 4, Other = 5 }
// UI (ar): تطبيق العملاء · تطبيق المناديب / السائقين · تطبيق التجار / مقدمي الخدمة · تطبيق الموظفين · تطبيق آخر

public enum AppPlatform     { Android = 1, iOS = 2, Both = 3, Unknown = 4 }

public enum RequestCommentKind
{
    Message = 1,               // normal message (client or staff)
    ClarificationQuestion = 2, // Admin asked the customer something (status → NeedsClarification)
    ClarificationAnswer = 3,   // customer's reply while NeedsClarification (status → PendingReview)
    InternalNote = 4,          // staff-only, NEVER returned to the client
    StatusChange = 5           // system entry written by the server on every triage/status transition
}

public enum RejectReasonCode
{
    Duplicate = 1,          // مكرر
    OutOfScope = 2,         // خارج نطاق التعاقد
    NeedsNewQuote = 3,      // تعديل يحتاج عرض سعر / تعاقد جديد
    NotReproducible = 4,    // لم نتمكن من تكرار المشكلة
    Other = 5               // يتطلب نص سبب
}
```

### 2.2 `RequestStatus` — additive (keep existing values and their numbers; append new ones)

Existing: `Open, InReview, InProgress, Resolved, Closed`.
Add: **`PendingReview`**, **`NeedsClarification`**, **`Rejected`**.

Meaning:

| Status | Who sees it | Meaning |
|---|---|---|
| `PendingReview` | Admin + client | New / answered — waiting for the Admin's decision |
| `NeedsClarification` | Admin + client | Admin asked a question — waiting for the customer |
| `Rejected` | Admin + client | Declined by the Admin. Terminal (except Admin `reopen-review`). Locked for replies |
| `Open` | everyone | **Approved**, waiting for the team (frontend labels it "معتمد") |
| `InReview`, `InProgress`, `Resolved`, `Closed` | everyone | unchanged team flow |

"Approved statuses" (used below) = `Open, InReview, InProgress, Resolved, Closed`.
"Triage statuses" = `PendingReview, NeedsClarification, Rejected`.

**Existing rows keep their status** (they are grandfathered as already approved). New rows always
start at `PendingReview`.

### 2.3 State machine (enforce it in ONE place — a domain method / policy class, unit-tested)

```
PendingReview      ──approve──▶ Open
PendingReview      ──reject───▶ Rejected
PendingReview      ──clarify──▶ NeedsClarification
NeedsClarification ──client answers (comment)──▶ PendingReview
NeedsClarification ──approve──▶ Open            (Admin may decide without waiting)
NeedsClarification ──reject───▶ Rejected
NeedsClarification ──clarify──▶ NeedsClarification (another question)
Rejected           ──reopen-review (Admin)──▶ PendingReview
Approved statuses  ──existing PATCH rules (unchanged)──▶ approved statuses
Resolved           ──client reply──▶ InReview   (existing behaviour, unchanged)
```

Any other transition → **409** with `reason: "invalid_transition"` and `data.currentStatus`.
Use optimistic concurrency (rowversion / `UpdatedAt` check) so two Admins cannot both act on the
same request; the loser gets **409 `invalid_transition`** with the fresh `currentStatus`.

Every transition writes a `StatusChange` comment (server-generated, `authorRole` of the actor,
`statusFrom`, `statusTo`, `body` = reason/question text or null) **in the same transaction**.

### 2.4 `ClientRequest` — new columns

| Column | Type | Notes |
|---|---|---|
| `Target` | `RequestTarget` | required for new rows. Migration default for old rows: `Other` |
| `SurfaceId` | `int?` FK → `ProjectSurface` | set when the customer picked a configured surface (2.5) |
| `AppAudience` | `AppAudience?` | required when `Target = MobileApp` |
| `AppName` | `nvarchar(100)?` | required when `AppAudience = Other`; optional otherwise |
| `AppPlatform` | `AppPlatform?` | optional, only meaningful for `MobileApp` |
| `TargetLabel` | `nvarchar(150)?` | **server-composed snapshot** for display, e.g. surface name `"تطبيق المندوب — Delivery"`, or `AppName`. Null when nothing better than the enum exists |
| `ReviewedById` | `string?` | last Admin who approved/rejected |
| `ReviewedAt` | `datetime?` | |
| `RejectReasonCode` | `RejectReasonCode?` | |
| `RejectReason` | `nvarchar(1000)?` | required when code = `Other` |
| `ClarificationRequestedAt` | `datetime?` | last time the Admin asked |
| `ClientRepliedAt` | `datetime?` | last client message while in a triage status |
| `ApprovedAt` | `datetime?` | |
| `IsArchived` | `bool` | `true` when Rejected (soft delete — "تتمسح وتتلغي"). Rejected rows are excluded from **every** staff query except the Admin inbox filter `status=Rejected` |

Indexes: `(ProjectId, Status)`, `(Status, CreatedAt)`, `(CustomerId, Status)`.

`ClientRequestComment` — new columns: `Kind` (`RequestCommentKind`, default `Message` for old rows),
`StatusFrom` (`RequestStatus?`), `StatusTo` (`RequestStatus?`).

### 2.5 New entity `ProjectSurface` — "what this project is made of"

So the customer picks *their* app from a list instead of guessing.

| Column | Type | Notes |
|---|---|---|
| `Id` | int | |
| `ProjectId` | int FK | cascade |
| `Kind` | `RequestTarget` | `Website`, `Dashboard` or `MobileApp` (not `Other`) |
| `AppAudience` | `AppAudience?` | required when `Kind = MobileApp` |
| `Name` | `nvarchar(100)` | what the customer sees, e.g. "تطبيق العميل", "تطبيق المندوب", "لوحة التحكم" |
| `Platforms` | `AppPlatform?` | for apps |
| `Url` | `nvarchar(500)?` | optional (website/dashboard link) |
| `OrderIndex` | int | |
| `IsActive` | bool | inactive = hidden from the customer, kept on old requests |
| `CreatedAt`, `UpdatedAt` | | |

Deleting a surface that is referenced by requests → soft (set `IsActive=false`), never break FKs.

---

## 3. Shared DTOs (additions to the existing ones)

### 3.1 `ClientRequestListItem` (used by portal list, staff list, admin inbox) — **add**:

```jsonc
{
  // …all existing fields unchanged…
  "target": "MobileApp",            // RequestTarget
  "surfaceId": 12,                  // int | null
  "appAudience": "Driver",          // AppAudience | null
  "appName": null,                  // string | null
  "appPlatform": "Android",         // AppPlatform | null
  "targetLabel": "تطبيق المندوب",    // string | null (server snapshot, see 2.4)
  "customerId": 7,
  "customerName": "شركة النور",      // customer/company name (clientName stays = the visitor name)
  "awaitingParty": "Admin",         // "Admin" | "Client" | "Team" | null  — computed, see below
  "clientRepliedAt": "2026-11-19T10:12:00Z", // null unless the client wrote while in triage
  "reviewedAt": null,
  "rejectReasonCode": null,         // RejectReasonCode | null
  "rejectReason": null
}
```

`awaitingParty` (server-computed, so every screen shows the same thing):
`PendingReview → "Admin"`, `NeedsClarification → "Client"`, `Open | InReview | InProgress → "Team"`,
`Resolved | Closed | Rejected → null`.

### 3.2 `ClientRequestDetails` — add (on top of 3.1):

```jsonc
{
  "reviewedByName": "Ahmed",        // staff only; ALWAYS null in ClientPortal responses
  "approvedAt": null,
  "clarificationRequestedAt": null,
  "surface": { "id": 12, "kind": "MobileApp", "appAudience": "Driver", "name": "تطبيق المندوب", "platforms": "Both", "isActive": true } // | null
}
```

### 3.3 `ClientRequestComment` — add:

```jsonc
{
  "kind": "ClarificationQuestion",  // RequestCommentKind
  "statusFrom": "PendingReview",    // RequestStatus | null — only for StatusChange
  "statusTo": "NeedsClarification"  // RequestStatus | null — only for StatusChange
}
```

**Visibility rules (enforce in the query, not in the controller):**
- ClientPortal responses: never include `InternalNote`. `commentsCount` must exclude them too.
  `StatusChange` entries ARE returned (the UI shows them as small timeline chips) but
  `authorName` is replaced by `null` for staff authors on StatusChange (the UI shows "فريق العمل").
- Staff responses: everything.

### 3.4 `ProjectSurface` DTO

```jsonc
{ "id": 12, "kind": "MobileApp", "appAudience": "Driver", "name": "تطبيق المندوب",
  "platforms": "Both", "url": null, "orderIndex": 2, "isActive": true }
```

### 3.5 Client portal project card — add to `ClientProject` (and therefore `ClientProjectDetails`)

```jsonc
{ "awaitingClientCount": 1 }   // requests of this project in NeedsClarification → "مطلوب ردك" badge
```
`openRequestsCount` keeps counting everything not Resolved/Closed/Rejected (triage included).
`counts.openRequests` same. Add `counts.awaitingClient`.

---

## 4. Client portal endpoints (`ClientPortal/*`, portal JWT, scoped to the link's customer)

### 4.1 `GET ClientPortal/Projects/{projectId}/request-options`  — NEW

What the "new request" form should offer for this project.

```jsonc
{
  "surfaces": [ /* active ProjectSurface DTOs, ordered by OrderIndex */ ],
  "appRequired": true   // true when the project has ≥ 2 active MobileApp surfaces
}
```
Empty `surfaces` = not configured → the UI shows the generic picker (target → audience).

### 4.2 `POST ClientPortal/Projects/{projectId}/requests` — CHANGED (multipart)

Fields: `type`, `title`, `description`, `attachments[]` (existing) **+**
`target`, `surfaceId?`, `appAudience?`, `appName?`, `appPlatform?`.

Validation (400 with the `reason` code; field errors in the usual validation shape):

| Rule | reason |
|---|---|
| `surfaceId` given but not an **active** surface of this project | `surface_invalid` |
| `surfaceId` given → server **derives** `target`/`appAudience` from the surface and ignores the posted ones; `TargetLabel = surface.Name` | — |
| no `surfaceId` and `target` missing | `target_required` |
| `target = MobileApp` and `appAudience` missing (and no `surfaceId`) | `app_required` |
| `target = MobileApp`, project has ≥ 2 active MobileApp surfaces, no `surfaceId` | `app_required` |
| `appAudience = Other` and empty `appName` | `app_name_required` |
| `appName` > 100 chars | validation |
| existing title/description/files rules unchanged (title ≤ 200, text ≤ 5000, ≤ 10 files × 20 MB, same extension allow-list) | existing |

Result: request created with **`status = PendingReview`**, `priority = null`, `assignedToId = null`.
Notify **Admins only** (`ClientRequestCreated`) — **remove** any existing notification to project
developers on create. Return `ClientRequestDetails` (201).

`TargetLabel` composition when no surface: `appName` if given, else null (UI localizes the enum).

### 4.3 `GET ClientPortal/Projects/{projectId}/requests` — CHANGED

Returns all of the customer's requests including `PendingReview`, `NeedsClarification`,
`Rejected`. `status` filter accepts the new values. New fields per 3.1.
Sort: `NeedsClarification` first, then by `updatedAt ?? createdAt` desc.

### 4.4 `GET ClientPortal/requests/{id}` — CHANGED: new fields; InternalNotes excluded.

### 4.5 `POST ClientPortal/requests/{id}/comments` — CHANGED behaviour

| Current status | Effect |
|---|---|
| `NeedsClarification` | comment saved with `kind = ClarificationAnswer`; status → `PendingReview`; `ClientRepliedAt = now`; StatusChange entry; notify Admins `ClientRequestClarificationAnswered` |
| `PendingReview` | `kind = Message`; `ClientRepliedAt = now`; status unchanged; notify Admins `ClientRequestComment` |
| `Rejected` | **409** `request_rejected` |
| `Closed` | existing 409 (unchanged) |
| `Resolved` | existing (→ `InReview`) |
| others | existing |

---

## 5. Admin inbox — NEW controller `ClientRequests` (role **Admin** only; others 403)

The Admin needs ONE queue across all projects, not a tab per project.

### 5.1 `GET ClientRequests`
Query: `status?` (single), `projectId?`, `customerId?`, `target?`, `type?`, `search?`
(title / description / customer name / request id), `pageIndex=1`, `pageSize=20 (max 100)`,
`sort?` = `oldest` | `newest` (default: `oldest` for `PendingReview`, else `newest`).
Returns the existing `PagedResult<ClientRequestListItem>`.
`Rejected` rows appear **only** when `status=Rejected` is passed explicitly.

### 5.2 `GET ClientRequests/summary`
```jsonc
{
  "pendingReview": 4,
  "clientReplied": 2,          // PendingReview AND ClientRepliedAt > ClarificationRequestedAt (customer answered)
  "needsClarification": 1,
  "approvedOpen": 9,           // Open + InReview + InProgress
  "rejectedLast30Days": 3,
  "oldestPendingAt": "2026-11-17T08:00:00Z" // null when nothing pending
}
```
Used for the sidebar badge and the inbox header. Cheap query (no cache needed, or 15s).

### 5.3 `GET ClientRequests/{id}` → `ClientRequestDetails` (staff visibility, all statuses).

### 5.4 `POST ClientRequests/{id}/approve`
```jsonc
{
  "priority": "High",              // required: High | Medium | Low
  "assignedToId": "user-guid",     // optional — must be a developer on the project or an Admin
  "internalNote": "ابدأ بأندرويد", // optional → saved as InternalNote
  "title": null                    // optional: Admin may rewrite a vague title (≤ 200)
}
```
Allowed from `PendingReview` / `NeedsClarification`. → `Open`, `ApprovedAt`, `ReviewedById/At`.
Notifications: client → `ClientRequestApproved`; assignee → `ClientRequestAssigned`; if no assignee,
all project developers → `ClientRequestApproved`. Returns fresh `ClientRequestDetails`.
Invalid assignee → 400 `assignee_invalid`.

### 5.5 `POST ClientRequests/{id}/reject`
```jsonc
{ "reasonCode": "OutOfScope", "reason": "التعديل ده محتاج عرض سعر منفصل", "notifyClient": true }
```
`reason` required when `reasonCode = Other` (`reason_required`), ≤ 1000.
Allowed from `PendingReview` / `NeedsClarification`. → `Rejected`, `IsArchived = true`,
`ReviewedById/At`. StatusChange entry `body = reason`. If `notifyClient`, client → `ClientRequestRejected`.
Never notify developers. Returns fresh details.

### 5.6 `POST ClientRequests/{id}/clarify` (multipart)
Fields: `question` (required, ≤ 5000), `attachments[]` (same rules).
Allowed from `PendingReview` / `NeedsClarification`. Saves a comment `kind = ClarificationQuestion`
(visible to the client) + StatusChange, status → `NeedsClarification`,
`ClarificationRequestedAt = now`. Notify client → `ClientRequestClarificationRequested`.
Returns fresh details.

### 5.7 `POST ClientRequests/{id}/reopen-review`
Only from `Rejected` → `PendingReview`, `IsArchived = false`. For Admin mistakes. No client notification.

### 5.8 `PATCH ClientRequests/{id}/classification`
Admin corrects what the customer picked. Body (all optional, same validation as 4.2):
`type`, `target`, `surfaceId`, `appAudience`, `appName`, `appPlatform`. Any status except `Rejected`.
Writes a `StatusChange` entry with `statusFrom = statusTo =` the current status and
`body = "classification"` so the history shows the correction. Returns fresh details.

### 5.9 `POST ClientRequests/{id}/comments` (multipart)
`body`, `attachments[]`, `isInternal` (bool, default **true** while in a triage status, false otherwise).
Non-internal Admin message while `PendingReview` is allowed (kind `Message`, no status change).

---

## 6. Staff per-project endpoints (`ManagerProjects/{projectId}/client-requests/*`) — CHANGED

- **GET list**: Admin → every status except `Rejected` (unless `status=Rejected`).
  **Developer → approved statuses only** (`PendingReview`/`NeedsClarification`/`Rejected` never returned,
  not even counted). New fields per 3.1.
- **GET one**: Developer requesting a triage-status request → **404** (not 403 — don't leak existence).
- **PATCH** (`status`, `priority`, `assignedToId`): only on approved requests, else **409
  `request_not_approved`**. Setting `status` to a triage status → **400 `use_triage_endpoint`**.
- **POST comments**: add form field `isInternal` (bool, default false) → `kind = InternalNote`.
  Developers may post internal notes. Clients never see them.

## 7. Surfaces management — NEW (`ManagerProjects/{projectId}/surfaces`)

| Verb | Route | Who |
|---|---|---|
| GET | `ManagerProjects/{projectId}/surfaces` | Admin + project developers (includes inactive, flag shown) |
| POST | `ManagerProjects/{projectId}/surfaces` | Admin |
| PUT | `ManagerProjects/{projectId}/surfaces/{id}` | Admin |
| DELETE | `ManagerProjects/{projectId}/surfaces/{id}` | Admin (soft when referenced) |
| PUT | `ManagerProjects/{projectId}/surfaces/order` body `{ "ids": [3,1,2] }` | Admin |

Body for POST/PUT: `kind, appAudience?, name, platforms?, url?, isActive`.
Validation: `kind != Other` (`surface_kind_invalid`), `appAudience` required for MobileApp,
`name` 1–100, unique per project (case-insensitive) → `surface_name_taken`.

---

## 8. Notifications

Append to `NotificationType` (keep existing numbers; **tell the frontend the numeric values**):

| Type | To | When |
|---|---|---|
| `ClientRequestCreated` (existing) | **Admins only** now | new request |
| `ClientRequestClarificationAnswered` | Admins | client answered a question |
| `ClientRequestApproved` | client + (assignee or project devs) | approved |
| `ClientRequestAssigned` | assignee | approve with assignee / later re-assign via PATCH |
| `ClientRequestRejected` | client (if `notifyClient`) | rejected |
| `ClientRequestClarificationRequested` | client | Admin asked |

Payload: `relatedEntityType = "ClientRequest"`, `relatedEntityId = requestId`, and **`projectId`
in the payload / data** (known gap today — staff notifications can't route without it).
Send notifications **after commit** (use the existing outbox / post-commit pattern if there is one).

How the client is notified: the portal has no inbox, so push the SignalR event (9) and, if the
project already sends WhatsApp/email notifications to the customer, reuse it for
`ClarificationRequested` / `Approved` / `Rejected` with a deep link `/portal/requests/{id}`.
If no such channel exists, skip it and say so in the frontend prompt.

## 9. Realtime (`/hubs/app`)

- Existing `ClientRequestUpdated` `{ projectId, requestId, status }` → send to
  `client-customer-{customerId}` on every change (already done for some — make it every transition).
- Send the same event to the **Admins** group on every create / transition / client comment.
- Send to project developers **only for approved statuses**.
- NEW `ClientRequestsSummaryChanged` `{ }` → Admins group, whenever the summary (5.2) changes,
  so the sidebar badge refreshes without polling.

## 10. Errors

Use the existing `ApiResponse` envelope and the existing error shape with `data.reason`
(the frontend's `ApiError.reason` reads it). New reason codes:

`invalid_transition`, `request_rejected`, `request_not_approved`, `use_triage_endpoint`,
`target_required`, `app_required`, `app_name_required`, `surface_invalid`, `surface_kind_invalid`,
`surface_name_taken`, `assignee_invalid`, `reason_required`.

## 11. Migration & data

- EF migration: new enum columns with defaults (`Target = Other`, `Kind = Message`, `IsArchived = false`).
- Existing requests keep their status (they bypass triage). Do **not** move them to `PendingReview`.
- Seed nothing for surfaces — Admins add them per project from the workspace settings tab.

## 12. Quality bar (non-negotiable)

- State machine in a single domain class with **unit tests for every allowed and forbidden transition**.
- Authorization through policies, not `if (role == …)` scattered in controllers. Developers' query
  filter lives in the repository/specification so no endpoint can forget it.
- All triage actions in a transaction (status + StatusChange comment + timestamps), concurrency-safe.
- No N+1 in the inbox list (project + customer names in one query; counts via projection).
- Integration tests: client create → admin clarify → client answer → admin approve → developer
  sees it; developer GET on a pending request → 404; client reply on rejected → 409.
- Swagger annotations for every new endpoint; enums as strings in Swagger.

---

## 13. When you finish — write the frontend prompt

At the end, **write a prompt for the frontend Claude** (Angular 18, standalone components, signals)
that contains:

1. The final contract as implemented: every route, request/response JSON example, enum string values,
   `reason` codes, the **numeric values** of the new `NotificationType` entries, and the SignalR events.
2. A **"Deviations from the spec"** list — every name, route, field or behaviour that differs from this
   document, with the reason. If nothing differs, say "No deviations".
3. Anything you could NOT do (e.g. no WhatsApp channel for client notifications) and what the frontend
   should show instead.
4. The exact migration/deploy note (is the DB migrated on the shared environment? which base URL?).

The frontend already has the screens built on a mock with these exact names, behind the flag
`CONTRACT_MOCKS.clientRequestsTriage` — they only need to flip it to `false` and diff your contract
against theirs.
