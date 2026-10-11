"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArtDefs } from "./Art";
import { CONFIG, GENDER_OPTIONS, normalizeDeckMode, resolveGenderValue } from "./config";
import { api } from "./lib/api";
import { ensureSession, isConfigured } from "./lib/supabase";
import { RoomView } from "./components/RoomView";
import { OfflineSetup } from "./components/OfflineSetup";
import { OfflineGame } from "./components/OfflineGame";
import {
  AgeGate,
  FormScreen,
  HomeScreen,
  LoadingCard,
  SetupNotice,
} from "./components/Screens";

const LAST_KEY = "between_last";
const OFFLINE_SESSION_KEY = "between_offline_session";

function readLast() {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLast(value) {
  try {
    if (value) localStorage.setItem(LAST_KEY, JSON.stringify(value));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

function readOfflineSession() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeOfflineSession(value) {
  try {
    if (value) localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(value));
    else localStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {
    /* ignore storage error */
  }
}

export default function Home() {
  // boot | setup | home | create | join | room | offline_setup | offline_game
  const [screen, setScreen] = useState("boot");
  const [setupMessage, setSetupMessage] = useState("");
  const [userId, setUserId] = useState(null);

  const [name, setName] = useState("");
  const [genderOption, setGenderOption] = useState("");
  const [customGender, setCustomGender] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [intensity, setIntensity] = useState("PLAYFUL");
  const [capacity, setCapacity] = useState(CONFIG.defaultCapacity);
  const [deckMode, setDeckMode] = useState("builtin");
  const [aiModel, setAiModel] = useState("openrouter/free");

  const [offlineSession, setOfflineSession] = useState(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const [showAgeGate, setShowAgeGate] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  const [rejoinList, setRejoinList] = useState([]);
  const [rejoining, setRejoining] = useState("");
  const [rejoinError, setRejoinError] = useState("");

  const loadRejoin = useCallback(async () => {
    try {
      const res = await api.myRooms();
      const list = Array.isArray(res) ? res : [];
      const last = readLast();
      if (last?.code && !list.some((r) => r.code === last.code)) {
        list.push({
          code: last.code,
          nickname: last.nickname,
          mode: "ONLINE",
          status: "waiting",
        });
      }
      setRejoinList(list.slice(0, 3));
    } catch {
      /* offline or unavailable */
    }
  }, []);

  /* Boot: load any saved offline session & last online player details, sign in
     (anonymously), then open either the invited room, an active offline game,
     or the home screen. */
  useEffect(() => {
    const savedOffline = readOfflineSession();
    if (savedOffline) {
      setOfflineSession(savedOffline);
    }

    const savedLast = readLast();
    if (savedLast?.nickname) {
      setName((prev) => prev || savedLast.nickname);
    }
    if (savedLast?.gender) {
      const matched = GENDER_OPTIONS.find((g) => g.id === savedLast.gender);
      if (matched) {
        setGenderOption(matched.id);
      } else {
        setGenderOption("Prefer to self-describe");
        setCustomGender(savedLast.gender);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (modeParam === "offline" && savedOffline?.players?.length >= 2) {
      setScreen("offline_game");
    }

    if (!isConfigured()) {
      setSetupMessage(
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or ..._PUBLISHABLE_KEY) to your environment, then redeploy."
      );
      if (modeParam !== "offline") setScreen("setup");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const session = await ensureSession();
        if (cancelled) return;
        setUserId(session.user.id);
      } catch (err) {
        if (cancelled) return;
        // If user is playing offline pass-and-play without internet, allow home/offline screens
        if (modeParam === "offline") {
          setScreen(savedOffline?.players?.length >= 2 ? "offline_game" : "offline_setup");
          return;
        }
        setSetupMessage(
          err.code === "AUTH_DISABLED"
            ? 'Anonymous sign-ins are turned off. In Supabase open Authentication → Providers (or Sign In / Providers) and enable "Allow anonymous sign-ins".'
            : "Could not start a secure session. Check your connection and reload the page."
        );
        setScreen("setup");
        return;
      }

      const invited = params.get("room");
      if (invited) {
        setRoomCode(invited.toUpperCase().replace(/[^A-Z0-9]/g, ""));
        setScreen("room");
      } else if (modeParam === "offline") {
        setScreen(savedOffline?.players?.length >= 2 ? "offline_game" : "offline_setup");
      } else {
        setScreen("home");
        loadRejoin();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadRejoin]);

  function goTo(next) {
    setError("");
    setScreen(next);
  }

  function enterRoom(code, extra = {}) {
    setRoomCode(code);
    const resolvedGender =
      extra.gender !== undefined
        ? extra.gender
        : resolveGenderValue(genderOption, customGender);
    writeLast({
      code,
      nickname: extra.nickname || name.trim(),
      gender: resolvedGender || undefined,
      mode: "ONLINE",
    });
    window.history.replaceState({}, "", `/?room=${code}`);
    setScreen("room");
  }

  const exitRoom = useCallback(() => {
    window.history.replaceState({}, "", "/");
    setRoomCode("");
    setError("");
    setScreen("home");
    loadRejoin();
  }, [loadRejoin]);

  const needJoin = useCallback((code, why) => {
    window.history.replaceState({}, "", "/");
    setRoomCode(code);
    setError(why?.error === "ROOM_NOT_FOUND" ? why.message : "");
    setScreen("join");
  }, []);

  function selectIntensity(title) {
    if (title === "AFTER DARK" && !ageVerified) {
      setShowAgeGate(true);
      return;
    }
    setIntensity(title);
  }

  async function guard(fn) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const startOfflineSetup = useCallback(() => {
    setError("");
    window.history.replaceState({}, "", "/?mode=offline");
    setScreen("offline_setup");
  }, []);

  const handleStartOfflineGame = useCallback((config) => {
    const newSession = {
      id: `offline-${Date.now()}`,
      players: config.players,
      deckMode: normalizeDeckMode(config.deckMode || "ai"),
      aiModel: config.aiModel || "openrouter/free",
      intensity: config.intensity || "PLAYFUL",
      questionMode: config.questionMode || "both",
      timerSeconds: typeof config.timerSeconds === "number" ? config.timerSeconds : 30,
      specialRounds: config.specialRounds !== undefined ? Boolean(config.specialRounds) : true,
      turnNo: 1,
      activeIndex: 0,
      currentCard: null,
      skipsUsedThisTurn: 0,
      timerDeadlineMs: null,
      scores: {},
      stats: {},
      usedPrompts: [],
      ended: false,
    };
    setOfflineSession(newSession);
    writeOfflineSession(newSession);
    window.history.replaceState({}, "", "/?mode=offline");
    setScreen("offline_game");
  }, []);

  const handleUpdateOfflineSession = useCallback((updater) => {
    setOfflineSession((prev) => {
      const next = typeof updater === "function" ? updater(prev || {}) : updater;
      writeOfflineSession(next);
      return next;
    });
  }, []);

  const createRoom = () =>
    guard(async () => {
      const finalGender = resolveGenderValue(genderOption, customGender);
      const res = await api.createRoom({
        nickname: name.trim(),
        gender: finalGender,
        mode: "ONLINE",
        intensity,
        capacity,
        deckMode: normalizeDeckMode(deckMode),
        aiModel,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      enterRoom(res.code, {
        nickname: name.trim(),
        gender: finalGender,
        mode: "ONLINE",
      });
    });

  const joinRoom = () =>
    guard(async () => {
      const finalGender = resolveGenderValue(genderOption, customGender);
      const res = await api.joinRoom(roomCode.trim().toUpperCase(), name.trim(), finalGender);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      enterRoom(res.code, {
        nickname: res.nickname || name.trim(),
        gender: finalGender,
      });
    });

  async function rejoin(code, nickname) {
    if (rejoining) return;
    setRejoining(code);
    setRejoinError("");
    const savedLast = readLast();
    const savedGender =
      savedLast?.code === code && savedLast?.gender
        ? savedLast.gender
        : resolveGenderValue(genderOption, customGender) || null;
    const res = await api.joinRoom(code, null, savedGender);
    setRejoining("");
    if (!res.ok) {
      setRejoinError(res.message);
      if (
        res.error === "ROOM_CLOSED" ||
        res.error === "ROOM_NOT_FOUND" ||
        res.error === "REMOVED"
      ) {
        writeLast(null);
        setRejoinList((list) => list.filter((r) => r.code !== code));
      }
      return;
    }
    enterRoom(res.code, {
      nickname: res.nickname || nickname,
      gender: savedGender,
    });
  }

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <ArtDefs />

      {screen === "boot" && <LoadingCard label="Starting up" variant="home" />}
      {screen === "setup" && <SetupNotice message={setupMessage} />}

      {screen === "home" && (
        <HomeScreen
          onCreate={() => goTo("create")}
          onJoin={() => goTo("join")}
          onOffline={startOfflineSetup}
          savedOfflineSession={
            offlineSession && !offlineSession.ended && offlineSession.players?.length >= 2
              ? offlineSession
              : null
          }
          onResumeOffline={() => {
            window.history.replaceState({}, "", "/?mode=offline");
            setScreen("offline_game");
          }}
          rejoinList={rejoinList}
          rejoining={rejoining}
          rejoinError={rejoinError}
          onRejoin={rejoin}
        />
      )}

      {(screen === "create" || screen === "join") && (
        <FormScreen
          join={screen === "join"}
          busy={busy}
          error={error}
          name={name}
          setName={setName}
          genderOption={genderOption}
          setGenderOption={setGenderOption}
          customGender={customGender}
          setCustomGender={setCustomGender}
          room={roomCode}
          setRoom={setRoomCode}
          intensity={intensity}
          onSelectIntensity={selectIntensity}
          capacity={capacity}
          setCapacity={setCapacity}
          deckMode={deckMode}
          setDeckMode={setDeckMode}
          aiModel={aiModel}
          setAiModel={setAiModel}
          onSwitch={goTo}
          onBack={() => goTo("home")}
          onSubmit={screen === "join" ? joinRoom : createRoom}
        />
      )}

      {screen === "offline_setup" && (
        <OfflineSetup
          initialConfig={{
            players:
              offlineSession?.players ||
              (name.trim()
                ? [
                    {
                      id: "p-1",
                      name: name.trim(),
                      gender: resolveGenderValue(genderOption, customGender) || "Male",
                    },
                    { id: "p-2", name: "", gender: "Female" },
                  ]
                : undefined),
            deckMode: offlineSession?.deckMode || "ai",
            aiModel: offlineSession?.aiModel || "openrouter/free",
            intensity: offlineSession?.intensity || intensity || "PLAYFUL",
            questionMode: offlineSession?.questionMode || "both",
            timerSeconds:
              typeof offlineSession?.timerSeconds === "number" ? offlineSession.timerSeconds : 30,
            specialRounds:
              offlineSession?.specialRounds !== undefined ? offlineSession.specialRounds : true,
          }}
          savedSession={
            offlineSession && !offlineSession.ended && offlineSession.players?.length >= 2
              ? offlineSession
              : null
          }
          onResumeSession={() => setScreen("offline_game")}
          onDiscardSaved={() => {
            setOfflineSession(null);
            writeOfflineSession(null);
          }}
          onStartGame={handleStartOfflineGame}
          onBack={() => {
            window.history.replaceState({}, "", "/");
            goTo("home");
          }}
        />
      )}

      {screen === "offline_game" && offlineSession && (
        <OfflineGame
          session={offlineSession}
          onUpdateSession={handleUpdateOfflineSession}
          onReturnToSetup={() => setScreen("offline_setup")}
          onExitHome={() => {
            window.history.replaceState({}, "", "/");
            goTo("home");
          }}
        />
      )}

      {screen === "room" && roomCode && userId && (
        <RoomView code={roomCode} userId={userId} onExit={exitRoom} onNeedJoin={needJoin} />
      )}

      {showAgeGate && (
        <AgeGate
          onConfirm={() => {
            setAgeVerified(true);
            setIntensity("AFTER DARK");
            setShowAgeGate(false);
          }}
          onDecline={() => setShowAgeGate(false)}
        />
      )}
    </>
  );
}
