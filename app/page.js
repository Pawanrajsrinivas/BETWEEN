"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const MODES = [
  ["01", "PLAYFUL", "Easy beginnings"],
  ["02", "PERSONAL", "Get to know each other"],
  ["03", "FLIRTY", "A little closer"],
  ["04", "WILD", "No backing out"],
  ["05", "AFTER DARK", "18+ only"],
];

function makeRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

  const modeInfo = MODES.find((item) => item[1] === mode);

  return (
    <>
      <div className="grain" aria-hidden="true" />

      {screen === "home" && (
        <HomeScreen
          mode={mode}
          setMode={setMode}
          onCreate={() => goTo("create")}
          onJoin={() => goTo("join")}
        />
      )}

      {screen === "create" && (
        <FormScreen
          title={
            <>
              Create a <em>room.</em>
            </>
          }
          lede="Pick a name and an energy. You'll get a code to share with one person."
          button="CREATE ROOM"
          busyLabel="CREATING"
          busy={busy}
          error={error}
          name={name}
          setName={setName}
          onBack={() => goTo("home")}
          onSubmit={createRoom}
          extra={
            <div className="field">
              <label htmlFor="intensity">Intensity</label>

              <select
                id="intensity"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                {MODES.map((item) => (
                  <option key={item[1]} value={item[1]}>
                    {item[1]}
                  </option>
                ))}
              </select>

              {modeInfo && <span className="hint">{modeInfo[2]}</span>}
            </div>
          }
        />
      )}

      {screen === "join" && (
        <FormScreen
          title={
            <>
              Join <em>them.</em>
            </>
          }
          lede="Enter your name and the six-character code you were given."
          button="JOIN ROOM"
          busyLabel="JOINING"
          busy={busy}
          error={error}
          name={name}
          setName={setName}
          room={room}
          setRoom={setRoom}
          onBack={() => goTo("home")}
          onSubmit={joinRoom}
          join
        />
      )}

      {screen === "lobby" && (
        <Lobby room={room} onGame={() => setScreen("game")} />
      )}

      {screen === "game" && <Game roomCode={room} />}
    </>
  );
}

/* =========================
   HOME
========================= */

function HomeScreen({ mode, setMode, onCreate, onJoin }) {
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const confirmRef = useRef(null);

  function selectMode(title) {
    if (title === "AFTER DARK" && !ageVerified) {
      setShowAgeGate(true);
      return;
    }

    setMode(title);
  }

  useEffect(() => {
    if (!showAgeGate) return;

    confirmRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape") setShowAgeGate(false);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAgeGate]);

  return (
    <>
      <main className="screen home">
        <header className="topbar">
          <div className="wordmark">BETWEEN</div>
          <div className="topbar-note">A game for two</div>
        </header>

        <section className="hero">
          <p className="eyebrow">Two people · One private space</p>

          <h1 className="display">
            What happens
            <br />
            <em>between</em> you.
          </h1>

          <p className="lede">
            Truths. Dares. Questions you wouldn&apos;t normally ask. A private
            game designed for two people.
          </p>

          <div className="cta-row">
            <button className="primary" onClick={onCreate}>
              Create room
              <span aria-hidden="true">→</span>
            </button>

            <button className="secondary" onClick={onJoin}>
              Join room
            </button>
          </div>

          <p className="assurance">Private · Two players</p>
        </section>

        <section className="moods-section" aria-labelledby="moods-label">
          <p className="label" id="moods-label">
            Choose your energy
          </p>

          <div className="moods">
            {MODES.map(([num, title, description]) => (
              <button
                key={title}
                className={`mood ${mode === title ? "selected" : ""}`}
                onClick={() => selectMode(title)}
                aria-pressed={mode === title}
              >
                <span className="mood-num">{num}</span>
                <strong>{title}</strong>
                <small>{description}</small>
              </button>
            ))}
          </div>
        </section>

        <footer className="foot">
          <span>BETWEEN</span>
          <span>Keep it between you.</span>
        </footer>
      </main>

      {showAgeGate && (
        <div className="age-overlay">
          <div
            className="age-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="age-title"
          >
            <p className="eyebrow">BETWEEN · After Dark</p>

            <h2 className="display" id="age-title">
              Are you
              <br />
              <em>18 or older?</em>
            </h2>

            <p className="lede">
              AFTER DARK is intended only for adults. By continuing, you
              confirm that you are at least 18 years old.
            </p>

            <div className="age-actions">
              <button
                ref={confirmRef}
                className="primary"
                onClick={() => {
                  setAgeVerified(true);
                  setMode("AFTER DARK");
                  setShowAgeGate(false);
                }}
              >
                I&apos;m 18+ · Continue
              </button>

              <button
                className="secondary"
                onClick={() => {
                  setShowAgeGate(false);
                }}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* =========================
   FORM
========================= */

function FormScreen({
  title,
  lede,
  button,
  busyLabel,
  busy,
  error,
  name,
  setName,
  room,
  setRoom,
  onBack,
  onSubmit,
  join,
  extra,
}) {
  const disabled = !name.trim() || (join && !room.trim()) || busy;

  function handleSubmit(e) {
    e.preventDefault();
    if (!disabled) onSubmit();
  }

  return (
    <main className="screen form-screen">
      <button className="text-button" onClick={onBack} type="button">
        ← Back
      </button>

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <p className="eyebrow">BETWEEN</p>

        <h1 className="display">{title}</h1>

        <p className="lede">{lede}</p>

        <div className="field">
          <label htmlFor="player-name">Your name</label>
          <input
            id="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What should they call you?"
            maxLength={30}
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint={join ? "next" : "go"}
          />
        </div>

        {join && (
          <div className="field">
            <label htmlFor="room-code">Room code</label>
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
        )}

        {extra}

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
          {busy ? busyLabel : button}
        </button>

        <span className="privacy">
          Your room is private and designed for two people.
        </span>
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

  function copyInvite() {
    copyText(`${window.location.origin}/?room=${room}`, "link");
  }

  function copyCode() {
    copyText(room, "code");
  }

  if (!loaded) {
    return (
      <main className="screen">
        <div className="state-card">
          <p className="eyebrow" role="status">
            Loading room
          </p>
          <div className="loading-line" />
        </div>
      </main>
    );
  }

  if (!roomData) {
    return (
      <main className="screen">
        <div className="state-card">
          <p className="eyebrow">Room {room}</p>
          <h1 className="display">
            Room <em>not found.</em>
          </h1>
          <p className="lede">
            This room may have expired, or the code may be wrong.
          </p>
          <a className="secondary" href="/">
            Back to start
          </a>
        </div>
      </main>
    );
  }

  const hasGuest = Boolean(roomData.guest_name);

  return (
    <main className="screen lobby">
      <header className="topbar">
        <div className="wordmark">BETWEEN</div>
        <div className="topbar-note">{roomData.intensity}</div>
      </header>

      <div className="lobby-body">
        <p className="eyebrow">{hasGuest ? "Both players are in" : "Room ready"}</p>

        <h1 className="display">
          {hasGuest ? (
            <>
              Ready when
              <br />
              <em>you are.</em>
            </>
          ) : (
            <>
              Waiting for
              <br />
              <em>two.</em>
            </>
          )}
        </h1>

        <button
          type="button"
          className={`code-block ${copied === "code" ? "done" : ""}`}
          onClick={copyCode}
          aria-label={`Room code ${room.split("").join(" ")}. Tap to copy.`}
        >
          <span className="label">Room code</span>
          <strong>{room}</strong>
          <span className="copy-hint" aria-live="polite">
            {copied === "code" ? "Copied" : "Tap to copy"}
          </span>
        </button>

        <div className="seats">
          <div className="seat">
            <div className="seat-mark" aria-hidden="true">
              {roomData.host_name.trim().charAt(0).toUpperCase()}
            </div>
            <div className="seat-text">
              <span className="seat-name">{roomData.host_name}</span>
              <span className="seat-role">Host</span>
            </div>
            <span className="seat-state">Joined</span>
          </div>

          <div className={`seat ${hasGuest ? "" : "empty"}`}>
            <div className="seat-mark" aria-hidden="true">
              {hasGuest ? roomData.guest_name.trim().charAt(0).toUpperCase() : "?"}
            </div>
            <div className="seat-text">
              <span className="seat-name">
                {hasGuest ? roomData.guest_name : "Waiting for them…"}
              </span>
              <span className="seat-role">Guest</span>
            </div>
            <span className="seat-state">{hasGuest ? "Joined" : "Waiting"}</span>
          </div>
        </div>

        {startError && (
          <p className="form-error" role="alert">
            {startError}
          </p>
        )}

        <div className="lobby-actions">
          <button className="secondary" onClick={copyInvite} type="button">
            {copied === "link" ? "Copied" : "Copy invite link"}
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

        <p className="tag lobby-meta">{roomData.intensity} · Two players</p>
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

  if (loadError) {
    return (
      <main className="screen game">
        <div className="state-card">
          <p className="eyebrow">Room {roomCode}</p>
          <h1 className="display">
            Room <em>not found.</em>
          </h1>
          <p className="lede">
            This room may have expired, or the link may be wrong.
          </p>
          <a className="secondary" href="/">
            Back to start
          </a>
        </div>
      </main>
    );
  }

  if (loading || !roomData) {
    return (
      <main className="screen game">
        <div className="state-card">
          <p className="eyebrow" role="status">
            BETWEEN
          </p>
          <h1 className="display">
            Entering your
            <br />
            <em>space.</em>
          </h1>
          <div className="loading-line" />
        </div>
      </main>
    );
  }

  const myPlayerNumber = player?.role === "host" ? 1 : 2;
  const isMyTurn = roomData.current_player === myPlayerNumber;
  const otherPlayer =
    myPlayerNumber === 1 ? roomData.guest_name : roomData.host_name;

  const players = [
    { n: 1, role: "Host", name: roomData.host_name },
    { n: 2, role: "Guest", name: roomData.guest_name || "Waiting…" },
  ];

  return (
    <main className="screen game">
      <header className="topbar">
        <div className="wordmark">BETWEEN</div>

        <div className="room-tag">
          <span className="mode-name">{roomData.intensity}</span>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span>{roomCode}</span>
        </div>
      </header>

      <div className="game-layout">
        {/* GAME */}
        <section className="stage" aria-label="Game">
          <div className="players-strip">
            {players.map((p) => (
              <div
                key={p.n}
                className={`pl ${roomData.current_player === p.n ? "active" : ""}`}
              >
                <span className="pl-role">
                  {p.role}
                  {p.n === myPlayerNumber ? " · You" : ""}
                </span>
                <span className="pl-name">{p.name}</span>
              </div>
            ))}
          </div>

          <div
            className={`turn-label turn-reveal ${isMyTurn ? "mine" : ""}`}
            key={`${roomData.current_player}-${roomData.current_question_id || "choice"}`}
            role="status"
          >
            <span>
              {isMyTurn
                ? "Your turn"
                : `${otherPlayer || "Them"}'s turn`}
            </span>
          </div>

          {!question && isMyTurn && (
            <div className="card choice-card">
              <p className="eyebrow">Choose your move</p>

              <h1 className="display">
                Truth or
                <br />
                <em>dare?</em>
              </h1>

              <div className="pick-row">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => run(() => chooseQuestion("TRUTH"))}
                >
                  Truth
                  <small>Answer honestly</small>
                </button>

                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => run(() => chooseQuestion("DARE"))}
                >
                  Dare
                  <small>Do it</small>
                </button>
              </div>

              {notice && (
                <p className="notice" role="alert">
                  {notice}
                </p>
              )}
            </div>
          )}

          {!question && !isMyTurn && (
            <div className="card choice-card">
              <p className="eyebrow">Their move</p>

              <h1 className="display">
                Your turn
                <br />
                <em>comes next.</em>
              </h1>

              <p className="lede">
                {otherPlayer || "The other player"} is choosing a truth or dare.
              </p>

              <span className="waiting-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          )}

          {question && (
            <div className="card question-card question-reveal" key={question.id}>
              <div className="question-kind">{question.kind}</div>

              <p className="question-text">{question.body}</p>

              {isMyTurn && (
                <div className="question-actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => run(skipQuestion)}
                  >
                    Skip
                  </button>

                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => run(nextTurn)}
                  >
                    Done · Next turn
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}

              {isMyTurn && notice && (
                <p className="notice" role="alert">
                  {notice}
                </p>
              )}

              {!isMyTurn && (
                <p className="waiting-text">
                  Waiting for {otherPlayer || "them"}…
                </p>
              )}
            </div>
          )}
        </section>

        {/* CHAT */}
        <aside className="chat" aria-label="Chat">
          <div className="chat-head">
            <span className="chat-title">Private chat</span>
            <span className="chat-people">
              {roomData.host_name}
              {roomData.guest_name ? ` & ${roomData.guest_name}` : ""}
            </span>
          </div>

          <div className="messages" ref={messagesRef} role="log" aria-live="polite">
            {messages.length === 0 && (
              <div className="empty-chat">
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
                  <span className="message-name">
                    {mine ? "You" : message.nickname}
                  </span>

                  <div className="message-body">{message.body}</div>
                </div>
              );
            })}
          </div>

          <form className="chat-form" onSubmit={sendMessage}>
            <input
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Say something…"
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
              →
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
