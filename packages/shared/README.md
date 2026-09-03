# @leaguelive/shared

Shared TypeScript types for LeagueLive's data model (see [../../docs/SRS.md](../../docs/SRS.md), section 7).

These are the wire/API shapes — plain data with string ids and ISO date strings — consumed by frontend clients (`admin`, `fan-web`, `fan-app`, `reporter-app`) so they don't redefine the same shapes. The backend's Mongoose models mirror these field names but use their own document types (`ObjectId`, `Date`) for the database layer.

## Scripts

- `npm run build` — compile to `dist/`
- `npm run typecheck` / `npm run lint`
