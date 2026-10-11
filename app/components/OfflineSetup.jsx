"use client";

import { useState } from "react";
import { BackLink, Crest, Hairline, Icon } from "../Art";
import {
  AI_MODELS,
  GENDER_OPTIONS,
  INTENSITIES,
  normalizeDeckMode,
  resolveGenderValue,
  TIMER_PRESETS,
} from "../config";
import { AgeGate } from "./Screens";

const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8];

function mapSavedGender(raw) {
  if (!raw) return { gender: "Male", customGender: "" };
  if (raw === "Man" || raw === "Male") return { gender: "Male", customGender: "" };
  if (raw === "Woman" || raw === "Female") return { gender: "Female", customGender: "" };
  if (raw === "Non-binary") return { gender: "Non-binary", customGender: "" };
  return {
    gender: "Prefer to self-describe",
    customGender: raw === "Prefer to self-describe" || raw === "Self-described" ? "" : raw,
  };
}

function createDefaultPlayer(index) {
  return {
    id: `p-${index + 1}`,
    name: "",
    gender: index % 2 === 0 ? "Male" : "Female",
    customGender: "",
  };
}

export function OfflineSetup({
  initialConfig,
  savedSession,
  onResumeSession,
  onDiscardSaved,
  onStartGame,
  onBack,
}) {
  const [playerCount, setPlayerCount] = useState(
    initialConfig?.players?.length || 2
  );
  const [players, setPlayers] = useState(() => {
    if (initialConfig?.players?.length >= 2) {
      return initialConfig.players.map((p, idx) => {
        const mapped = mapSavedGender(p.gender);
        return {
          id: p.id || `p-${idx + 1}`,
          name: p.name || "",
          gender: mapped.gender,
          customGender: mapped.customGender,
        };
      });
    }
    return [
      { id: "p-1", name: "", gender: "Male", customGender: "" },
      { id: "p-2", name: "", gender: "Female", customGender: "" },
    ];
  });

  const [deckMode, setDeckMode] = useState(() =>
    normalizeDeckMode(initialConfig?.deckMode || "ai")
  );
  const [aiModel, setAiModel] = useState(initialConfig?.aiModel || "openrouter/free");
  const [intensity, setIntensity] = useState(initialConfig?.intensity || "PLAYFUL");
  const [questionMode, setQuestionMode] = useState(initialConfig?.questionMode || "both");
  const [timerSeconds, setTimerSeconds] = useState(
    typeof initialConfig?.timerSeconds === "number" ? initialConfig.timerSeconds : 30
  );
  const [specialRounds, setSpecialRounds] = useState(
    initialConfig?.specialRounds !== undefined ? Boolean(initialConfig.specialRounds) : true
  );
  const [ageVerified, setAgeVerified] = useState(
    (initialConfig?.intensity || "").toUpperCase() === "AFTER DARK"
  );
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [error, setError] = useState("");

  const handleSelectIntensity = (themeName) => {
    if (themeName === "AFTER DARK" && !ageVerified) {
      setShowAgeGate(true);
      return;
    }
    setIntensity(themeName);
  };

  const handleCountChange = (count) => {
    setPlayerCount(count);
    setError("");
    setPlayers((prev) => {
      if (count === prev.length) return prev;
      if (count < prev.length) return prev.slice(0, count);
      const next = [...prev];
      for (let i = prev.length; i < count; i += 1) {
        next.push(createDefaultPlayer(i));
      }
      return next;
    });
  };

  const updatePlayer = (index, patch) => {
    setError("");
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, ...patch } : p))
    );
  };

  const validateAndStart = (e) => {
    e.preventDefault();
    setError("");

    const normalized = [];
    const seenNames = new Set();

    for (let i = 0; i < players.length; i += 1) {
      const p = players[i];
      const cleanName = (p.name || "").trim();
      if (!cleanName) {
        setError(`Please enter a name for Player ${i + 1}.`);
        return;
      }
      if (cleanName.length > 24) {
        setError(`Player ${i + 1}'s name must be 24 characters or fewer.`);
        return;
      }
      const lower = cleanName.toLowerCase();
      if (seenNames.has(lower)) {
        setError(`Duplicate name "${cleanName}". Give each player a distinct name.`);
        return;
      }
      seenNames.add(lower);

      const finalGender = resolveGenderValue(p.gender, p.customGender);
      if (!finalGender) {
        setError(`Please select a gender option for ${cleanName}.`);
        return;
      }

      normalized.push({
        id: p.id || `p-${i + 1}`,
        seat: i + 1,
        name: cleanName,
        gender: finalGender,
      });
    }

    onStartGame({
      players: normalized,
      deckMode: normalizeDeckMode(deckMode),
      aiModel,
      intensity,
      questionMode,
      timerSeconds,
      specialRounds,
    });
  };

  return (
    <>
      <form className="screen fade-in offline-setup-screen" onSubmit={validateAndStart} noValidate>
        <div className="topbar">
          <BackLink onClick={onBack} />
          <span className="step-tag">OFFLINE · PASS &amp; PLAY</span>
        </div>

        <div className="form-head">
          <Crest size={28} />
          <div className="eyebrow" style={{ marginTop: 14 }}>
            SINGLE PHONE · NO ROOM CODE
          </div>
          <h2 className="h-serif">Gather the Room</h2>
          <p className="sub">
            One phone for the whole group. Register everyone playing so prompts and
            dares adapt to the room.
          </p>
          <Hairline style={{ maxWidth: 160, margin: "14px auto 0" }} />
        </div>

        {savedSession && Array.isArray(savedSession.players) && savedSession.players.length >= 2 && (
          <div className="rejoin-strip offline-resume-banner" role="region" aria-label="Saved offline game">
            <div className="rejoin-head">SAVED OFFLINE GAME IN PROGRESS</div>
            <div className="rejoin-row">
              <button type="button" className="rejoin-main" onClick={onResumeSession}>
                <span className="rejoin-code">TURN {savedSession.turnNo || 1}</span>
                <span className="rejoin-meta">
                  {savedSession.players.map((p) => p.name).join(", ")} · {savedSession.intensity}
                </span>
                <span className="rejoin-cta">Resume →</span>
              </button>
              <button
                type="button"
                className="rejoin-leave"
                onClick={onDiscardSaved}
                title="Discard saved offline session"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Player Count */}
        <div className="field">
          <span className="label">01 · HOW MANY PLAYERS?</span>
          <div className="cap-picker offline-count-picker" role="group" aria-label="Number of players">
            {PLAYER_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`cap-btn ${playerCount === n ? "active" : ""}`}
                onClick={() => handleCountChange(n)}
                aria-pressed={playerCount === n}
              >
                <span className="cap-num">{n}</span>
                <span className="cap-sub">players</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Player Roster (Name + Gender) */}
        <div className="field">
          <span className="label">02 · PLAYER ROSTER &amp; GENDER</span>
          <div className="offline-roster-list">
            {players.map((p, idx) => (
              <div key={p.id || idx} className="offline-player-card">
                <div className="offline-player-header">
                  <span className="offline-seat-pill">PLAYER {String(idx + 1).padStart(2, "0")}</span>
                  <input
                    type="text"
                    className="input offline-name-input"
                    value={p.name}
                    maxLength={24}
                    placeholder={`Player ${idx + 1} name`}
                    onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                    aria-label={`Player ${idx + 1} name`}
                  />
                </div>

                <div className="offline-gender-row" role="group" aria-label={`Player ${idx + 1} gender`}>
                  {GENDER_OPTIONS.map((g) => {
                    const active = p.gender === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => updatePlayer(idx, { gender: g.id })}
                        className={`offline-gender-pill ${active ? "active" : ""}`}
                        aria-pressed={active}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>

                {p.gender === "Prefer to self-describe" && (
                  <input
                    type="text"
                    className="input offline-custom-gender"
                    value={p.customGender}
                    maxLength={24}
                    placeholder="Describe gender / pronouns (optional)"
                    onChange={(e) => updatePlayer(idx, { customGender: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 3: Card Source (AI Generator vs Built-in Deck) */}
        <div className="field">
          <span className="label">03 · CARD ENGINE</span>
          <div className="mode-picker">
            <button
              type="button"
              className={`mode-card ${deckMode === "ai" ? "active" : ""}`}
              onClick={() => setDeckMode("ai")}
              aria-pressed={deckMode === "ai"}
            >
              <div className="mode-card-top">
                <span className="mode-card-icon">
                  <Icon name="flame" size={18} />
                </span>
                <div>
                  <div className="mode-card-name">AI Generator</div>
                  <div className="mode-card-tag">Group-aware prompts</div>
                </div>
                <span className="i-radio" aria-hidden="true" />
              </div>
              <p className="mode-card-desc">
                Generates fresh Truths &amp; Dares tailored to your players, theme, and room dynamics.
              </p>
            </button>

            <button
              type="button"
              className={`mode-card ${deckMode === "builtin" ? "active" : ""}`}
              onClick={() => setDeckMode("builtin")}
              aria-pressed={deckMode === "builtin"}
            >
              <div className="mode-card-top">
                <span className="mode-card-icon">
                  <Icon name="sparkle" size={18} />
                </span>
                <div>
                  <div className="mode-card-name">Built-in Deck</div>
                  <div className="mode-card-tag">Works 100% offline</div>
                </div>
                <span className="i-radio" aria-hidden="true" />
              </div>
              <p className="mode-card-desc">
                Curated in-house deck with zero internet dependency and instant card draws.
              </p>
            </button>
          </div>

          {deckMode === "ai" && (
            <div style={{ marginTop: 12 }}>
              <label className="label" htmlFor="offline-ai-model">
                AI MODEL
              </label>
              <select
                id="offline-ai-model"
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
        </div>

        {/* Step 4: Theme Selection */}
        <div className="field">
          <span className="label">04 · CHOOSE THEME</span>
          <div className="intensity-list">
            {INTENSITIES.map(([num, name, desc, icon]) => {
              const active = intensity === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectIntensity(name)}
                  className={`intensity-row ${active ? "active" : ""}`}
                >
                  <span className="i-num">{num}</span>
                  <span className="i-icon">
                    <Icon name={icon} size={16} />
                  </span>
                  <span className="i-body">
                    <span className="i-name">
                      {name}
                      {name === "AFTER DARK" ? " (18+)" : ""}
                    </span>
                    <span className="i-desc">{desc}</span>
                  </span>
                  <span className="i-radio" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 5: Game Rules (Allowed types, Timer, Special Rounds) */}
        <div className="field">
          <span className="label">05 · GAMEPLAY OPTIONS</span>
          <div className="offline-rules-box">
            <div className="offline-rule-item">
              <span className="offline-rule-label">Allowed Prompts</span>
              <div className="mode-toggle">
                {[
                  ["both", "Truth & Dare"],
                  ["truth", "Truth Only"],
                  ["dare", "Dare Only"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={questionMode === id ? "active" : ""}
                    onClick={() => setQuestionMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="offline-rule-item">
              <span className="offline-rule-label">Challenge Timer</span>
              <div className="settings-pill-row">
                {TIMER_PRESETS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTimerSeconds(t.value)}
                    className={`settings-pill ${timerSeconds === t.value ? "active" : ""}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="offline-rule-item settings-switch-row">
              <div>
                <span className="offline-rule-label">Special Rounds</span>
                <p className="settings-switch-sub">
                  Double Dare, Spotlight, Group Challenge &amp; Wildcard bonus rounds.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={specialRounds}
                onClick={() => setSpecialRounds((v) => !v)}
                className={`settings-toggle-btn ${specialRounds ? "on" : ""}`}
              >
                <span className="settings-toggle-thumb" />
                <span className="settings-toggle-label">{specialRounds ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="err" role="alert">
            {error}
          </div>
        )}

        <div className="spacer" />
        <button type="submit" className="btn btn-crimson">
          <span>Start Offline Game</span>
          <span className="btn-arrow">→</span>
        </button>
      </form>

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
