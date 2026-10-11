"use client";

import { useEffect, useRef, useState } from "react";
import { Hourglass, Icon } from "../Art";
import { AI_MODELS, INTENSITIES, normalizeDeckMode, TIMER_PRESETS } from "../config";

const QUESTION_MODES = [
  { id: "both", label: "Truth & Dare" },
  { id: "truth", label: "Truth Only" },
  { id: "dare", label: "Dare Only" },
];

export function GameSettingsModal({
  open,
  onClose,
  onSave,
  canEdit = true,
  isOnline = true,
  busy = false,
  settings = {},
}) {
  const [deckMode, setDeckMode] = useState(() => normalizeDeckMode(settings.deckMode));
  const [aiModel, setAiModel] = useState(settings.aiModel || "openrouter/free");
  const [intensity, setIntensity] = useState((settings.intensity || "PLAYFUL").toUpperCase());
  const [mode, setMode] = useState(settings.mode || "both");
  const [timerSeconds, setTimerSeconds] = useState(
    typeof settings.timerSeconds === "number" ? settings.timerSeconds : 0
  );
  const [specialRounds, setSpecialRounds] = useState(Boolean(settings.specialRounds));
  const [saveError, setSaveError] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(
    (settings.intensity || "").toUpperCase() === "AFTER DARK"
  );
  const [pendingAfterDark, setPendingAfterDark] = useState(false);

  // Only sync local form state when the modal transitions from closed -> open,
  // preventing parent timer/presence re-renders from wiping out host edits.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDeckMode(normalizeDeckMode(settings.deckMode));
      setAiModel(settings.aiModel || "openrouter/free");
      const normIntensity = (settings.intensity || "PLAYFUL").toUpperCase();
      setIntensity(normIntensity);
      if (normIntensity === "AFTER DARK") {
        setAgeConfirmed(true);
      }
      setMode(settings.mode || "both");
      setTimerSeconds(typeof settings.timerSeconds === "number" ? settings.timerSeconds : 0);
      setSpecialRounds(Boolean(settings.specialRounds));
      setSaveError("");
      setPendingAfterDark(false);
    }
    wasOpenRef.current = open;
  }, [open, settings]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (pendingAfterDark) {
          setPendingAfterDark(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pendingAfterDark]);

  if (!open) return null;

  const handleSelectTheme = (themeName) => {
    if (!canEdit) return;
    if (themeName === "AFTER DARK" && !ageConfirmed) {
      setPendingAfterDark(true);
      return;
    }
    setIntensity(themeName);
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!canEdit || busy) return;
    setSaveError("");
    const res = await onSave?.({
      deckMode: normalizeDeckMode(deckMode),
      aiModel: aiModel || "openrouter/free",
      intensity,
      mode,
      timerSeconds,
      specialRounds,
    });
    if (res === false || (res && typeof res === "object" && res.ok === false)) {
      setSaveError(res?.message || "Could not save room settings. Please try again.");
      return;
    }
    onClose?.();
  };

  return (
    <div
      className="modal-backdrop settings-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <form className="modal-card settings-modal-card" onSubmit={handleApply}>
        <div className="settings-modal-head">
          <div>
            <div className="eyebrow">
              {isOnline ? "ROOM CONFIGURATION" : "OFFLINE SESSION SETTINGS"}
            </div>
            <h3 id="game-settings-title" className="modal-title">
              Deck &amp; AI Settings
            </h3>
          </div>
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {!canEdit && (
          <div className="settings-readonly-banner" role="status">
            <Icon name="lock" size={14} />
            <span>Only the host can change room settings. Viewing active room rules.</span>
          </div>
        )}

        {pendingAfterDark && (
          <div className="settings-age-confirm" role="alertdialog" aria-label="18+ Age Confirmation">
            <div className="settings-age-head">
              <Hourglass className="settings-age-icon" />
              <div>
                <strong>After Dark is strictly for adults (18+)</strong>
                <p>
                  Confirm that everyone playing in this {isOnline ? "room" : "session"} is 18 or
                  older and consents to mature adult prompts.
                </p>
              </div>
            </div>
            <div className="settings-age-actions">
              <button
                type="button"
                className="btn btn-crimson"
                onClick={() => {
                  setAgeConfirmed(true);
                  setIntensity("AFTER DARK");
                  setPendingAfterDark(false);
                }}
              >
                <span>Yes, Everyone is 18+</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingAfterDark(false)}
              >
                Keep Current Theme
              </button>
            </div>
          </div>
        )}

        <div className="settings-modal-body">
          {/* Card Source: Built-in Deck vs AI Generator */}
          <div className="settings-group">
            <span className="label">CARD SOURCE</span>
            <div className="settings-source-grid">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setDeckMode("builtin")}
                className={`settings-source-card ${deckMode === "builtin" ? "active" : ""}`}
                aria-pressed={deckMode === "builtin"}
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
                disabled={!canEdit}
                onClick={() => setDeckMode("ai")}
                className={`settings-source-card ai-variant ${deckMode === "ai" ? "active" : ""}`}
                aria-pressed={deckMode === "ai"}
              >
                <div className="settings-source-top">
                  <span className="settings-source-icon">
                    <Icon name="flame" size={16} />
                  </span>
                  <span className="settings-source-badge ai">Live AI</span>
                </div>
                <div className="settings-source-name">AI Generator</div>
                <div className="settings-source-desc">
                  Dynamic player-aware prompts tailored to your group &amp; theme.
                </div>
              </button>
            </div>
          </div>

          {/* AI Model Selector (shown when AI mode is selected) */}
          {deckMode === "ai" && (
            <div className="settings-group">
              <label className="label" htmlFor="settings-ai-model">
                AI ENGINE MODEL
              </label>
              <select
                id="settings-ai-model"
                className="settings-select"
                value={aiModel}
                disabled={!canEdit}
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

          {/* Theme / Intensity Selector */}
          <div className="settings-group">
            <span className="label">THEME</span>
            <div className="settings-theme-list">
              {INTENSITIES.map(([, name, desc, icon]) => {
                const active = intensity.toUpperCase() === name;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => handleSelectTheme(name)}
                    className={`settings-theme-chip ${active ? "active" : ""}`}
                    aria-pressed={active}
                  >
                    <span className="settings-theme-icon">
                      <Icon name={icon} size={15} />
                    </span>
                    <span className="settings-theme-text">
                      <span className="settings-theme-name">
                        {name}
                        {name === "AFTER DARK" ? " (18+)" : ""}
                      </span>
                      <span className="settings-theme-desc">{desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allowed Card Types */}
          <div className="settings-group">
            <span className="label">CARD TYPES</span>
            <div className="mode-toggle" role="group" aria-label="Allowed card types">
              {QUESTION_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!canEdit}
                  className={mode === m.id ? "active" : ""}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Challenge Timer */}
          <div className="settings-group">
            <span className="label">CHALLENGE TIMER</span>
            <div className="settings-pill-row" role="group" aria-label="Challenge timer">
              {TIMER_PRESETS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setTimerSeconds(t.value)}
                  className={`settings-pill ${timerSeconds === t.value ? "active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Special Rounds */}
          <div className="settings-group">
            <div className="settings-switch-row">
              <div>
                <span className="label" style={{ marginBottom: 4 }}>
                  SPECIAL ROUNDS
                </span>
                <p className="settings-switch-sub">
                  Inject Double Dare, Spotlight, Group Challenge &amp; Wildcard bonus turns.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={specialRounds}
                disabled={!canEdit}
                onClick={() => setSpecialRounds((v) => !v)}
                className={`settings-toggle-btn ${specialRounds ? "on" : ""}`}
              >
                <span className="settings-toggle-thumb" />
                <span className="settings-toggle-label">{specialRounds ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </div>

        {saveError && (
          <p className="form-error" role="alert" style={{ marginTop: 10 }}>
            {saveError}
          </p>
        )}

        <div className="modal-actions settings-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit && (
            <button type="submit" className="btn btn-crimson" disabled={busy}>
              <span>{busy ? "Saving…" : "Apply Settings"}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
