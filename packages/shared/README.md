# @leaguelive/shared

Shared TypeScript types for LeagueLive's data model (see [../../docs/SRS.md](../../docs/SRS.md), section 7).

These are the wire/API shapes — plain data with string ids and ISO date strings — consumed by frontend clients (`admin`, `fan-web`, `fan-app`, `reporter-app`) so they don't redefine the same shapes. The backend's Mongoose models mirror these field names but use their own document types (`ObjectId`, `Date`) for the database layer.

## API client (`src/api/`)

`createLeagueLiveApiClient({ baseUrl, getAccessToken?, refreshAccessToken? })` returns a typed client (currently `auth`, `fixtures`, and `matchEvents` — add a resource group the same way as a frontend needs one) so every frontend calls the backend through the exact same request/response shapes instead of each hand-rolling `fetch`. Handles JSON encoding/decoding, attaching `Authorization: Bearer <token>`, and — the one piece of real logic here — a single refresh-and-retry on a 401 (never twice, never for a request that deliberately went out with `auth: false`, e.g. login itself) via `refreshAccessToken`.

Deliberately dependency-free: just the global `fetch` (browsers, Node 18+, React Native all have it) — no `URL`/`URLSearchParams` (not reliably available across every RN engine), no axios. `reporter-app`'s `lib/api.ts` is the reference example of wiring it up: a small adapter supplying this app's own token storage, nothing more.

## Scripts

- `npm run build` — compile to `dist/`
- `npm run typecheck` / `npm run lint`
