import questionsData from "../../content/questions.json";

export const SPECIAL_ROUND_TYPES = {
  standard: {
    id: "standard",
    key: "standard",
    label: "Standard",
    badge: "STANDARD",
    shortLabel: "Standard",
    description: "",
    bonusPoints: 0,
    forcedKind: null,
    icon: "sparkle",
  },
  double_dare: {
    id: "double_dare",
    key: "double_dare",
    label: "Double Dare",
    badge: "DOUBLE DARE · +1 BONUS",
    shortLabel: "Double Dare",
    description: "Complete a Dare this turn to earn +1 bonus point (3 pts total).",
    bonusPoints: 1,
    forcedKind: "DARE",
    icon: "flame",
  },
  group_challenge: {
    id: "group_challenge",
    key: "group_challenge",
    label: "Group Challenge",
    badge: "GROUP CHALLENGE · +1 BONUS",
    shortLabel: "Group Round",
    description: "Everyone participates together! Completing it awards +1 bonus point.",
    bonusPoints: 1,
    forcedKind: null,
    icon: "users",
  },
  spotlight: {
    id: "spotlight",
    key: "spotlight",
    label: "Spotlight",
    badge: "SPOTLIGHT · +1 BONUS",
    shortLabel: "Spotlight",
    description: "All eyes on you — a tailored group prompt worth +1 bonus point.",
    bonusPoints: 1,
    forcedKind: null,
    icon: "sparkle",
  },
  quick_round: {
    id: "quick_round",
    key: "quick_round",
    label: "Quick Round",
    badge: "QUICK ROUND · 20S BLITZ",
    shortLabel: "Quick 20s",
    description: "Fast-paced challenge with a 20-second blitz timer (+1 bonus point).",
    bonusPoints: 1,
    forcedSeconds: 20,
    forcedKind: null,
    icon: "flame",
  },
  wildcard: {
    id: "wildcard",
    key: "wildcard",
    label: "Wildcard",
    badge: "WILDCARD · +1 BONUS",
    shortLabel: "Wildcard",
    description: "An unexpected twist challenge worth +1 bonus point.",
    bonusPoints: 1,
    forcedKind: null,
    icon: "dice",
  },
};

const SPECIAL_KEYS = [
  "double_dare",
  "group_challenge",
  "spotlight",
  "quick_round",
  "wildcard",
];

/**
 * Deterministic, controlled special-round trigger based on turn number.
 * Never triggers on turn 1 or on consecutive turns.
 * Always returns an object with `{ id, key, label, badge, description, bonusPoints }`.
 */
export function getSpecialRoundForTurn(turnNo, enabled = true) {
  if (!enabled || !turnNo || turnNo < 2) return SPECIAL_ROUND_TYPES.standard;
  const mod = turnNo % 7;
  if (mod !== 3 && mod !== 6) return SPECIAL_ROUND_TYPES.standard;
  const idx = Math.floor((turnNo * 3 + 1) / 3) % SPECIAL_KEYS.length;
  const key = SPECIAL_KEYS[idx];
  return SPECIAL_ROUND_TYPES[key] || SPECIAL_ROUND_TYPES.standard;
}

/**
 * Normalizes theme/intensity key to lowercase snake_case ("playful", "personal", "flirty", "wild", "after_dark")
 */
export function normalizeIntensityKey(themeOrIntensity) {
  const raw = String(themeOrIntensity || "playful")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  if (["playful", "personal", "flirty", "wild", "after_dark"].includes(raw)) {
    return raw;
  }
  return "playful";
}

export function toDeckIntensityKey(themeOrIntensity) {
  const norm = normalizeIntensityKey(themeOrIntensity);
  return norm.toUpperCase().replace(/_/g, " ");
}

/**
 * Picks a built-in question or dare from content/questions.json, injecting player names
 * when appropriate and avoiding already-used prompts.
 */
export function drawBuiltInCard({
  mode = "offline",
  type,
  kind,
  theme,
  intensity,
  players = [],
  currentPlayer = null,
  targetPlayer: explicitTarget = null,
  roundType = "standard",
  specialRound = null,
  excludePrompts = [],
  usedPrompts = [],
}) {
  const modeKey = String(mode || "offline").toUpperCase() === "ONLINE" ? "ONLINE" : "OFFLINE";
  const intensityKey = toDeckIntensityKey(theme || intensity || "PLAYFUL");
  const rawKind = type || kind || "truth";
  const kindKey = String(rawKind).toUpperCase() === "DARE" ? "DARE" : "TRUTH";

  const pool =
    questionsData?.[modeKey]?.[intensityKey]?.[kindKey] ||
    questionsData?.OFFLINE?.PLAYFUL?.[kindKey] ||
    [];

  const solo = !Array.isArray(players) || players.length < 2;
  const eligible = pool.filter((item) => (solo ? item[1] === 1 : true));
  const candidates = eligible.length > 0 ? eligible : pool;

  const combinedUsed = [
    ...(Array.isArray(excludePrompts) ? excludePrompts : []),
    ...(Array.isArray(usedPrompts) ? usedPrompts : []),
  ];
  const usedSet = new Set(combinedUsed);
  const fresh = candidates.filter((item) => !usedSet.has(item[2]));
  const activePool = fresh.length > 0 ? fresh : candidates;

  const chosen =
    activePool[Math.floor(Math.random() * activePool.length)] || [
      "Challenge",
      1,
      kindKey === "DARE"
        ? "Deliver your most dramatic 10-second monologue to the group."
        : "What is the funniest first impression you have ever had of someone?",
    ];

  const [category, , rawText] = chosen;

  let targetPlayer = explicitTarget;
  if (!targetPlayer && Array.isArray(players) && players.length > 1) {
    const others = players.filter(
      (p) => p && p.name && (!currentPlayer || p.name !== currentPlayer.name)
    );
    if (others.length > 0) {
      targetPlayer = others[Math.floor(Math.random() * others.length)];
    }
  }

  const targetName =
    typeof targetPlayer === "string" ? targetPlayer : targetPlayer?.name || null;

  const resolvedRound =
    specialRound || SPECIAL_ROUND_TYPES[roundType] || SPECIAL_ROUND_TYPES.standard;

  let promptText = rawText;

  if (resolvedRound.id === "group_challenge") {
    promptText = `Group Challenge — Everyone in the room: ${rawText}`;
  } else if (
    targetName &&
    /another player|the other player|someone sitting here|someone here/i.test(promptText)
  ) {
    promptText = promptText.replace(
      /another player|the other player|someone sitting here|someone here/gi,
      targetName
    );
  }

  return {
    id: `builtin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: kindKey.toLowerCase(),
    kind: kindKey.toLowerCase(),
    theme: normalizeIntensityKey(intensityKey),
    intensity: intensityKey,
    mode: modeKey.toLowerCase(),
    category:
      resolvedRound.id !== "standard" ? resolvedRound.label : category || "Curated Deck",
    prompt: promptText,
    body: promptText,
    targetPlayerName: targetName,
    roundType: resolvedRound.id,
    roundLabel: resolvedRound.label,
    bonusPoints: resolvedRound.bonusPoints || 0,
    source: "deck",
  };
}
