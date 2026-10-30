# Supabase backend

Replaces the simulated on-device server. With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set the app syncs to Supabase; without them it behaves exactly as before.

## Setup (once)
1. Create a Supabase project, open the SQL editor, and run [schema.sql](schema.sql). It is safe to re-run.
2. Let Supabase accept Clerk sign-ins:
   - Clerk dashboard: open the Supabase integration setup and activate it. This adds `role: authenticated` to session tokens and shows your Clerk domain.
   - Supabase dashboard: Authentication, Sign In / Providers, add the Clerk provider, paste the Clerk domain.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings, API) in `.env` and in Vercel (Settings, Environment Variables), then redeploy. The anon key is public by design; the data is protected by row level security plus the Clerk token.
4. Check it: sign in on two browsers, create a case as ASHA in one, and open the PHC list in the other. It appears within 30 seconds.

## How it works
- One table per record type (`patients`, `referrals`, `followups`, `facility_events`). The whole app record lives in `data` (jsonb), so `src/db/types.ts` stays the single source of truth.
- `referrals.facility` is a separate column. The field device never sends it, so a later ASHA push cannot overwrite what a facility recorded. The database resets it when a referral changes tier.
- Conflicts: last write wins on the record's `updatedAt`. A stale write is ignored by the `carelink_guard` trigger.
- Devices pull everything changed since their last sync (`server_updated_at` cursor), now and every 30 seconds.
- New record ids carry a per-device tag (`REF-K3F9-0001`) so two devices never create the same id. Local mode keeps `REF-0001`.
- Demo cases are not seeded when Supabase is on. Set `VITE_SEED_DEMO=1` to load them anyway.

## Known gaps
- **Access is wide open to any signed-in user.** The RLS policies allow every authenticated user to read and write every row. Replace them with per-tier / per-facility policies before real patient data goes in.
- Report PDFs are still stored inside the record (`dataUrl`). Move them to Supabase Storage and keep only the URL.
- A record edited offline and older than the server copy loses to the server copy (last write wins).
- Not yet run against a live Supabase project. The SQL was tested on Postgres 16 and the client against a mocked server.
