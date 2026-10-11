"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useRoom } from "../lib/useRoom";
import { Game } from "./Game";
import { Lobby } from "./Lobby";
import { LoadingCard, StateCard } from "./Screens";
import { ToastStack, useToasts } from "./Toasts";

/* Decides what to show for a room: loading, a "can't be here" explanation, the
   lobby, or the game. All live behaviour comes from useRoom. */
export function RoomView({ code, userId, onExit, onNeedJoin }) {
  const { toasts, push, dismiss } = useToasts();
  const r = useRoom({ code, userId, notify: push });
  const [rejoining, setRejoining] = useState(false);
  const [rejoinError, setRejoinError] = useState("");

  const needsJoin =
    r.phase === "blocked" && (r.blocked?.error === "NOT_MEMBER" || r.blocked?.error === "ROOM_NOT_FOUND");

  useEffect(() => {
    if (needsJoin) onNeedJoin(code, r.blocked);
  }, [needsJoin, code, r.blocked, onNeedJoin]);

  async function rejoin() {
    if (rejoining) return;
    setRejoining(true);
    setRejoinError("");
    const res = await api.joinRoom(code, null);
    setRejoining(false);
    if (res.ok) r.reload();
    else setRejoinError(res.message);
  }

  const exitButton = (
    <button type="button" className="secondary outline" onClick={onExit}>
      Back to start
    </button>
  );
  const rejoinButton = (
    <button type="button" className="primary" onClick={rejoin} disabled={rejoining} aria-busy={rejoining ? "true" : undefined}>
      {rejoining ? "Rejoining" : "Rejoin Room"}
    </button>
  );
  const rejoinNote = rejoinError && (
    <p className="form-error" role="alert">
      {rejoinError}
    </p>
  );

  let body;

  if (r.phase === "loading" || needsJoin) {
    body = <LoadingCard label="Loading room" />;
  } else if (r.phase === "blocked") {
    const err = r.blocked?.error;
    if (err === "LEFT") {
      body = (
        <StateCard eyebrow={`Room ${code}`} title="You left this" em="room.">
          You can come back with the same code, if there is space.
          {rejoinNote}
          <span className="state-actions-inline">
            {rejoinButton}
            {exitButton}
          </span>
        </StateCard>
      );
    } else if (err === "ROOM_FULL") {
      body = (
        <StateCard eyebrow={`Room ${code}`} title="Room is" em="full.">
          {r.blocked?.message || "Every seat is taken right now."}
          <span className="state-actions-inline">
            <button type="button" className="primary" onClick={r.reload}>
              Try again
            </button>
            {exitButton}
          </span>
        </StateCard>
      );
    } else {
      body = (
        <StateCard eyebrow={`Room ${code}`} title="Unable to" em="connect.">
          {r.blocked?.message || "Something went wrong while loading this room."}
          <span className="state-actions-inline">
            <button type="button" className="primary" onClick={r.reload}>
              Try again
            </button>
            {exitButton}
          </span>
        </StateCard>
      );
    }
  } else if (r.terminal === "removed") {
    body = (
      <StateCard eyebrow={`Room ${code}`} title="You were" em="removed.">
        The host removed you from this room, so you can no longer see or send messages here.
        <span className="state-actions-inline">{exitButton}</span>
      </StateCard>
    );
  } else if (r.terminal === "closed") {
    const expired = r.room?.closed_reason === "expired";
    body = (
      <StateCard eyebrow={`Room ${code}`} title="This room is" em="closed.">
        {expired
          ? "The room was idle for too long and has been closed."
          : "The host closed this room. Thanks for playing."}
        <span className="state-actions-inline">{exitButton}</span>
      </StateCard>
    );
  } else if (r.terminal === "full") {
    body = (
      <StateCard eyebrow={`Room ${code}`} title="Your seat was" em="taken.">
        You were away for a while and the room filled up.
        <span className="state-actions-inline">{exitButton}</span>
      </StateCard>
    );
  } else if (r.terminal === "left") {
    body = (
      <StateCard eyebrow={`Room ${code}`} title="You left this" em="room.">
        You can come back with the same code, if there is space.
        {rejoinNote}
        <span className="state-actions-inline">
          {rejoinButton}
          {exitButton}
        </span>
      </StateCard>
    );
  } else if (r.room && r.me) {
    const common = {
      room: r.room,
      me: r.me,
      members: r.members,
      statuses: r.statuses,
      removedList: r.removedList,
      isHost: r.isHost,
      conn: r.conn,
      busy: r.busy,
      actionError: r.actionError,
      actions: r.actions,
      onLeave: async () => {
        const res = await r.actions.leave();
        if (res?.ok) onExit();
        return res;
      },
    };
    body =
      r.room.status === "playing" ? (
        <Game
          {...common}
          currentMember={r.currentMember}
          clearActionError={r.clearActionError}
          chat={r}
        />
      ) : (
        <Lobby {...common} occupied={r.occupied} />
      );
  } else {
    body = <LoadingCard label="Loading room" />;
  }

  return (
    <>
      {body}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
