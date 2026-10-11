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

export const AI_MODELS = [
  { id: "openrouter/free", label: "OpenRouter Free (Auto)", short: "Auto Free" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast)", short: "Gemini Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Deep & Creative)", short: "Gemini Pro" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Ultra Fast)", short: "Flash-Lite" },
];

export const TIMER_PRESETS = [
  { value: 0, label: "Off" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
];

export const DECK_MODES = {
  BUILTIN: "builtin",
  AI: "ai",
};

export function normalizeDeckMode(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "ai" || v === "ai_generator" || v === "ai deck") return "ai";
  return "builtin";
}

export const GENDER_OPTIONS = [
  { id: "Male", label: "Male" },
  { id: "Female", label: "Female" },
  { id: "Non-binary", label: "Non-binary" },
  { id: "Prefer to self-describe", label: "Self-describe" },
];

export function resolveGenderValue(genderOption, customGender = "") {
  const opt = String(genderOption || "").trim();
  if (!opt) return "";
  if (opt === "Man") return "Male";
  if (opt === "Woman") return "Female";
  if (opt === "Prefer to self-describe") {
    const custom = String(customGender || "").trim().slice(0, 24);
    return custom || "Self-described";
  }
  return opt.slice(0, 24);
}

export const GAME_MODES = {
  ONLINE: {
    label: "Online",
    tagline: "Playing apart",
    description:
      "Everyone joins from their own device using a room code. Real-time cards, chat, and synchronized turns.",
  },
  OFFLINE: {
    label: "Offline",
    tagline: "Same room · One phone",
    description:
      "Pass one phone around the room. Register everyone's names, pick a theme, and play face to face.",
  },
};

