"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "../config";
import { Icon } from "../Art";

const ICONS = {
  joined: "userplus",
  left: "leave",
  removed: "userminus",
  disconnected: "wifioff",
  reconnected: "wifi",
  online: "wifi",
  host: "crown",
  info: "sparkle",
  error: "close",
};

/* In-app notifications. Replaces browser alerts. */
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind, text) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((list) => {
      // never stack the same sentence twice in a row
      if (list.some((t) => t.text === text)) return list;
      return [...list, { id, kind, text }].slice(-CONFIG.maxToasts);
    });
  }, []);

  return { toasts, push, dismiss };
}

function Toast({ toast, onDismiss }) {
  const timer = useRef(null);

  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(toast.id), CONFIG.toastMs);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <li
      className={`toast toast-${toast.kind}`}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
    >
      <span className="toast-icon">
        <Icon name={ICONS[toast.kind] || "sparkle"} />
      </span>
      <span className="toast-text">{toast.text}</span>
      <button
        type="button"
        className="toast-x"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="close" />
      </button>
    </li>
  );
}

/* One polite live region: screen readers announce each toast as it appears. */
export function ToastStack({ toasts, onDismiss }) {
  return (
    <ul className="toast-stack" role="status" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </ul>
  );
}
