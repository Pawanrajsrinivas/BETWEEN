"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CONFIG } from "../config";
import { Icon, RoseAvatar } from "../Art";
import { Avatar } from "./PlayerBits";

function timeLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function typingText(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

export function Chat({
  room,
  me,
  members,
  statuses,
  messages,
  chatState,
  typingNames,
  disabled,
  onSend,
  onRetry,
  onDiscard,
  onTyping,
  onReload,
}) {
  const [text, setText] = useState("");
  const [unseen, setUnseen] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const input = useRef(null);
  const nearBottom = useRef(true);
  const lastCount = useRef(0);
  const lastKey = useRef(null);

  const onlineCount = members.filter((m) => statuses[m.id] === "online").length;
  const typing = typingText(typingNames);

  function toBottom(smooth) {
    const el = list.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseen(0);
  }

  function onScroll() {
    const el = list.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom.current) setUnseen(0);
  }

  /* Follow new messages only when the reader is already at the bottom (or sent
     the message themselves). Otherwise leave their place alone and offer a
     "new messages" shortcut. */
  useLayoutEffect(() => {
    const last = messages[messages.length - 1];
    const key = last ? last.client_id || last.id : null;
    const added = messages.length - lastCount.current;
    const firstPaint = lastCount.current === 0;
    lastCount.current = messages.length;
    if (key === lastKey.current && !firstPaint) return;
    lastKey.current = key;
    if (!last) return;

    const mine = last.member_id === me?.member_id;
    if (firstPaint || mine || nearBottom.current) {
      toBottom(!firstPaint);
    } else if (added > 0) {
      setUnseen((n) => n + added);
    }
  }, [messages, me]);

  useEffect(() => {
    if (nearBottom.current) toBottom(false);
  }, [typing]);

  function resize() {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function submit(e) {
    e?.preventDefault();
    if (!text.trim() || disabled) return;
    if (onSend(text)) {
      setText("");
      requestAnimationFrame(() => {
        resize();
        nearBottom.current = true;
      });
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function onFocus() {
    // With the on-screen keyboard open, keep the composer in view.
    setTimeout(() => root.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 320);
  }

  const memberById = new Map(members.map((m) => [m.id, m]));
  const items = [];
  let prev = null;
  messages.forEach((m) => {
    const day = dayLabel(m.created_at);
    const prevDay = prev ? dayLabel(prev.created_at) : null;
    if (day && day !== prevDay) items.push({ type: "day", key: `day-${m.client_id || m.id}`, label: day });

    if (m.kind === "system") {
      items.push({ type: "system", key: `m-${m.id}`, m });
      prev = null;
      return;
    }
    const mine = m.member_id === me?.member_id;
    const grouped =
      prev &&
      prev.member_id === m.member_id &&
      new Date(m.created_at) - new Date(prev.created_at) < 5 * 60 * 1000 &&
      dayLabel(prev.created_at) === day;
    items.push({ type: "msg", key: `m-${m.client_id || m.id}`, m, mine, grouped: Boolean(grouped) });
    prev = m;
  });

  return (
    <aside className="chat" aria-label="Chat" ref={root}>
      <div className="chat-head">
        <span className="chat-title">
          <Icon name="chat" />
          <span>
            Chat
            <small>Room {room.code}</small>
          </span>
        </span>
        <span className="chat-people" aria-label={`${members.length} in the room, ${onlineCount} online`}>
          <Icon name="users" />
          {members.length}
          <i className="presence-dot online" aria-hidden="true" />
          {onlineCount} online
        </span>
      </div>

      <div className="messages-wrap">
        <div
          className="messages"
          ref={list}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Messages"
          tabIndex={0}
        >
          {chatState === "loading" && messages.length === 0 && (
            <div className="chat-note" role="status">
              <span className="spinner" aria-hidden="true" /> Loading messages…
            </div>
          )}

          {chatState === "error" && (
            <div className="chat-note error" role="alert">
              Couldn&apos;t load earlier messages.
              <button type="button" onClick={onReload}>
                Try again
              </button>
            </div>
          )}

          {chatState === "ready" && messages.length === 0 && (
            <div className="empty-chat">
              <RoseAvatar />
              <strong>Say something.</strong>
              Messages here stay inside this room.
            </div>
          )}

          {items.map((item) => {
            if (item.type === "day") {
              return (
                <div key={item.key} className="day-sep">
                  <span>{item.label}</span>
                </div>
              );
            }
            if (item.type === "system") {
              return (
                <div key={item.key} className="system-message">
                  <span>{item.m.body}</span>
                </div>
              );
            }
            const { m, mine, grouped } = item;
            const sender = memberById.get(m.member_id);
            return (
              <div
                key={item.key}
                className={`message ${mine ? "mine" : ""} ${grouped ? "grouped" : ""} ${m.pending ? "pending" : ""} ${m.failed ? "failed" : ""}`}
              >
                {!mine && (
                  <span className="message-avatar">
                    {grouped ? null : <Avatar status={sender ? statuses[sender.id] : "offline"} className="small" />}
                  </span>
                )}
                <div className="message-col">
                  {!mine && !grouped && <span className="message-name">{m.nickname}</span>}
                  <div className="message-body">{m.body}</div>
                  <span className="message-meta">
                    {m.failed ? (
                      <>
                        <span className="message-error" role="alert">
                          Message failed to send
                        </span>
                        <button type="button" onClick={() => onRetry(m.client_id)}>
                          Retry
                        </button>
                        <button type="button" onClick={() => onDiscard(m.client_id)}>
                          Delete
                        </button>
                      </>
                    ) : m.pending ? (
                      "Sending…"
                    ) : (
                      timeLabel(m.created_at)
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="typing" aria-live="off">
              <span className="typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {typing}
            </div>
          )}
        </div>

        {unseen > 0 && (
          <button type="button" className="new-pill" onClick={() => toBottom(true)}>
            {unseen} new {unseen === 1 ? "message" : "messages"} ↓
          </button>
        )}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <textarea
          ref={input}
          value={text}
          rows={1}
          maxLength={CONFIG.messageMax}
          placeholder={disabled ? "This room is closed" : "Type a message…"}
          aria-label="Message"
          enterKeyHint="send"
          autoComplete="off"
          disabled={disabled}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setText(e.target.value);
            resize();
            if (e.target.value.trim()) onTyping();
          }}
        />
        {text.length > CONFIG.messageMax - 80 && (
          <span className="char-count" aria-hidden="true">
            {CONFIG.messageMax - text.length}
          </span>
        )}
        <button type="submit" disabled={!text.trim() || disabled} aria-label="Send message">
          <Icon name="send" />
        </button>
      </form>
    </aside>
  );
}
