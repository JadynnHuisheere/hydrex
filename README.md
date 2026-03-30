# Urbex Dashboard

Cloudflare-first Next.js foundation for the Urbex Dashboard platform.

## Current slice

- Landing page and product framing
- Demo auth flow with cookie-backed sessions
- Gated dashboard with locked app states
- License redemption prototype
- Urbex DB shell with live Leaflet map and seeded markers

## Stack

- Next.js App Router
- Tailwind CSS v4
- OpenNext adapter for Cloudflare Workers
- Supabase-ready environment wiring
- Leaflet for map rendering

## Local development

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Run `npm run dev`.

Demo accounts:

- `admin@urbex.local` / `DemoAdmin123`
- `member@urbex.local` / `DemoMember123`
- `user@urbex.local` / `DemoUser123`

Demo license keys:

- `URBEX-ALPHA-ACCESS`
- `PATREON-LICENSE-2026`

## Cloudflare deployment

- `npm run preview` to test the OpenNext Cloudflare adapter locally.
- `npm run deploy` to build and deploy with Wrangler.

### Cloudflare dashboard command settings

If you are using Cloudflare Workers Builds, configure commands as:

- Build command: `npm run cf:build`
- Deploy command: `npm run cf:deploy`

Do not use `npm run build` followed by `npx wrangler deploy` for this project.
`next build` alone does not generate the OpenNext compiled config needed by the
OpenNext deploy step, which causes:
`ERROR Could not find compiled Open Next config, did you run the build command?`

### R2 note

The current `wrangler.toml` intentionally deploys without an R2 binding so Workers
Builds can succeed on accounts where R2 is not enabled yet.

After enabling R2 in Cloudflare, add back:

```toml
[[r2_buckets]]
binding = "URBEX_UPLOADS"
bucket_name = "urbex-dashboard-uploads"
```