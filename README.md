# NMD — Nunca Mais é Domingo

PWA for the NMD Sunday padel group: registrations, automatic pairing (Regulamento NMD), live tournament, season ranking, finos and treasury.

## Stack
- Next.js 15 (App Router) + Tailwind 4, installable PWA
- Supabase (Postgres, email-code auth, realtime for live scores)
- Deploy: Render (Node web service)

## Rules engine (`src/lib/engine`)
- `scoring.ts` — points = pairs − position + 1, shared places split, Joker ×2 / ÷2, +0.5 repasto-only
- `pairing.ts` — fixed pairs, side balance (volunteers, then draw), wild cards with best-ranked, best with worst, no repeat partner from the last 4 encounters
- `tournament.ts` — formats for 4/6/8/10/12 pairs, direct-cross variant, group tiebreakers

```
npm test
```

## Setup
1. Apply `supabase/migrations/*.sql` to the Supabase project.
2. Auth → Email template "Magic Link": include `{{ .Token }}` so members receive a 6-digit code.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
4. `npm install && npm run dev`

Member data (players, results, treasury) lives only in Supabase — never commit seed files.
