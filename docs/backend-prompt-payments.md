# Backend Prompt — روابط الدفع من الشات (InstaPay + المحافظ)

> الملف ده موجّه لمطوّر الباك إند (ASP.NET Core). الفرونت متكتب على الـ contract ده بالظبط، وشغّال دلوقتي على mock لحد ما الـ endpoints تتنشر.
> **أي تغيير في أسماء الحقول أو الـ routes أو قيم الـ enums لازم يتبلّغ للفرونت.**

---

## 1. الفكرة باختصار

الموظف بيبقى في محادثة واتساب، فيدوس زرار **"طلب دفعة"** ويعمل كده:

1. يختار حساب الشركة اللي العميل هيحوّل عليه: InstaPay، أو محفظة من الأربعة (فودافون كاش، اتصالات كاش، أورنج كاش، WE Pay).
2. يكتب المبلغ، والوصف، ومدة صلاحية الرابط بالأيام.
3. بيانات العميل بتتملي لوحدها من المحادثة: الاسم والهاتف والإيميل.
4. الباك إند **ينشئ طلب دفع** بـ token سري، ويرجّعه.
5. الفرونت يبعت رسالة في نفس المحادثة فيها الرابط `https://<frontend>/pay/{token}`، من خلال endpoint الإرسال الموجود `WhatsApp/send`.
6. العميل يفتح الرابط من غير تسجيل دخول، فتظهر له صفحة فيها:
   - زرار يفتح تطبيق InstaPay، أو تطبيق المحفظة (Ana Vodafone / My Etisalat / My Orange / My WE)، على طول.
   - كود USSD للدفع من غير إنترنت.
   - لو الطلب على محفظة فودافون والعميل معاه اتصالات، تظهر له المحافظ التانية كلها. كل واحدة فيها "فتح التطبيق" و"كود الدفع"، والتحويل يروح على نفس الرقم.
7. العميل يدوس **"تم التحويل"**، ويكتب الرقم اللي حوّل منه أو رقم العملية، ويرفع صورة الإيصال لو حب. الحالة تبقى `CustomerConfirmed`.
8. الموظف يتأكد إن الفلوس وصلت فعلاً، ويدوس **"تأكيد الدفع"**. الحالة تبقى `Paid`.

### المطلوب من الباك إند

- يخزّن **طرق الدفع** (حسابات الشركة)، وإدارتها للأدمن بس.
- يخزّن **طلبات الدفع** مع snapshot ثابت من طريقة الدفع وقت الإنشاء.
- يوفّر endpoints عامة (Anonymous) لصفحة العميل.
- يقفل الطلبات اللي انتهت صلاحيتها.
- يبعت notification للموظف لما العميل يأكّد التحويل.

### المطلوب منه **لأ**

- ❌ مفيش ربط مع InstaPay أو أي محفظة أو بوابة دفع. مفيش API رسمي يسمح بإنشاء طلب دفع بمبلغ أو التحقق منه، **والتحقق يدوي 100%**.
- ❌ مفيش علاقة بمحور (Mihwar). الرسالة بتتبعت من الفرونت عن طريق `WhatsApp/send` العادي.
- ❌ deep links التطبيقات وأكواد الـ USSD بيبنيها الفرونت حسب نوع الموبايل (Android/iOS). الباك إند بيرجّع البيانات الخام بس: النوع، الرقم، الـ IPA، ورابط InstaPay.

---

## 2. القواعد العامة (زي باقي الـ API)

- **Envelope:** كل الـ responses بالشكل `{ statusCode, message, data }`.
- **الصفحات:** الـ paged lists بالشكل `{ pageIndex, pageSize, count, data: [] }`، و`count` هو الإجمالي. `pageSize` أقصاه 100.
- **الـ enums بتتبعت كـ string** (اسم الـ enum مش رقمه). يعني `JsonStringEnumConverter` على الـ endpoints دي.
- **التواريخ:** ISO-8601 بـ UTC وفي آخرها `Z`، زي `2026-11-18T10:00:00Z`.
- **الأخطاء:** الـ status المناسب، و`message` بالعربي، و`data.reason` كود ثابت (الجدول في §7). أخطاء الـ validation ترجع field errors بالشكل المعتاد.
- **CORS على ردود الأخطاء ⚠ مهم:** `UseCors` لازم يتسجّل **قبل** `UseAuthentication`/`UseAuthorization` وقبل أي exception handler، عشان أي رد (400/401/404/413/500) يطلع فيه `Access-Control-Allow-Origin`. وإلا المتصفح يخفي الخطأ الحقيقي ويعرض "CORS error" بـ status 0. ده نفس اللي حصل في رفع الـ APK على `DeveloperProjects/{id}/releases`، وهناك السبب غالباً حد حجم الـ request على IIS/Kestrel.
- لازم الـ origin بتاع الفرونت يبقى مسموح (`http://crmtheone.theonesystemco.com` و`https://…`) على الـ endpoints العامة كمان.

---

## 3. الـ Entities

### 3.1 `PaymentMethod` — حساب تستقبل عليه الشركة

| Field | Type | Rules |
|---|---|---|
| `Id` | int PK | |
| `Type` | enum `PaymentMethodType` | `InstaPay`, `VodafoneCash`, `EtisalatCash`, `OrangeCash`, `WePay` |
| `AccountName` | nvarchar(120) | **required**. اسم صاحب الحساب بالظبط زي ما هيظهر للعميل في التطبيق |
| `PhoneNumber` | varchar(11) null | **required للمحافظ** وبيطابق `^01[0125]\d{8}$`. اختياري لـ InstaPay بنفس الـ regex. يتخزن بالصيغة المحلية `01xxxxxxxxx` (حوّل `+20` / `20` لـ `0`) |
| `InstapayAddress` | varchar(100) null | InstaPay بس. بيطابق `^[A-Za-z0-9._-]+@instapay$` (case-insensitive) ويتخزن lowercase |
| `InstapayLink` | varchar(300) null | InstaPay بس. لازم `https://`، ويُفضَّل host `ipn.eg` (ما ترفضش غيره، بس اعمل validation إنه URL صحيح) |
| `Instructions` | nvarchar(300) null | تعليمات تظهر للعميل |
| `Currency` | varchar(3) | ثابت `"EGP"` |
| `IsActive` | bit | default true |
| `SortOrder` | int | default 0 |
| `CreatedAt` | datetime2 UTC | |
| `UpdatedAt` | datetime2 UTC null | |
| `CreatedById` / `UpdatedById` | string FK → Users | |
| `IsDeleted` | bit | **soft delete**، عشان الطلبات القديمة بتشير ليها |

**Validation:**
- **InstaPay:** لازم يبقى فيه `InstapayAddress` **أو** `InstapayLink`، واحد على الأقل. ولو مفيش الاتنين يرجع `400 INSTAPAY_TARGET_REQUIRED`.
- **محفظة:** `PhoneNumber` إجباري وصحيح، وإلا `400 INVALID_PHONE`. ولو اتبعتت حقول InstaPay مع محفظة، تتخزن `null`.
- ممنوع يتكرر نفس `(Type, PhoneNumber)` أو نفس `InstapayAddress` بين الطرق اللي مش محذوفة، وإلا `409 DUPLICATE_METHOD`.

### 3.2 `PaymentRequest` — طلب دفع

| Field | Type | Rules |
|---|---|---|
| `Id` | int PK | |
| `Token` | varchar(64) **unique index** | random آمن: 24 byte أو أكتر من `RandomNumberGenerator`، بـ Base64Url. **مش** Guid ومش متسلسل |
| `Amount` | decimal(12,2) | من 1 لـ 1,000,000 |
| `Currency` | varchar(3) | `"EGP"` |
| `Description` | nvarchar(200) null | |
| `Status` | enum `PaymentRequestStatus` | `Pending`, `CustomerConfirmed`, `Paid`, `Cancelled`, `Expired` |
| `ExpiresAt` | datetime2 UTC | `CreatedAt + ValidityDays`، والأيام من 1 لـ 90 |
| `MethodId` | int FK null | الطريقة الأصلية (ممكن تتحذف بعدين) |
| **Snapshot:** `MethodType`, `MethodAccountName`, `MethodPhoneNumber`, `MethodInstapayAddress`, `MethodInstapayLink`, `MethodInstructions` | نفس أنواع §3.1 | **بتتنسخ وقت الإنشاء ومش بتتغير أبداً**، حتى لو الأدمن عدّل الطريقة أو حذفها |
| `CustomerName` | nvarchar(120) null | |
| `CustomerPhone` | varchar(20) null | digits بس، ومسموح `+` في الأول |
| `CustomerEmail` | nvarchar(200) null | email صحيح |
| `ChatId` | int FK null → WhatsApp chats | |
| `CustomerId` | int FK null → Customers | |
| `CreatedById` | string FK → Users | من الـ JWT |
| `CreatedAt` | datetime2 UTC | |
| `PayerPhone` | varchar(20) null | من صفحة العميل |
| `PayerReference` | nvarchar(100) null | رقم العملية |
| `ReceiptPath` | nvarchar(300) null | مسار صورة الإيصال |
| `CustomerConfirmedAt` | datetime2 null | |
| `PaidAt` | datetime2 null | |
| `PaidById` | string FK null | |
| `StaffNote` | nvarchar(300) null | |
| `CancelledAt` / `CancelledById` | null | |
| `ViewCount` | int | default 0 |
| `LastViewedAt` | datetime2 null | |

**Indexes:** `Token` (unique)، و`(Status, ExpiresAt)`، و`ChatId`، و`CreatedById`، و`CreatedAt desc`.

### 3.3 حالات الطلب (State machine)

```
Pending ──(العميل: confirm)──► CustomerConfirmed ──(موظف: mark-paid)──► Paid
   │                                   │
   ├──(موظف: mark-paid)──► Paid        ├──(موظف: cancel)──► Cancelled
   ├──(موظف: cancel)────► Cancelled
   └──(ExpiresAt < now)──► Expired     (CustomerConfirmed مش بتنتهي — مستنية مراجعة)
```

- `Paid` و`Cancelled` و`Expired` حالات نهائية. أي action عليها يرجّع `409 INVALID_STATE`.
- **مسموح** `mark-paid` على `Expired`، لأن العميل ممكن يكون حوّل متأخر. ده الاستثناء الوحيد.
- **الانتهاء:** في كل read (list / get / public) حوّل أي `Pending` عدّى `ExpiresAt` لـ `Expired` (lazy). وكمان اعمل `BackgroundService` كل ساعة يعمل نفس الحاجة عشان الإحصائيات.

---

## 4. Endpoints — طرق الدفع (`PaymentMethods`)

الأدوار: `Admin`، `Sales`، `Support` (نفس أدوار واتساب).

### `GET /api/PaymentMethods`
- **أي موظف:** يرجع الطرق المفعّلة وغير المحذوفة بس.
- `?includeInactive=true` **للأدمن بس**، ويرجّع المتوقفة كمان. لو مش أدمن، تجاهل الـ parameter.
- الترتيب: `SortOrder` ثم `Id`.
- **Response `data`:** `PaymentMethod[]`

```json
{
  "id": 2,
  "type": "VodafoneCash",
  "accountName": "The One System",
  "phoneNumber": "01000000002",
  "instapayAddress": null,
  "instapayLink": null,
  "instructions": null,
  "currency": "EGP",
  "isActive": true,
  "sortOrder": 1,
  "createdAt": "2026-11-18T10:00:00Z",
  "updatedAt": null
}
```

### `POST /api/PaymentMethods` — Admin
**Body:**
```json
{
  "type": "InstaPay",
  "accountName": "The One System",
  "phoneNumber": "01000000001",
  "instapayAddress": "theone@instapay",
  "instapayLink": "https://ipn.eg/S/theone/instapay/AbC123",
  "instructions": "اكتب رقم الفاتورة في الملاحظات",
  "isActive": true,
  "sortOrder": 0
}
```
**Response:** `201`، و`data` = الـ `PaymentMethod` المحفوظ.

### `PUT /api/PaymentMethods/{id}` — Admin
نفس الـ body، و**Response** = `PaymentMethod` بعد التعديل. **ما يغيّرش أي طلب اتعمل قبل كده** (الطلبات عندها snapshot).

### `DELETE /api/PaymentMethods/{id}` — Admin
Soft delete. **Response** `200` و`data: null`. الطلبات المرتبطة تفضل شغالة عادي.

---

## 5. Endpoints — طلبات الدفع (`PaymentRequests`)

**الصلاحيات:**
- **Admin:** يشوف ويتحكم في كل الطلبات.
- **Sales/Support:** يشوف ويتحكم في الطلبات اللي **هو أنشأها**، أو اللي على **محادثة متعيّنة له**. أي طلب تاني يرجّع `404` (مش 403، عشان ما نكشفش وجوده).

### `POST /api/PaymentRequests`
**Body:**
```json
{
  "methodId": 2,
  "amount": 1500,
  "description": "حجز جلسة",
  "validityDays": 14,
  "customerName": "Mohamad Fathy",
  "customerPhone": "+201033171715",
  "customerEmail": null,
  "chatId": 812,
  "customerId": null
}
```

**Validation:**

| الشرط | لو اتكسر يرجّع |
|---|---|
| `methodId` موجود ومفعّل ومش محذوف | `400 METHOD_INACTIVE` |
| `amount` من 1 لـ 1,000,000، ورقمين عشريين بالكتير | `400 INVALID_AMOUNT` |
| `validityDays` من 1 لـ 90 | `400 VALIDATION` |
| `customerPhone` **أو** `customerEmail` واحد منهم على الأقل | `400 CONTACT_REQUIRED` |
| `customerPhone` لو موجود بيطابق `^\+?\d{8,15}$` | `400 VALIDATION` |
| `customerEmail` لو موجود صحيح | `400 VALIDATION` |

- لو `chatId` موجود، اتأكد إن الموظف عنده صلاحية على المحادثة دي، وإلا `404 NOT_FOUND`.
- **Response:** `201`، و`data` = `PaymentRequest` (الشكل في الآخر).

### `GET /api/PaymentRequests`
**Query:**
- `pageIndex` (default 1)، `pageSize` (default 20، أقصاه 100).
- `status` واحد من الـ enum.
- `search`: بيدوّر في `customerName` و`customerPhone` و`customerEmail` و`description` و`payerReference`، contains و case-insensitive.
- `chatId`.

الترتيب: `CreatedAt desc`.

**Response:** `{ pageIndex, pageSize, count, data: PaymentRequest[] }`

### `GET /api/PaymentRequests/{id}`
**Response:** `PaymentRequest`

### `POST /api/PaymentRequests/{id}/mark-paid`
**Body:** `{ "note": "رقم العملية 123456" }`، و`note` اختياري لحد 300 حرف.

**مسموح من:** `Pending`، `CustomerConfirmed`، `Expired`. غير كده `409 INVALID_STATE`.

**بيحدّث:** `Status=Paid`، و`PaidAt=now`، و`PaidById` من الـ JWT، و`StaffNote=note`.

**Response:** `PaymentRequest`

### `POST /api/PaymentRequests/{id}/cancel`
**Body:** `{}`

**مسموح من:** `Pending`، `CustomerConfirmed`. غير كده `409 INVALID_STATE`.

**Response:** `PaymentRequest`

### شكل `PaymentRequest` في الـ response (الأسماء بالظبط)
```json
{
  "id": 41,
  "token": "q3V9zK0bX2y7Lm1PqR8sT4uV",
  "amount": 1500.00,
  "currency": "EGP",
  "description": "حجز جلسة",
  "status": "CustomerConfirmed",
  "expiresAt": "2026-12-02T10:00:00Z",
  "method": {
    "methodId": 2,
    "type": "VodafoneCash",
    "accountName": "The One System",
    "phoneNumber": "01000000002",
    "instapayAddress": null,
    "instapayLink": null,
    "instructions": null
  },
  "customerName": "Mohamad Fathy",
  "customerPhone": "+201033171715",
  "customerEmail": null,
  "chatId": 812,
  "customerId": null,
  "createdById": "c1b2…",
  "createdByName": "Hadeer Muhammed",
  "createdAt": "2026-11-18T10:00:00Z",
  "payerPhone": "01112223334",
  "payerReference": "TRX-998877",
  "receiptUrl": "/uploads/payment-receipts/2026/11/41-9f2c.jpg",
  "customerConfirmedAt": "2026-11-18T12:30:00Z",
  "paidAt": null,
  "paidByName": null,
  "staffNote": null,
  "cancelledAt": null,
  "viewCount": 3,
  "lastViewedAt": "2026-11-18T12:25:00Z"
}
```
- `method` بيتملي من الـ **snapshot**، مش من جدول `PaymentMethods`.
- `receiptUrl` مسار نسبي من origin الـ API (من غير `/api`)، زي باقي الـ uploads. الفرونت بيكمّله بـ `assetUrl`.
- **الأفضل** يتخدم الإيصال من endpoint محمي بالـ JWT بدل static file. لو كده، رجّع الـ route في `receiptUrl` وقولّنا عشان نجيبه كـ blob.

---

## 6. Endpoints العامة — صفحة العميل (`PublicPayments`) — `[AllowAnonymous]`

> الـ endpoints دي **بدون JWT**، والـ token هو الصلاحية الوحيدة. **ممنوع** ترجّع أي حقل داخلي: لا `createdBy`، ولا `chatId`، ولا `customerPhone`، ولا `staffNote`، ولا `id`.

### `GET /api/PublicPayments/{token}`
- لو الـ token مش موجود: `404 NOT_FOUND`، وبنفس زمن الرد تقريباً (ما تفرّقش بين "مش موجود" و"اتمسح").
- طبّق الانتهاء (lazy) قبل ما ترجّع.
- زوّد `ViewCount` وحدّث `LastViewedAt`. ممكن تتجاهل الزيارات المكررة من نفس الـ IP خلال 5 دقايق.
- **رجّع الطلب في كل الحالات** (`Expired` / `Cancelled` / `Paid`) بـ `200`، والفرونت هو اللي يعرض الشاشة المناسبة.
- **Response `data`:**
```json
{
  "amount": 1500.00,
  "currency": "EGP",
  "description": "حجز جلسة",
  "status": "Pending",
  "expiresAt": "2026-12-02T10:00:00Z",
  "method": {
    "methodId": 2,
    "type": "VodafoneCash",
    "accountName": "The One System",
    "phoneNumber": "01000000002",
    "instapayAddress": null,
    "instapayLink": null,
    "instructions": null
  },
  "merchantName": "The One System",
  "customerName": "Mohamad Fathy",
  "customerConfirmedAt": null,
  "paidAt": null
}
```
- `merchantName` من الإعدادات (`appsettings: Payments:MerchantName`).
- الهيدرز: `Cache-Control: no-store` و`X-Robots-Tag: noindex`.

### `POST /api/PublicPayments/{token}/confirm` — `multipart/form-data`

| Field | Rules |
|---|---|
| `payerPhone` | اختياري، `^\+?\d{8,15}$` |
| `payerReference` | اختياري، لحد 100 حرف |
| `receipt` | ملف اختياري: `image/jpeg` أو `image/png` أو `image/webp`، **≤ 5 MB**. اتأكد من الـ magic bytes مش الامتداد بس |

- لازم واحد على الأقل من `payerPhone` / `payerReference`، وإلا `400 VALIDATION`.
- **مسموح بس** لو الحالة `Pending` وما انتهتش. غير كده `409 INVALID_STATE` (والـ `message` بيقول الحالة).
- خزّن الصورة باسم عشوائي (مش اسم الملف الأصلي) في `uploads/payment-receipts/yyyy/MM/`.
- **بيحدّث:** `Status=CustomerConfirmed`، و`CustomerConfirmedAt=now`، والحقول اللي اتبعتت.
- **Notification** (§8).
- **Response:** نفس شكل `GET /PublicPayments/{token}` بعد التحديث.
- **حد الحجم:** `[RequestSizeLimit(6_000_000)]` + `[RequestFormLimits(MultipartBodyLengthLimit = 6_000_000)]`. وعلى IIS اتأكد إن `maxAllowedContentLength` أكبر من كده.

### Rate limiting (إجباري على الـ public)
استخدم `Microsoft.AspNetCore.RateLimiting`:

| Endpoint | الحد | لو اتعدّى |
|---|---|---|
| `GET` | 60 طلب/دقيقة لكل IP | `429` + `Retry-After` |
| `confirm` | 5 طلبات/ساعة لكل token، و20/ساعة لكل IP | `429` + `Retry-After` |

---

## 7. أكواد الأخطاء (`data.reason`)

| HTTP | reason | امتى |
|---|---|---|
| 400 | `VALIDATION` | أي حقل غلط (ومعاه field errors) |
| 400 | `INVALID_PHONE` | رقم محفظة غلط |
| 400 | `INSTAPAY_TARGET_REQUIRED` | InstaPay من غير IPA ولا رابط |
| 400 | `METHOD_INACTIVE` | الطريقة متوقفة أو محذوفة |
| 400 | `INVALID_AMOUNT` | المبلغ برا المدى |
| 400 | `CONTACT_REQUIRED` | مفيش هاتف ولا إيميل |
| 400 | `INVALID_FILE` | الإيصال مش صورة أو أكبر من 5MB |
| 404 | `NOT_FOUND` | مش موجود أو مش من صلاحيتك |
| 409 | `INVALID_STATE` | action مش مسموح في الحالة دي |
| 409 | `DUPLICATE_METHOD` | الحساب متضاف قبل كده |
| 429 | `RATE_LIMITED` | |

**مثال:**
```json
{ "statusCode": 409, "message": "لا يمكن تأكيد هذا الطلب — الرابط منتهي", "data": { "reason": "INVALID_STATE" } }
```

---

## 8. Notifications + Realtime

- لما العميل يعمل `confirm`، ابعت notification بالنظام الموجود (نفس جدول الـ notifications ونفس hub `/hubs/app`) لـ:
  - **منشئ الطلب**.
  - **كل الـ Admins**.
- النوع: نوع جديد **`PaymentConfirmedByCustomer`** وادّيله الرقم الجاي في الـ enum (**قولّنا الرقم**).
- الـ payload:
  ```json
  { "paymentRequestId": 41, "amount": 1500, "customerName": "…", "chatId": 812 }
  ```
- العنوان: `"العميل أكّد تحويل 1,500 ج.م"`.
- **اختياري:** event على الـ hub اسمه `paymentRequestUpdated` بالـ `PaymentRequest` كامل عند أي تغيير حالة (confirm / mark-paid / cancel / expire)، عشان صفحة الطلبات تتحدث لوحدها.

---

## 9. Audit + أمان

- **Audit log:** سجّل كل create / mark-paid / cancel / تعديل طريقة دفع: مين، وامتى، والقيم القديمة والجديدة.
- **أرقام الحساب:** الـ public endpoint بيرجّع رقم المحفظة/الـ IPA. ده مقصود، لأن العميل محتاجه عشان يحوّل. لكن **ما يترجعش** في الـ public أي حاجة تخص الموظف أو بيانات العميل الداخلية.
- **الـ token:** ما يظهرش في logs الـ request كاملة لو ينفع، وماسكه في الـ access log.
- **الـ ID:** ما تقبلش `id` رقمي في أي public endpoint. الـ token بس.

---

## 10. الإعدادات (`appsettings.json`)

```json
"Payments": {
  "MerchantName": "The One System",
  "MaxValidityDays": 90,
  "ReceiptMaxBytes": 5242880,
  "ExpireJobIntervalMinutes": 60
}
```

---

## 11. Checklist قبل التسليم

- [ ] Migration للجدولين + الـ indexes + soft delete.
- [ ] كل الـ endpoints في §4–§6 بالأسماء والـ JSON بالظبط (camelCase، والـ enums strings).
- [ ] snapshot طريقة الدفع بيتنسخ وقت الإنشاء، وتعديل أو حذف الطريقة ما يأثرش على طلب قديم.
- [ ] صلاحيات Sales/Support على طلباتهم ومحادثاتهم بس، والـ 404 للباقي.
- [ ] الانتهاء: lazy + BackgroundService.
- [ ] الـ public: `[AllowAnonymous]`، ومن غير حقول داخلية، و`no-store`، وrate limiting.
- [ ] `confirm` multipart + فحص الصورة + حد الحجم (Kestrel + IIS).
- [ ] CORS قبل الـ auth والـ exception handler، وبيرجع على ردود الأخطاء كمان.
- [ ] Notification `PaymentConfirmedByCustomer` (وابعتلنا رقم النوع).
- [ ] Swagger محدّث، وابعتلنا لينكه بعد النشر.

**بعد النشر:** الفرونت هيقلب `CONTRACT_MOCKS.payments` لـ `false` في `src/app/core/constants/contract-mocks.const.ts`، ومن غير أي تغيير تاني.

---

## 12. حالة التنفيذ (2026-11-18) — الفروقات المتفق عليها مع الباك إند

الباك إند اتسلّم مطابق للـ contract، ما عدا النقط دي. **الفرونت اتظبط عليها:**

| # | الفرق | اللي اتعمل في الفرونت |
|---|---|---|
| 1 | نوع الإشعار `PaymentConfirmedByCustomer = 27` | `isPaymentNotification()` بيقبل الاسم أو الرقم `27` أو `relatedEntityType = "PaymentRequest"` |
| 2 | payload الإشعار فيه `relatedEntityType`/`relatedEntityId` بس (من غير `amount`/`customerName`/`chatId`) | الضغط على الإشعار بيفتح `/payments?request={id}`، والصفحة بتجيب التفاصيل بـ `GET PaymentRequests/{id}` |
| 3 | `receiptUrl` ملف static (مش endpoint محمي بالـ JWT) | بيتعرض بـ `assetUrl` زي باقي الـ uploads. **لو اتحوّل لـ endpoint محمي بعدين، لازم يتغير في الفرونت** (يتجاب كـ blob) |
| 4 | مفيش event `paymentRequestUpdated` على الـ hub | `PaymentsInboxStore`: polling كل 60 ثانية والتاب مفتوح بس، + refresh فوري لما يوصل إشعار 27. الصفحة بتتحدث بهدوء من غير ما تفقد الفلتر أو التفاصيل المفتوحة |

**مطلوب من الباك إند لسه:** رابط Swagger بعد النشر عشان نراجع الـ schemas النهائية.

### مراجعة الـ Swagger (2026-11-18 — `crmproject.runasp.net`)

- ✅ الـ 11 endpoint موجودين بالـ routes والـ DTOs المتفق عليها.
- ✅ تجربة live: `GET PublicPayments/{token}` بـ token غلط بترجع `404` + `{"data":{"reason":"NOT_FOUND"}}` + `no-store` + `noindex`، و CORS (حتى على الخطأ و الـ preflight) شغال لـ `http://crmtheone.theonesystemco.com`.
- ⚠ الـ Swagger بيعرض `PaymentMethodType` / `PaymentRequestStatus` بـ labels عربي (`"فودافون كاش"`، `"في انتظار الدفع"`) بدل الأسماء. الفرونت بيبعت الأسماء (حسب الـ contract) و بيقرا **أي شكل** (اسم / رقم / label عربي) من `payments.mapper.ts`. **المطلوب من الباك إند تأكيد:** الـ JSON الفعلي و الـ input بيستخدموا الأسماء (`VodafoneCash`)؟
- ⚠ الـ Swagger مفيهوش schemas للـ responses (`200 OK` بس) — الـ mapper بيقبل الـ snapshot nested (`method: {…}`) أو flat (`methodType`, `methodAccountName`…).

### طلب تعديل (2026-11-18) — صورة الإيصال بقت **إجبارية**

في `POST /api/PublicPayments/{token}/confirm`:
- حقل `receipt` بقى **required**. لو مش موجود → `400` + `data.reason = "RECEIPT_REQUIRED"` + `message: "صورة الإيصال مطلوبة"`.
- نفس قيود الملف (jpeg/png/webp، ≤ 5MB، فحص magic bytes) → غير كده `400 INVALID_FILE`.
- `payerPhone` / `payerReference`: نفس القاعدة القديمة (واحد منهم على الأقل).
- الفرونت بيمنع الإرسال من غير صورة، بس **لازم الباك إند يفرضها كمان** (الـ endpoint عام وأي حد يقدر يكلّمه مباشرة).
