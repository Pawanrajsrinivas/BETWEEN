"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArtDefs,
  Icon,
  Decor,
  Chain,
  Rose,
  Heart,
  Snake,
  Cards,
  Hourglass,
  LipsArt,
  RoseAvatar,
} from "./Art";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

/* [number, database value, short description, icon] — the database values
   (PLAYFUL, PERSONAL…) are what the questions table filters on, so they stay. */
const MODES = [
  ["01", "PLAYFUL", "Playful & light", "petal"],
  ["02", "PERSONAL", "Honest & close", "sparkle"],
  ["03", "FLIRTY", "Bold & flirty", "lips"],
  ["04", "WILD", "No backing out", "flame"],
  ["05", "AFTER DARK", "18+ only", "moon"],
];

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function titleCase(text) {
  return text
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Logo() {
  return <div className="logo">BETWEEN</div>;
}

/* =========================
   APP
========================= */

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState("PLAYFUL");
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const invitedRoom = params.get("room");
    const isGame = params.get("game") === "true";

    if (invitedRoom) {
      const code = invitedRoom.toUpperCase();

      setRoom(code);

      if (isGame) {
        setScreen("game");
      } else {
        setScreen("join");
      }
    }
  }, []);

  function goTo(next) {
    setError("");
    setScreen(next);
  }

  /* AFTER DARK always asks for 18+ confirmation first */
  function selectMode(title) {
    if (title === "AFTER DARK" && !ageVerified) {
      setShowAgeGate(true);
      return;
    }

    setMode(title);
  }

  async function createRoom() {
    if (!name.trim() || busy) return;

    setError("");
    setBusy(true);

    const code = makeRoomCode();

    const { error: insertError } = await supabase.from("rooms").insert({
      code,
      host_name: name.trim(),
      intensity: mode,
      status: "waiting",
    });

    if (insertError) {
      setError(insertError.message);
      setBusy(false);
      return;
    }

    localStorage.setItem(
      "between_player",
      JSON.stringify({
        room: code,
        role: "host",
        nickname: name.trim(),
      })
    );

    setRoom(code);

    window.history.replaceState({}, "", `/?room=${code}`);

    setBusy(false);
    setScreen("lobby");
  }

  async function joinRoom() {
    if (!name.trim() || !room.trim() || busy) return;

    setError("");
    setBusy(true);

    const code = room.trim().toUpperCase();

    const { data, error: selectError } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (selectError) {
      setError(selectError.message);
      setBusy(false);
      return;
    }

    if (!data) {
      setError("Room not found. Check the code and try again.");
      setBusy(false);
      return;
    }

    if (data.guest_name) {
      setError("This room already has two players.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        guest_name: name.trim(),
        status: "ready",
      })
      .eq("id", data.id);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    localStorage.setItem(
      "between_player",
      JSON.stringify({
        room: code,
        role: "guest",
        nickname: name.trim(),
      })
    );

    setRoom(code);
    setMode(data.intensity);

    window.history.replaceState({}, "", `/?room=${code}`);

    setBusy(false);
    setScreen("lobby");
  }

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <ArtDefs />

      {screen === "home" && (
        <HomeScreen
          onCreate={() => goTo("create")}
          onJoin={() => goTo("join")}
        />
      )}

      {(screen === "create" || screen === "join") && (
        <FormScreen
          join={screen === "join"}
          busy={busy}
          error={error}
          name={name}
          setName={setName}
          room={room}
          setRoom={setRoom}
          mode={mode}
          onSelectMode={selectMode}
          onSwitch={goTo}
          onBack={() => goTo("home")}
          onSubmit={screen === "join" ? joinRoom : createRoom}
        />
      )}

      {screen === "lobby" && (
        <Lobby room={room} onGame={() => setScreen("game")} />
      )}

      {screen === "game" && <Game roomCode={room} />}

      {showAgeGate && (
        <AgeGate
          onConfirm={() => {
            setAgeVerified(true);
            setMode("AFTER DARK");
            setShowAgeGate(false);
          }}
          onDecline={() => setShowAgeGate(false)}
        />
      )}
    </>
  );
}

/* =========================
   AGE CONFIRMATION
========================= */

function AgeGate({ onConfirm, onDecline }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape") onDecline();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDecline]);

  return (
    <div className="age-overlay">
      <div
        className="age-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-title"
      >
        <Hourglass className="age-hourglass" />

        <h2 className="display" id="age-title">
          Are you 18
          <br />
          or older?
        </h2>

        <p className="lede">
          This is a private and mature experience meant only for adults.
        </p>

        <div className="age-actions">
          <button ref={confirmRef} className="primary" onClick={onConfirm}>
            Yes, I am 18+
          </button>

          <button className="secondary outline" onClick={onDecline}>
            No, I am under 18
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   HOME
========================= */

function HomeScreen({ onCreate, onJoin }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="screen home">
      <Decor variant="home" />

      <header className="topbar">
        <Logo />

        <nav
          className={`nav-links ${menuOpen ? "open" : ""}`}
          aria-label="Main"
        >
          <a href="#top" onClick={() => setMenuOpen(false)}>
            Home
          </a>
          <a href="#about" onClick={() => setMenuOpen(false)}>
            About
          </a>
          <a href="#how" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <button
            type="button"
            className="nav-cta"
            onClick={() => {
              setMenuOpen(false);
              onCreate();
            }}
          >
            Start Playing
          </button>
        </nav>

        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            A private truth or dare experience
            <Icon name="sparkle" className="eyebrow-spark" />
          </p>

          <h1 className="display">
            Two people.
            <br />
            <em>No limits.</em>
          </h1>

          <p className="lede">
            A private truth or dare experience
            <br />
            for deeper, wilder connections.
          </p>

          <div className="cta-row">
            <button className="primary" onClick={onCreate}>
              Create a Room
              <span aria-hidden="true">→</span>
            </button>

            <button className="secondary outline" onClick={onJoin}>
              Join a Room
            </button>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <Snake className="art-snake" />
          <Heart className="art-heart" />
          <Rose className="art-rose" />
          <Cards className="art-cards" />
          <Icon name="sparkle" className="art-spark s1" />
          <Icon name="sparkle" className="art-spark s2" />
          <Icon name="sparkle" className="art-spark s3" />
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <div className="how-intro" id="about">
          <p className="eyebrow">About</p>
          <h2 className="display" id="how-title">
            Just the two of you.
          </h2>
          <p className="lede">
            BETWEEN is a private game for exactly two people. Rooms hold two
            players, questions match the energy you choose, and your chat stays
            in the room.
          </p>
        </div>

        <ol className="steps" id="how">
          <li>
            <span className="step-icon">
              <Icon name="heart" />
            </span>
            <strong>Create a room</strong>
            <span>Pick your energy and get a six-character code.</span>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="lips" />
            </span>
            <strong>Share the code</strong>
            <span>One partner joins. No one else can.</span>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="flame" />
            </span>
            <strong>Take turns</strong>
            <span>Truth or dare, with a private chat alongside.</span>
          </li>
        </ol>
      </section>

      <footer className="foot">
        <span>Intimate</span>
        <i aria-hidden="true" />
        <span>Private</span>
        <i aria-hidden="true" />
        <span>Real</span>
        <i aria-hidden="true" />
        <span>Just the Two of You</span>
      </footer>
    </main>
  );
}

/* =========================
   CREATE / JOIN FORM
========================= */

function FormScreen({
  join,
  busy,
  error,
  name,
  setName,
  room,
  setRoom,
  mode,
  onSelectMode,
  onSwitch,
  onBack,
  onSubmit,
}) {
  const disabled = !name.trim() || (join && !room.trim()) || busy;

  function handleSubmit(e) {
    e.preventDefault();
    if (!disabled) onSubmit();
  }

  return (
    <main className="screen form-screen">
      <Decor variant="form" chain />

      <header className="topbar">
        <button
          className="icon-btn"
          onClick={onBack}
          type="button"
          aria-label="Back to home"
        >
          <Icon name="back" />
        </button>

        <Logo />

        <span className="topbar-spacer" aria-hidden="true" />
      </header>

      <form className="panel form-card" onSubmit={handleSubmit} noValidate>
        <div className="segmented" role="tablist" aria-label="Room action">
          <button
            type="button"
            role="tab"
            aria-selected={!join}
            className={!join ? "on" : ""}
            onClick={() => onSwitch("create")}
          >
            Create Room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={join}
            className={join ? "on" : ""}
            onClick={() => onSwitch("join")}
          >
            Join Room
          </button>
        </div>

        <div className="field">
          <label htmlFor="player-name">Your Nickname</label>
          <div className="input-wrap">
            <Icon name="user" />
            <input
              id="player-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Baby, Angel, Trouble"
              maxLength={30}
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint={join ? "next" : "go"}
            />
          </div>
        </div>

        {join ? (
          <div className="field">
            <label htmlFor="room-code">Room Code</label>
            <div className="input-wrap">
              <Icon name="sparkle" />
              <input
                id="room-code"
                className="code-input"
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={error ? "true" : undefined}
              />
            </div>
          </div>
        ) : (
          <fieldset className="field intensity">
            <legend>Select Intensity</legend>

            <div className="mode-grid" role="radiogroup" aria-label="Intensity">
              {MODES.map(([num, title, description, icon]) => (
                <button
                  key={title}
                  type="button"
                  role="radio"
                  aria-checked={mode === title}
                  className={`mode-card ${mode === title ? "selected" : ""}`}
                  onClick={() => onSelectMode(title)}
                >
                  <Icon name={icon} />
                  <strong>{titleCase(title)}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary full"
          type="submit"
          disabled={disabled}
          aria-busy={busy ? "true" : undefined}
        >
          {busy ? (join ? "Joining" : "Creating") : join ? "Join Room" : "Create My Room"}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </form>
    </main>
  );
}

/* =========================
   LOBBY
========================= */

function Lobby({ room, onGame }) {
  const [roomData, setRoomData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [me, setMe] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("between_player") || "null");
      if (stored && stored.room === room) setMe(stored.role);
    } catch {
      /* no saved player — labels simply omit "You" */
    }
  }, [room]);

  useEffect(() => {
    let channel;

    async function loadRoom() {
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", room)
        .maybeSingle();

      setRoomData(data);
      setLoaded(true);
    }

    loadRoom();

    channel = supabase
      .channel(`lobby-${room}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
        },
        (payload) => {
          if (payload.new.code === room) {
            setRoomData(payload.new);

            if (payload.new.status === "playing") {
              window.location.href = `/?room=${room}&game=true`;
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room]);

  async function startGame() {
    if (!roomData?.guest_name || starting) return;

    setStartError("");
    setStarting(true);

    const { error } = await supabase
      .from("rooms")
      .update({
        status: "playing",
      })
      .eq("id", roomData.id);

    if (error) {
      setStartError(error.message);
      setStarting(false);
      return;
    }

    window.location.href = `/?room=${room}&game=true`;
  }

  async function copyText(text, which) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => {
        setCopied(null);
      }, 2000);
    } catch {
      setStartError("Couldn't copy automatically. Select the code and copy it.");
    }
  }

  function leaveRoom() {
    window.location.href = "/";
  }

  if (!loaded) {
    return (
      <main className="screen">
        <Decor variant="lobby" />
        <div className="state-card">
          <Hourglass className="state-hourglass" />
          <p className="eyebrow" role="status">
            Loading room
          </p>
        </div>
      </main>
    );
  }

  if (!roomData) {
    return (
      <main className="screen">
        <Decor variant="lobby" />
        <div className="state-card">
          <p className="eyebrow">Room {room}</p>
          <h1 className="display">
            Room <em>not found.</em>
          </h1>
          <p className="lede">
            This room may have expired, or the code may be wrong.
          </p>
          <a className="secondary outline" href="/">
            Back to start
          </a>
        </div>
      </main>
    );
  }

  const hasGuest = Boolean(roomData.guest_name);

  return (
    <main className="screen lobby">
      <Decor variant="lobby" />

      <header className="topbar">
        <Logo />

        <button type="button" className="leave-btn" onClick={leaveRoom}>
          <Icon name="leave" />
          Leave Room
        </button>
      </header>

      <div className="lobby-body">
        <h1 className="display">
          {hasGuest ? "Both Players Are In" : "Your Room is Ready"}
        </h1>

        <p className="lede">
          {hasGuest
            ? "Start whenever you're both ready."
            : "Share this code with your partner"}
        </p>

        <div className="code-card">
          <div className="code-chars" aria-label={`Room code ${room.split("").join(" ")}`}>
            {room.split("").map((char, i) => (
              <span key={i}>{char}</span>
            ))}
          </div>

          <button
            type="button"
            className={`copy-btn ${copied === "code" ? "done" : ""}`}
            onClick={() => copyText(room, "code")}
            aria-label={copied === "code" ? "Room code copied" : "Copy room code"}
          >
            <Icon name={copied === "code" ? "check" : "copy"} />
          </button>
        </div>

        <div className="duo">
          <div className="duo-player">
            <RoseAvatar />
            <strong>{roomData.host_name}</strong>
            <span>{me === "host" ? "You" : "Player 1"}</span>
            <em className="badge">Host</em>
          </div>

          <div className="pulse-line" aria-hidden="true">
            <i />
            <Icon name="heart" />
            <i />
          </div>

          <div className={`duo-player ${hasGuest ? "" : "empty"}`}>
            {hasGuest ? (
              <RoseAvatar />
            ) : (
              <span className="empty-avatar" aria-hidden="true">
                ?
              </span>
            )}
            <strong>{hasGuest ? roomData.guest_name : "Waiting for Player 2…"}</strong>
            {hasGuest && <span>{me === "guest" ? "You" : "Player 2"}</span>}
            {hasGuest && <em className="badge ghost">Guest</em>}
          </div>
        </div>

        <div className="status-panel" role="status">
          <Hourglass className="status-hourglass" />
          <div>
            <strong>
              {hasGuest
                ? "Your partner has joined"
                : "Waiting for your partner to join…"}
            </strong>
            <span>
              {hasGuest
                ? "Both players are in the room."
                : "This won't take long. Get ready."}
            </span>
          </div>
        </div>

        {startError && (
          <p className="form-error" role="alert">
            {startError}
          </p>
        )}

        <div className="lobby-actions">
          <button
            className="secondary outline"
            onClick={() =>
              copyText(`${window.location.origin}/?room=${room}`, "link")
            }
            type="button"
          >
            {copied === "link" ? "Link copied" : "Copy invite link"}
          </button>

          {hasGuest && (
            <button
              className="primary"
              onClick={startGame}
              disabled={starting}
              aria-busy={starting ? "true" : undefined}
              type="button"
            >
              {starting ? "Starting" : "Start Between"}
              {!starting && <span aria-hidden="true">→</span>}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/* =========================
   REAL GAME
========================= */

function Game({ roomCode }) {
  const [roomData, setRoomData] = useState(null);
  const [question, setQuestion] = useState(null);
  const [messages, setMessages] = useState([]);
  const [player, setPlayer] = useState(null);
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const messagesRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("between_player");

    if (stored) {
      try {
        const savedPlayer = JSON.parse(stored);

        if (savedPlayer.room && savedPlayer.role) {
          setPlayer(savedPlayer);
        }
      } catch {
        console.log("Could not read player data.");
      }
    }
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    let roomChannel;
    let messageChannel;

    async function loadGame() {
      const { data: room, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode)
        .maybeSingle();

      if (error || !room) {
        setLoadError("Room could not be found.");
        setLoading(false);
        return;
      }

      setRoomData(room);

      if (room.current_question_id) {
        await loadQuestion(room.current_question_id);
      }

      const { data: oldMessages } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", {
          ascending: true,
        });

      setMessages(oldMessages || []);
      setLoading(false);

      /* ROOM REALTIME */
      roomChannel = supabase
        .channel(`game-room-${roomCode}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
          },
          async (payload) => {
            if (payload.new.code !== roomCode) {
              return;
            }

            setRoomData(payload.new);

            if (payload.new.current_question_id) {
              await loadQuestion(payload.new.current_question_id);
            } else {
              setQuestion(null);
            }
          }
        );

      roomChannel.subscribe();

      /* CHAT REALTIME */
      messageChannel = supabase
        .channel(`game-chat-${room.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `room_id=eq.${room.id}`,
          },
          (payload) => {
            setMessages((current) => {
              const exists = current.some(
                (message) => message.id === payload.new.id
              );

              if (exists) {
                return current;
              }

              return [...current, payload.new];
            });
          }
        );

      messageChannel.subscribe();
    }

    async function loadQuestion(id) {
      const { data } = await supabase
        .from("questions")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (data) {
        setQuestion(data);
      }
    }

    loadGame();

    return () => {
      if (roomChannel) {
        supabase.removeChannel(roomChannel);
      }

      if (messageChannel) {
        supabase.removeChannel(messageChannel);
      }
    };
  }, [roomCode]);

  /* Keep the newest message in view (scrolls only the chat, never the page) */
  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, loading]);

  /* Prevents double-taps from firing the same action twice */
  async function run(action) {
    if (busyRef.current) return;

    busyRef.current = true;
    setBusy(true);

    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function chooseQuestion(kind) {
    if (!roomData || !player) return;

    setNotice("");

    const myPlayerNumber = player.role === "host" ? 1 : 2;

    if (roomData.current_player !== myPlayerNumber) {
      return;
    }

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("intensity", roomData.intensity)
      .eq("kind", kind)
      .eq("active", true);

    if (error) {
      setNotice(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setNotice(
        `No ${kind.toLowerCase()} questions are available for ${roomData.intensity} yet. Try the other option.`
      );
      return;
    }

    const randomQuestion = data[Math.floor(Math.random() * data.length)];

    const { error: updateError } = await supabase
      .from("rooms")
      .update({
        current_question_id: randomQuestion.id,
      })
      .eq("id", roomData.id);

    if (updateError) {
      setNotice(updateError.message);
    }
  }

  async function nextTurn() {
    if (!roomData || !player) {
      return;
    }

    const myPlayerNumber = player.role === "host" ? 1 : 2;

    if (roomData.current_player !== myPlayerNumber) {
      return;
    }

    await supabase
      .from("rooms")
      .update({
        current_player: myPlayerNumber === 1 ? 2 : 1,
        current_question_id: null,
      })
      .eq("id", roomData.id);
  }

  async function skipQuestion() {
    if (!question || !roomData || !player) {
      return;
    }

    const myPlayerNumber = player.role === "host" ? 1 : 2;

    if (roomData.current_player !== myPlayerNumber) {
      return;
    }

    await supabase.from("messages").insert({
      room_id: roomData.id,
      player: myPlayerNumber,
      nickname: player.nickname,
      body: `${player.nickname} skipped the previous question.`,
    });

    await chooseQuestion(question.kind);
  }

  async function sendMessage(e) {
    e.preventDefault();

    if (!chatText.trim() || !roomData || !player) {
      return;
    }

    const myPlayerNumber = player.role === "host" ? 1 : 2;
    const text = chatText.trim();

    setChatText("");

    const { error } = await supabase.from("messages").insert({
      room_id: roomData.id,
      player: myPlayerNumber,
      nickname: player.nickname,
      body: text,
    });

    if (error) {
      setNotice(error.message);
      setChatText(text);
    }
  }

  function leaveRoom() {
    window.location.href = "/";
  }

  if (loadError) {
    return (
      <main className="screen game">
        <Decor variant="game" />
        <div className="state-card">
          <p className="eyebrow">Room {roomCode}</p>
          <h1 className="display">
            Room <em>not found.</em>
          </h1>
          <p className="lede">
            This room may have expired, or the link may be wrong.
          </p>
          <a className="secondary outline" href="/">
            Back to start
          </a>
        </div>
      </main>
    );
  }

  if (loading || !roomData) {
    return (
      <main className="screen game">
        <Decor variant="game" />
        <div className="state-card">
          <Hourglass className="state-hourglass" />
          <p className="eyebrow" role="status">
            Entering your space
          </p>
        </div>
      </main>
    );
  }

  const myPlayerNumber = player?.role === "host" ? 1 : 2;
  const isMyTurn = roomData.current_player === myPlayerNumber;
  const otherPlayer =
    myPlayerNumber === 1 ? roomData.guest_name : roomData.host_name;

  const turnTitle = isMyTurn ? "Your Turn" : `${otherPlayer || "Their"}'s Turn`;

  let turnSub;
  if (isMyTurn) {
    turnSub = question ? "Take your time, then pass the turn" : "Choose your move";
  } else {
    turnSub = question
      ? `${otherPlayer || "They"} drew a ${question.kind.toLowerCase()}`
      : `${otherPlayer || "They"} is choosing a truth or dare`;
  }

  const canPick = isMyTurn && !question;

  return (
    <main className="screen game">
      <Decor variant="game" />

      <header className="topbar">
        <Logo />

        <div className="room-tag">
          <span className="mode-name">{titleCase(roomData.intensity)}</span>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span>{roomCode}</span>
        </div>

        <button type="button" className="leave-btn" onClick={leaveRoom}>
          <Icon name="leave" />
          <span>Leave Room</span>
        </button>
      </header>

      <div className="game-layout">
        {/* GAME */}
        <section className="stage" aria-label="Game">
          <LipsArt className="stage-lips" />
          <Chain className="stage-chain" />

          <div
            className="turn-head turn-reveal"
            key={`${roomData.current_player}-${roomData.current_question_id || "choice"}`}
            role="status"
          >
            {isMyTurn && (
              <span className="turn-crown">
                <Icon name="crown" />
                Your Turn
              </span>
            )}
            <h1 className="display">{turnTitle}</h1>
            <p>{turnSub}</p>
          </div>

          <div className="pick-row" role="group" aria-label="Truth or dare">
            <button
              type="button"
              className={`pick ${question?.kind === "TRUTH" ? "active" : ""}`}
              disabled={!canPick || busy}
              onClick={() => run(() => chooseQuestion("TRUTH"))}
            >
              <Icon name="heart" />
              Truth
            </button>

            <button
              type="button"
              className={`pick ${question?.kind === "DARE" ? "active" : ""}`}
              disabled={!canPick || busy}
              onClick={() => run(() => chooseQuestion("DARE"))}
            >
              <Icon name="flame" />
              Dare
            </button>
          </div>

          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}

          <div
            className={`question-card ${question ? "question-reveal" : "idle"}`}
            key={question ? question.id : "idle"}
          >
            <Icon name="sparkle" className="qc-ornament" />

            {question ? (
              <>
                <div className="question-kind">{question.kind}</div>
                <p className="question-text">{question.body}</p>
              </>
            ) : (
              <p className="question-text idle-text">
                {isMyTurn
                  ? "Pick truth or dare, and your question appears here."
                  : "Your next question is on its way…"}
              </p>
            )}

            <span className="qc-dice" aria-hidden="true">
              <Icon name="dice" />
            </span>
          </div>

          <div className="turn-actions">
            {isMyTurn && question && (
              <button
                type="button"
                className="skip-link"
                disabled={busy}
                onClick={() => run(skipQuestion)}
              >
                Skip this question
              </button>
            )}

            <button
              type="button"
              className="primary full"
              disabled={!isMyTurn || !question || busy}
              aria-busy={busy && isMyTurn && question ? "true" : undefined}
              onClick={() => run(nextTurn)}
            >
              Next Turn
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        {/* CHAT */}
        <aside className="chat" aria-label="Chat">
          <div className="chat-head">
            <span className="chat-title">
              <Icon name="chat" />
              Chat
            </span>
            <span className="chat-people">
              {roomData.host_name}
              {roomData.guest_name ? ` & ${roomData.guest_name}` : ""}
            </span>
          </div>

          <div className="messages" ref={messagesRef} role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty-chat">
                <RoseAvatar />
                <strong>Say something.</strong>
                Messages here stay between the two of you.
              </div>
            )}

            {messages.map((message) => {
              const isSystemMessage = message.body
                .toLowerCase()
                .includes("skipped the previous question");

              const mine = message.player === myPlayerNumber;

              if (isSystemMessage) {
                return (
                  <div key={message.id} className="system-message">
                    <span>{message.body}</span>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={`message ${mine ? "mine" : ""}`}
                >
                  {!mine && <RoseAvatar className="small" />}

                  <div className="message-col">
                    {!mine && (
                      <span className="message-name">{message.nickname}</span>
                    )}

                    <div className="message-body">{message.body}</div>

                    <span className="message-time">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <form className="chat-form" onSubmit={sendMessage}>
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type a message…"
              maxLength={500}
              autoComplete="off"
              enterKeyHint="send"
              aria-label="Message"
            />

            <button
              type="submit"
              disabled={!chatText.trim()}
              aria-label="Send message"
            >
              <Icon name="send" />
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
