"use client";

import { useEffect, useRef, useState } from "react";
import {
  Cards,
  Decor,
  Heart,
  Hourglass,
  Icon,
  Rose,
  Snake,
} from "../Art";
import { AI_MODELS, CONFIG, GENDER_OPTIONS, INTENSITIES, normalizeDeckMode } from "../config";

export function Logo() {
  return <div className="logo">BETWEEN</div>;
}

function titleCase(text) {
  return (text || "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
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

export function HomeScreen({
  onCreate,
  onJoin,
  onOffline,
  savedOfflineSession,
  onResumeOffline,
  rejoinList,
  rejoining,
  rejoinError,
  onRejoin,
}) {
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
            Play Online
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
            <button type="button" className="primary" onClick={onCreate}>
              <Icon name="globe" />
              Play Online
              <span aria-hidden="true">→</span>
            </button>

            <button type="button" className="secondary outline" onClick={onOffline}>
              <Icon name="offline" />
              Play Offline
            </button>

            <button type="button" className="secondary outline" onClick={onJoin}>
              Join with Code
            </button>
          </div>

          {(rejoinList.length > 0 || savedOfflineSession) && (
            <div className="rejoin" aria-label="Your active games">
              {savedOfflineSession && (
                <div className="rejoin-card" key="offline-saved">
                  <div className="rejoin-info">
                    <strong>
                      Offline Pass &amp; Play
                      <em className="mode-badge mini offline">Single Phone</em>
                    </strong>
                    <span>
                      {savedOfflineSession.players?.map((p) => p.name).join(", ")} · Turn #
                      {savedOfflineSession.turnNo || 1}
                    </span>
                  </div>
                  <button type="button" className="primary" onClick={onResumeOffline}>
                    Resume Game
                  </button>
                </div>
              )}

              {rejoinList.map((r) => (
                <div className="rejoin-card" key={r.code}>
                  <div className="rejoin-info">
                    <strong>
                      Room {r.code}
                      <em className="mode-badge mini online">Online</em>
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
            BETWEEN is a private game for the people you choose. Play online from separate devices
            with a room code, or pass a single phone around the room in offline mode.
          </p>
        </div>

        <ol className="steps" id="how">
          <li>
            <span className="step-icon">
              <Icon name="heart" />
            </span>
            <strong>Choose how to play</strong>
            <span>Open an online multiplayer room with a six-character code, or play offline on one device.</span>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="lips" />
            </span>
            <strong>Pick your theme &amp; AI</strong>
            <span>Switch between the curated deck and live AI cards tailored to your group.</span>
          </li>
          <li>
            <span className="step-icon">
              <Icon name="flame" />
            </span>
            <strong>Take turns</strong>
            <span>Truth or dare, timers, special rounds, and scores.</span>
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

/* ---------- online create / join form ----------------------------------- */

export function FormScreen({
  join,
  busy,
  error,
  name,
  setName,
  genderOption,
  setGenderOption,
  customGender,
  setCustomGender,
  room,
  setRoom,
  intensity,
  onSelectIntensity,
  capacity,
  setCapacity,
  deckMode = "builtin",
  setDeckMode,
  aiModel = "openrouter/free",
  setAiModel,
  onSwitch,
  onBack,
  onSubmit,
}) {
  const [validationError, setValidationError] = useState("");
  const normalizedDeck = normalizeDeckMode(deckMode);

  const missingName = !name.trim();
  const missingGender = !genderOption;
  const missingCode = join && room.trim().length < 4;

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (missingName) {
      setValidationError("Please enter your nickname.");
      return;
    }
    if (missingGender) {
      setValidationError("Please select your gender so prompts can adapt naturally.");
      return;
    }
    if (missingCode) {
      setValidationError("Please enter a valid room code.");
      return;
    }
    setValidationError("");
    onSubmit();
  }

const sizes = Array.from(
  { length: Math.max(0, CONFIG.maxCapacity - 1) },
  (_, i) => i + 2
);
  const displayError = error || validationError;

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
        <div className="segmented" role="tablist" aria-label="Online room action">
          <button
            type="button"
            role="tab"
            aria-selected={!join}
            className={!join ? "on" : ""}
            onClick={() => {
              setValidationError("");
              onSwitch("create");
            }}
          >
            Create Online Room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={join}
            className={join ? "on" : ""}
            onClick={() => {
              setValidationError("");
              onSwitch("join");
            }}
          >
            Join Room
          </button>
        </div>

        {/* Player Nickname */}
        <div className="field">
          <label htmlFor="player-name">Your Nickname</label>
          <div className="input-wrap">
            <Icon name="user" />
            <input
              id="player-name"
              value={name}
              onChange={(e) => {
                setValidationError("");
                setName(e.target.value);
              }}
              placeholder="e.g. Alex, Jordan, Trouble"
              maxLength={CONFIG.nicknameMax}
              autoComplete="nickname"
              autoCapitalize="words"
              enterKeyHint={join ? "next" : "go"}
            />
          </div>
        </div>

        {/* Player Gender Selection (Online Create & Join) */}
        <fieldset className="field">
          <legend>Your Gender</legend>
          <div className="online-gender-grid" role="radiogroup" aria-label="Your gender">
            {GENDER_OPTIONS.map((g) => {
              const selected = genderOption === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`online-gender-btn ${selected ? "selected" : ""}`}
                  onClick={() => {
                    setValidationError("");
                    setGenderOption?.(g.id);
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          {genderOption === "Prefer to self-describe" && (
            <div className="input-wrap" style={{ marginTop: 8 }}>
              <Icon name="sparkle" />
              <input
                id="player-custom-gender"
                value={customGender || ""}
                onChange={(e) => setCustomGender?.(e.target.value)}
                placeholder="Describe your gender or pronouns (optional)"
                maxLength={24}
                aria-label="Custom gender or pronouns"
              />
            </div>
          )}
        </fieldset>

        {join ? (
          <div className="field">
            <label htmlFor="room-code">Room Code</label>
            <div className="input-wrap">
              <Icon name="sparkle" />
              <input
                id="room-code"
                className="code-input"
                value={room}
                onChange={(e) => {
                  setValidationError("");
                  setRoom(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                }}
                placeholder="ABC123"
                maxLength={CONFIG.roomCodeLength + 2}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="go"
                aria-invalid={displayError ? "true" : undefined}
              />
            </div>
            <small className="hint">
              Coming back? Enter the same code and you&apos;ll rejoin your seat.
            </small>
          </div>
        ) : (
          <>
            {/* Card Source: Built-in Deck vs AI Generator */}
            {setDeckMode && (
              <fieldset className="field">
                <legend>Card Source</legend>
                <div className="settings-source-grid">
                  <button
                    type="button"
                    onClick={() => setDeckMode("builtin")}
                    className={`settings-source-card ${normalizedDeck === "builtin" ? "active" : ""}`}
                    aria-pressed={normalizedDeck === "builtin"}
                  >
                    <div className="settings-source-top">
                      <span className="settings-source-icon">
                        <Icon name="sparkle" size={16} />
                      </span>
                      <span className="settings-source-badge">Curated</span>
                    </div>
                    <div className="settings-source-name">Built-in Deck</div>
                    <div className="settings-source-desc">
                      Handcrafted BETWEEN prompts with instant zero-latency draws.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeckMode("ai")}
                    className={`settings-source-card ai-variant ${normalizedDeck === "ai" ? "active" : ""}`}
                    aria-pressed={normalizedDeck === "ai"}
                  >
                    <div className="settings-source-top">
                      <span className="settings-source-icon">
                        <Icon name="flame" size={16} />
                      </span>
                      <span className="settings-source-badge ai">Live AI</span>
                    </div>
                    <div className="settings-source-name">AI Generator</div>
                    <div className="settings-source-desc">
                      Dynamic player-aware prompts tailored to your room &amp; theme.
                    </div>
                  </button>
                </div>

                {normalizedDeck === "ai" && setAiModel && (
                  <div style={{ marginTop: 10 }}>
                    <label htmlFor="create-ai-model" className="sub-label">
                      AI Engine Model
                    </label>
                    <select
                      id="create-ai-model"
                      className="settings-select"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                    >
                      {AI_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>
            )}

            {/* Theme Selection */}
            <fieldset className="field intensity">
              <legend>Select Theme</legend>
              <div className="mode-grid" role="radiogroup" aria-label="Theme">
                {INTENSITIES.map(([, title, description, icon]) => (
                  <button
                    key={title}
                    type="button"
                    role="radio"
                    aria-checked={intensity === title}
                    className={`mode-card ${intensity === title ? "selected" : ""}`}
                    onClick={() => onSelectIntensity(title)}
                  >
                    <Icon name={icon} />
                    <strong>
                      {titleCase(title)}
                      {title === "AFTER DARK" ? " (18+)" : ""}
                    </strong>
                    <small>{description}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Players Capacity */}
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
                {capacity} players: you plus up to {capacity - 1} more
              </p>
            </fieldset>
          </>
        )}

        <button
          className="primary full"
          type="submit"
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
        >
          {busy
            ? join
              ? "Joining"
              : "Creating"
            : join
              ? "Join Room"
              : "Create Online Room"}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
      </form>
    </main>
  );
}
