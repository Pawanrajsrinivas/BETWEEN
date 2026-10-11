"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crest, Hairline, Icon } from "../Art";
import { normalizeDeckMode } from "../config";
import { drawBuiltInCard, getSpecialRoundForTurn } from "../lib/fallbackDeck";
import { GameSettingsModal } from "./GameSettingsModal";

export function OfflineGame({
  session,
  onUpdateSession,
  onReturnToSetup,
  onExitHome,
  notify,
}) {
  const players = session?.players || [];
  const turnNo = session?.turnNo || 1;
  const activeIndex = session?.activeIndex ?? 0;
  const currentCard = session?.currentCard || null;
  const skipsUsedThisTurn = session?.skipsUsedThisTurn || 0;
  const scores = session?.scores || {};
  const stats = session?.stats || {};
  const usedPrompts = session?.usedPrompts || [];
  const ended = Boolean(session?.ended);

  const deckMode = normalizeDeckMode(session?.deckMode || "ai");
  const aiModel = session?.aiModel || "openrouter/free";
  const intensity = session?.intensity || "PLAYFUL";
  const questionMode = session?.questionMode || "both";
  const timerSeconds = typeof session?.timerSeconds === "number" ? session.timerSeconds : 30;
  const specialRounds =
    session?.specialRounds !== undefined ? Boolean(session.specialRounds) : true;

  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fallbackNotice, setFallbackNotice] = useState("");

  // Timestamp-based challenge timer state
  const [timerDeadlineMs, setTimerDeadlineMs] = useState(session?.timerDeadlineMs || null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const busyRef = useRef(false);

  const activePlayer = players[activeIndex] || players[0] || { id: "p-1", name: "Player 1", seat: 1 };

  const targetPlayer = useMemo(() => {
    if (players.length < 2) return null;
    const others = players.filter((_, idx) => idx !== activeIndex);
    if (!others.length) return null;
    return others[(turnNo - 1) % others.length];
  }, [players, activeIndex, turnNo]);

  const specialRound = useMemo(() => {
    const base = getSpecialRoundForTurn(turnNo, specialRounds);
    if (base.id === "quick_round" && timerSeconds === 0) {
      return { ...base, forcedTimer: 20 };
    }
    return base;
  }, [turnNo, specialRounds, timerSeconds]);

  const effectiveTimerSeconds = useMemo(() => {
    if (specialRound.id === "quick_round") {
      return timerSeconds > 0 ? Math.min(timerSeconds, 20) : 20;
    }
    return timerSeconds;
  }, [specialRound.id, timerSeconds]);

  // Keep timer ticking smoothly while active
  useEffect(() => {
    if (!currentCard || effectiveTimerSeconds <= 0 || pausedRemainingMs !== null) return undefined;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => clearInterval(interval);
  }, [currentCard, effectiveTimerSeconds, pausedRemainingMs]);

  const remainingSeconds = useMemo(() => {
    if (!currentCard || effectiveTimerSeconds <= 0) return null;
    if (pausedRemainingMs !== null) {
      return Math.max(0, Math.ceil(pausedRemainingMs / 1000));
    }
    if (!timerDeadlineMs) return effectiveTimerSeconds;
    return Math.max(0, Math.ceil((timerDeadlineMs - nowMs) / 1000));
  }, [currentCard, effectiveTimerSeconds, pausedRemainingMs, timerDeadlineMs, nowMs]);

  const isTimerExpired = remainingSeconds !== null && remainingSeconds <= 0;

  const togglePauseTimer = () => {
    if (!currentCard || effectiveTimerSeconds <= 0) return;
    if (pausedRemainingMs !== null) {
      const nextDeadline = Date.now() + pausedRemainingMs;
      setPausedRemainingMs(null);
      setTimerDeadlineMs(nextDeadline);
      setNowMs(Date.now());
      onUpdateSession((prev) => ({ ...prev, timerDeadlineMs: nextDeadline }));
    } else if (timerDeadlineMs) {
      const rem = Math.max(0, timerDeadlineMs - Date.now());
      setPausedRemainingMs(rem);
    }
  };

  const resetTimer = () => {
    if (!currentCard || effectiveTimerSeconds <= 0) return;
    const nextDeadline = Date.now() + effectiveTimerSeconds * 1000;
    setPausedRemainingMs(null);
    setTimerDeadlineMs(nextDeadline);
    setNowMs(Date.now());
    onUpdateSession((prev) => ({ ...prev, timerDeadlineMs: nextDeadline }));
  };

  const drawOfflineCard = useCallback(
    async (kind, isSkip = false) => {
      if (busyRef.current) return;
      if (isSkip && skipsUsedThisTurn >= 1) {
        setErrorMsg("Only one skip is allowed per turn.");
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setErrorMsg("");
      setFallbackNotice("");

      const chosenKind =
        kind ||
        currentCard?.kind ||
        (questionMode === "dare" ? "dare" : "truth");

      try {
        let drawnCard = null;
        let usedFallback = false;

        if (deckMode === "ai") {
          try {
            const res = await fetch("/api/generate-card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: chosenKind,
                theme: intensity,
                mode: "offline",
                selectedModel: aiModel,
                players,
                currentPlayer: activePlayer,
                targetPlayer,
                roundType: specialRound.id,
                excludePrompts: usedPrompts.slice(-15),
                allowFallback: true,
              }),
            });
            const data = await res.json();
            if (res.ok && data?.success && data?.card) {
              drawnCard = data.card;
              usedFallback = Boolean(data.fallback);
            }
          } catch (networkErr) {
            console.warn("Offline AI call failed, using local deck fallback:", networkErr);
            usedFallback = true;
          }
        }

        if (!drawnCard) {
          drawnCard = drawBuiltInCard({
            type: chosenKind,
            theme: intensity,
            mode: "offline",
            players,
            currentPlayer: activePlayer,
            targetPlayer,
            roundType: specialRound.id,
            excludePrompts: usedPrompts.slice(-20),
          });
          if (deckMode === "ai") {
            drawnCard = {
              ...drawnCard,
              source: "fallback",
              category:
                specialRound.id !== "standard" ? specialRound.label : "Built-in Fallback",
            };
            usedFallback = true;
          }
        }

        if (deckMode === "ai" && usedFallback) {
          const msg = "AI providers were unavailable — drew a built-in fallback card for this turn.";
          setFallbackNotice(msg);
          notify?.("info", msg);
        }

        const deadline =
          effectiveTimerSeconds > 0 ? Date.now() + effectiveTimerSeconds * 1000 : null;
        setPausedRemainingMs(null);
        setTimerDeadlineMs(deadline);
        setNowMs(Date.now());

        const nextSkips = isSkip ? skipsUsedThisTurn + 1 : skipsUsedThisTurn;
        const playerId = activePlayer.id;
        const prevPlayerStats = stats[playerId] || { truths: 0, dares: 0, skips: 0 };
        const nextStats = isSkip
          ? {
              ...stats,
              [playerId]: {
                ...prevPlayerStats,
                skips: (prevPlayerStats.skips || 0) + 1,
              },
            }
          : stats;

        onUpdateSession((prev) => ({
          ...prev,
          currentCard: drawnCard,
          skipsUsedThisTurn: nextSkips,
          timerDeadlineMs: deadline,
          stats: nextStats,
          usedPrompts: drawnCard.prompt
            ? [...(prev.usedPrompts || []).slice(-35), drawnCard.prompt]
            : prev.usedPrompts || [],
        }));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [
      skipsUsedThisTurn,
      currentCard,
      questionMode,
      deckMode,
      intensity,
      aiModel,
      players,
      activePlayer,
      targetPlayer,
      specialRound.id,
      specialRound.label,
      usedPrompts,
      effectiveTimerSeconds,
      stats,
      onUpdateSession,
      notify,
    ]
  );

  const advanceTurn = useCallback(
    (awardedPoints = 0) => {
      if (busyRef.current) return;
      const playerId = activePlayer.id;
      const cardKind = currentCard?.kind || currentCard?.type || "truth";
      const prevScore = Number(scores[playerId]) || 0;
      const nextScores = {
        ...scores,
        [playerId]: prevScore + awardedPoints,
      };

      const prevPlayerStats = stats[playerId] || { truths: 0, dares: 0, skips: 0 };
      const nextStats = {
        ...stats,
        [playerId]: {
          truths: prevPlayerStats.truths + (awardedPoints > 0 && cardKind === "truth" ? 1 : 0),
          dares: prevPlayerStats.dares + (awardedPoints > 0 && cardKind === "dare" ? 1 : 0),
          skips: prevPlayerStats.skips || 0,
        },
      };

      const nextIndex = players.length > 0 ? (activeIndex + 1) % players.length : 0;
      setPausedRemainingMs(null);
      setTimerDeadlineMs(null);
      setErrorMsg("");
      setFallbackNotice("");

      onUpdateSession((prev) => ({
        ...prev,
        turnNo: (prev.turnNo || 1) + 1,
        activeIndex: nextIndex,
        currentCard: null,
        skipsUsedThisTurn: 0,
        timerDeadlineMs: null,
        scores: nextScores,
        stats: nextStats,
      }));
    },
    [activePlayer.id, currentCard, scores, stats, players.length, activeIndex, onUpdateSession]
  );

  const handleCompleteChallenge = () => {
    const kind = currentCard?.kind || currentCard?.type || "truth";
    const basePts = kind === "dare" ? 2 : 1;
    const bonus = Number(currentCard?.bonusPoints || specialRound?.bonusPoints || 0);
    advanceTurn(basePts + bonus);
  };

  const handleApplySettings = (next) => {
    onUpdateSession((prev) => ({
      ...prev,
      deckMode: normalizeDeckMode(next.deckMode),
      aiModel: next.aiModel,
      intensity: next.intensity,
      questionMode: next.mode,
      timerSeconds: next.timerSeconds,
      specialRounds: next.specialRounds,
    }));
    notify?.("info", "Updated offline game settings.");
    return { ok: true };
  };

  const handleRestartSamePlayers = () => {
    setPausedRemainingMs(null);
    setTimerDeadlineMs(null);
    setFallbackNotice("");
    onUpdateSession((prev) => ({
      ...prev,
      turnNo: 1,
      activeIndex: 0,
      currentCard: null,
      skipsUsedThisTurn: 0,
      timerDeadlineMs: null,
      scores: {},
      stats: {},
      ended: false,
    }));
  };

  // Compute Leaderboard & Highlights
  const leaderboard = useMemo(() => {
    return players
      .map((p) => {
        const st = stats[p.id] || { truths: 0, dares: 0, skips: 0 };
        return {
          ...p,
          score: Number(scores[p.id]) || 0,
          truths: st.truths || 0,
          dares: st.dares || 0,
          skips: st.skips || 0,
        };
      })
      .sort((a, b) => b.score - a.score || b.dares - a.dares || a.seat - b.seat);
  }, [players, scores, stats]);

  if (ended) {
    const winner = leaderboard[0] || activePlayer;
    const mostDares = [...leaderboard].sort((a, b) => b.dares - a.dares)[0];
    const mostTruths = [...leaderboard].sort((a, b) => b.truths - a.truths)[0];

    return (
      <div className="screen fade-in offline-summary-screen">
        <div className="topbar">
          <span className="step-tag">OFFLINE · FINAL SUMMARY</span>
          <span className="step-tag">{turnNo - 1} TURNS PLAYED</span>
        </div>

        <div className="form-head">
          <Crest size={34} />
          <div className="eyebrow" style={{ marginTop: 14 }}>
            THE NIGHT CONCLUDES
          </div>
          <h2 className="h-serif">Session Highlights</h2>
          <p className="sub">
            {winner.score > 0
              ? `${winner.name} leads the room with ${winner.score} points.`
              : "Every secret shared stays between the room."}
          </p>
          <Hairline style={{ maxWidth: 160, margin: "14px auto 0" }} />
        </div>

        <div className="summary-highlights-grid">
          <div className="summary-highlight-card">
            <span className="eyebrow">CROWN HOLDER</span>
            <div className="summary-highlight-name">{winner?.name}</div>
            <div className="summary-highlight-stat">{winner?.score || 0} pts</div>
          </div>
          <div className="summary-highlight-card">
            <span className="eyebrow">FEARLESS DARES</span>
            <div className="summary-highlight-name">{mostDares?.name}</div>
            <div className="summary-highlight-stat">{mostDares?.dares || 0} dares</div>
          </div>
          <div className="summary-highlight-card">
            <span className="eyebrow">DEEPEST TRUTHS</span>
            <div className="summary-highlight-name">{mostTruths?.name}</div>
            <div className="summary-highlight-stat">{mostTruths?.truths || 0} truths</div>
          </div>
        </div>

        <div className="field">
          <span className="label">FINAL STANDINGS</span>
          <div className="scoreboard-list">
            {leaderboard.map((p, idx) => (
              <div key={p.id} className={`scoreboard-row ${idx === 0 ? "leader" : ""}`}>
                <span className="scoreboard-rank">#{idx + 1}</span>
                <div className="scoreboard-info">
                  <span className="scoreboard-name">{p.name}</span>
                  <span className="scoreboard-meta">
                    {p.truths}T · {p.dares}D · {p.skips} Skips
                  </span>
                </div>
                <span className="scoreboard-pts">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        <div className="spacer" />
        <div className="summary-actions">
          <button type="button" className="btn btn-crimson" onClick={handleRestartSamePlayers}>
            <span>Play Again · Same Players</span>
            <span className="btn-arrow">→</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={onReturnToSetup}>
            Edit Players &amp; Setup
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExitHome}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const cardKind = currentCard?.kind || currentCard?.type || "truth";
  const basePoints = cardKind === "dare" ? 2 : 1;
  const bonusPoints = Number(currentCard?.bonusPoints || specialRound?.bonusPoints || 0);
  const totalCardPoints = basePoints + bonusPoints;

  return (
    <div className="screen game-screen fade-in offline-game-screen">
      {/* Top Bar: Pass & Play status + Settings + End */}
      <div className="game-top">
        <div className="offline-mode-pill" title="Single-phone offline pass & play">
          <Icon name="offline" size={13} />
          <span>PASS &amp; PLAY</span>
        </div>

        <div className="turn-pill">
          <span className="turn-dot" />
          <span>
            {activePlayer.name.toUpperCase()}&apos;S TURN · #{turnNo}
          </span>
        </div>

        <div className="game-top-right">
          <button
            type="button"
            className="settings-trigger-btn"
            onClick={() => setSettingsOpen(true)}
            title="Deck & AI Settings"
          >
            <Icon name={deckMode === "ai" ? "flame" : "sparkle"} size={13} />
            <span>{deckMode === "ai" ? "AI Mode" : "Deck"}</span>
          </button>
          <button
            type="button"
            className="leave-mini"
            onClick={() => onUpdateSession((prev) => ({ ...prev, ended: true }))}
            title="Finish game and view summary"
          >
            End
          </button>
        </div>
      </div>

      {/* Active Rules & Scoreboard Toggle Strip */}
      <div className="game-subbar">
        <div className="game-subbar-tags">
          <span className="meta-pill">{intensity}</span>
          <span className="meta-pill">
            {deckMode === "ai" ? "AI Generator" : "Built-in Deck"}
          </span>
          {effectiveTimerSeconds > 0 && (
            <span className="meta-pill">{effectiveTimerSeconds}s Timer</span>
          )}
        </div>
        <button
          type="button"
          className="scoreboard-toggle-btn"
          onClick={() => setScoreboardOpen((v) => !v)}
          aria-expanded={scoreboardOpen}
        >
          <span>Scores ({Number(scores[activePlayer.id]) || 0} pts)</span>
          <span>{scoreboardOpen ? "▴" : "▾"}</span>
        </button>
      </div>

      {scoreboardOpen && (
        <div className="scoreboard-drawer fade-in">
          <div className="scoreboard-drawer-head">
            <span className="eyebrow">ROOM SCOREBOARD</span>
            <button
              type="button"
              className="link-btn"
              onClick={onReturnToSetup}
            >
              Edit Players
            </button>
          </div>
          <div className="scoreboard-mini-list">
            {leaderboard.map((p, idx) => (
              <div
                key={p.id}
                className={`scoreboard-mini-item ${p.id === activePlayer.id ? "current" : ""}`}
              >
                <span className="scoreboard-mini-rank">#{idx + 1}</span>
                <span className="scoreboard-mini-name">{p.name}</span>
                <span className="scoreboard-mini-gender">{p.gender}</span>
                <span className="scoreboard-mini-score">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Special Round Banner */}
      {specialRound.id !== "standard" && (
        <div className={`special-round-banner round-${specialRound.id}`}>
          <div className="special-round-badge">
            <Icon name="flame" size={14} />
            <span>{specialRound.badge}</span>
          </div>
          <div className="special-round-text">
            <strong>{specialRound.label}:</strong> {specialRound.description}
          </div>
        </div>
      )}

      {fallbackNotice && (
        <p className="notice" role="status" style={{ marginBottom: 10 }}>
          {fallbackNotice}
        </p>
      )}

      {errorMsg && (
        <div className="err" role="alert" style={{ marginBottom: 10 }}>
          {errorMsg}
        </div>
      )}

      {/* Main Card Stage */}
      <div className="stage">
        {!currentCard ? (
          <div className="card-prompt">
            <Crest size={34} />
            <div className="eyebrow" style={{ marginTop: 14 }}>
              PASS THE PHONE TO {activePlayer.name.toUpperCase()}
            </div>
            <h2 className="h-serif" style={{ fontSize: 32, marginTop: 6 }}>
              Truth or Dare?
            </h2>
            <p className="sub" style={{ maxWidth: 280 }}>
              {deckMode === "ai"
                ? `AI will craft a ${intensity.toLowerCase()} prompt for ${activePlayer.name}${
                    targetPlayer ? ` & ${targetPlayer.name}` : ""
                  }.`
                : `Pick a card from the ${intensity.toLowerCase()} deck.`}
            </p>
            <Hairline style={{ maxWidth: 160, margin: "18px auto" }} />

            <div className="choice-row">
              {(questionMode === "both" || questionMode === "truth") && (
                <button
                  type="button"
                  className="choice-card truth"
                  disabled={busy}
                  onClick={() => drawOfflineCard("truth", false)}
                >
                  <span className="choice-num">I</span>
                  <span className="choice-title">TRUTH</span>
                  <span className="choice-sub">
                    {busy ? "Generating…" : "Confess honestly (+1 pt)"}
                  </span>
                </button>
              )}
              {(questionMode === "both" || questionMode === "dare") && (
                <button
                  type="button"
                  className="choice-card dare"
                  disabled={busy}
                  onClick={() => drawOfflineCard("dare", false)}
                >
                  <span className="choice-num">II</span>
                  <span className="choice-title">DARE</span>
                  <span className="choice-sub">
                    {busy ? "Generating…" : "Do it right now (+2 pts)"}
                  </span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={`q-card ${cardKind} fade-in`} key={currentCard.id || turnNo}>
            <div className="q-card-frame" aria-hidden="true" />
            <div className="q-top">
              <span className={`q-tag ${cardKind}`}>{cardKind.toUpperCase()}</span>
              <span className="q-cat">
                {currentCard.category ||
                  (currentCard.source === "ai"
                    ? "AI Generated"
                    : currentCard.source === "fallback"
                      ? "Built-in Fallback"
                      : "Curated Deck")}
              </span>
              <span className="q-num">+{totalCardPoints} PT</span>
            </div>

            {currentCard.targetPlayerName && (
              <div className="q-target-pill">
                <span>For {activePlayer.name}</span>
                <span>↔</span>
                <span>{currentCard.targetPlayerName}</span>
              </div>
            )}

            <div className="q-body-wrap">
              <span className="q-quote-mark open" aria-hidden="true">
                &ldquo;
              </span>
              <p className="q-body">{currentCard.prompt || currentCard.body}</p>
              <span className="q-quote-mark close" aria-hidden="true">
                &rdquo;
              </span>
            </div>

            {/* Challenge Timer Bar */}
            {effectiveTimerSeconds > 0 && remainingSeconds !== null && (
              <div className={`challenge-timer-box ${isTimerExpired ? "expired" : ""}`}>
                <div className="challenge-timer-top">
                  <span className="challenge-timer-label">
                    {isTimerExpired
                      ? "TIME'S UP!"
                      : pausedRemainingMs !== null
                        ? "TIMER PAUSED"
                        : "CHALLENGE TIMER"}
                  </span>
                  <span className="challenge-timer-value">{remainingSeconds}s</span>
                </div>
                <div className="challenge-timer-track">
                  <div
                    className="challenge-timer-fill"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (remainingSeconds / effectiveTimerSeconds) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <div className="challenge-timer-controls">
                  <button
                    type="button"
                    className="timer-mini-btn"
                    onClick={togglePauseTimer}
                  >
                    {pausedRemainingMs !== null ? "Resume" : "Pause"}
                  </button>
                  <button type="button" className="timer-mini-btn" onClick={resetTimer}>
                    Reset
                  </button>
                </div>
              </div>
            )}

            <div className="q-foot">
              <Hairline />
              <div className="q-meta">
                <span>FOR {activePlayer.name.toUpperCase()}</span>
                <span className="dot">·</span>
                <span>{intensity}</span>
                {currentCard.source === "ai" && (
                  <>
                    <span className="dot">·</span>
                    <span>AI</span>
                  </>
                )}
                {currentCard.source === "fallback" && (
                  <>
                    <span className="dot">·</span>
                    <span>FALLBACK DECK</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Turn Controls */}
      {currentCard && (
        <div className="game-actions offline-game-actions">
          <div className="game-actions-row">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || skipsUsedThisTurn >= 1}
              onClick={() => drawOfflineCard(cardKind, true)}
              title={
                skipsUsedThisTurn >= 1
                  ? "Only one skip per turn"
                  : "Skip and draw a replacement card"
              }
            >
              {busy
                ? "Drawing…"
                : skipsUsedThisTurn >= 1
                  ? "Skip Used"
                  : "Skip Card (1 left)"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => advanceTurn(0)}
            >
              Pass (0 pts)
            </button>
          </div>

          <button
            type="button"
            className="btn btn-crimson"
            disabled={busy}
            onClick={handleCompleteChallenge}
          >
            <span>Completed (+{totalCardPoints} pts) · Next Player</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      )}

      <GameSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleApplySettings}
        canEdit={true}
        isOnline={false}
        busy={busy}
        settings={{
          deckMode,
          aiModel,
          intensity,
          mode: questionMode,
          timerSeconds,
          specialRounds,
        }}
      />
    </div>
  );
}
