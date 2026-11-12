# CrmTheOne

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 18.2.20.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## WhatsApp module

In-CRM **WhatsApp + Facebook Messenger** for **Admin, Sales and Support** (`src/app/features/whatsapp`). The backend talks to **Mihwar** (official WhatsApp Business API + Messenger). The browser only talks to our backend (`/api/WhatsApp/*` + the `/hubs/whatsapp` SignalR hub) and holds no provider key. The backend enforces every permission; the UI just doesn't offer actions the user can't take.

A **channel** is a WhatsApp number (`whatsapp_cloud`) or a Messenger page (`messenger`). The API still calls its id `instanceId`. Channels are connected in the **Mihwar dashboard**, never in the CRM (there is no QR / pairing code anymore). Admins see every channel; an employee has at most one WhatsApp number and one Messenger page.

**Routes**
| Route | Who | What |
|---|---|---|
| `/whatsapp` | Admin · Sales · Support | Inbox: channels (admin) or own channels card (employee), chats, conversation |
| `/whatsapp/chats/:chatId` | same | Inbox with that chat open (notification deep links) |
| `/whatsapp/settings` | Admin | Channels table (assign / unassign employees), **Import past conversations** (`POST /import`), **Diagnostics** tab (`?tab=diagnostics`) |

Old links keep working: `/whatsapp/:id`, `/whatsapp/numbers` and `/settings/whatsapp` redirect.

**Architecture**
| Piece | Scope | Role |
|---|---|---|
| `WhatsAppApiService` | root | One method per endpoint, unwraps `data`. Every call is `withInlineHandling` + `withUnauthorizedAsForbidden`. `sendMedia` streams upload progress |
| `WhatsAppAssignmentService` | root | Assign / unassign on top of `PUT /users/{id}/number` (see below) |
| `WhatsAppRealtimeService` | root | One SignalR connection. Starts after login for WhatsApp roles, stops on logout, restarts on token refresh, reconnects forever. Lazy-loads `@microsoft/signalr`. Exposes `message$`, `messageStatus$`, `chatUpdated$`, `instanceStatus$`, `reconnected$` |
| `WhatsAppSessionStore` | root | Own status (`GET /status`), channels (`GET /instances`), unread totals → sidebar badge, header status chip |
| `WhatsAppInboxStore` | inbox page | Chat list: channel, search (300 ms debounce), All/Unread, infinite scroll, live upserts |
| `WhatsAppThreadStore` | per thread | History (`beforeId` paging), live append + ticks, optimistic sends, the single **composer state**, templates, mark-read |
| `resolveComposerState()` | `utils/composer-state.util.ts` | Pure function: reply / template only / locked |
| `provideWhatsApp()` | `app.config.ts` | Starts the root services at boot |

**Key behaviours**
- **24-hour window (composer):** `chat.canReply` → free text + files (with "Replies allowed until 3:40 PM" when < 2 h are left; the window also closes client-side when `replyWindowEndsAt` passes). Otherwise `chat.canSendTemplate` → banner + **Send template**. Otherwise (Messenger past 24 h, or chat not linked yet) → disabled "wait for the customer". A customer profile tab is always template-only (free replies happen in the inbox).
- **Templates (WhatsApp only):** `GET /templates` (admins pass the chat's `instanceId`), only `sendable` ones. A reactive form with one required control per variable and a live preview; values go in `parameters` keyed by name.
- **New conversation:** customer or international phone → template → `POST /send-template`. No free text. Hidden when `GET /status` is `NOT_ASSIGNED`. Admins pick the WhatsApp number to send from; employees never send `instanceId`.
- **Sending:** every message gets a fresh `clientMessageId`. Network errors retry automatically (2 s, 5 s) with the **same** id. A `400` shows the server message as a toast and puts the text / file back into the composer (when it's empty).
- **Files:** jpg/jpeg/png/webp, mp4/3gp, mp3/ogg/m4a/aac, pdf/doc(x)/xls(x)/ppt(x)/txt/csv/zip, up to **16 MB**, validated before upload; upload progress shows on the bubble.
- **Ticks** only move forward (Pending → Sent → Delivered → Read). `Failed` shows `errorMessage` (tooltip + under the bubble).
- **Assignment:** `{ instanceId }` replaces only the user's channel of the same type; `{ instanceId: null }` removes **all** of them. So "unassign" = clear, then re-assign the user's other channel; moving a taken channel releases it first and rolls back on failure.
- **Missed events:** while the hub is down the views poll (chats 20 s, counters 60 s, only while the tab is visible); after a reconnect they refetch.
- **401:** a 401 with body `"Unauthorized access."` means *permission denied* app-wide — no refresh, no logout.

**Tests:** `src/app/features/whatsapp/**/*.spec.ts` (API URLs/bodies, composer state, template utils, store merging of hub events, assignment). Run only these with:
`npx ng test --watch=false --browsers=ChromeHeadless --include="src/app/features/whatsapp/**/*.spec.ts"`
(Note: `tsconfig.spec.json` type-checks every spec, so the unrelated, pre-existing `app.component.spec.ts` error — it expects an `AppComponent.title` that no longer exists — must be fixed first, or run with a tsconfig that only includes the WhatsApp specs.)

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
