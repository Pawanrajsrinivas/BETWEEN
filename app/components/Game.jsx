"use client";

import { useEffect, useMemo, useState } from "react";
import { Chain, Decor, Hourglass, Icon, LipsArt } from "../Art";
import { Chat } from "./Chat";
import { GameSettingsModal } from "./GameSettingsModal";
import { HostTools } from "./HostTools";
import { Avatar, ConnectionBadge, ModeBadge } from "./PlayerBits";
import { RoomDialogs } from "./RoomDialogs";
import { INTENSITIES, normalizeDeckMode } from "../config";

function Logo() {
  return <div className="logo">BETWEEN</div>;
}

function titleCase(text) {
  return (text || "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function Game({
  room,
  me,
  members,
  statuses,
  removedList,
  isHost,
  currentMember,
  conn,
  busy,
  actionError,
  clearActionError,
  actions,
  onLeave,
  chat,
}) {
  const [confirm, setConfirm] = useState(null);
  const [hostOpen, setHostOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [standingsOpen, setStandingsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const question = room.current_question;
  const solo = members.length <= 1;
  const isMyTurn = me.seat === room.current_player;
  const currentName = currentMember?.nickname || "Someone";
  const currentStatus = currentMember ? statuses[currentMember.id] : "offline";
  const away =
    !isMyTurn && currentMember && currentStatus !== "online" && currentStatus !== "checking";
  const gone = !isMyTurn && (!currentMember || currentStatus === "offline");

  const isAiMode = normalizeDeckMode(room.deck_mode) === "ai";
  const specialRound = room.special_round || { id: "standard", label: "Standard", bonusPoints: 0 };
  const timerSeconds = room.timer_seconds || 0;
  const timerDeadlineMs = room.timer_deadline_ms || null;
  const scores = room.scores || {};
  const skipsUsed = room.skips_used_this_turn || 0;

  useEffect(() => {
    if (!question || !timerDeadlineMs || timerSeconds <= 0) return undefined;
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [question, timerDeadlineMs, timerSeconds]);

  const remainingSeconds = useMemo(() => {
    if (!question || !timerDeadlineMs || timerSeconds <= 0) return null;
    return Math.max(0, Math.ceil((timerDeadlineMs - nowMs) / 1000));
  }, [question, timerDeadlineMs, timerSeconds, nowMs]);

  const isTimerExpired = remainingSeconds !== null && remainingSeconds <= 0;

  // Turn order mirrors the server: by seat, skipping people who are away.
  const ordered = [...members].sort((a, b) => a.seat - b.seat);
  const eligible = ordered.filter(
    (m) => statuses[m.id] !== "offline" || m.seat === room.current_player
  );
  const afterCurrent = eligible.filter((m) => m.seat > room.current_player);
  const nextMember = !solo ? afterCurrent[0] || eligible[0] : null;

  const qKindUpper = (question?.kind || question?.type || "TRUTH").toUpperCase();
  const basePts = qKindUpper === "DARE" ? 2 : 1;
  const bonusPts = Number(question?.bonusPoints || specialRound?.bonusPoints || 0);
  const totalTurnPts = basePts + bonusPts;

  let turnTitle = isMyTurn ? "Your Turn" : `${currentName}'s Turn`;
  let turnSub;
  if (isMyTurn) {
    turnSub = question
      ? "Complete the challenge for points, or pass the turn"
      : isAiMode
        ? "Choose truth or dare — AI will generate a card for the room"
        : "Choose truth or dare";
  } else if (away) {
    turnSub = gone
      ? `${currentName} has been away for a while`
      : `Waiting for ${currentName} to reconnect…`;
  } else {
    turnSub = question
      ? `${currentName} drew a ${qKindUpper.toLowerCase()}`
      : `${currentName} is choosing truth or dare`;
  }

  const canPick = isMyTurn && !question;
  const intensityLabel = titleCase(room.intensity || "PLAYFUL");
  const intensityIcon =
    INTENSITIES.find((i) => i[1] === (room.intensity || "").toUpperCase())?.[3] || "sparkle";

  const leaderboard = useMemo(() => {
    return ordered
      .map((m) => ({
        ...m,
        score: Number(scores[String(m.seat)]) || 0,
      }))
      .sort((a, b) => b.score - a.score || a.seat - b.seat);
  }, [ordered, scores]);

  const allowTruth = room.question_mode !== "dare";
  const allowDare = room.question_mode !== "truth";

  return (
    <main className="screen game">
      <Decor variant="game" />

      <header className="topbar">
        <Logo />

        <div className="room-tag">
          <ModeBadge mode="ONLINE" />
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span className="mode-name">{intensityLabel}</span>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span className="mode-name">{isAiMode ? "AI Deck" : "Room Deck"}</span>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span>{room.code}</span>
        </div>

        <div className="topbar-right">
          <ConnectionBadge conn={conn} />
          <button
            type="button"
            className={`leave-btn ai-toggle-btn ${isAiMode ? "active" : ""}`}
            onClick={() => setSettingsOpen(true)}
            title={isHost ? "Configure Deck, AI Model, Timer & Special Rounds" : "View Room Rules"}
          >
            <Icon name={isAiMode ? "flame" : "sparkle"} />
            <span>{isAiMode ? "AI Mode" : "Deck Settings"}</span>
          </button>
          <button
            type="button"
            className="leave-btn"
            onClick={() => setStandingsOpen(true)}
            title="View Room Standings"
          >
            <Icon name="crown" />
            <span>Scores</span>
          </button>
          {isHost && (
            <button
              type="button"
              className="leave-btn host-btn"
              aria-haspopup="dialog"
              onClick={() => setHostOpen(true)}
            >
              <Icon name="shield" />
              <span>Host</span>
            </button>
          )}
          <button type="button" className="leave-btn" onClick={() => setConfirm({ type: "leave" })}>
            <Icon name="leave" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      <div className="game-layout">
        <section className="stage" aria-label="Game">
          <LipsArt className="stage-lips" />
          <Chain className="stage-chain" />

          <div
            className="turn-head turn-reveal"
            key={`${room.turn_no}-${question?.id || "choice"}`}
            role="status"
          >
            {isMyTurn && (
              <span className="turn-crown">
                <Icon name="crown" />
                Your Turn · Turn #{room.turn_no}
              </span>
            )}
            {!isMyTurn && <span className="turn-crown">Turn #{room.turn_no}</span>}
            <h1 className="display">{turnTitle}</h1>
            <p>{turnSub}</p>
          </div>

          {!solo && (
            <ol className="turn-order" aria-label="Turn order">
              {ordered.map((m) => {
                const current = m.seat === room.current_player;
                const isNext = nextMember && m.id === nextMember.id && !current;
                const memberScore = Number(scores[String(m.seat)]) || 0;
                return (
                  <li
                    key={m.id}
                    className={`turn-chip ${current ? "current" : ""} ${
                      statuses[m.id] === "offline" ? "away" : ""
                    }`}
                    aria-current={current ? "step" : undefined}
                  >
                    <Avatar status={statuses[m.id] || "checking"} className="small" />
                    <span className="turn-chip-name">
                      {m.nickname}
                      {m.id === me.member_id ? " (you)" : ""}
                    </span>
                    {current && <span className="turn-chip-tag">Now</span>}
                    {isNext && <span className="turn-chip-tag soft">Next</span>}
                  </li>
                );
              })}
            </ol>
          )}

          {/* Special Round Banner */}
          {specialRound.id !== "standard" && (
            <div className={`special-round-banner round-${specialRound.id}`} role="status">
              <div className="special-round-badge">
                <Icon name="flame" size={14} />
                <span>{specialRound.badge}</span>
              </div>
              <div className="special-round-text">
                <strong>{specialRound.label}:</strong> {specialRound.description}
              </div>
            </div>
          )}

          {/* Active Card Source Indicator & Host Settings Shortcut */}
          <div className="stage-source-bar">
            <div className="stage-source-info">
              <Icon name={isAiMode ? "flame" : "dice"} />
              <span>
                {isAiMode
                  ? `AI Generator Active · ${intensityLabel}`
                  : `Built-in Room Deck · ${intensityLabel}`}
              </span>
              {timerSeconds > 0 && <span className="stage-source-pill">{timerSeconds}s Timer</span>}
            </div>
            <button
              type="button"
              className="stage-source-btn"
              onClick={() => setSettingsOpen(true)}
            >
              <Icon name="settings" />
              <span>{isHost ? "Change Deck / AI" : "Room Rules"}</span>
            </button>
          </div>

          <div className="pick-row" role="group" aria-label="Truth or dare">
            {allowTruth && (
              <button
                type="button"
                className={`pick ${qKindUpper === "TRUTH" && question ? "active" : ""}`}
                disabled={!canPick || busy}
                onClick={() => actions.draw("truth")}
              >
                <Icon name="heart" />
                {busy && canPick ? "Drawing…" : isAiMode ? "AI Truth" : "Truth"}
              </button>
            )}

            {allowDare && (
              <button
                type="button"
                className={`pick ${qKindUpper === "DARE" && question ? "active" : ""}`}
                disabled={!canPick || busy}
                onClick={() => actions.draw("dare")}
              >
                <Icon name="flame" />
                {busy && canPick ? "Drawing…" : isAiMode ? "AI Dare" : "Dare"}
              </button>
            )}
          </div>

          {actionError && (
            <p className="notice" role="alert">
              {actionError}
              <button type="button" className="link-btn" onClick={clearActionError}>
                Dismiss
              </button>
            </p>
          )}

          <div
            className={`question-card ${question ? "question-reveal" : "idle"}`}
            key={question ? question.id : `idle-${room.turn_no}`}
          >
            <Icon name={question ? intensityIcon : "sparkle"} className="qc-ornament" />

            {question ? (
              <>
                <div className="question-kind">
                  {qKindUpper}
                  {question.category ? (
                    <span className="question-cat"> · {question.category}</span>
                  ) : null}
                  {question.source === "ai" ? (
                    <span className="question-cat"> · AI</span>
                  ) : question.source === "fallback" ? (
                    <span className="question-cat"> · Fallback Deck</span>
                  ) : null}
                  <span className="question-pts"> · +{totalTurnPts} pt</span>
                </div>

                {question.targetPlayerName && (
                  <div className="q-target-pill">
                    <span>{currentName}</span>
                    <span>↔</span>
                    <span>{question.targetPlayerName}</span>
                  </div>
                )}

                <p className="question-text">{question.body || question.prompt}</p>

                {/* Synchronized Challenge Timer */}
                {timerSeconds > 0 && remainingSeconds !== null && (
                  <div className={`challenge-timer-box ${isTimerExpired ? "expired" : ""}`}>
                    <div className="challenge-timer-top">
                      <span className="challenge-timer-label">
                        {isTimerExpired ? "TIME'S UP!" : "CHALLENGE TIMER"}
                      </span>
                      <span className="challenge-timer-value">{remainingSeconds}s</span>
                    </div>
                    <div className="challenge-timer-track">
                      <div
                        className="challenge-timer-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, (remainingSeconds / timerSeconds) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : busy && isAiMode ? (
              <div className="ai-generating-inline" role="status">
                <Hourglass className="ai-skeleton-hourglass" />
                <p className="question-text idle-text">
                  Summoning an AI card for {currentName}…
                </p>
              </div>
            ) : (
              <p className="question-text idle-text">
                {isMyTurn
                  ? isAiMode
                    ? "Pick AI Truth or AI Dare, and your custom question appears for everyone in the room."
                    : "Pick truth or dare, and your question appears here."
                  : away
                    ? "The game is paused until they are back."
                    : "The next question is on its way…"}
              </p>
            )}

            <span className="qc-dice" aria-hidden="true">
              <Icon name="dice" />
            </span>
          </div>

          <p className="optional-note">
            Everything here is optional. Skip anything you&apos;d rather not do (1 skip per turn).
          </p>

          <div className="turn-actions">
            {isMyTurn && question && (
              <button
                type="button"
                className="skip-link"
                disabled={busy || skipsUsed >= 1}
                onClick={actions.skip}
              >
                {skipsUsed >= 1
                  ? "Skip used this turn"
                  : `Skip this ${qKindUpper.toLowerCase()} (draw replacement)`}
              </button>
            )}

            {isMyTurn && !question && !solo && (
              <button type="button" className="skip-link" disabled={busy} onClick={actions.next}>
                Pass this turn
              </button>
            )}

            {gone && (
              <button
                type="button"
                className="secondary outline"
                disabled={busy}
                onClick={actions.next}
              >
                <Icon name="skip" />
                Skip {currentName}&apos;s turn
              </button>
            )}

            <div className="turn-finish-row">
              {isMyTurn && question && (
                <button
                  type="button"
                  className="secondary outline"
                  disabled={busy}
                  onClick={actions.next}
                >
                  Pass (0 pts)
                </button>
              )}

              <button
                type="button"
                className="primary full"
                disabled={!isMyTurn || !question || busy}
                aria-busy={busy && isMyTurn && question ? "true" : undefined}
                onClick={actions.completeTurn}
              >
                {solo
                  ? `Completed (+${totalTurnPts} pt) · Next Turn`
                  : nextMember
                    ? `Completed (+${totalTurnPts} pt) · Pass to ${nextMember.nickname}`
                    : `Completed (+${totalTurnPts} pt) · Next Turn`}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </section>

        <Chat
          room={room}
          me={me}
          members={members}
          statuses={statuses}
          messages={chat.messages}
          chatState={chat.chatState}
          typingNames={chat.typingNames}
          disabled={room.status === "closed"}
          onSend={chat.sendChat}
          onRetry={chat.retryMessage}
          onDiscard={chat.discardMessage}
          onTyping={chat.sendTyping}
          onReload={chat.reloadMessages}
        />
      </div>

      {/* Deck & AI Settings Popup */}
      <GameSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        canEdit={isHost}
        isOnline={true}
        busy={busy}
        settings={{
          deckMode: normalizeDeckMode(room.deck_mode),
          aiModel: room.ai_model || "openrouter/free",
          intensity: room.intensity || "PLAYFUL",
          mode: room.question_mode || "both",
          timerSeconds: room.timer_seconds || 0,
          specialRounds: Boolean(room.special_rounds),
        }}
        onSave={async (next) => {
          return actions.updateSettings(next);
        }}
      />

      {/* Room Standings & Summary Modal */}
      {standingsOpen && (
        <div
          className="age-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setStandingsOpen(false)}
        >
          <div
            className="age-card host-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="standings-title"
          >
            <p className="eyebrow">ROOM {room.code} · TURN #{room.turn_no}</p>
            <h2 className="display" id="standings-title">
              Room Standings
            </h2>
            <div className="scoreboard-list" style={{ margin: "16px 0" }}>
              {leaderboard.map((m, idx) => (
                <div
                  key={m.id}
                  className={`scoreboard-row ${idx === 0 && m.score > 0 ? "leader" : ""}`}
                >
                  <span className="scoreboard-rank">#{idx + 1}</span>
                  <div className="scoreboard-info">
                    <span className="scoreboard-name">
                      {m.nickname}
                      {m.id === me.member_id ? " (you)" : ""}
                    </span>
                    <span className="scoreboard-meta">
                      Seat {m.seat}
                      {m.gender ? ` · ${m.gender}` : ""}
                    </span>
                  </div>
                  <span className="scoreboard-pts">{m.score} pts</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="secondary outline full"
              onClick={() => setStandingsOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {hostOpen && (
        <div
          className="age-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setHostOpen(false)}
        >
          <HostSheet
            onClose={() => setHostOpen(false)}
            room={room}
            me={me}
            members={members}
            statuses={statuses}
            removedList={removedList}
            actions={actions}
            busy={busy}
            onOpenDeckSettings={() => {
              setHostOpen(false);
              setSettingsOpen(true);
            }}
            onAsk={(c) => {
              setHostOpen(false);
              setConfirm(c);
            }}
          />
        </div>
      )}

      <RoomDialogs
        confirm={confirm}
        onClose={() => setConfirm(null)}
        room={room}
        members={members}
        isHost={isHost}
        actions={actions}
        onLeave={onLeave}
        busy={busy}
      />
    </main>
  );
}

function HostSheet({
  onClose,
  room,
  me,
  members,
  statuses,
  removedList,
  actions,
  busy,
  onOpenDeckSettings,
  onAsk,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="age-card host-sheet" role="dialog" aria-modal="true" aria-labelledby="host-title">
      <h2 className="display" id="host-title">
        Host controls
      </h2>

      <button
        type="button"
        className="secondary outline full"
        style={{ marginBottom: 14 }}
        onClick={onOpenDeckSettings}
      >
        <Icon name="settings" />
        Configure Deck, AI Mode &amp; Timer
      </button>

      <ul className="host-players" aria-label="Players">
        {members.map((m) => (
          <li key={m.id}>
            <Avatar status={statuses[m.id] || "checking"} className="small" />
            <span className="host-player-name">
              {m.nickname}
              {m.id === me.member_id ? " (you)" : ""}
              {m.gender ? ` · ${m.gender}` : ""}
            </span>
            {m.id !== me.member_id && (
              <button
                type="button"
                className="link-btn"
                aria-label={`Remove ${m.nickname} from the room`}
                onClick={() => onAsk({ type: "remove", member: m })}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <HostTools
        room={room}
        removedList={removedList}
        actions={actions}
        busy={busy}
        inGame
        onAsk={onAsk}
      />

      <button type="button" className="secondary outline full" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
