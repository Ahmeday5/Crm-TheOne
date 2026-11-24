# Backend task: sales-rep filter on the customer lists + fix missing rep on list rows

## Context

The Angular CRM has three places that count/filter customers by sales rep, and they disagree:

| Screen | Endpoint | Rep filter today |
|---|---|---|
| Sales pipeline (Kanban) | `GET /Sales/Pipeline?SalesPersonId=` | Server-side, by id — correct |
| Leads (marketing) | `GET /Customers/getLeadCustomer` | **None** — frontend downloads every page and matches by `salesPersonName` |
| Sales customers | `GET /Customers/getSalesCustomers` | **None** — frontend downloads every page and matches by `salesPersonId` / name |
| Buyers | `GET /Customers/buyers` | **None** — same frontend workaround |

Result: for the same rep, the pipeline shows e.g. 40+ customers while the lists show ~20.

## Bug 1 (fix first): list rows say "unassigned" for customers that ARE assigned

Reproduce: customer **مصطفى** (phone `01031760823`, status **Buyer**, source Facebook, campaign "اعلان ياسمين").

- `getLeadCustomer` and `getSalesCustomers` return `salesPersonName: null` for this row → UI shows "غير معين".
- `POST /Customers/{id}/assign` with `{ salesPersonId: <Yasmeen Ahmed> }` returns
  `"Customer is already assigned to this sales person"`.

So the assign endpoint reads the rep from one place (`Customer.SalesPersonId`, presumably) and the list projections read it from another (an assignment/history join, a navigation that isn't `Include`d, or a condition that drops it once the customer becomes Buyer / is handed to Support).

**Fix:** every customer list projection (`getLeadCustomer`, `getSalesCustomers`, `getSupportCustomers`, `buyers`) and `GET /Customers/{id}` must read the rep from the **same source of truth** the assign endpoint and `/Sales/Pipeline` use, and return **both**:

```json
"salesPersonId": "guid-or-null",
"salesPersonName": "Yasmeen Ahmed"
```

`getLeadCustomer` currently doesn't return `salesPersonId` at all — please add it.

Please also check the data: list any customers where the two sources disagree (rep set on the customer but missing in the list projection, or the reverse) and tell us the count.

## Feature: `SalesPersonId` filter on the customer lists

Add an optional query param to `getLeadCustomer`, `getSalesCustomers`, `getSupportCustomers` and `buyers`:

| Param | Type | Meaning |
|---|---|---|
| `SalesPersonId` | string (user id) | Only customers currently assigned to this rep |
| `Unassigned` | bool | `true` = only customers with **no** sales rep ("بدون موظف مبيعات") |

Rules:
- Combines with every existing filter (`Search`, `SourceId`, `CustomerStatusId`, `CountryId`, `GovernorateId`, `From`, `To`) and with paging; `count` must be the filtered total.
- If both `SalesPersonId` and `Unassigned=true` are sent → `400` with a clear message.
- Sales-role callers already only see their own customers; for them `SalesPersonId` of another rep returns an empty page (not 403). Admin can filter by anyone.
- Filter on the same rep field as Bug 1's fix, so list counts match `/Sales/Pipeline` for the same filters.

Please also add `Unassigned` to `GET /Sales/Pipeline` with the same meaning, so the Kanban board has the "بدون موظف" option too.

## Clarify scope (answer in the PR description)

For a given rep with no other filters, what should hold?
- Does `getSalesCustomers` exclude Buyers / customers handed to Support? If yes, document it — the UI will label the pipeline total as "includes buyers / not-buyers".
- Expected: `Pipeline total == getSalesCustomers count + (anything excluded, e.g. buyers)`. Give us the exact relation.

## Acceptance

1. Customer مصطفى shows "Yasmeen Ahmed" in `getLeadCustomer`, `getSalesCustomers` and `GET /Customers/{id}`, with `salesPersonId` filled.
2. `getSalesCustomers?SalesPersonId=<Hadeer>` → `count` equals what the pipeline shows for Hadeer (or differs only by the documented excluded statuses).
3. `?Unassigned=true` returns only rows with `salesPersonId == null` on all four list endpoints and on the pipeline.
4. Swagger documents the new params.

Once deployed, the frontend will send `SalesPersonId` / `Unassigned` directly and delete its download-everything workaround (`src/app/features/leads/utils/sales-person-filter.util.ts`).
