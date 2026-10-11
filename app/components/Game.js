"use client";

import { useEffect, useState } from "react";
import { Chain, Decor, Icon, LipsArt } from "../Art";
import { Chat } from "./Chat";
import { HostTools } from "./HostTools";
import { Avatar, ConnectionBadge, ModeBadge } from "./PlayerBits";
import { RoomDialogs } from "./RoomDialogs";
import { INTENSITIES } from "../config";

function Logo() {
  return <div className="logo">BETWEEN</div>;
}

function titleCase(text) {
  return text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
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

  const question = room.current_question;
  const solo = members.length <= 1;
  const isMyTurn = me.seat === room.current_player;
  const currentName = currentMember?.nickname || "Someone";
  const currentStatus = currentMember ? statuses[currentMember.id] : "offline";
  const away = !isMyTurn && currentMember && currentStatus !== "online" && currentStatus !== "checking";
  const gone = !isMyTurn && (!currentMember || currentStatus === "offline");

  // Turn order mirrors the server: by seat, skipping people who are away.
  const ordered = [...members].sort((a, b) => a.seat - b.seat);
  const eligible = ordered.filter((m) => statuses[m.id] !== "offline" || m.seat === room.current_player);
  const afterCurrent = eligible.filter((m) => m.seat > room.current_player);
  const nextMember = !solo ? afterCurrent[0] || eligible[0] : null;

  let turnTitle = isMyTurn ? "Your Turn" : `${currentName}'s Turn`;
  let turnSub;
  if (isMyTurn) {
    turnSub = question ? "Take your time, then pass the turn" : "Choose truth or dare";
  } else if (away) {
    turnSub = gone ? `${currentName} has been away for a while` : `Waiting for ${currentName} to reconnect…`;
  } else {
    turnSub = question
      ? `${currentName} drew a ${question.kind.toLowerCase()}`
      : `${currentName} is choosing truth or dare`;
  }

  const canPick = isMyTurn && !question;
  const intensityLabel = titleCase(room.intensity);
  const intensityIcon = INTENSITIES.find((i) => i[1] === room.intensity)?.[3] || "sparkle";

  return (
    <main className="screen game">
      <Decor variant="game" />

      <header className="topbar">
        <Logo />

        <div className="room-tag">
          <ModeBadge mode={room.mode} />
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span className="mode-name">{intensityLabel}</span>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <span>{room.code}</span>
        </div>

        <div className="topbar-right">
          <ConnectionBadge conn={conn} />
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
                Your Turn
              </span>
            )}
            <h1 className="display">{turnTitle}</h1>
            <p>{turnSub}</p>
          </div>

          {!solo && (
            <ol className="turn-order" aria-label="Turn order">
              {ordered.map((m) => {
                const current = m.seat === room.current_player;
                const isNext = nextMember && m.id === nextMember.id && !current;
                return (
                  <li
                    key={m.id}
                    className={`turn-chip ${current ? "current" : ""} ${statuses[m.id] === "offline" ? "away" : ""}`}
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

          <div className="pick-row" role="group" aria-label="Truth or dare">
            <button
              type="button"
              className={`pick ${question?.kind === "TRUTH" ? "active" : ""}`}
              disabled={!canPick || busy}
              onClick={() => actions.draw("TRUTH")}
            >
              <Icon name="heart" />
              Truth
            </button>

            <button
              type="button"
              className={`pick ${question?.kind === "DARE" ? "active" : ""}`}
              disabled={!canPick || busy}
              onClick={() => actions.draw("DARE")}
            >
              <Icon name="flame" />
              Dare
            </button>
          </div>

          {actionError && (
            <p className="notice" role="alert">
              {actionError}
              <button type="button" className="link-btn" onClick={clearActionError}>
                Dismiss
              </button>
            </p>
          )}

          <div className={`question-card ${question ? "question-reveal" : "idle"}`} key={question ? question.id : "idle"}>
            <Icon name={question ? intensityIcon : "sparkle"} className="qc-ornament" />

            {question ? (
              <>
                <div className="question-kind">
                  {question.kind}
                  {question.category ? <span className="question-cat"> · {question.category}</span> : null}
                </div>
                <p className="question-text">{question.body}</p>
              </>
            ) : (
              <p className="question-text idle-text">
                {isMyTurn
                  ? "Pick truth or dare, and your question appears here."
                  : away
                    ? "The game is paused until they are back."
                    : "The next question is on its way…"}
              </p>
            )}

            <span className="qc-dice" aria-hidden="true">
              <Icon name="dice" />
            </span>
          </div>

          <p className="optional-note">Everything here is optional. Skip anything you&apos;d rather not do.</p>

          <div className="turn-actions">
            {isMyTurn && question && (
              <button type="button" className="skip-link" disabled={busy} onClick={actions.skip}>
                Skip this {question.kind.toLowerCase()}
              </button>
            )}

            {isMyTurn && !question && !solo && (
              <button type="button" className="skip-link" disabled={busy} onClick={actions.next}>
                Pass this turn
              </button>
            )}

            {gone && (
              <button type="button" className="secondary outline" disabled={busy} onClick={actions.next}>
                <Icon name="skip" />
                Skip {currentName}&apos;s turn
              </button>
            )}

            <button
              type="button"
              className="primary full"
              disabled={!isMyTurn || !question || busy}
              aria-busy={busy && isMyTurn && question ? "true" : undefined}
              onClick={actions.next}
            >
              {solo ? "Next Turn" : nextMember ? `Done, pass to ${nextMember.nickname}` : "Next Turn"}
              <span aria-hidden="true">→</span>
            </button>
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

function HostSheet({ onClose, room, me, members, statuses, removedList, actions, busy, onAsk }) {
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

      <ul className="host-players" aria-label="Players">
        {members.map((m) => (
          <li key={m.id}>
            <Avatar status={statuses[m.id] || "checking"} className="small" />
            <span className="host-player-name">
              {m.nickname}
              {m.id === me.member_id ? " (you)" : ""}
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
        showMode={false}
      />

      <button type="button" className="secondary outline full" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
