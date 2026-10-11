import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
/* .env.example historically said ANON_KEY while the code read PUBLISHABLE_KEY.
   Accept either so both old and new setups work. */
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client = null;
let sessionPromise = null;

export function isConfigured() {
  return Boolean(URL && KEY);
}

/* Created on first use, so a missing env var shows a setup message instead of
   crashing the build or the first render. */
export function getSupabase() {
  if (!client) {
    client = createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/* Every browser gets a stable anonymous identity (kept in localStorage by
   Supabase Auth). That identity is the "participant token": it cannot be
   guessed or claimed by typing a nickname or a room code. Concurrent callers
   share one sign-in so a page never creates two identities. */
export function ensureSession() {
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    let session = data?.session;

    if (!session) {
      const { data: created, error } = await supabase.auth.signInAnonymously();
      if (error || !created?.session) {
        const err = new Error(error?.message || "Could not start a session.");
        err.code = /anonymous/i.test(error?.message || "") ? "AUTH_DISABLED" : "AUTH_FAILED";
        throw err;
      }
      session = created.session;
    }

    await supabase.realtime.setAuth(session.access_token);
    return session;
  })().catch((err) => {
    sessionPromise = null; // allow a retry
    throw err;
  });

  return sessionPromise;
}
