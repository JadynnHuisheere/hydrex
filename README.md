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