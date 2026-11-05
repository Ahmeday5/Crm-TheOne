# Sales Playbook API — backend contract

The frontend is fully built against this contract. Until it is deployed, the
app runs on a browser-only mock (`MockSalesPlaybookRepository`, persisted in
`localStorage` under `crm.salesPlaybook.mock.v1`). Once these endpoints are
live, switch the adapter in
`src/app/features/sales-playbook/data/sales-playbook-repository.provider.ts`
to `inject(HttpSalesPlaybookRepository)`. No other frontend change is needed.
(The paths live in `SALES_PLAYBOOK_ENDPOINTS` in
`http-sales-playbook.repository.ts`; move them into `API_ENDPOINTS` when wiring.)

All responses use the standard envelope `{ statusCode, message, data }`.
Timestamps are UTC ISO-8601. Ids are strings (GUID or int as string).

## Rules

| Rule | Detail |
|---|---|
| Who reads | `Admin`, `Sales`, `Support`. Return `403` for other roles. |
| Who writes | `Admin` only (create, update, delete, import). Return `403` for everyone else. |
| Favourites | **Not** stored on the server. They are per-user and kept in the browser. |
| Import idempotency | `POST /import` must skip items that already exist (see *Duplicate detection*) and items repeated inside the same request. Running it twice adds nothing the second time. |
| Prices | Seed content intentionally contains no prices. |

## Models

### `CallScriptDto`

```jsonc
{
  "id": "string",
  "title": "string",               // ≤ 140, required
  "service": {                     // nullable — snapshot of the linked service
    "id": 12, "nameAr": "برنامج الحسابات", "nameEn": "Accounting"
  },
  "summary": "string",             // ≤ 240, may be ""
  "opening": "string",             // ≤ 1200, required
  "steps": ["string"],             // ≥ 1, ≤ 12 items, each ≤ 400
  "questions": ["string"],         // ≤ 15 items, each ≤ 400
  "closing": "string",             // ≤ 1200, required
  "createdAt": "2026-11-05T09:12:00Z",
  "updatedAt": null
}
```

Storing `service` as `{ id, nameAr, nameEn }` is preferred (the UI shows the
name without a second lookup). Persisting only `serviceId` and joining on read
is fine as long as the response has the object. If the service is deleted,
return `service: null`.

### `ObjectionDto`

```jsonc
{
  "id": "string",
  "category": "price | timing | trust | competitor | need | decisionMaker | other",
  "objection": "string",           // what the customer says, ≤ 240, required
  "answer": "string",              // best answer, ≤ 1500, required
  "tip": "string",                 // coaching note for the rep, ≤ 300, may be ""
  "createdAt": "…", "updatedAt": null
}
```

### `CompetitorDto`

```jsonc
{
  "id": "string",
  "name": "string",                // ≤ 80, required
  "website": "string",             // ≤ 200, may be ""
  "strengths": ["string"],         // ≤ 10
  "weaknesses": ["string"],        // ≤ 10
  "howToWin": "string",            // ≤ 1200, may be ""
  "mentions": [                    // customers who mentioned this competitor
    { "customerId": 341, "name": "Ahmed Ali", "company": "Ali Trading" }
  ],
  "createdAt": "…", "updatedAt": null
}
```

The client sends `mentions` as snapshots taken from `GET /Customers/dropdownCustomers`.
The server may store only `customerId` and resolve `name` / `company` on read.

### `QuickReplyDto`

```jsonc
{
  "id": "string",
  "title": "string",               // ≤ 80, required
  "category": "greeting | info | followUp | closing | support | other",
  "text": "string",                // ≤ 4096 (WhatsApp limit), required; may contain {name}
  "createdAt": "…", "updatedAt": null
}
```

`{name}` is a client-side placeholder. The WhatsApp composer replaces it with
the customer's name when one is known. The server stores it as-is.

### Input DTOs

The create/update body is the DTO without `id`, `createdAt` or `updatedAt`.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/SalesPlaybook` | — | `{ scripts: CallScriptDto[], objections: ObjectionDto[], competitors: CompetitorDto[], replies: QuickReplyDto[] }` |
| `POST` | `/api/SalesPlaybook/{collection}` | input DTO | the created DTO |
| `PUT` | `/api/SalesPlaybook/{collection}/{id}` | input DTO | the updated DTO, with `updatedAt` set |
| `DELETE` | `/api/SalesPlaybook/{collection}/{id}` | — | `200` |
| `POST` | `/api/SalesPlaybook/import` | `ImportBundleDto` | `ImportResultDto` |

`{collection}` is one of `scripts`, `objections`, `competitors`, `replies`.

Validation errors return `400` with a human-readable `message`, which the form shows as-is.

### `ImportBundleDto` / `ImportResultDto`

```jsonc
// request: the ready-made content; the client has already resolved each script's service
{
  "scripts":    [ /* CallScript input DTOs */ ],
  "objections": [ /* Objection input DTOs */ ],
  "replies":    [ /* QuickReply input DTOs */ ]
}

// response
{
  "added":   { "scripts": 8, "objections": 18, "replies": 14 },
  "skipped": 0,                    // duplicates not inserted
  "unlinkedScripts": 0             // added scripts whose service is null
}
```

## Duplicate detection (import)

Compare on a **normalised key**, which the frontend mirrors in
`utils/arabic-text.util.ts` → `compactKey()`:

1. Unicode NFKC, then lower-case.
2. Remove Arabic diacritics (U+064B–U+065F, U+0670, U+0610–U+061A, U+06D6–U+06ED) and tatweel (U+0640).
3. Unify letters: `أ إ آ ٱ → ا`, `ة → ه`, `ى → ي`, `ؤ → و`, `ئ → ي`.
4. Replace punctuation and symbols with spaces, then split into words.
5. Strip a leading definite article from each word (`ال`, `وال`, `بال`, `فال`, `كال`, `لال`) when ≥ 2 letters remain.
6. Join the words with no spaces.

| Collection | Duplicate when |
|---|---|
| scripts | same key of `title` |
| objections | same key of `objection` |
| replies | same key of `title` **or** same key of `text` |

## Service matching (done on the client)

Before calling import, the client links each program script to the most
similar service from `GET /Services?PageSize=100`. It scores names against
Arabic and English aliases: same key, then substring of ≥ 4 letters, then word
overlap with prefix tolerance. The threshold is 0.6. If nothing matches,
`service` is `null` and the result reports it in `unlinkedScripts`.
