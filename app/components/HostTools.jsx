"use client";

import { Icon } from "../Art";

/* Host-only controls. The buttons are hidden for everyone else, and every
   action is also rejected by the database unless the caller is the host. */
export function HostTools({ room, removedList, actions, busy, inGame, onAsk }) {
  return (
    <div className="host-tools">
      <button
        type="button"
        className="secondary tool-btn"
        disabled={busy}
        aria-pressed={room.locked}
        onClick={() => actions.setLock(!room.locked)}
      >
        <Icon name={room.locked ? "lock" : "unlock"} />
        {room.locked ? "Room locked to new players. Unlock" : "Lock room to new players"}
      </button>

      {inGame && (
        <button
          type="button"
          className="secondary tool-btn"
          disabled={busy}
          onClick={() => onAsk({ type: "reset" })}
        >
          <Icon name="back" />
          Return to lobby
        </button>
      )}

      {removedList?.length > 0 && (
        <div className="removed-list">
          <span className="field-label">Removed players</span>
          <ul>
            {removedList.map((r) => (
              <li key={r.id}>
                <span>{r.nickname}</span>
                <button
                  type="button"
                  className="link-btn"
                  disabled={busy}
                  onClick={() => actions.readmit(r.id)}
                >
                  Allow back
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="secondary tool-btn danger-outline"
        disabled={busy}
        onClick={() => onAsk({ type: "close" })}
      >
        <Icon name="close" />
        Close room for everyone
      </button>
    </div>
  );
}
