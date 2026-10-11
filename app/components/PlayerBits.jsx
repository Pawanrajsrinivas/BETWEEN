"use client";

import { RoseAvatar, Icon } from "../Art";

export const STATUS_LABEL = {
  online: "Online",
  reconnecting: "Reconnecting",
  offline: "Offline",
  checking: "Checking…",
};

/* Rose avatar with a live presence dot */
export function Avatar({ status = "checking", className = "" }) {
  return (
    <span className={`avatar ${className}`}>
      <RoseAvatar />
      <i className={`presence-dot ${status}`} aria-hidden="true" />
    </span>
  );
}

export function StatusPill({ status, stale = false }) {
  return (
    <span className={`status-pill ${status} ${stale ? "stale" : ""}`}>
      <i aria-hidden="true" />
      {STATUS_LABEL[status] || STATUS_LABEL.checking}
    </span>
  );
}

export function ModeBadge({ mode }) {
  return (
    <span className={`mode-badge ${mode === "OFFLINE" ? "offline" : "online"}`}>
      <Icon name={mode === "OFFLINE" ? "users" : "globe"} />
      {mode === "OFFLINE" ? "Offline" : "Online"}
    </span>
  );
}

export function ConnectionBadge({ conn }) {
  if (conn === "online") return null;
  const text =
    conn === "offline"
      ? "You're offline. Showing last known status."
      : conn === "connecting"
        ? "Connecting…"
        : "Reconnecting…";
  return (
    <span className="conn-badge" role="status">
      <Icon name="wifioff" />
      <span>{text}</span>
    </span>
  );
}
