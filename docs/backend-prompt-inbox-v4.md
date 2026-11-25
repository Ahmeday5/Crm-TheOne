# Backend task: inbox v4. Chat ↔ customer link, shared chat tools, transfer, not-buying reasons, discount approval

You are a senior .NET engineer on TheOneCRM. This brief is self-contained. It lists every endpoint, field, rule, error,
realtime event and notification the Angular frontend needs. **Build on what already exists** (`WhatsApp/*`, `Customers/*`,
`PriceQuotations`, `PaymentRequests`, `PublicPayments`, `Notifications` + FCM, the `hubs/whatsapp` SignalR hub). Do not
create parallel copies. When done, reply with a frontend brief in the usual format (contract + DTOs + errors), plus
answers to the **Questions** marked ❓.

**Why this exists:** the frontend team prototyped these features with data kept **in the browser only** (labels, notes,
reminders, discount-approval codes). A note one rep writes is invisible to the admin on another device. A reminder only
fires while the CRM tab is open. A discount above the limit is blocked only in the UI, and the API accepts it. Everything
below moves that to the server.

Messages come through Mihwar (WhatsApp Cloud + Messenger + Instagram). **No Mihwar changes are needed.** Everything here
uses data you already store per chat/message.

---

## 0. Rules (same as every brief)

- Responses `{ statusCode, message, data }`; errors `{ statusCode, message, details? }`. Every `400` `message` must be
  user-facing **Arabic** (the UI shows it as-is).
- camelCase JSON. Dates in UTC (the UI appends `Z` if missing). "Today/tomorrow" rules use **Africa/Cairo**.
- Paged: `{ pageIndex, pageSize, count, data }`.
- Empty / `null` / `false` query params are never sent by the UI. Treat a missing param as "no filter".
- **Chat permission** below means the same rule as `DELETE WhatsApp/chats/{id}`: Admin, or the employee who owns the
  chat's channel. Otherwise `403`.
- Every change to a chat in §1–§6 must emit the existing **`whatsappChatUpdated`** hub event carrying the **full updated
  chat** (same shape as an item of `GET WhatsApp/chats`) to everyone who can see that chat.

---

## 1. Link a chat to a CRM customer

The inbox already returns `customerId` / `customerName` per chat and shows "غير مسجّل كعميل" when it is null. The frontend
now has **«إضافة كعميل»** and **«ربط بعميل»** on such chats. «إضافة كعميل» opens the normal add-customer form pre-filled
with `contactName` (+ `phone` on WhatsApp) and saves via the existing `POST Customers/CreateCustomer`. Its validation is
**unchanged**: email, campaign and services stay required. Then it links the chat. «ربط بعميل» picks an existing customer.
That is the only way to match Messenger / Instagram chats, which have no phone.

### 1.1 `POST api/WhatsApp/chats/{chatId}/link-customer`
Body `{ "customerId": 123 }`. Chat permission.
- `404`: chat (or deleted chat) or customer not found.
- `400` (Arabic): the chat is already linked to a **different** customer. Re-linking to the same customer is a no-op `200`.
- Effect: set `chat.CustomerId`. Its existing messages now also appear in `GET WhatsApp/customers/{customerId}/messages`.
- `200` → `data` = the updated chat (with `customerId`, `customerName`, `companyName`). Emit `whatsappChatUpdated`.

### 1.2 Auto-link WhatsApp chats by phone
On `CreateCustomer`, on `updateCustomer` when the phone changes, and on every incoming message of an unlinked chat:
link every **WhatsApp** chat with `CustomerId == null` whose phone matches. Normalize both sides exactly like the
duplicate-phone check (`01012345678` = `+20 101 234 5678` = `00201012345678`). Emit `whatsappChatUpdated` per chat.

### 1.3 Email becomes optional for customers
Chat customers rarely have an email. **The frontend already made email optional** on add-customer and edit-customer.
- `POST Customers/CreateCustomer` and `PUT Customers/updateCustomer/{id}` accept `email` as `""`, `null` or missing.
  Store `null`. When it is present it must still be a valid email (`400` in Arabic otherwise).
- Any uniqueness check on email must ignore empty values.
- Every read returns `email: null` for customers without one. Exports, the customer details page and contract/quotation
  PDFs must not break on a null email.
- Everything else stays required as today: name, phone, campaign, services and the sales rep assignment.

### 1.4 Confirm
- `POST Customers/CreateCustomer` returns the new customer's `id` in `data`.
- `contactName` is filled for Messenger and Instagram chats (profile name).

---

## 2. Chat labels (shared by the whole team)

Fixed set (enum, stored as strings):

| Code | Arabic label (UI) |
|---|---|
| `Interested` | مهتم |
| `QuoteSent` | عرض سعر اتبعت |
| `AwaitingPayment` | مستني دفع |
| `FollowUp` | متابعة |
| `Closed` | مغلق |

- **`PUT api/WhatsApp/chats/{chatId}/labels`** with body `{ "labels": ["Interested", "QuoteSent"] }`. It **replaces** the
  whole set, and an empty array clears it. Chat permission. Unknown code → `400`. `200` → updated chat + `whatsappChatUpdated`.
- `GET WhatsApp/chats` items gain `labels: string[]`.
- `GET WhatsApp/chats` gains filter `label=<code>` (one code; combines with existing `search`, `instanceId`, `unreadOnly`).

---

## 3. Internal notes (team only, never sent to the customer)

| Endpoint | Who | Notes |
|---|---|---|
| `GET api/WhatsApp/chats/{chatId}/notes` | chat permission | newest first, not paged (cap 200) |
| `POST api/WhatsApp/chats/{chatId}/notes` `{ "text": "…" }` | chat permission | 1–1000 chars, trimmed; `201` → the note |
| `DELETE api/WhatsApp/chats/{chatId}/notes/{noteId}` | the note's author, or Admin | otherwise `403` |

```ts
interface ChatNote { id: number; chatId: number; text: string; createdById: string; createdByName: string;
                     createdAt: string; isSystem: boolean; }   // isSystem = auto notes from §6 (not deletable by reps)
```
- `GET WhatsApp/chats` items gain `notesCount: number`.
- Every add/delete emits `whatsappChatUpdated` (so `notesCount` updates live). Please also emit a new hub event
  **`whatsappChatNoteAdded`** `{ chatId, note }` so an open notes panel can append without refetching.

---

## 4. Reminders («ذكّرني») that fire even when the CRM is closed

| Endpoint | Who |
|---|---|
| `POST api/WhatsApp/chats/{chatId}/reminders` `{ "dueAt": "2026-11-26T08:00:00Z", "note": "رد على عرض السعر" }` | chat permission |
| `GET api/WhatsApp/reminders?status=pending\|due\|done&pageIndex&pageSize` | the caller's own reminders (Admin: `userId=` optional) |
| `POST api/WhatsApp/reminders/{id}/done` | its owner, or Admin |
| `DELETE api/WhatsApp/reminders/{id}` | its owner, or Admin |

```ts
interface ChatReminder { id: number; chatId: number; customerId: number | null; contactName: string | null;
                         dueAt: string; note: string | null; status: 'Pending' | 'Due' | 'Done';
                         createdById: string; createdByName: string; createdAt: string; }
```
- `dueAt` must be in the future (`400` otherwise). `note` ≤ 300 chars, optional.
- **At `dueAt` the server sends a new notification type `ChatReminderDue`** to the reminder's owner through the existing
  `Notifications` pipeline **and FCM push**. Payload: `{ reminderId, chatId, customerId, contactName, note }`,
  `relatedEntityType: "WhatsAppChat"`, `relatedEntityId: chatId` (so the existing deep link opens the chat).
  Status becomes `Due`.
- **If the chat is linked to a customer**, also set that customer's `nextFollowUpDate = dueAt` (same as
  `POST Customers/{id}/followUp`), so it shows on the follow-ups page. Done/deleted does not roll that back.
- `GET WhatsApp/chats` items gain `nextReminderAt: string | null` (the earliest pending/due reminder of **any** user on
  that chat) and `reminderDue: boolean`.
- Every create/done/delete emits `whatsappChatUpdated`.

---

## 5. "Awaiting reply" (مستني رد)

Today the UI guesses this from `unreadCount`, so opening a chat without replying hides it. It must be based on **replies**.

- `GET WhatsApp/chats` items gain:
  - `lastMessageDirection: 'Incoming' | 'Outgoing' | null`
  - `awaitingReplySince: string | null`: the time of the **oldest incoming message after our last outgoing message**.
    `null` when our message is the latest. Templates and media count as replies. Reading does not.
- New filters on `GET WhatsApp/chats` (combine with the existing ones):
  - `awaitingReply=true`: only chats with `awaitingReplySince` older than the threshold, **oldest first**.
  - `hasReminder=true`: only chats with a pending/due reminder, ordered by `nextReminderAt` ascending.
- **`GET api/WhatsApp/chats/counters`** (`instanceId?`, Admin may pass any) → `{ awaitingReply: number, overdueReminders: number }`
  for the two red badges. Scope = the chats the caller can see.
- Threshold: **60 minutes**, configurable (`AwaitingReplyThresholdMinutes` in settings). Return it in the counters
  response as `thresholdMinutes` so the UI uses the same number.

---

## 6. Transfer a chat to a colleague

**`POST api/WhatsApp/chats/{chatId}/transfer`** `{ "toUserId": "…", "message": "العميل عايز عرض لبرنامج العيادات" }`
- Allowed for **Admin and Sales** with chat permission. The chat **must be linked to a customer**; otherwise `400`
  "اربط المحادثة بعميل الأول".
- `toUserId` must be a **Sales** user. For Support, the UI keeps using the existing
  `POST Customers/{id}/AssignToSupportPerson` (it books an appointment). Please add the same system note there when the
  request carries `chatId` (add an optional `chatId` to that body).
- Effect, in one transaction:
  1. Assign the customer to `toUserId` (same logic, activity and rules as `POST Customers/{id}/assign`).
  2. Add a system note (§3, `isSystem: true`): "اتحوّل لـ <name>" + the message.
  3. Notify `toUserId` with a new type **`ChatTransferred`**: `{ chatId, customerId, customerName, fromUserName, message }`,
     `relatedEntityType: "WhatsAppChat"`.
  4. Emit `whatsappChatUpdated`.
- `200` → updated chat.

❓ **Question:** chats belong to a channel (the sender's number/page). After a transfer, how does the colleague see and
answer this conversation? Options: (a) grant the new rep read + reply access to this chat through the original channel;
(b) read-only access, and they reply from their own number by starting a new chat (template, since the 24h window is per
number); (c) something else. Pick one, implement it, and describe the exact behaviour (which list the chat shows up in,
`canReply`, ownership) in your reply.

---

## 7. Customer side panel next to the chat

The panel uses `GET Customers/{id}/getCustomerById` (already enough for name, status, phone, email, sales rep, support
person, source, created date, services, team notes).
- Missing: **the customer's last support tickets.** Confirm that `GET SupportTickets/GetTickets` supports
  `customerId=` (+ `pageSize=3`, newest first), or add it. Roles: whoever can open the chat.

---

## 8. Fixed "not buying" reasons

Free-text reasons can't be grouped in reports. Add a reason code to the existing status change.

`PUT api/Customers/{id}/status` body becomes:
```json
{ "status": "NotBuyer", "notBuyingReasonCode": "PriceTooHigh", "notBuyingReason": "تفاصيل اختيارية" }
```
| Code | Arabic |
|---|---|
| `PriceTooHigh` | السعر مرتفع |
| `ChoseCompetitor` | اختار منافس |
| `BudgetTooLow` | الميزانية مش كفاية |
| `NotNeededNow` | مش محتاج الخدمة دلوقتي |
| `NoResponse` | مفيش رد |
| `Other` | أخرى |

- For `NotBuyer`: `notBuyingReasonCode` is **required**. `notBuyingReason` (details) is optional, except it is
  **required when the code is `Other`**. `400` (Arabic) otherwise.
- Every customer read that returns `notBuyingReason` also returns `notBuyingReasonCode`. Existing rows: `Other`, with
  the old text kept as the details.
- `GET Sales/NotBuyingReasons` and the sales-analysis report group by **code** and return `{ code, count }[]`.
  Keep the old free-text list available, or tell us the new shape.

---

## 9. Manager approval for discounts above the limit (enforced by the server)

**Rule:** a discount above **10 %** of the amount (configurable, `DiscountApprovalThresholdPercent`) on a **price
quotation** or a **payment link** needs an Admin's approval code. **Admins never need one.**

The prototype checked this in the UI only, and its codes "work from any device" without a server. That means a code
can be computed or bypassed. It must be issued and checked here.

### 9.1 Requests
**`POST api/DiscountApprovals`** (Sales, Marketing, Support: anyone who can create quotations or payment links)
```json
{ "type": "PriceQuotation", "customerId": 12, "amount": 5000, "discount": 750, "referenceId": null }
```
- `type`: `PriceQuotation` | `PaymentRequest`. `amount` = total before discount. `referenceId` = quotation id when
  editing an existing quotation.
- `400` if the discount is not above the threshold ("الخصم ده مش محتاج موافقة") or `discount > amount`.
- `201` → `DiscountApproval` (status `Pending`). Notify **every Admin** with a new type **`DiscountApprovalRequested`**:
  `{ approvalId, type, customerName, requesterName, amount, discount, percent }`, `relatedEntityType: "DiscountApproval"`.

```ts
interface DiscountApproval {
  id: number; type: 'PriceQuotation' | 'PaymentRequest';
  customerId: number; customerName: string;
  amount: number; discount: number; netAmount: number; percent: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Used' | 'Expired';
  requestedById: string; requestedByName: string; requestedAt: string;
  decidedById: string | null; decidedByName: string | null; decidedAt: string | null;
  code: string | null;          // only returned to Admins and to the requester after approval
  validUntil: string | null;    // end of tomorrow, Cairo time
  rejectReason: string | null;
  referenceId: number | null;   // quotation / payment request that used it
}
```

### 9.2 Admin
| Endpoint | Notes |
|---|---|
| `GET api/DiscountApprovals?status=&pageIndex&pageSize` | Admin: all. Others: their own requests |
| `GET api/DiscountApprovals/{id}` | Admin, or the requester |
| `POST api/DiscountApprovals/{id}/approve` | Admin. Generates a random **6-digit** code, valid **today and tomorrow** (Cairo). `200` → approval with `code` |
| `POST api/DiscountApprovals/{id}/reject` `{ "reason": "…" }` | Admin |

On approve/reject notify the requester with **`DiscountApprovalDecided`**: `{ approvalId, status, code?, validUntil?, reason? }`.
The rep can then type the code they received, or the UI can fill it from the notification.

### 9.3 Enforcement
`POST/PUT api/PriceQuotations` and `POST api/PaymentRequests` accept an optional `"approvalCode": "224337"`.
When the caller is **not Admin** and the discount is above the threshold, the save is rejected with `400` (Arabic)
unless the code:
- exists, is `Approved`, is not expired and was not used;
- matches the **same type, customer, amount and discount**. Any change after approval needs a new approval;
- belongs to an approval the caller requested.

On success, mark the approval `Used` and set `referenceId`.
**Editing an existing quotation without increasing its discount does not need a code.**

Messages: `"الخصم ده محتاج موافقة المدير"`, `"كود الموافقة غلط أو منتهي"`,
`"كود الموافقة مش لنفس المبلغ والخصم — اطلب موافقة جديدة"`.

### 9.4 Discount on payment links
- `POST PaymentRequests` gains `discount: number` (optional, ≥ 0, < amount). `amount` in the body stays the price
  **before** the discount.
- `PaymentRequest` (staff) and `GET PublicPayments/{token}` (public page) return
  `originalAmount`, `discount` and `amount` (= net, the amount to pay). The pay page and the WhatsApp message show the
  original struck through.
- Validation of the discount follows §9.3.

### 9.5 Settings
`GET api/Settings/sales-rules` (any staff) → `{ discountApprovalThresholdPercent: 10, awaitingReplyThresholdMinutes: 60 }`.
Admin `PUT` the same, if a settings endpoint pattern already exists. Otherwise, config is fine; just expose the GET.

---

## 10. Realtime and notifications summary

| What | Where |
|---|---|
| `whatsappChatUpdated` (full chat) | link (§1), labels (§2), note add/delete (§3), reminder create/done/delete (§4), transfer (§6) |
| `whatsappChatNoteAdded` `{ chatId, note }` | §3 |
| Notification `ChatReminderDue` | §4. FCM push too |
| Notification `ChatTransferred` | §6 |
| Notification `DiscountApprovalRequested` (to Admins) | §9.1 |
| Notification `DiscountApprovalDecided` (to requester) | §9.2 |

New fields on each `GET WhatsApp/chats` item: `labels`, `notesCount`, `nextReminderAt`, `reminderDue`,
`lastMessageDirection`, `awaitingReplySince`. New filters: `label`, `awaitingReply`, `hasReminder`.

---

## 11. Acceptance

1. WhatsApp chat from an unknown number → «إضافة كعميل» → save → the header shows «ملف العميل» at once, also in a second
   browser. Saving a customer with no email works. Saving one with an invalid email → `400`.
2. Messenger chat → «ربط بعميل» → linked; the customer's WhatsApp tab shows the Messenger messages. Linking a chat already
   linked to someone else → `400`.
3. Rep A adds a label and a note on device 1 → Admin sees both on device 2 without reloading. Rep A deletes the note;
   rep B can't delete A's note (`403`).
4. A reminder for in 2 minutes fires a `ChatReminderDue` push **with the CRM closed**. For a linked customer, the
   follow-ups page shows the date.
5. A customer message unanswered for 61 min shows under `awaitingReply=true`. Opening the chat without replying keeps it
   there. Replying removes it. `counters` match the filters.
6. Transfer to a sales rep → customer reassigned, rep notified with the message, system note added. Transfer of an
   unlinked chat → `400`.
7. NotBuyer without a code → `400`. `Other` without details → `400`. The report groups by code.
8. Rep saves a quotation with a 15 % discount and no code → `400`. Requests approval → Admin approves → the rep saves with
   the code → OK, and the code is now `Used`. Changing the discount after approval → `400`. The same code on a second
   quotation → `400`. An Admin saves a 30 % discount with no code → OK.
9. Payment link with a discount: the public page returns original, discount and net.
10. Swagger documents every new endpoint, field, filter and enum.
