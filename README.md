# BETWEEN

A dark, premium Truth or Dare web app for 1–8 players, in Online or Offline mode.
Next.js 15 + Supabase (anonymous auth, Postgres, Realtime). Deployed on Vercel.

## What the multiplayer upgrade does
- **Rejoin fix.** Membership lives in `room_members`. Leaving frees your seat; returning with the same code restores you; refresh never duplicates you. Capacity is enforced inside the database under a row lock, so simultaneous joins can't overfill a room.
- Capacity 1–8 (default set at creation, max from `app_settings`), solo mode, turn order, host transfer.
- Presence (Online / Reconnecting / Offline), toasts, redesigned chat with typing indicators, host controls (start, mode, lock, remove, allow back, reset, close), Rejoin Room cards.
- 160 original seeded questions, split by mode, intensity and Truth/Dare.
- RLS on every table; all writes go through validated RPCs with rate limits.

## Run locally
    npm install
    cp .env.example .env.local   # fill in your own Supabase URL + anon key
    npm run dev                  # http://localhost:3000

## Supabase setup (in this order)
1. SQL Editor → run `supabase/schema.sql` (skip if already applied).
2. Run `supabase/migrations/001_multiplayer.sql`. It is additive and safe to re-run. It does not drop tables or data.
3. Run `supabase/seed_questions.sql` (inserts only missing questions; regenerate with `npm run questions`).
4. Authentication → Sign In / Providers → enable **Allow anonymous sign-ins**.
5. Realtime → Settings: make sure Realtime Authorization (private channels) is available; the migration adds the `realtime.messages` policies. Optionally enable CAPTCHA/rate limits for anonymous sign-ins in Auth settings.
6. Set `NEXT_PUBLIC_SUPABASE_URL` and the anon/publishable key in Vercel, then redeploy.

Tunables (table `app_settings`): `max_room_capacity`, `reconnect_grace_seconds`, `host_takeover_seconds`, `room_idle_expiry_minutes`, `room_code_length`, and the rate limits.

## Consequences of the migration (read before deploying to production)
- Row Level Security is enabled; the **old client no longer works** against the migrated database. Deploy the new client together with the migration.
- Old two-player rooms (no `room_members`) can't be entered; players just create new rooms.
- The 8 original questions are kept but never drawn.
- Test on a Supabase staging project or branch first.

## Known limitations
- Identity is an anonymous session. Clearing site data loses it, and the old seat frees after the grace period. A removed person who still has the code can re-enter as a new anonymous user; use the room **lock** (or lock-on-remove) to prevent that.
- Solo mode draws from a small pool (8 per mode/intensity).

## Testing status
Verified against a local Postgres 16 (138 SQL checks: atomic capacity, idempotent joins, turn guards, RLS, rate limits) and in headless Chromium with several independent simulated clients (73 end-to-end checks plus overflow checks from 320 to 1280px). The browser tests used a local stand-in for supabase-js, **not** a live Supabase project. **Not yet verified:** real Supabase Auth/Realtime/private-channel authorization, `next build`, `next lint`, and real devices. Run those on staging before launch.

## Safety
Content is original, skippable, and has an 18+ gate for AFTER DARK. Before a public launch also add reporting/blocking review, and CAPTCHA on anonymous sign-ins.
