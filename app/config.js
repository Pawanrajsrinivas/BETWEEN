/* Tunables for the client. Server-side rules (capacity, grace period, rate
   limits) live in the app_settings table; see supabase/migrations/001. */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

const envMax = Number(process.env.NEXT_PUBLIC_MAX_ROOM_CAPACITY);

export const CONFIG = {
  /* Largest room the create form offers. The database enforces its own limit
     (app_settings.max_room_capacity), so raising this alone is not enough. */
  maxCapacity: clamp(Number.isFinite(envMax) && envMax > 0 ? Math.floor(envMax) : 8, 1, 32),
  defaultCapacity: 2,
  roomCodeLength: 6,
  nicknameMax: 30,
  messageMax: 500,
  historyLimit: 300,
  heartbeatMs: 20000,
  /* Shown until the server tells us its real grace period. */
  fallbackGraceSeconds: 120,
  /* A presence drop must last this long before "disconnected" is announced. */
  disconnectNoticeDelayMs: 4000,
  typingTtlMs: 3500,
  typingThrottleMs: 1500,
  toastMs: 4800,
  maxToasts: 4,
};

export const INTENSITIES = [
  ["01", "PLAYFUL", "Playful & light", "petal"],
  ["02", "PERSONAL", "Honest & close", "sparkle"],
  ["03", "FLIRTY", "Bold & flirty", "lips"],
  ["04", "WILD", "No backing out", "flame"],
  ["05", "AFTER DARK", "18+ only", "moon"],
];

export const GAME_MODES = {
  ONLINE: {
    label: "Online",
    tagline: "Playing apart",
    description:
      "Everyone is in a different place. Truths and dares work over chat, voice notes and video calls.",
  },
  OFFLINE: {
    label: "Offline",
    tagline: "Playing together",
    description:
      "Everyone is in the same room. Challenges are face to face, with no phones or internet needed.",
  },
};
