# cinch

Read-only dashboard for official Robinhood Stock Tokens on Hood (Robinhood Chain).

The web app is Next.js. It reads Postgres. The indexer (`npm run index`) is a long-running process — run it on a machine, not on Vercel.

Copy `env.example` to `.env.local`. Production needs a hosted `DATABASE_URL` (pooled, `sslmode=require`) and `NEXT_PUBLIC_SITE_ORIGIN`.
