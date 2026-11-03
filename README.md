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

In-CRM WhatsApp for **Admin, Sales and Support** (`src/app/features/whatsapp`). The browser only talks to our backend (`/api/WhatsApp/*` + the `/hubs/whatsapp` SignalR hub). It never talks to Wavex and holds no Wavex key. The backend enforces every permission. The UI just doesn't offer actions the user can't take.

**Routes**
| Route | Who | What |
|---|---|---|
| `/whatsapp` | Admin · Sales · Support | Inbox: channels (admin) or own number card (employee), chats, conversation |
| `/whatsapp/chats/:chatId` | same | Inbox with that chat open (notification deep links) |
| `/whatsapp/numbers` | Admin | Numbers table: assign/unassign employees, request pairing codes. The **Diagnostics** tab (`?tab=diagnostics`, `GET /diagnostics`) shows config alerts, CRM numbers vs. the Wavex account, and webhook queue health |

Old links keep working: `/whatsapp/:id` and `/settings/whatsapp` redirect.

**Architecture**
| Piece | Scope | Role |
|---|---|---|
| `WhatsAppApiService` | root | Typed HTTP calls, unwraps `data`. Every call is `withInlineHandling` + `withUnauthorizedAsForbidden` |
| `WhatsAppRealtimeService` | root | One SignalR connection. Starts after login for WhatsApp roles, stops on logout, restarts on token refresh. Reconnects forever. Lazy-loads `@microsoft/signalr`. Exposes `message$`, `messageStatus$`, `chatUpdated$`, `instanceStatus$`, `reconnected$` |
| `WhatsAppSessionStore` | root | Own status (`GET /status`), channels (`GET /instances`), unread totals. Publishes the sidebar badge through `NavBadgesService` |
| `WhatsAppInboxStore` | inbox page | Chat list: channel, search (300 ms debounce), All/Unread, infinite scroll (30 per page), live upserts |
| `WhatsAppThreadStore` | per thread | History (`take=50`, `beforeId` paging), live append and ticks, optimistic sends, mark-read |
| `provideWhatsApp()` | `app.config.ts` | Starts the two root services at boot |

Components are presentational and read the stores.

**Key behaviours**
- **Who can be messaged:** anyone. Employees and admins can message any CRM customer, whoever it is assigned to, or any phone: international `+201012345678` (8–15 digits) or local `01012345678`. Employees always send from their own number, and the frontend never sends `instanceId` for them. In a new chat, an admin sends from the selected channel. Inside an existing chat everyone sends by `chatId`.
- **Channel filter (admin):** `GET /chats?instanceId=<channel.id>`, or no `instanceId` for "All channels". Live messages are added to the list only when "All channels" is selected or `event.instanceId` matches the selected channel.
- **Sending:** every message gets a fresh `clientMessageId`. After a network error or gateway timeout the request is retried automatically (2 s, then 5 s) with the **same** id, so the backend can't send it twice. Retrying a definite failure uses a **new** id. The composer never blocks during the provider's 3–12 s anti-ban delay.
- **Ticks** only move forward (Pending → Sent → Delivered → Read). `Failed` shows the reason and a Retry button.
- **Mark read:** a chat is marked read when you open it with unread messages, and on new incoming messages only while the window is focused.
- **Missed events:** if the hub is down, the views fall back to polling (chats every 20 s, channel counters every 60 s, only while the tab is visible). After a reconnect they refetch.
- **401 handling:** a 401 whose body is `"Unauthorized access."` means *permission denied* app-wide. It skips the token refresh and never logs the user out. A 401 without that body still goes through the normal refresh/logout flow.
- **Linking a phone:** linking uses a pairing code (the provider exposes no QR). The dialog polls every 5 s and also listens to `whatsappInstanceStatus`. The code is kept only in component memory.
- **Attachments:** jpg/jpeg/png/webp, mp4/3gp, and pdf/doc(x)/xls(x)/ppt(x)/txt/csv/zip/mp3/ogg/m4a, up to 3.5 MB. These are checked before upload.

**Provider limitations (by design, not bugs):** there is no QR code. History starts when the webhook was configured. Incoming media can't be downloaded, so it shows as a labelled placeholder. "Read" resets the CRM counter only and sends no blue ticks. Number status can take about a minute to update.

**Adding a number:** in the Wavex dashboard, add an instance (no scan needed). Then assign it on `/whatsapp/numbers`. The employee links it from the CRM with a pairing code.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
