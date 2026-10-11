"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG, normalizeDeckMode } from "../config";
import {
  api,
  fetchMessages,
  isStateEventMessage,
  messageFor,
  reduceRoomStateEvents,
} from "./api";
import { getSpecialRoundForTurn } from "./fallbackDeck";
import { getSupabase } from "./supabase";

/* Everything a room screen needs: the shared game state (from the database,
   the single source of truth), live presence, chat, and the guarded actions. */

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function ts(value) {
  const n = Date.parse(value || "");
  return Number.isNaN(n) ? 0 : n;
}

function sortMessages(list) {
  return [...list].sort((a, b) => {
    if (a.pending !== b.pending) return a.pending ? 1 : -1;
    const d = ts(a.created_at) - ts(b.created_at);
    if (d) return d;
    return typeof a.id === "number" && typeof b.id === "number" ? a.id - b.id : 0;
  });
}

export function useRoom({ code, userId, notify }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | blocked
  const [blocked, setBlocked] = useState(null); // { error, message }
  const [terminal, setTerminal] = useState(null); // closed | removed | left | full
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [members, setMembers] = useState([]);
  const [removedList, setRemovedList] = useState([]);
  const [graceMs, setGraceMs] = useState(CONFIG.fallbackGraceSeconds * 1000);
  const [allMessages, setAllMessages] = useState([]);
  const [chatState, setChatState] = useState("loading"); // loading | ready | error
  const [dbUp, setDbUp] = useState(false);
  const [everUp, setEverUp] = useState(false);
  const [presenceUp, setPresenceUp] = useState(false);
  const [presenceReady, setPresenceReady] = useState(false);
  const [present, setPresent] = useState(() => new Set());
  const [absentSince, setAbsentSince] = useState({});
  const [typing, setTyping] = useState({});
  const [browserOnline, setBrowserOnline] = useState(true);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [actionError, setActionError] = useState("");

  const roomRef = useRef(null);
  const meRef = useRef(null);
  const membersRef = useRef([]);
  const presentRef = useRef(new Set());
  const announced = useRef({});
  const disconnectTimers = useRef({});
  const typingTimers = useRef({});
  const presenceChannel = useRef(null);
  const lastTypingSent = useRef(0);
  const busyRef = useRef(false);
  const lastKnown = useRef({});
  const prevConn = useRef("connecting");
  const usedAiPromptsRef = useRef([]);
  const aiAbortRef = useRef(null);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const say = useCallback((kind, text) => notifyRef.current?.(kind, text), []);

  /* ---------- applying state ------------------------------------------- */

  const announce = useCallback(
    (memberId, kind, text) => {
      const last = announced.current[memberId];
      if (kind === "joined" && last === "joined") return;
      if ((kind === "left" || kind === "removed") && last === kind) return;
      if (
        kind === "disconnected" &&
        !(last === undefined || last === "joined" || last === "reconnected")
      )
        return;
      if (kind === "reconnected" && last !== "disconnected") return;
      announced.current[memberId] = kind;
      say(kind, text);
    },
    [say]
  );

  const applyRoom = useCallback(
    (incoming) => {
      if (!incoming) return;
      const prev = roomRef.current;
      if (prev && ts(incoming.updated_at) < ts(prev.updated_at)) return;

      const merged = { ...(prev || {}), ...incoming };
      if (incoming.deck_mode !== undefined && incoming.deck_mode !== null) {
        merged.deck_mode = normalizeDeckMode(incoming.deck_mode);
      } else if (prev?.deck_mode) {
        merged.deck_mode = normalizeDeckMode(prev.deck_mode);
      }
      roomRef.current = merged;
      setRoom(merged);

      if (merged.status === "closed") setTerminal((t) => t || "closed");

      if (
        prev &&
        prev.host_user &&
        incoming.host_user &&
        prev.host_user !== incoming.host_user
      ) {
        const next = membersRef.current.find((m) => m.user_id === incoming.host_user);
        if (next) say("host", `${next.nickname} is now the host.`);
      }
    },
    [say]
  );

  const applySnapshot = useCallback(
    (snap) => {
      const now = Date.now();
      const list = (snap.members || []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        nickname: m.nickname,
        gender: m.gender || null,
        seat: m.seat,
        seenAt: now - (m.seen_ago || 0) * 1000,
      }));
      membersRef.current = list;
      setMembers(list);
      list.forEach((m) => {
        if (!announced.current[m.id]) announced.current[m.id] = "joined";
      });
      meRef.current = snap.me;
      setMe(snap.me);
      setRemovedList(snap.removed || []);
      if (snap.config?.grace_seconds) setGraceMs(snap.config.grace_seconds * 1000);
      applyRoom(snap.room);
    },
    [applyRoom]
  );

  const mergeMessage = useCallback((incoming) => {
    if (!incoming) return;
    setAllMessages((cur) => {
      const idx = cur.findIndex(
        (m) => m.id === incoming.id || (incoming.client_id && m.client_id === incoming.client_id)
      );
      if (idx >= 0) {
        const next = cur.slice();
        next[idx] = { ...cur[idx], ...incoming, pending: false, failed: false };
        return sortMessages(next);
      }
      return sortMessages([...cur, { ...incoming, pending: false }]);
    });
  }, []);

  const loadMessages = useCallback(async (roomId) => {
    const res = await fetchMessages(roomId, CONFIG.historyLimit);
    if (!res.ok) {
      setChatState((s) => (s === "ready" ? s : "error"));
      return false;
    }
    setAllMessages((cur) => {
      const map = new Map();
      cur.filter((m) => !m.pending && !m.failed).forEach((m) => map.set(m.id, m));
      res.messages.forEach((m) => map.set(m.id, m));
      const real = [...map.values()];
      const known = new Set(real.map((m) => m.client_id).filter(Boolean));
      const unsent = cur.filter((m) => (m.pending || m.failed) && !known.has(m.client_id));
      return sortMessages([...real, ...unsent]);
    });
    setChatState("ready");
    return true;
  }, []);

  const handleFailure = useCallback((res, initial = false) => {
    switch (res?.error) {
      case "REMOVED":
        setTerminal("removed");
        return true;
      case "LEFT":
        if (initial) {
          setBlocked({ error: "LEFT", message: res.message });
          setPhase("blocked");
        } else setTerminal("left");
        return true;
      case "ROOM_CLOSED":
        setTerminal("closed");
        return true;
      case "ROOM_FULL":
        if (initial) {
          setBlocked(res);
          setPhase("blocked");
        } else setTerminal("full");
        return true;
      case "NOT_MEMBER":
      case "ROOM_NOT_FOUND":
        setBlocked(res);
        setPhase("blocked");
        return true;
      default:
        return false;
    }
  }, []);

  const resync = useCallback(async () => {
    const snap = await api.snapshot(code);
    if (!snap.ok) {
      handleFailure(snap);
      return false;
    }
    if (snap.room?.id) {
      await loadMessages(snap.room.id);
    }
    applySnapshot(snap);
    return true;
  }, [code, applySnapshot, handleFailure, loadMessages]);

  /* ---------- initial load --------------------------------------------- */

  const load = useCallback(async () => {
    setPhase("loading");
    setBlocked(null);
    setTerminal(null);
    const snap = await api.snapshot(code);
    if (!snap.ok) {
      if (!handleFailure(snap, true)) {
        setBlocked(snap);
        setPhase("blocked");
      }
      return;
    }
    const beat = await api.touch(snap.room.id);
    if (!beat.ok && beat.error !== "NETWORK") {
      if (!handleFailure(beat, true)) {
        setBlocked(beat);
        setPhase("blocked");
      }
      return;
    }
    announced.current = {};
    // Load messages BEFORE marking phase ready so persisted state events (cfg, card, prof, score)
    // are reduced synchronously on the very first ready render without flashing default state.
    await loadMessages(snap.room.id);
    applySnapshot(snap);
    setPhase("ready");
  }, [code, applySnapshot, handleFailure, loadMessages]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------- realtime: database changes + presence -------------------- */

  const roomId = room?.id;
  const memberId = me?.member_id;

  useEffect(() => {
    if (phase !== "ready" || !roomId || !memberId || terminal) return undefined;
    const supabase = getSupabase();
    let disposed = false;

    const onMemberRow = (payload) => {
      const row = payload.new;
      if (!row || payload.eventType === "DELETE") return;

      if (row.id === meRef.current?.member_id) {
        if (row.status === "removed") setTerminal("removed");
        else if (row.status === "left") setTerminal((t) => t || "left");
        else if (row.gender) {
          meRef.current = { ...meRef.current, gender: row.gender };
          setMe(meRef.current);
        }
        return;
      }

      const existing = membersRef.current.find((m) => m.id === row.id);
      if (row.status === "active") {
        const entry = {
          id: row.id,
          user_id: row.user_id,
          nickname: row.nickname,
          gender: row.gender || existing?.gender || null,
          seat: row.seat,
          seenAt: Date.now(),
        };
        const next = existing
          ? membersRef.current.map((m) =>
              m.id === row.id ? { ...m, ...entry, seenAt: m.seenAt } : m
            )
          : [...membersRef.current, entry].sort((a, b) => a.seat - b.seat);
        membersRef.current = next;
        setMembers(next);
        if (!existing) {
          delete announced.current[row.id];
          announce(row.id, "joined", `${row.nickname} joined the room.`);
        }
      } else if (existing) {
        const next = membersRef.current.filter((m) => m.id !== row.id);
        membersRef.current = next;
        setMembers(next);
        clearTimeout(disconnectTimers.current[row.id]);
        if (row.status === "removed") {
          announce(row.id, "removed", `${row.nickname} was removed by the host.`);
        } else {
          announce(row.id, "left", `${row.nickname} left the room.`);
        }
        if (row.status === "removed") resync();
      }
    };

    const db = supabase
      .channel(`db:${roomId}:${memberId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => applyRoom(p.new)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` },
        onMemberRow
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (p) => mergeMessage(p.new)
      )
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setDbUp(true);
          setEverUp(true);
          resync();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setDbUp(false);
        }
      });

    const onSync = () => {
      const state = pres.presenceState();
      const ids = new Set(Object.keys(state));
      const prev = presentRef.current;
      presentRef.current = ids;
      setPresent(ids);
      setPresenceReady(true);

      const myId = meRef.current?.member_id;
      prev.forEach((id) => {
        if (ids.has(id) || id === myId) return;
        setAbsentSince((a) => ({ ...a, [id]: Date.now() }));
        clearTimeout(disconnectTimers.current[id]);
        disconnectTimers.current[id] = setTimeout(() => {
          const m = membersRef.current.find((x) => x.id === id);
          if (m && !presentRef.current.has(id)) {
            announce(id, "disconnected", `${m.nickname} disconnected.`);
          }
        }, CONFIG.disconnectNoticeDelayMs);
      });
      ids.forEach((id) => {
        if (prev.has(id) || id === myId) return;
        clearTimeout(disconnectTimers.current[id]);
        setAbsentSince((a) => {
          if (!(id in a)) return a;
          const { [id]: _drop, ...rest } = a;
          return rest;
        });
        const m = membersRef.current.find((x) => x.id === id);
        if (m) announce(id, "reconnected", `${m.nickname} reconnected.`);
      });
    };

    const pres = supabase
      .channel(`room:${roomId}`, {
        config: { private: true, presence: { key: memberId }, broadcast: { self: false } },
      })
      .on("presence", { event: "sync" }, onSync)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const id = payload?.member_id;
        if (!id || id === meRef.current?.member_id) return;
        setTyping((t) => ({ ...t, [id]: true }));
        clearTimeout(typingTimers.current[id]);
        typingTimers.current[id] = setTimeout(() => {
          setTyping((t) => {
            const { [id]: _drop, ...rest } = t;
            return rest;
          });
        }, CONFIG.typingTtlMs);
      })
      .subscribe(async (status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          await pres.track({ member_id: memberId, at: Date.now() });
          setPresenceUp(true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setPresenceUp(false);
        }
      });
    presenceChannel.current = pres;

    return () => {
      disposed = true;
      Object.values(disconnectTimers.current).forEach(clearTimeout);
      Object.values(typingTimers.current).forEach(clearTimeout);
      disconnectTimers.current = {};
      typingTimers.current = {};
      presenceChannel.current = null;
      setDbUp(false);
      setPresenceUp(false);
      setPresenceReady(false);
      supabase.removeChannel(db);
      supabase.removeChannel(pres);
    };
  }, [phase, roomId, memberId, terminal, announce, applyRoom, mergeMessage, resync]);

  /* ---------- heartbeat, resync triggers, clock ------------------------- */

  useEffect(() => {
    if (phase !== "ready" || !roomId || terminal) return undefined;

    const beat = async () => {
      const res = await api.touch(roomId);
      if (!res.ok && res.error !== "NETWORK") handleFailure(res);
    };
    const timer = setInterval(beat, CONFIG.heartbeatMs);
    const slow = setInterval(() => resync(), 30000);

    const wake = () => {
      if (document.visibilityState === "visible") {
        beat();
        resync();
      }
    };
    const onOnline = () => {
      setBrowserOnline(true);
      beat();
      resync();
    };
    const onOffline = () => setBrowserOnline(false);

    setBrowserOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(timer);
      clearInterval(slow);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [phase, roomId, terminal, handleFailure, resync]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  /* ---------- connection + member status -------------------------------- */

  const conn = !browserOnline
    ? "offline"
    : dbUp
      ? "online"
      : everUp
        ? "reconnecting"
        : "connecting";
  useEffect(() => {
    if (
      conn === "online" &&
      (prevConn.current === "reconnecting" || prevConn.current === "offline")
    ) {
      say("online", "You're back online.");
    }
    prevConn.current = conn;
  }, [conn, say]);

  const statuses = useMemo(() => {
    const now = Date.now();
    const out = {};
    members.forEach((m) => {
      if (m.id === me?.member_id) {
        out[m.id] = conn === "online" ? "online" : "reconnecting";
        return;
      }
      if (conn !== "online") {
        out[m.id] = lastKnown.current[m.id] || "checking";
        return;
      }
      const lastHeard = absentSince[m.id] ?? m.seenAt;
      const inGrace = now - lastHeard < graceMs;
      if (presenceUp && presenceReady) {
        out[m.id] = present.has(m.id) ? "online" : inGrace ? "reconnecting" : "offline";
      } else if (presenceUp) {
        out[m.id] = "checking";
      } else {
        out[m.id] = now - m.seenAt < 60000 ? "online" : inGrace ? "reconnecting" : "offline";
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, me, conn, present, presenceUp, presenceReady, absentSince, graceMs, tick]);

  useEffect(() => {
    if (conn === "online") lastKnown.current = { ...statuses };
  }, [conn, statuses]);

  /* ---------- authoritative room state reduction ------------------------ */

  const reduced = useMemo(
    () => reduceRoomStateEvents({ room, members, messages: allMessages }),
    [room, members, allMessages]
  );

  const enrichedMembers = useMemo(
    () =>
      members.map((m) => ({
        ...m,
        gender: reduced.memberGenders?.[m.id] || m.gender || null,
      })),
    [members, reduced.memberGenders]
  );
  membersRef.current = enrichedMembers;

  const enrichedMe = useMemo(() => {
    if (!me) return null;
    return {
      ...me,
      gender: reduced.memberGenders?.[me.member_id] || me.gender || null,
    };
  }, [me, reduced.memberGenders]);
  meRef.current = enrichedMe;

  const visibleMessages = useMemo(
    () => allMessages.filter((m) => !isStateEventMessage(m)),
    [allMessages]
  );

  const effectiveRoom = useMemo(() => {
    if (!room) return null;
    const specialRound = getSpecialRoundForTurn(room.turn_no, reduced.settings.specialRounds);
    return {
      ...room,
      mode: room.mode || "ONLINE",
      question_mode: reduced.settings.questionMode || "both",
      intensity: reduced.settings.intensity,
      deck_mode: normalizeDeckMode(reduced.settings.deckMode),
      ai_model: reduced.settings.aiModel,
      timer_seconds: reduced.settings.timerSeconds,
      special_rounds: reduced.settings.specialRounds,
      current_question: reduced.activeQuestion,
      skips_used_this_turn: reduced.skipsUsedThisTurn,
      scores: reduced.scores,
      completed_turns: reduced.completedTurns,
      timer_deadline_ms: reduced.timerDeadlineMs,
      special_round: specialRound,
    };
  }, [room, reduced]);

  const effectiveRoomRef = useRef(null);
  effectiveRoomRef.current = effectiveRoom;

  // Keep usedAiPromptsRef seeded with any persisted AI prompts in the room
  useEffect(() => {
    if (Array.isArray(reduced.usedPrompts) && reduced.usedPrompts.length > 0) {
      const merged = Array.from(
        new Set([...usedAiPromptsRef.current, ...reduced.usedPrompts])
      ).slice(-30);
      usedAiPromptsRef.current = merged;
    }
  }, [reduced.usedPrompts]);

  /* ---------- chat ------------------------------------------------------- */

  const deliver = useCallback(
    async (clientId, body) => {
      const res = await api.sendMessage(roomRef.current.id, body, clientId);
      if (res.ok) {
        mergeMessage(res.message);
        return true;
      }
      if (handleFailure(res)) return false;
      setAllMessages((cur) =>
        cur.map((m) =>
          m.client_id === clientId
            ? { ...m, pending: false, failed: true, error: messageFor(res.error, res.message) }
            : m
        )
      );
      return false;
    },
    [mergeMessage, handleFailure]
  );

  const sendChat = useCallback(
    (text) => {
      const body = (text || "").trim();
      const self = meRef.current;
      if (!body || !self || !roomRef.current) return false;
      const clientId = uuid();
      setAllMessages((cur) =>
        sortMessages([
          ...cur,
          {
            id: clientId,
            client_id: clientId,
            room_id: roomRef.current.id,
            member_id: self.member_id,
            player: self.seat,
            nickname: self.nickname,
            body,
            kind: "chat",
            created_at: new Date().toISOString(),
            pending: true,
          },
        ])
      );
      deliver(clientId, body);
      return true;
    },
    [deliver]
  );

  const retryMessage = useCallback(
    (clientId) => {
      const target = allMessages.find((m) => m.client_id === clientId);
      if (!target) return;
      setAllMessages((cur) =>
        cur.map((m) => (m.client_id === clientId ? { ...m, pending: true, failed: false } : m))
      );
      deliver(clientId, target.body);
    },
    [allMessages, deliver]
  );

  const discardMessage = useCallback((clientId) => {
    setAllMessages((cur) => cur.filter((m) => m.client_id !== clientId));
  }, []);

  const sendTyping = useCallback(() => {
    const ch = presenceChannel.current;
    const now = Date.now();
    if (!ch || now - lastTypingSent.current < CONFIG.typingThrottleMs) return;
    lastTypingSent.current = now;
    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { member_id: meRef.current?.member_id },
    });
  }, []);

  /* ---------- guarded actions -------------------------------------------- */

  const act = useCallback(
    async (fn) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setActionError("");
      try {
        const res = await fn();
        if (res?.room) applyRoom(res.room);
        if (res?.stateMessage) mergeMessage(res.stateMessage);
        if (res && res.ok === false) {
          if (res.error === "STALE_TURN") return res;
          if (!handleFailure(res)) setActionError(messageFor(res.error, res.message));
        }
        return res;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [applyRoom, mergeMessage, handleFailure]
  );

  const turnNo = () => roomRef.current?.turn_no;
  const rid = () => roomRef.current?.id;

  const generateAndPersistAiCard = useCallback(
    async (kind, isSkip = false) => {
      const curRoom = effectiveRoomRef.current;
      if (!curRoom) return { ok: false, error: "ROOM_NOT_FOUND" };

      const requestedTurnNo = curRoom.turn_no;
      const requestedKind = (
        kind ||
        curRoom.current_question?.kind ||
        (curRoom.question_mode === "dare" ? "dare" : "truth")
      ).toLowerCase();

      const currentMembers = membersRef.current || [];
      const activeMember =
        currentMembers.find((m) => m.seat === curRoom.current_player) || null;
      const otherMembers = currentMembers.filter((m) => m.seat !== curRoom.current_player);
      const targetMember =
        otherMembers.length > 0
          ? otherMembers[(requestedTurnNo - 1) % otherMembers.length]
          : null;
      const specialRound = getSpecialRoundForTurn(requestedTurnNo, curRoom.special_rounds);

      if (aiAbortRef.current) {
        aiAbortRef.current.abort();
      }
      const controller = new AbortController();
      aiAbortRef.current = controller;

      setAiGenerating(true);
      try {
        const response = await fetch("/api/generate-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            type: requestedKind,
            theme: curRoom.intensity || "PLAYFUL",
            mode: "online",
            selectedModel: curRoom.ai_model || "openrouter/free",
            players: currentMembers.map((m) => ({
              name: m.nickname,
              gender: m.gender || undefined,
              seat: m.seat,
            })),
            currentPlayer: activeMember
              ? { name: activeMember.nickname, gender: activeMember.gender || undefined }
              : null,
            targetPlayer: targetMember
              ? { name: targetMember.nickname, gender: targetMember.gender || undefined }
              : null,
            roundType: specialRound.id,
            excludePrompts: usedAiPromptsRef.current.slice(-15),
            allowFallback: true,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success || !data?.card) {
          return {
            ok: false,
            error: "AI_FAILED",
            message: data?.error || "Could not generate an AI card right now.",
          };
        }

        // Check if turn changed while AI request was in flight
        if (effectiveRoomRef.current?.turn_no !== requestedTurnNo) {
          return { ok: false, error: "STALE_TURN", message: "The turn changed." };
        }

        const card = data.card;
        if (card.prompt) {
          usedAiPromptsRef.current = [...usedAiPromptsRef.current.slice(-25), card.prompt];
        }

        if (data.fallback) {
          say(
            "info",
            "AI provider was unreachable — drew a built-in fallback card for this turn. AI Deck remains selected."
          );
        }

        const saveRes = await api.setAiQuestion(curRoom.id, requestedTurnNo, card, isSkip);
        return saveRes;
      } catch (err) {
        if (err?.name === "AbortError") {
          return { ok: false, error: "ABORTED", message: "AI request was cancelled." };
        }
        return {
          ok: false,
          error: "NETWORK",
          message: err?.message || "Failed to generate AI card.",
        };
      } finally {
        if (aiAbortRef.current === controller) {
          aiAbortRef.current = null;
        }
        setAiGenerating(false);
      }
    },
    [say]
  );

  const actions = useMemo(
    () => ({
      start: () => act(() => api.startGame(rid())),
      draw: (kind) =>
        act(async () => {
          const cur = effectiveRoomRef.current;
          if (normalizeDeckMode(cur?.deck_mode) === "ai") {
            return generateAndPersistAiCard(kind, false);
          }
          return api.draw(rid(), String(kind || "TRUTH").toUpperCase(), turnNo());
        }),
      drawAi: (kind) => act(() => generateAndPersistAiCard(kind, false)),
      skip: () =>
        act(async () => {
          const cur = effectiveRoomRef.current;
          if (
            normalizeDeckMode(cur?.deck_mode) === "ai" ||
            cur?.current_question?.source === "ai" ||
            cur?.current_question?.source === "fallback"
          ) {
            if ((cur?.skips_used_this_turn || 0) >= 1) {
              return {
                ok: false,
                error: "SKIP_LIMIT",
                message: "Only one skip is allowed per turn.",
              };
            }
            const kind = cur?.current_question?.kind || "truth";
            return generateAndPersistAiCard(kind, true);
          }
          return api.skip(rid(), turnNo());
        }),
      next: () => act(() => api.next(rid(), turnNo())),
      completeTurn: () =>
        act(async () => {
          const cur = effectiveRoomRef.current;
          if (!cur) return { ok: false, error: "ROOM_NOT_FOUND" };
          const q = cur.current_question;
          const kind = (q?.kind || q?.type || "truth").toLowerCase();
          const basePts = kind === "dare" ? 2 : 1;
          const bonusPts = Number(q?.bonusPoints || cur.special_round?.bonusPoints || 0);
          const totalPts = basePts + bonusPts;
          return api.completeTurnScore(
            cur.id,
            cur.turn_no,
            totalPts,
            cur.current_player,
            kind
          );
        }),
      updateSettings: async (newSettings) => {
        const cur = effectiveRoomRef.current;
        if (!cur) return { ok: false, error: "ROOM_NOT_FOUND" };
        // If switching away from AI while an AI card request is in flight, cancel the in-flight fetch
        if (normalizeDeckMode(newSettings?.deckMode) === "builtin" && aiAbortRef.current) {
          aiAbortRef.current.abort();
          aiAbortRef.current = null;
        }
        const res = await api.setRoomSettings(cur.id, newSettings, Boolean(cur.locked));
        if (res?.room) applyRoom(res.room);
        if (res?.stateMessage) mergeMessage(res.stateMessage);
        if (res && res.ok === false) {
          if (!handleFailure(res)) setActionError(messageFor(res.error, res.message));
        }
        return res;
      },
      updateProfile: async (gender) => {
        const cur = effectiveRoomRef.current;
        if (!cur) return { ok: false, error: "ROOM_NOT_FOUND" };
        const res = await api.setMemberProfile(cur.id, gender);
        if (res?.stateMessage) mergeMessage(res.stateMessage);
        return res;
      },
      setMode: (mode) => act(() => api.setMode(rid(), mode)),
      setLock: (locked) => act(() => api.setLock(rid(), locked)),
      reset: (mode) => act(() => api.resetGame(rid(), mode)),
      close: () => act(() => api.closeRoom(rid())),
      remove: async (id, lock) => {
        const res = await act(() => api.removeMember(rid(), id, lock));
        if (res?.ok) resync();
        return res;
      },
      readmit: async (id) => {
        const res = await act(() => api.readmit(rid(), id));
        if (res?.ok) resync();
        return res;
      },
      claimHost: async () => {
        const res = await act(() => api.claimHost(rid()));
        if (res?.ok) resync();
        return res;
      },
      leave: async () => {
        const res = await api.leave(rid());
        return res;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [act, resync, generateAndPersistAiCard, applyRoom, mergeMessage, handleFailure]
  );

  /* ---------- derived ---------------------------------------------------- */

  const isHost = Boolean(room && userId && room.host_user === userId);
  const hostMember = enrichedMembers.find((m) => m.user_id === room?.host_user) || null;
  const currentMember = room
    ? enrichedMembers.find((m) => m.seat === room.current_player) || null
    : null;
  const occupied = enrichedMembers.filter((m) => statuses[m.id] !== "offline").length;
  const typingNames = enrichedMembers.filter((m) => typing[m.id]).map((m) => m.nickname);

  return {
    phase,
    blocked,
    terminal,
    room: effectiveRoom,
    me: enrichedMe,
    members: enrichedMembers,
    removedList,
    statuses,
    conn,
    messages: visibleMessages,
    chatState,
    typingNames,
    isHost,
    hostMember,
    currentMember,
    occupied,
    graceMs,
    busy: busy || aiGenerating,
    aiGenerating,
    actionError,
    clearActionError: () => setActionError(""),
    reload: load,
    reloadMessages: () => roomRef.current && loadMessages(roomRef.current.id),
    sendChat,
    retryMessage,
    discardMessage,
    sendTyping,
    actions,
  };
}
