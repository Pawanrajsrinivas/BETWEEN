"use client";

import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/* All confirmation steps for leaving, closing, removing and resetting.
   `confirm` is { type, member? } or null. The server re-checks every one of
   these actions, so the dialogs are a courtesy, not the security. */
export function RoomDialogs({ confirm, onClose, room, members, isHost, actions, onLeave, busy }) {
  const [lock, setLock] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  if (!confirm) return null;

  function dismiss() {
    if (working) return;
    setError("");
    onClose();
  }

  async function run(fn) {
    setWorking(true);
    setError("");
    const res = await fn();
    setWorking(false);
    if (res && res.ok === false) {
      setError(res.message || "That didn't work. Please try again.");
      return;
    }
    onClose();
  }

  if (confirm.type === "leave") {
    const others = members.filter((m) => m.user_id !== room.host_user);
    const hostLeaving = isHost && others.length > 0;
    return (
      <ConfirmDialog
        title="Leave this room?"
        confirmLabel="Leave Room"
        danger
        busy={working}
        error={error}
        onCancel={dismiss}
        onConfirm={() => run(onLeave)}
      >
        <p>
          {hostLeaving
            ? "You're the host. If you leave, hosting passes to the player who has been here longest. You can come back with the same code."
            : "You can come back any time with the same room code, as long as there is space."}
        </p>
      </ConfirmDialog>
    );
  }

  if (confirm.type === "close") {
    return (
      <ConfirmDialog
        title="Close this room?"
        confirmLabel="Close Room"
        danger
        busy={working}
        error={error}
        onCancel={dismiss}
        onConfirm={() => run(actions.close)}
      >
        <p>
          Everyone is told the room is closed. Nobody can join, play or send messages in it
          again.
        </p>
      </ConfirmDialog>
    );
  }

  if (confirm.type === "reset") {
    return (
      <ConfirmDialog
        title="Return to the lobby?"
        confirmLabel="Return to Lobby"
        busy={working}
        error={error}
        onCancel={dismiss}
        onConfirm={() => run(() => actions.reset())}
      >
        <p>
          The current game ends and everyone goes back to the lobby. Turn order and used
          questions reset. Chat is kept. You can change the settings before starting again.
        </p>
      </ConfirmDialog>
    );
  }

  if (confirm.type === "remove" && confirm.member) {
    return (
      <ConfirmDialog
        title={`Remove ${confirm.member.nickname}?`}
        confirmLabel="Remove Player"
        danger
        busy={working}
        error={error}
        onCancel={dismiss}
        onConfirm={() => run(() => actions.remove(confirm.member.id, lock))}
      >
        <p>
          They lose access to this room and its chat straight away and can&apos;t rejoin unless
          you let them back in.
        </p>
        <label className="check-row">
          <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
          <span>Also lock the room so no new players can join</span>
        </label>
      </ConfirmDialog>
    );
  }

  return null;
}
