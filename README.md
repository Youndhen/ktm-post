This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Running with Docker

The app is containerized as a multi-stage build producing a Next.js
`standalone` server on Alpine, running as a non-root user.

### Setup

```bash
cp .env.example .env   # then fill in real values
```

Do not wrap values in quotes. `docker run --env-file` does not strip them,
which makes Prisma reject `DATABASE_URL`.

The database stays on hosted Neon; the container runs the app only.

### Build and run

```bash
docker compose build
docker compose up -d
docker compose logs -f web
```

The app is served on http://localhost:3000.

Port 3000 collides with `npm run dev`. Either stop the dev server or pick
another host port:

```bash
APP_PORT=3001 docker compose up -d
```

### Notes

- `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL` are needed at **build** time as
  well as at run time: `/` and `/news` are statically generated from the
  database, and `NEXT_PUBLIC_*` is inlined into the client bundle. Compose
  passes both through as build args.
- `.env` is excluded via `.dockerignore`, so no secrets land in an image
  layer. Runtime configuration is injected by Compose.
- `next.config.ts` pins `outputFileTracingRoot` to the project. Without it
  Next walks up the filesystem for a lockfile and nests the standalone
  output, putting `server.js` somewhere the container's `CMD` cannot find.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.


- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
# Nepal-Voices
# Nepal-Voices
