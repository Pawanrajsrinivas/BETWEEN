"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArtDefs } from "./Art";
import { CONFIG } from "./config";
import { api } from "./lib/api";
import { ensureSession, isConfigured } from "./lib/supabase";
import { RoomView } from "./components/RoomView";
import {
  AgeGate,
  FormScreen,
  HomeScreen,
  LoadingCard,
  SetupNotice,
} from "./components/Screens";

const LAST_KEY = "between_last";

function readLast() {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || "null");
  } catch {
    return null; // storage can be blocked; this is only a convenience
  }
}

function writeLast(value) {
  try {
    if (value) localStorage.setItem(LAST_KEY, JSON.stringify(value));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* private mode / blocked storage: the server still knows our rooms */
  }
}

export default function Home() {
  const [screen, setScreen] = useState("boot"); // boot | setup | home | create | join | room
  const [setupMessage, setSetupMessage] = useState("");
  const [userId, setUserId] = useState(null);

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [gameMode, setGameMode] = useState(null);
  const [intensity, setIntensity] = useState("PLAYFUL");
  const [capacity, setCapacity] = useState(CONFIG.defaultCapacity);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const [showAgeGate, setShowAgeGate] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  const [rejoinList, setRejoinList] = useState([]);
  const [rejoining, setRejoining] = useState("");
  const [rejoinError, setRejoinError] = useState("");

  const loadRejoin = useCallback(async () => {
    const res = await api.myRooms();
    const list = Array.isArray(res) ? res : [];
    const last = readLast();
    if (last?.code && !list.some((r) => r.code === last.code)) {
      // A room we left on purpose or were disconnected from: offer it too.
      // Joining re-checks everything on the server, so a stale hint is harmless.
      list.push({
        code: last.code,
        nickname: last.nickname,
        mode: last.mode || "ONLINE",
        status: "waiting",
      });
    }
    setRejoinList(list.slice(0, 3));
  }, []);

  /* Boot: sign in (anonymously), then either open the room in the URL or show
     the home screen with any rooms we can rejoin. */
  useEffect(() => {
    if (!isConfigured()) {
      setSetupMessage(
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or ..._PUBLISHABLE_KEY) to your environment, then redeploy."
      );
      setScreen("setup");
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
        setSetupMessage(
          err.code === "AUTH_DISABLED"
            ? "Anonymous sign-ins are turned off. In Supabase open Authentication → Providers (or Sign In / Providers) and enable \"Allow anonymous sign-ins\"."
            : "Could not start a secure session. Check your connection and reload the page."
        );
        setScreen("setup");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const invited = params.get("room");
      if (invited) {
        setRoomCode(invited.toUpperCase().replace(/[^A-Z0-9]/g, ""));
        setScreen("room");
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
    writeLast({ code, nickname: extra.nickname || name.trim(), mode: extra.mode || gameMode });
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

  /* Opening a link to a room we are not in lands on the join form with the
     code filled in. */
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
    if (busyRef.current) return; // one request at a time; blocks double taps
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

  const createRoom = () =>
    guard(async () => {
      const res = await api.createRoom({
        nickname: name.trim(),
        mode: gameMode,
        intensity,
        capacity,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      enterRoom(res.code, { nickname: name.trim(), mode: gameMode });
    });

  const joinRoom = () =>
    guard(async () => {
      const res = await api.joinRoom(roomCode.trim().toUpperCase(), name.trim());
      if (!res.ok) {
        setError(res.message);
        return;
      }
      enterRoom(res.code, { nickname: res.nickname });
    });

  async function rejoin(code, nickname) {
    if (rejoining) return;
    setRejoining(code);
    setRejoinError("");
    const res = await api.joinRoom(code, null);
    setRejoining("");
    if (!res.ok) {
      setRejoinError(res.message);
      if (res.error === "ROOM_CLOSED" || res.error === "ROOM_NOT_FOUND" || res.error === "REMOVED") {
        writeLast(null);
        setRejoinList((list) => list.filter((r) => r.code !== code));
      }
      return;
    }
    enterRoom(res.code, { nickname: res.nickname || nickname });
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
          room={roomCode}
          setRoom={setRoomCode}
          gameMode={gameMode}
          setGameMode={setGameMode}
          intensity={intensity}
          onSelectIntensity={selectIntensity}
          capacity={capacity}
          setCapacity={setCapacity}
          onSwitch={goTo}
          onBack={() => goTo("home")}
          onSubmit={screen === "join" ? joinRoom : createRoom}
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
