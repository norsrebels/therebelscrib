# The Rebels Crib

**The Rebels Crib** is a volleyball club / tournament web application for managing players,
assessments, tournaments, live scoreboards, photo galleries, statistics, and an AI-powered
team assistant.

## Tech Stack

- **[TanStack Start](https://tanstack.com/start)** — full-stack React framework (TanStack Router v1, React 19)
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling
- **[Drizzle ORM](https://orm.drizzle.team)** — type-safe schema & queries
- **[Netlify Postgres (Netlify DB)](https://docs.netlify.com/database/overview/)** — relational data
- **[Netlify Blobs](https://docs.netlify.com/blobs/overview/)** — image / file object storage
- **[Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/)** — authentication
- **[Anthropic Claude](https://www.anthropic.com)** — AI assistant (via the Anthropic SDK)
- **Vite 7** + **TypeScript 5.7** (strict mode)
- Deployed on **Netlify**

## Getting Started

### Prerequisites

- Node.js 22+
- The [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm install -g netlify-cli`)
- A Netlify site linked to this project (for Netlify DB, Blobs, and Identity emulation)

### Install

```bash
npm install
```

### Environment variables

Copy the example file and fill in the values (see [`.env.example`](./.env.example)):

```bash
cp .env.example .env
```

Netlify-managed variables (database URL, Blobs, Identity) are injected automatically when you
run the app through the Netlify CLI; the remaining variables must be provided.

### Develop

```bash
npm run dev          # Vite dev server on port 3000
# or, with full Netlify feature emulation (DB, Blobs, Identity):
netlify dev --port 8889
```

### Build & preview

```bash
npm run build        # production build
npm run preview      # preview the production build
```

### Database (Drizzle)

The schema lives in [`db/schema.ts`](./db/schema.ts); migrations are stored under
`netlify/database/migrations/`. Drizzle is configured in
[`drizzle.config.ts`](./drizzle.config.ts).

## Project Structure

```
db/                         # Drizzle schema and database client
netlify/database/migrations # SQL migrations (managed by Netlify DB)
src/
  routes/                   # File-based routes & API endpoints
  server/                   # TanStack server functions (data + auth logic)
  components/               # React UI components
  lib/                      # Shared utilities (auth, db retry, stats, toasts)
public/                     # Static assets
```
