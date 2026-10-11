"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cards,
  Decor,
  Heart,
  Hourglass,
  Icon,
  OfflineArt,
  OnlineArt,
  Rose,
  Snake,
} from "../Art";
import { CONFIG, GAME_MODES, INTENSITIES } from "../config";

export function Logo() {
  return <div className="logo">BETWEEN</div>;
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/* ---------- small states ------------------------------------------------ */

export function LoadingCard({ label = "Loading room", variant = "lobby" }) {
  return (
    <main className="screen">
      <Decor variant={variant} />
      <div className="state-card">
        <Hourglass className="state-hourglass" />
        <p className="eyebrow" role="status">
          {label}
        </p>
      </div>
    </main>
  );
}

export function StateCard({ eyebrow, title, em, children, actions, variant = "lobby" }) {
  return (
    <main className="screen">
      <Decor variant={variant} />
      <div className="state-card">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="display">
          {title} {em && <em>{em}</em>}
        </h1>
        {children && <p className="lede">{children}</p>}
        {actions && <div className="state-actions">{actions}</div>}
      </div>
    </main>
  );
}

export function SetupNotice({ message }) {
  return (
    <StateCard eyebrow="Setup needed" title="Almost" em="there.">
      {message}
    </StateCard>
  );
}

/* ---------- age gate ---------------------------------------------------- */

export function AgeGate({ onConfirm, onDecline }) {
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
      <div className="age-card" role="dialog" aria-modal="true" aria-labelledby="age-title">
        <Hourglass className="age-hourglass" />
        <h2 className="display" id="age-title">
          Are you 18
          <br />
          or older?
        </h2>
        <p className="lede">This is a private and mature experience meant only for adults.</p>
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

/* ---------- home -------------------------------------------------------- */

export function HomeScreen({ onCreate, onJoin, rejoinList, rejoining, rejoinError, onRejoin }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="screen home">
      <Decor variant="home" />

      <header className="topbar">
        <Logo />

        <nav className={`nav-links ${menuOpen ? "open" : ""}`} aria-label="Main">
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
            Your people.
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

          {rejoinList.length > 0 && (
            <div className="rejoin" aria-label="Your rooms">
              {rejoinList.map((r) => (
                <div className="rejoin-card" key={r.code}>
                  <div className="rejoin-info">
                    <strong>
                      Room {r.code}
                      <em className={`mode-badge mini ${r.mode === "OFFLINE" ? "offline" : "online"}`}>
                        {r.mode === "OFFLINE" ? "Offline" : "Online"}
                      </em>
                    </strong>
                    <span>
                      You&apos;re in this room as {r.nickname}
                      {r.status === "playing" ? " · game in progress" : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="primary"
                    disabled={Boolean(rejoining)}
                    aria-busy={rejoining === r.code ? "true" : undefined}
                    onClick={() => onRejoin(r.code, r.nickname)}
                  >
                    {rejoining === r.code ? "Rejoining" : "Rejoin Room"}
                  </button>
                </div>
              ))}
              {rejoinError && (
                <p className="form-error" role="alert">
                  {rejoinError}
                </p>
              )}
            </div>
          )}
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
            Just your people.
          </h2>
          <p className="lede">
            BETWEEN is a private game for the people you choose. Rooms hold anywhere from one to
            eight players, questions match the energy you choose, and your chat stays in the room.
          </p>
        </div>

        <ol className="steps" id="how">
          <li>
            <span className="step-icon">
              <Icon name="heart" />
            </span>
            <strong>Create a room</strong>
            <span>Pick online or offline, your energy, and a six-character code.</span>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="lips" />
            </span>
            <strong>Share the code</strong>
            <span>Your people join. No one else can.</span>
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
        <span>Just Your People</span>
      </footer>
    </main>
  );
}

/* ---------- create / join form ------------------------------------------ */

export function FormScreen({
  join,
  busy,
  error,
  name,
  setName,
  room,
  setRoom,
  gameMode,
  setGameMode,
  intensity,
  onSelectIntensity,
  capacity,
  setCapacity,
  onSwitch,
  onBack,
  onSubmit,
}) {
  const needsMode = !join && !gameMode;
  const disabled = !name.trim() || (join && room.trim().length < 4) || needsMode || busy;

  function handleSubmit(e) {
    e.preventDefault();
    if (!disabled) onSubmit();
  }

  const sizes = Array.from({ length: CONFIG.maxCapacity }, (_, i) => i + 1);

  return (
    <main className="screen form-screen">
      <Decor variant="form" chain />

      <header className="topbar">
        <button className="icon-btn" onClick={onBack} type="button" aria-label="Back to home">
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
              maxLength={CONFIG.nicknameMax}
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
                onChange={(e) => setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="ABC123"
                maxLength={CONFIG.roomCodeLength + 2}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={error ? "true" : undefined}
              />
            </div>
            <small className="hint">Coming back? Use the same code and you&apos;ll rejoin your seat.</small>
          </div>
        ) : (
          <>
            <fieldset className="field">
              <legend>Where are you playing?</legend>
              <div className="mode-pick" role="radiogroup" aria-label="Game mode">
                {Object.entries(GAME_MODES).map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={gameMode === key}
                    className={`mode-option ${gameMode === key ? "selected" : ""}`}
                    onClick={() => setGameMode(key)}
                  >
                    {key === "ONLINE" ? <OnlineArt /> : <OfflineArt />}
                    <strong>{info.label}</strong>
                    <em>{info.tagline}</em>
                    <small>{info.description}</small>
                  </button>
                ))}
              </div>
              {needsMode && <small className="hint">Choose one to continue.</small>}
            </fieldset>

            <fieldset className="field intensity">
              <legend>Select Intensity</legend>
              <div className="mode-grid" role="radiogroup" aria-label="Intensity">
                {INTENSITIES.map(([num, title, description, icon]) => (
                  <button
                    key={title}
                    type="button"
                    role="radio"
                    aria-checked={intensity === title}
                    className={`mode-card ${intensity === title ? "selected" : ""}`}
                    onClick={() => onSelectIntensity(title)}
                  >
                    <Icon name={icon} />
                    <strong>{titleCase(title)}</strong>
                    <small>{description}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="field">
              <legend>Players</legend>
              <div className="size-grid" role="radiogroup" aria-label="Number of players">
                {sizes.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={capacity === n}
                    aria-label={`${n} ${n === 1 ? "player" : "players"}`}
                    className={`size-btn ${capacity === n ? "selected" : ""}`}
                    onClick={() => setCapacity(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="size-note" role="status">
                <Icon name="users" />
                {capacity === 1
                  ? "Solo room: just you"
                  : `${capacity} players: you plus up to ${capacity - 1} more`}
              </p>
            </fieldset>
          </>
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
