# LeagueLive

LeagueLive is a monorepo covering the backend API and four client apps that together let
organizers run a league, reporters file live updates from the field, and fans follow along in
real time.

Full functional and non-functional requirements live in [docs/SRS.md](docs/SRS.md) — this README
is just an orientation.

## Packages

| Package        | Path                                           | Stack                           | Role                                                                                                                                                 |
| -------------- | ---------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`      | [packages/backend](packages/backend)           | Node.js, Express, TypeScript    | Central API. Owns league/team/match data, real-time score and event updates, and auth. Serves `admin`, `fan-web`, `fan-app`, and `reporter-app`.     |
| `admin`        | [packages/admin](packages/admin)               | Next.js, TypeScript             | Internal dashboard for league/tournament organizers to manage competitions, teams, and reporters, and to moderate incoming data before it goes live. |
| `fan-web`      | [packages/fan-web](packages/fan-web)           | Next.js, TypeScript             | Public website where fans view live scores, schedules, standings, and league content, backed by `backend`.                                           |
| `fan-app`      | [packages/fan-app](packages/fan-app)           | React Native (Expo), TypeScript | Mobile counterpart to `fan-web` — fans view live scores, schedules, and league content on iOS/Android.                                               |
| `reporter-app` | [packages/reporter-app](packages/reporter-app) | React Native (Expo), TypeScript | Mobile app for on-the-ground reporters to submit live match events and scores, which flow into `backend` and out to `fan-web`/`fan-app`/`admin`.     |

## How the packages relate

```
reporter-app  ──┐
                ├──▶  backend  ──▶  fan-web   (public, read-mostly)
admin        ───┤        │    └──▶  fan-app   (public, read-mostly)
                 │        └────▶  admin      (internal moderation/management)
```

`backend` is the single source of truth. `reporter-app` is the primary write path for live match
data; `admin` both writes (league/team/roster setup) and reads (moderation); `fan-web` and
`fan-app` are read-only for the public, on web and mobile respectively. See docs/SRS.md for the
precise data flows and requirements per package.

## Repo structure

This is an npm-workspaces monorepo (`packages/*`). Shared `tsconfig.base.json`, ESLint
(`eslint.config.base.mjs`), and Prettier (`.prettierrc.json`) configs live at the root and are
extended by each package; each package layers on its own framework-specific config (Next.js,
Expo, Node).

Each package (`backend`, `admin`, `fan-web`, `fan-app`, `reporter-app`) is its own git
repository — there is no root-level git repo tying them together.

## Getting started

```bash
npm install               # installs and links all workspaces

npm run dev:backend       # run the API
npm run dev:admin         # run the admin dashboard
npm run dev:fan-web       # run the fan-facing site
npm run dev:fan-app       # run the Expo dev server for the fan mobile app
npm run dev:reporter-app  # run the Expo dev server for the reporter app

npm run lint              # lint all workspaces
npm run format            # format all workspaces with Prettier
```

## Docs

- [docs/SRS.md](docs/SRS.md) — Software Requirements Specification (source of truth for scope and
  requirements; currently a placeholder — replace with the actual SRS).
