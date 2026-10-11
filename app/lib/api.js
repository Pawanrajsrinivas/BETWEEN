import { normalizeDeckMode } from "../config.js";
import { ensureSession, getSupabase } from "./supabase.js";

/* Friendly wording for failures that never reach the database. Errors the
   database itself returns already carry a user-ready `message`. */
const LOCAL_MESSAGES = {
  NETWORK: "Unable to connect. Check your internet connection and try again.",
  AUTH_DISABLED:
    "This app is not fully set up yet: anonymous sign-ins are turned off in Supabase (Authentication → Providers).",
  AUTH_FAILED: "Could not start a secure session. Please reload the page.",
  NOT_CONFIGURED: "The app is missing its Supabase settings.",
  MIGRATION_MISSING:
    "The game server needs updating. Run supabase/migrations/001_multiplayer.sql in Supabase.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export const BWN_PREFIX = "\u2063BWN:";

function makeClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function encodeStateEvent(payload) {
  const raw = `${BWN_PREFIX}${JSON.stringify(payload)}`;
  return raw.length <= 500 ? raw : raw.slice(0, 500);
}

export function decodeStateEvent(body) {
  if (typeof body !== "string" || !body.startsWith(BWN_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(BWN_PREFIX.length));
  } catch {
    return null;
  }
}

export function isStateEventMessage(msg) {
  return Boolean(msg && typeof msg.body === "string" && msg.body.startsWith(BWN_PREFIX));
}

function parseTs(value) {
  const n = Date.parse(value || "");
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Pure reducer that combines the database `room` row and any persisted state
 * events in `messages` into the authoritative multiplayer room state.
 */
export function reduceRoomStateEvents({ room, members = [], messages = [] }) {
  const hostUser = room?.host_user;
  const hostMember = members.find((m) => m.user_id === hostUser) || null;

  const settings = {
    deckMode: normalizeDeckMode(room?.deck_mode),
    aiModel: room?.ai_model || "openrouter/free",
    timerSeconds: typeof room?.timer_seconds === "number" ? room.timer_seconds : 0,
    specialRounds:
      room?.special_rounds !== undefined ? Boolean(room.special_rounds) : false,
    intensity: room?.intensity || "PLAYFUL",
    questionMode: room?.question_mode || "both",
  };

  const scores = {
    ...(room?.scores && typeof room.scores === "object" ? room.scores : {}),
  };
  const completedTurns = {
    ...(room?.completed_turns && typeof room.completed_turns === "object"
      ? room.completed_turns
      : {}),
  };

  // Member gender map: keyed by member_id (and seat fallback), only updatable by that member's own authenticated messages
  const memberGenders = {};
  members.forEach((m) => {
    if (m?.id && m?.gender) {
      memberGenders[m.id] = String(m.gender).slice(0, 40);
    }
  });

  const latestCardByTurn = {};
  const skipsByTurn = {};
  const usedPrompts = [];

  for (const m of messages) {
    if (!m || m.failed) continue;
    const ev = decodeStateEvent(m.body);
    if (!ev || !ev.t) continue;

    // Profile event: send_message in Postgres sets m.member_id from auth.uid(),
    // so a participant can only ever set their own gender.
    if (ev.t === "prof") {
      const cleanGender = String(ev.g || "").trim().slice(0, 40);
      if (cleanGender && m.member_id) {
        memberGenders[m.member_id] = cleanGender;
      }
      continue;
    }

    const isFromHost = Boolean(
      (hostMember && (m.member_id === hostMember.id || m.player === hostMember.seat)) ||
        (!hostMember && m.player === 1)
    );

    if (ev.t === "reset") {
      if (isFromHost) {
        Object.keys(scores).forEach((k) => delete scores[k]);
        Object.keys(completedTurns).forEach((k) => delete completedTurns[k]);
        Object.keys(latestCardByTurn).forEach((k) => delete latestCardByTurn[k]);
        Object.keys(skipsByTurn).forEach((k) => delete skipsByTurn[k]);
      }
      continue;
    }

    if (ev.t === "cfg") {
      if (!isFromHost) continue;
      if (ev.dm) settings.deckMode = normalizeDeckMode(ev.dm);
      if (ev.am) settings.aiModel = ev.am;
      if (typeof ev.tm === "number") settings.timerSeconds = ev.tm;
      if (ev.sr !== undefined) settings.specialRounds = Boolean(ev.sr);
      if (ev.in) settings.intensity = ev.in;
      if (ev.qm && ["both", "truth", "dare"].includes(ev.qm)) settings.questionMode = ev.qm;
      continue;
    }

    if (ev.t === "card") {
      const turnNo = Number(ev.n);
      if (!turnNo) continue;
      // For the active turn, only accept cards emitted by the current turn player or the host
      if (
        room &&
        turnNo === room.turn_no &&
        m.player !== room.current_player &&
        !isFromHost
      ) {
        continue;
      }
      const prevSkips = skipsByTurn[turnNo] || 0;
      const nextSkips = ev.sk ? prevSkips + 1 : prevSkips;
      skipsByTurn[turnNo] = nextSkips;

      if (ev.p && !usedPrompts.includes(ev.p)) {
        usedPrompts.push(ev.p);
      }

      const issuedAtMs = parseTs(m.created_at) || Date.now();
      latestCardByTurn[turnNo] = {
        id: ev.id || `ai-${turnNo}-${m.id || issuedAtMs}`,
        kind: ev.k || "truth",
        type: ev.k || "truth",
        category:
          ev.c ||
          (ev.src === "fallback"
            ? "Built-in Fallback"
            : ev.r && ev.r !== "standard"
              ? ev.rl || "Special Round"
              : "AI Generated"),
        intensity: ev.h || settings.intensity,
        theme: ev.h || settings.intensity,
        body: ev.p || "",
        prompt: ev.p || "",
        roundType: ev.r || "standard",
        roundLabel: ev.rl || null,
        bonusPoints: Number(ev.b) || 0,
        targetPlayerName: ev.tg || null,
        source: ev.src || "ai",
        skipsUsed: nextSkips,
        turnNo,
        issued_at: m.created_at,
        issuedAtMs,
      };
      continue;
    }

    if (ev.t === "score") {
      const turnKey = String(ev.n || "");
      if (!turnKey || completedTurns[turnKey]) continue;
      const pts = Number(ev.pts) || 0;
      const seatKey = String(ev.s || 1);
      completedTurns[turnKey] = {
        seat: Number(ev.s) || 1,
        points: pts,
        kind: ev.k || "truth",
        at: m.created_at,
      };
      scores[seatKey] = (Number(scores[seatKey]) || 0) + pts;
    }
  }

  let activeQuestion = null;
  if (room?.status === "playing") {
    const turnCard = latestCardByTurn[room.turn_no] || null;
    const dbCard = room.current_question || null;

    if (turnCard && dbCard) {
      const dbTs = parseTs(dbCard.issued_at) || parseTs(room.updated_at);
      activeQuestion = turnCard.issuedAtMs >= dbTs ? turnCard : { ...dbCard, issuedAtMs: dbTs };
    } else if (turnCard) {
      activeQuestion = turnCard;
    } else if (dbCard) {
      activeQuestion = {
        ...dbCard,
        issuedAtMs: parseTs(dbCard.issued_at) || parseTs(room.updated_at) || Date.now(),
      };
    }
  }

  const skipsUsedThisTurn = Math.max(
    Number(room?.skips_used_this_turn) || 0,
    room?.turn_no ? skipsByTurn[room.turn_no] || 0 : 0
  );

  let timerDeadlineMs = null;
  if (activeQuestion && settings.timerSeconds > 0) {
    const startMs =
      activeQuestion.issuedAtMs ||
      parseTs(activeQuestion.issued_at) ||
      parseTs(room?.updated_at) ||
      Date.now();
    timerDeadlineMs = startMs + settings.timerSeconds * 1000;
  }

  return {
    settings,
    activeQuestion,
    skipsUsedThisTurn,
    scores,
    completedTurns,
    timerDeadlineMs,
    memberGenders,
    usedPrompts,
  };
}

export function messageFor(code, fallback) {
  return fallback || LOCAL_MESSAGES[code] || LOCAL_MESSAGES.UNKNOWN;
}

function isNetworkError(error) {
  const text = `${error?.message || ""} ${error?.details || ""}`;
  return (
    !error?.code &&
    /failed to fetch|networkerror|network request failed|load failed|timeout|abort/i.test(text)
  );
}

/* Calls a database function and always resolves to { ok, error?, message?, ... }.
   It never throws and never hides a failure. */
async function rpc(fn, params = {}) {
  try {
    await ensureSession();
  } catch (err) {
    return { ok: false, error: err.code || "AUTH_FAILED", message: messageFor(err.code) };
  }

  try {
    const { data, error } = await getSupabase().rpc(fn, params);

    if (error) {
      if (isNetworkError(error)) {
        return { ok: false, error: "NETWORK", message: LOCAL_MESSAGES.NETWORK };
      }
      if (error.code === "PGRST202" || error.code === "42883") {
        return { ok: false, error: "MIGRATION_MISSING", message: LOCAL_MESSAGES.MIGRATION_MISSING };
      }
      console.error(`[between] ${fn} failed`, error);
      return { ok: false, error: "UNKNOWN", message: LOCAL_MESSAGES.UNKNOWN };
    }

    if (Array.isArray(data)) return data;
    return data ?? { ok: false, error: "UNKNOWN", message: LOCAL_MESSAGES.UNKNOWN };
  } catch (err) {
    console.error(`[between] ${fn} threw`, err);
    return { ok: false, error: "NETWORK", message: LOCAL_MESSAGES.NETWORK };
  }
}

export const api = {
  createRoom: async ({
    nickname,
    gender = null,
    mode = "ONLINE",
    intensity = "PLAYFUL",
    capacity = 2,
    deckMode = "builtin",
    aiModel = "openrouter/free",
  }) => {
    const res = await rpc("create_room", {
      p_nickname: nickname,
      p_mode: mode || "ONLINE",
      p_intensity: intensity,
      p_capacity: capacity,
    });
    if (!res?.ok || !res.room_id) return res;

    // Persist host gender if provided
    if (gender) {
      await api.setMemberProfile(res.room_id, gender);
    }

    // If host chose AI deck during room creation, persist that room setting immediately
    const normDeck = normalizeDeckMode(deckMode);
    if (normDeck === "ai") {
      await api.setRoomSettings(
        res.room_id,
        {
          deckMode: "ai",
          aiModel: aiModel || "openrouter/free",
          intensity,
          questionMode: "both",
          timerSeconds: 0,
          specialRounds: false,
        },
        false
      );
    }

    return res;
  },

  joinRoom: async (code, nickname = null, gender = null) => {
    const res = await rpc("join_room", { p_code: code, p_nickname: nickname });
    if (res?.ok && res.room_id && gender) {
      await api.setMemberProfile(res.room_id, gender);
    }
    return res;
  },

  setMemberProfile: async (roomId, gender) => {
    const cleanGender = String(gender || "").trim().slice(0, 40);
    if (!roomId || !cleanGender) return { ok: false, error: "INVALID_GENDER" };

    const direct = await rpc("set_member_profile", {
      p_room_id: roomId,
      p_gender: cleanGender,
    });

    const msgRes = await rpc("send_message", {
      p_room_id: roomId,
      p_body: encodeStateEvent({ t: "prof", g: cleanGender }),
      p_client_id: makeClientId(),
    });

    if (direct.ok) {
      return { ...direct, stateMessage: msgRes?.message || null };
    }
    if (msgRes.ok) {
      return { ok: true, gender: cleanGender, stateMessage: msgRes.message };
    }
    return direct.error !== "MIGRATION_MISSING" ? direct : msgRes;
  },

  snapshot: (code) => rpc("get_room_snapshot", { p_code: code }),
  touch: (roomId) => rpc("touch_member", { p_room_id: roomId }),
  leave: (roomId) => rpc("leave_room", { p_room_id: roomId }),
  myRooms: () => rpc("my_active_rooms"),

  startGame: (roomId) => rpc("start_game", { p_room_id: roomId }),
  setMode: (roomId, mode) => rpc("set_room_mode", { p_room_id: roomId, p_mode: mode }),
  setLock: (roomId, locked) => rpc("set_room_lock", { p_room_id: roomId, p_locked: locked }),
  resetGame: async (roomId, mode = null) => {
    const res = await rpc("reset_game", { p_room_id: roomId, p_mode: mode });
    if (res?.ok) {
      await rpc("send_message", {
        p_room_id: roomId,
        p_body: encodeStateEvent({ t: "reset", at: Date.now() }),
        p_client_id: makeClientId(),
      });
    }
    return res;
  },
  closeRoom: (roomId) => rpc("close_room", { p_room_id: roomId }),
  removeMember: (roomId, memberId, lock = false) =>
    rpc("remove_member", { p_room_id: roomId, p_member_id: memberId, p_lock: lock }),
  readmit: (roomId, memberId) =>
    rpc("readmit_member", { p_room_id: roomId, p_member_id: memberId }),
  claimHost: (roomId) => rpc("claim_host", { p_room_id: roomId }),

  draw: (roomId, kind, turnNo) =>
    rpc("draw_question", { p_room_id: roomId, p_kind: kind, p_turn_no: turnNo }),
  skip: (roomId, turnNo) => rpc("skip_question", { p_room_id: roomId, p_turn_no: turnNo }),
  next: (roomId, turnNo) => rpc("next_turn", { p_room_id: roomId, p_turn_no: turnNo }),

  setRoomSettings: async (roomId, settings = {}, currentLocked = false) => {
    const normalizedDeck = normalizeDeckMode(settings.deckMode);
    const dbDeckValue = normalizedDeck === "ai" ? "AI" : "DECK";
    const qMode = settings.questionMode || settings.mode || "both";
    const cleanIntensity = (settings.intensity || "PLAYFUL").toUpperCase();
    const cleanTimer = typeof settings.timerSeconds === "number" ? settings.timerSeconds : 0;
    const cleanSpecial = Boolean(settings.specialRounds);
    const cleanModel = settings.aiModel || "openrouter/free";

    const direct = await rpc("set_room_settings", {
      p_room_id: roomId,
      p_deck_mode: dbDeckValue,
      p_ai_model: cleanModel,
      p_intensity: cleanIntensity,
      p_timer_seconds: cleanTimer,
      p_special_rounds: cleanSpecial,
    });

    const cfgPayload = {
      t: "cfg",
      dm: normalizedDeck,
      am: cleanModel,
      tm: cleanTimer,
      sr: cleanSpecial ? 1 : 0,
      in: cleanIntensity,
      qm: ["both", "truth", "dare"].includes(qMode) ? qMode : "both",
    };

    if (direct.ok) {
      const msgRes = await rpc("send_message", {
        p_room_id: roomId,
        p_body: encodeStateEvent(cfgPayload),
        p_client_id: makeClientId(),
      });
      return {
        ...direct,
        confirmedSettings: {
          deckMode: normalizedDeck,
          aiModel: cleanModel,
          intensity: cleanIntensity,
          questionMode: cfgPayload.qm,
          timerSeconds: cleanTimer,
          specialRounds: cleanSpecial,
        },
        stateMessage: msgRes?.message || null,
      };
    }

    if (direct.error !== "MIGRATION_MISSING") {
      return direct;
    }

    // Fallback when 002_ai_and_gameplay.sql is not yet applied on remote DB:
    // Use set_room_lock with the room's current locked state to enforce PostgreSQL host-only authorization
    // in both waiting and playing states.
    const hostCheckRes = await rpc("set_room_lock", {
      p_room_id: roomId,
      p_locked: Boolean(currentLocked),
    });
    if (!hostCheckRes.ok) {
      return hostCheckRes;
    }

    const msgRes = await rpc("send_message", {
      p_room_id: roomId,
      p_body: encodeStateEvent(cfgPayload),
      p_client_id: makeClientId(),
    });

    if (!msgRes.ok) return msgRes;
    return {
      ok: true,
      room: {
        ...(hostCheckRes.room || {}),
        deck_mode: normalizedDeck,
        ai_model: cleanModel,
        intensity: cleanIntensity,
        timer_seconds: cleanTimer,
        special_rounds: cleanSpecial,
      },
      confirmedSettings: {
        deckMode: normalizedDeck,
        aiModel: cleanModel,
        intensity: cleanIntensity,
        questionMode: cfgPayload.qm,
        timerSeconds: cleanTimer,
        specialRounds: cleanSpecial,
      },
      stateMessage: msgRes.message,
    };
  },

  setAiQuestion: async (roomId, turnNo, card, isSkip = false) => {
    const direct = await rpc("set_ai_question", {
      p_room_id: roomId,
      p_turn_no: turnNo,
      p_question: card,
      p_is_skip: Boolean(isSkip),
    });

    const promptText = String(card?.prompt || card?.body || "").slice(0, 340);
    const eventPayload = {
      t: "card",
      n: Number(turnNo) || 1,
      k: card?.type || card?.kind || "truth",
      h: card?.theme || card?.intensity || "playful",
      r: card?.roundType || "standard",
      rl: card?.roundLabel || null,
      b: Number(card?.bonusPoints) || 0,
      tg: card?.targetPlayerName || null,
      src: card?.source || "ai",
      sk: isSkip ? 1 : 0,
      p: promptText,
    };

    if (direct.ok) {
      const msgRes = await rpc("send_message", {
        p_room_id: roomId,
        p_body: encodeStateEvent(eventPayload),
        p_client_id: makeClientId(),
      });
      return { ...direct, stateMessage: msgRes?.message || null };
    }

    if (direct.error !== "MIGRATION_MISSING") {
      return direct;
    }

    const msgRes = await rpc("send_message", {
      p_room_id: roomId,
      p_body: encodeStateEvent(eventPayload),
      p_client_id: makeClientId(),
    });
    if (!msgRes.ok) return msgRes;
    return { ok: true, stateMessage: msgRes.message };
  },

  completeTurnScore: async (roomId, turnNo, points = 1, seat = 1, kind = "truth") => {
    const direct = await rpc("complete_turn_score", {
      p_room_id: roomId,
      p_turn_no: turnNo,
      p_points: points,
    });

    if (direct.ok) {
      return direct;
    }

    if (direct.error !== "MIGRATION_MISSING") {
      return direct;
    }

    // Fallback: call next_turn first for atomic turn & seat verification
    const nextRes = await rpc("next_turn", {
      p_room_id: roomId,
      p_turn_no: turnNo,
    });
    if (!nextRes.ok) {
      return nextRes;
    }

    const msgRes = await rpc("send_message", {
      p_room_id: roomId,
      p_body: encodeStateEvent({
        t: "score",
        n: Number(turnNo),
        s: Number(seat) || 1,
        pts: Number(points) || 0,
        k: kind || "truth",
      }),
      p_client_id: makeClientId(),
    });

    return { ok: true, room: nextRes.room, stateMessage: msgRes?.message || null };
  },

  sendMessage: (roomId, body, clientId) =>
    rpc("send_message", { p_room_id: roomId, p_body: body, p_client_id: clientId }),
};

/* Reads messages straight from the table; Row Level Security limits this to
   rooms the signed-in user is an active member of. */
export async function fetchMessages(roomId, limit) {
  try {
    await ensureSession();
    const { data, error } = await getSupabase()
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) {
      return { ok: false, error: isNetworkError(error) ? "NETWORK" : "UNKNOWN" };
    }
    return { ok: true, messages: (data || []).reverse() };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}
