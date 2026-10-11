"use client";

import { useState } from "react";
import { Decor, Hourglass, Icon } from "../Art";
import { Avatar, ConnectionBadge, ModeBadge, StatusPill } from "./PlayerBits";
import { RoomDialogs } from "./RoomDialogs";
import { HostTools } from "./HostTools";
import { GameSettingsModal } from "./GameSettingsModal";
import { GAME_MODES, normalizeDeckMode } from "../config";

function Logo() {
  return <div className="logo">BETWEEN</div>;
}

export function PlayerCard({ member, status, isMe, isHostMember, canRemove, onRemove }) {
  return (
    <li className={`player-card ${status} ${isMe ? "me" : ""}`}>
      <Avatar status={status} />
      <strong className="player-name">{member.nickname}</strong>
      <span className="player-tags">
        {isMe && <em className="badge ghost">You</em>}
        {isHostMember && <em className="badge">Host</em>}
        {member.gender && <em className="badge ghost">{member.gender}</em>}
      </span>
      <StatusPill status={status} />
      {canRemove && (
        <button
          type="button"
          className="remove-btn"
          aria-label={`Remove ${member.nickname} from the room`}
          onClick={() => onRemove(member)}
        >
          <Icon name="userminus" />
          Remove
        </button>
      )}
    </li>
  );
}

export function EmptySeat({ n }) {
  return (
    <li className="player-card empty" aria-label={`Open seat ${n}`}>
      <span className="empty-avatar" aria-hidden="true">
        ?
      </span>
      <strong className="player-name">Open seat</strong>
      <span className="status-pill ghost">Waiting…</span>
    </li>
  );
}

export function Lobby({
  room,
  me,
  members,
  statuses,
  removedList,
  isHost,
  occupied,
  conn,
  busy,
  actionError,
  actions,
  onLeave,
}) {
  const [confirm, setConfirm] = useState(null);
  const [copied, setCopied] = useState(null);
  const [copyError, setCopyError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isAiMode = normalizeDeckMode(room.deck_mode) === "ai";
  const needed = Math.min(room.capacity, 2);
  const enough = occupied >= needed;
  const openSeats = Math.max(0, room.capacity - members.length);
  const solo = room.capacity === 1;

  async function copyText(text, which) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setCopyError("");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyError("Couldn't copy automatically. Select the code and copy it.");
    }
  }

  let title = "Your Room is Ready";
  let lede = "Share this code with your people.";
  if (solo) {
    title = "Your Solo Room";
    lede = "Just you. Start whenever you're ready.";
  } else if (enough && occupied >= room.capacity) {
    title = "Everyone Is In";
    lede = isHost ? "Start whenever you're ready." : "Waiting for the host to start.";
  } else if (enough) {
    title = "Ready When You Are";
    lede = isHost ? "You can start now, or wait for more players." : "Waiting for the host to start.";
  } else if (room.capacity > 1) {
    title = "Waiting for Players";
  }

  const hostMemberId = members.find((m) => m.user_id === room.host_user)?.id;
  const modeInfo = GAME_MODES[room.mode] || GAME_MODES.ONLINE;

  return (
    <main className="screen lobby">
      <Decor variant="lobby" />

      <header className="topbar">
        <Logo />
        <div className="topbar-right">
          <ConnectionBadge conn={conn} />
          <button
            type="button"
            className={`leave-btn ai-toggle-btn ${isAiMode ? "active" : ""}`}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name={isAiMode ? "flame" : "sparkle"} />
            <span>{isAiMode ? "AI Deck" : "Built-in Deck"}</span>
          </button>
          <button type="button" className="leave-btn" onClick={() => setConfirm({ type: "leave" })}>
            <Icon name="leave" />
            <span>Leave Room</span>
          </button>
        </div>
      </header>

      <div className="lobby-body wide">
        <div className="lobby-meta">
          <ModeBadge mode="ONLINE" />
          <span className="meta-chip">
            <Icon name={isAiMode ? "flame" : "sparkle"} />
            {isAiMode ? "AI Generator" : "Built-in Deck"}
          </span>
          <span className="meta-chip">{room.intensity}</span>
          {room.timer_seconds > 0 && (
            <span className="meta-chip">{room.timer_seconds}s Timer</span>
          )}
          {room.special_rounds && <span className="meta-chip">Special Rounds</span>}
          <span className="meta-chip">
            <Icon name="users" />
            {solo ? "Solo" : `${room.capacity} players max`}
          </span>
          {room.locked && (
            <span className="meta-chip">
              <Icon name="lock" />
              Locked
            </span>
          )}
        </div>

        <h1 className="display">{title}</h1>
        <p className="lede">{lede}</p>

        <div className="code-card">
          <div className="code-chars" aria-label={`Room code ${room.code.split("").join(" ")}`}>
            {room.code.split("").map((char, i) => (
              <span key={i}>{char}</span>
            ))}
          </div>
          <button
            type="button"
            className={`copy-btn ${copied === "code" ? "done" : ""}`}
            onClick={() => copyText(room.code, "code")}
            aria-label={copied === "code" ? "Room code copied" : "Copy room code"}
          >
            <Icon name={copied === "code" ? "check" : "copy"} />
          </button>
        </div>

        <div className="occupancy" role="status">
          <span>
            <strong>{occupied}</strong> of <strong>{room.capacity}</strong>{" "}
            {room.capacity === 1 ? "player" : "players"} in the room
          </span>
          <span className="pips" aria-hidden="true">
            {Array.from({ length: room.capacity }, (_, i) => (
              <i key={i} className={i < occupied ? "on" : ""} />
            ))}
          </span>
        </div>

        <ul className="player-grid" aria-label="Players">
          {members.map((m) => (
            <PlayerCard
              key={m.id}
              member={m}
              status={statuses[m.id] || "checking"}
              isMe={m.id === me.member_id}
              isHostMember={m.id === hostMemberId}
              canRemove={isHost && m.id !== me.member_id}
              onRemove={(member) => setConfirm({ type: "remove", member })}
            />
          ))}
          {Array.from({ length: Math.min(openSeats, 8) }, (_, i) => (
            <EmptySeat key={`seat-${i}`} n={members.length + i + 1} />
          ))}
        </ul>

        {!solo && !enough && (
          <div className="status-panel" role="status">
            <Hourglass className="status-hourglass" />
            <div>
              <strong>Waiting for players to join…</strong>
              <span>
                {needed} {needed === 1 ? "player is" : "players are"} needed to start. {occupied} here so far.
              </span>
            </div>
          </div>
        )}

        {(actionError || copyError) && (
          <p className="form-error" role="alert">
            {actionError || copyError}
          </p>
        )}

        <div className="lobby-actions">
          <button
            className="secondary outline"
            type="button"
            onClick={() => copyText(`${window.location.origin}/?room=${room.code}`, "link")}
          >
            <Icon name="link" />
            {copied === "link" ? "Link copied" : "Copy invite link"}
          </button>

          {isHost && (
            <button
              className="secondary outline"
              type="button"
              onClick={() => setSettingsOpen(true)}
            >
              <Icon name="settings" />
              Deck &amp; AI Settings
            </button>
          )}

          {isHost ? (
            <button
              className="primary"
              type="button"
              onClick={actions.start}
              disabled={busy || !enough}
              aria-busy={busy ? "true" : undefined}
            >
              {busy ? "Starting" : "Start Between"}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          ) : (
            <p className="waiting-host" role="status">
              <Icon name="crown" />
              Waiting for the host to start
            </p>
          )}
        </div>

        {isHost && (
          <section className="panel host-panel" aria-label="Host controls">
            <h2 className="panel-title">
              <Icon name="shield" />
              Host controls
            </h2>
            <HostTools
              room={room}
              removedList={removedList}
              actions={actions}
              busy={busy}
              inGame={false}
              onAsk={setConfirm}
            />
          </section>
        )}

        {!isHost && (
          <p className="mode-note">
            <strong>{modeInfo.label} mode:</strong> {modeInfo.description}
          </p>
        )}
      </div>

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
