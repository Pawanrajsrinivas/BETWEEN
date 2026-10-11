"use client";

import { useEffect, useRef } from "react";

/* Accessible modal: focus moves in, Tab stays inside, Escape cancels, focus
   returns to whatever opened it. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const card = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !card.current) return;
      const items = card.current.querySelectorAll("button:not(:disabled), input, [href]");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [busy, onCancel]);

  return (
    <div className="age-overlay" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div
        ref={card}
        className="age-card dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-body"
      >
        <h2 className="display" id="dialog-title">
          {title}
        </h2>
        <div className="dialog-body" id="dialog-body">
          {children}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="age-actions">
          <button
            type="button"
            className={`primary ${danger ? "danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy ? "true" : undefined}
          >
            {confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            className="secondary outline"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
