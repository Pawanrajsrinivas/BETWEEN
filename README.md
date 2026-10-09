# BETWEEN

A dark, premium, two-player Truth or Dare web app.

## Current build
- Premium dark landing page
- Create/join room UI
- Private room/lobby flow
- Intensity selector
- Supabase schema for rooms, realtime chat and questions
- Mobile-first styling

## Run locally

1. Install Node.js 20+.
2. Open this folder in Terminal.
3. Run:
   npm install
   npm run dev
4. Open http://localhost:3000

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Paste `supabase/schema.sql` and run it.
4. Copy `.env.example` to `.env.local`.
5. Add your Supabase URL and anon key.

The next implementation step is wiring the UI to Supabase so two phones can create/join the same room and exchange messages in real time.

## Safety
The production version should include 18+ age gating, reporting/blocking, room expiration, rate limits and moderation before public launch.
