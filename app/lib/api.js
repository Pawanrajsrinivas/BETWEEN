import { ensureSession, getSupabase } from "./supabase";

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
  createRoom: ({ nickname, mode, intensity, capacity }) =>
    rpc("create_room", {
      p_nickname: nickname,
      p_mode: mode,
      p_intensity: intensity,
      p_capacity: capacity,
    }),
  joinRoom: (code, nickname = null) =>
    rpc("join_room", { p_code: code, p_nickname: nickname }),
  snapshot: (code) => rpc("get_room_snapshot", { p_code: code }),
  touch: (roomId) => rpc("touch_member", { p_room_id: roomId }),
  leave: (roomId) => rpc("leave_room", { p_room_id: roomId }),
  myRooms: () => rpc("my_active_rooms"),

  startGame: (roomId) => rpc("start_game", { p_room_id: roomId }),
  setMode: (roomId, mode) => rpc("set_room_mode", { p_room_id: roomId, p_mode: mode }),
  setLock: (roomId, locked) => rpc("set_room_lock", { p_room_id: roomId, p_locked: locked }),
  resetGame: (roomId, mode = null) => rpc("reset_game", { p_room_id: roomId, p_mode: mode }),
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
