-- ============================================================================
-- BETWEEN — migration 001: multiplayer rooms, membership, host controls,
-- game modes, presence support and Row Level Security.
--
-- ADDITIVE AND IDEMPOTENT. Nothing is dropped, truncated or deleted. Safe to
-- run more than once. Run AFTER supabase/schema.sql, BEFORE seed_questions.sql.
--
-- What changes for existing data
--   * rooms / messages / questions keep every row and every old column.
--   * Old two-player rooms have no room_members rows and no host_user, so the
--     new app cannot enter them. They were already on a 2-hour timer, so this
--     only affects games in progress at the moment you deploy.
--   * The 8 original questions have no `mode`, so the new game never draws them
--     (they stay in the table, untouched).
--   * rooms.host_name becomes nullable (new rooms keep names in room_members).
--   * RLS is switched ON. The old client (which wrote to tables directly with
--     the anon key) stops working by design. Deploy the new client together
--     with this migration.
--
-- Requires: Supabase Auth -> Providers -> "Allow anonymous sign-ins" = ON.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Settings (change a value with a plain UPDATE; no redeploy needed)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  key   text primary key,
  value text not null,
  note  text
);

insert into app_settings (key, value, note) values
  ('max_room_capacity',         '8',   'Largest room a host may create (1 to this value).'),
  ('reconnect_grace_seconds',   '120', 'A member silent for longer than this stops holding a capacity slot and is shown Offline.'),
  ('host_takeover_seconds',     '600', 'How long the host must be silent before another member may claim host.'),
  ('room_idle_expiry_minutes',  '120', 'A room with no heartbeat for this long is closed. Active rooms never hit it.'),
  ('room_code_length',          '6',   'Characters in a room code (4-20). 32 symbols per character.'),
  ('rate_create_room_per_hour', '10',  'Rooms one browser identity may create per hour.'),
  ('rate_join_per_10min',       '30',  'Join attempts (successful or not) per identity per 10 minutes.'),
  ('rate_messages_per_minute',  '40',  'Chat messages per member per minute.')
on conflict (key) do nothing;

create or replace function setting_int(p_key text, p_default int)
returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(value, '')::int from app_settings where key = p_key), p_default)
$$;

-- ---------------------------------------------------------------------------
-- 1. Existing tables: new columns and constraints
-- ---------------------------------------------------------------------------
alter table rooms alter column host_name drop not null;

alter table rooms
  add column if not exists mode              text        not null default 'ONLINE',
  add column if not exists capacity          smallint    not null default 2,
  add column if not exists host_user         uuid,
  add column if not exists locked            boolean     not null default false,
  add column if not exists turn_no           integer     not null default 0,
  add column if not exists current_question  jsonb,
  add column if not exists used_question_ids uuid[]      not null default '{}',
  add column if not exists started_at        timestamptz,
  add column if not exists closed_at         timestamptz,
  add column if not exists closed_reason     text,
  add column if not exists updated_at        timestamptz not null default now();

alter table messages
  add column if not exists member_id uuid,
  add column if not exists kind      text not null default 'chat',
  add column if not exists client_id uuid;

alter table questions
  add column if not exists mode     text,
  add column if not exists category text,
  add column if not exists solo_ok  boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_mode_chk') then
    alter table rooms add constraint rooms_mode_chk check (mode in ('ONLINE','OFFLINE'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_capacity_chk') then
    alter table rooms add constraint rooms_capacity_chk check (capacity between 1 and 32);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_status_chk') then
    alter table rooms add constraint rooms_status_chk
      check (status in ('waiting','ready','playing','closed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'messages_kind_chk') then
    alter table messages add constraint messages_kind_chk check (kind in ('chat','system'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'questions_mode_chk') then
    alter table questions add constraint questions_mode_chk
      check (mode is null or mode in ('ONLINE','OFFLINE'));
  end if;
end $$;

create unique index if not exists messages_room_client_uidx
  on messages (room_id, client_id) where client_id is not null;
create index if not exists messages_room_created_idx on messages (room_id, created_at);
create index if not exists rooms_host_user_idx on rooms (host_user);
create unique index if not exists questions_unique_uidx
  on questions (mode, kind, intensity, body);
create index if not exists questions_pool_idx
  on questions (mode, kind, intensity) where active;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rooms_set_updated_at on rooms;
create trigger rooms_set_updated_at before update on rooms
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------

-- One row per (room, browser identity). A returning player UPDATES their row;
-- they never get a second one. `status` separates the three lifecycle states:
--   active  = in the room (may be briefly disconnected: see room_member_seen)
--   left    = pressed Leave; slot released; may rejoin with the code
--   removed = removed by the host; cannot rejoin unless the host readmits them
create table if not exists room_members (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  user_id    uuid not null,
  nickname   text not null check (char_length(nickname) between 1 and 30),
  seat       smallint not null,
  status     text not null default 'active' check (status in ('active','left','removed')),
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  removed_at timestamptz,
  unique (room_id, user_id),
  unique (room_id, seat)
);

create unique index if not exists room_members_active_nick_uidx
  on room_members (room_id, lower(nickname)) where status = 'active';
create index if not exists room_members_user_idx
  on room_members (user_id) where status = 'active';

-- Heartbeats live in their own table that is NOT in the Realtime publication,
-- so a heartbeat every few seconds never fans out to every client.
create table if not exists room_member_seen (
  member_id uuid primary key references room_members(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create table if not exists rate_events (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  action  text not null,
  at      timestamptz not null default now()
);
create index if not exists rate_events_idx on rate_events (user_id, action, at);

create table if not exists moderation_events (
  id               bigint generated always as identity primary key,
  room_id          uuid not null references rooms(id) on delete cascade,
  actor_user       uuid not null,
  target_member_id uuid,
  action           text not null,
  detail           jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists moderation_events_room_idx on moderation_events (room_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. Small helpers
-- ---------------------------------------------------------------------------
create or replace function rpc_fail(p_code text, p_message text)
returns jsonb language sql immutable as $$
  select jsonb_build_object('ok', false, 'error', p_code, 'message', p_message)
$$;

create or replace function is_room_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from room_members
    where room_id = p_room and user_id = auth.uid() and status = 'active'
  )
$$;

-- Topic format used by the client for Presence/Broadcast: "room:<room uuid>"
create or replace function can_access_room_topic(p_topic text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_topic is null or p_topic !~ '^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return is_room_member(substr(p_topic, 6)::uuid);
end $$;

-- Inserts first, then counts, so blocked attempts keep extending the block.
create or replace function check_rate(p_user uuid, p_action text, p_max int, p_window interval)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from rate_events where user_id = p_user and at < now() - interval '1 day';
  insert into rate_events (user_id, action) values (p_user, p_action);
  select count(*) into n from rate_events
   where user_id = p_user and action = p_action and at > now() - p_window;
  return n <= p_max;
end $$;

-- 32 unambiguous symbols (no I, O, 0, 1); one symbol per random byte & 31, so
-- every symbol is equally likely. gen_random_uuid() is a cryptographic RNG;
-- bytes 6 and 8 of each uuid carry fixed version bits, so they are skipped.
create or replace function gen_room_code(p_len int)
returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  out text := '';
  i int;
begin
  for i in 0..31 loop
    continue when (i % 16) in (6, 8);
    out := out || substr(alphabet, (get_byte(bytes, i) & 31) + 1, 1);
    exit when char_length(out) >= p_len;
  end loop;
  return out;
end $$;

-- Members who currently hold a capacity slot: active and heard from recently.
create or replace function room_occupancy(p_room uuid, p_exclude_user uuid default null)
returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from room_members m
    left join room_member_seen s on s.member_id = m.id
   where m.room_id = p_room
     and m.status = 'active'
     and (p_exclude_user is null or m.user_id <> p_exclude_user)
     and coalesce(s.last_seen, m.joined_at)
         >= now() - make_interval(secs => setting_int('reconnect_grace_seconds', 120))
$$;

create or replace function room_json(r rooms)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'mode', r.mode, 'intensity', r.intensity,
    'capacity', r.capacity, 'status', r.status, 'locked', r.locked,
    'host_user', r.host_user, 'current_player', r.current_player,
    'turn_no', r.turn_no, 'current_question', r.current_question,
    'closed_reason', r.closed_reason, 'created_at', r.created_at,
    'expires_at', r.expires_at, 'updated_at', r.updated_at)
$$;

create or replace function touch_seen(p_member uuid)
returns void
language sql security definer set search_path = public as $$
  insert into room_member_seen (member_id, last_seen) values (p_member, now())
  on conflict (member_id) do update set last_seen = excluded.last_seen
$$;

-- Keeps a room alive while anyone is using it (rolling window, not a hard cap).
-- Only writes when more than half the window is gone, to avoid constant updates.
create or replace function bump_room_expiry(p_room uuid)
returns void
language sql security definer set search_path = public as $$
  update rooms
     set expires_at = now() + make_interval(mins => setting_int('room_idle_expiry_minutes', 120))
   where id = p_room
     and status <> 'closed'
     and expires_at < now() + make_interval(mins => setting_int('room_idle_expiry_minutes', 120) / 2)
$$;

-- Moves the turn to the next member (by seat) who is present. `p_caller` is
-- always treated as present. Increments turn_no so stale clients can be
-- detected, and clears the current question.
create or replace function advance_turn(p_room_id uuid, p_caller uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  cur smallint;
  nxt smallint;
begin
  select current_player into cur from rooms where id = p_room_id;

  with eligible as (
    select m.seat
      from room_members m
      left join room_member_seen s on s.member_id = m.id
     where m.room_id = p_room_id
       and m.status = 'active'
       and (m.user_id = p_caller
            or coalesce(s.last_seen, m.joined_at)
               >= now() - make_interval(secs => setting_int('reconnect_grace_seconds', 120)))
  )
  select coalesce(
           (select min(seat) from eligible where seat > cur),
           (select min(seat) from eligible))
    into nxt;

  update rooms
     set current_player = coalesce(nxt, current_player),
         turn_no = turn_no + 1,
         current_question_id = null,
         current_question = null
   where id = p_room_id;
end $$;

-- Picks a random question for the room's mode + intensity + kind that has not
-- been used yet (the used list resets once the pool is exhausted). Rooms with a
-- single person present only receive questions flagged solo_ok.
create or replace function pick_question(p_room rooms, p_kind text)
returns table (id uuid, kind text, category text, body text, used_reset boolean)
language plpgsql security definer set search_path = public as $$
declare
  solo boolean := room_occupancy(p_room.id) < 2;
begin
  return query
    select q.id, q.kind, q.category, q.body, false
      from questions q
     where q.active and q.mode = p_room.mode and q.intensity = p_room.intensity
       and q.kind = p_kind and (q.solo_ok or not solo)
       and not (q.id = any (p_room.used_question_ids))
     order by random() limit 1;
  if found then return; end if;

  return query
    select q.id, q.kind, q.category, q.body, true
      from questions q
     where q.active and q.mode = p_room.mode and q.intensity = p_room.intensity
       and q.kind = p_kind and (q.solo_ok or not solo)
     order by random() limit 1;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security: clients may READ what their room contains. Every
--    write goes through the functions below.
-- ---------------------------------------------------------------------------
alter table rooms             enable row level security;
alter table room_members      enable row level security;
alter table room_member_seen  enable row level security;
alter table messages          enable row level security;
alter table questions         enable row level security;
alter table app_settings      enable row level security;
alter table rate_events       enable row level security;
alter table moderation_events enable row level security;

revoke all on rooms, room_members, room_member_seen, messages, questions,
              app_settings, rate_events, moderation_events from anon;
revoke all on room_member_seen, questions, app_settings, rate_events,
              moderation_events from authenticated;
revoke insert, update, delete, truncate on rooms, room_members, messages from authenticated;
grant select on rooms, room_members, messages to authenticated;

drop policy if exists rooms_select_members on rooms;
create policy rooms_select_members on rooms
  for select to authenticated using (is_room_member(id));

-- You can always see your own row (so a removed player is told), and the
-- rows of the other active members of any room you are an active member of.
drop policy if exists room_members_select on room_members;
create policy room_members_select on room_members
  for select to authenticated
  using (user_id = auth.uid() or is_room_member(room_id));

drop policy if exists messages_select_members on messages;
create policy messages_select_members on messages
  for select to authenticated using (is_room_member(room_id));

-- ---------------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['rooms', 'messages', 'room_members'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Presence + Broadcast run on PRIVATE channels named "room:<room id>". Only
-- active members of that room may join, listen or send.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists "room members receive" on realtime.messages;
    create policy "room members receive" on realtime.messages
      for select to authenticated
      using (extension in ('broadcast', 'presence')
             and public.can_access_room_topic((select realtime.topic())));

    drop policy if exists "room members send" on realtime.messages;
    create policy "room members send" on realtime.messages
      for insert to authenticated
      with check (extension in ('broadcast', 'presence')
                  and public.can_access_room_topic((select realtime.topic())));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. API functions (the only way clients change data)
-- ---------------------------------------------------------------------------

-- 6.1 create_room ------------------------------------------------------------
create or replace function create_room(
  p_nickname text, p_mode text, p_intensity text, p_capacity int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  nick  text := regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g');
  maxc  int  := setting_int('max_room_capacity', 8);
  len   int  := least(greatest(setting_int('room_code_length', 6), 4), 20);
  v_code text;
  rid   uuid;
  mid   uuid;
  tries int := 0;
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  if char_length(nick) not between 1 and 30 then
    return rpc_fail('INVALID_NICKNAME', 'Choose a nickname between 1 and 30 characters.');
  end if;
  if p_mode is null or p_mode not in ('ONLINE', 'OFFLINE') then
    return rpc_fail('INVALID_MODE', 'Choose Online or Offline.');
  end if;
  if p_intensity is null or p_intensity not in ('PLAYFUL','PERSONAL','FLIRTY','WILD','AFTER DARK') then
    return rpc_fail('INVALID_INTENSITY', 'Choose an intensity.');
  end if;
  if p_capacity is null or p_capacity < 1 or p_capacity > maxc then
    return rpc_fail('INVALID_CAPACITY', format('Choose between 1 and %s players.', maxc));
  end if;
  if not check_rate(uid, 'create_room', setting_int('rate_create_room_per_hour', 10), interval '1 hour') then
    return rpc_fail('RATE_LIMITED', 'You have created a lot of rooms. Please wait a while and try again.');
  end if;

  loop
    v_code := gen_room_code(len);
    begin
      insert into rooms (code, host_user, mode, intensity, capacity, status, current_player, expires_at)
      values (v_code, uid, p_mode, p_intensity, p_capacity, 'waiting', 1,
              now() + make_interval(mins => setting_int('room_idle_expiry_minutes', 120)))
      returning id into rid;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 10 then
        return rpc_fail('TRY_AGAIN', 'Could not create a room right now. Please try again.');
      end if;
    end;
  end loop;

  insert into room_members (room_id, user_id, nickname, seat)
  values (rid, uid, nick, 1) returning id into mid;
  perform touch_seen(mid);

  return jsonb_build_object('ok', true, 'code', v_code, 'room_id', rid, 'member_id', mid);
end $$;

-- 6.2 join_room --------------------------------------------------------------
-- Idempotent for a returning identity: a refresh, a retry or a second tab hits
-- the existing member row and consumes no extra slot. The room row is locked
-- for the whole call, so simultaneous joins are processed one at a time and
-- capacity cannot be exceeded.
create or replace function join_room(p_code text, p_nickname text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  v_code  text := upper(btrim(coalesce(p_code, '')));
  nick    text := nullif(regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'), '');
  r       rooms%rowtype;
  m       room_members%rowtype;
  have_m  boolean;
  present boolean := false;
  seatn   int;
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  if not check_rate(uid, 'join_room', setting_int('rate_join_per_10min', 30), interval '10 minutes') then
    return rpc_fail('RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.');
  end if;
  if v_code !~ '^[A-Z0-9]{4,20}$' then
    return rpc_fail('ROOM_NOT_FOUND', 'Room not found. Check the code and try again.');
  end if;

  select * into r from rooms where code = v_code for update;
  if not found then
    return rpc_fail('ROOM_NOT_FOUND', 'Room not found. Check the code and try again.');
  end if;

  select * into m from room_members where room_id = r.id and user_id = uid;
  have_m := found;

  if have_m and m.status = 'removed' then
    return rpc_fail('REMOVED', 'The host removed you from this room.');
  end if;

  if r.status <> 'closed' and r.expires_at < now() then
    update rooms set status = 'closed', closed_at = now(), closed_reason = 'expired' where id = r.id;
    r.status := 'closed';
  end if;
  if r.status = 'closed' then
    return rpc_fail('ROOM_CLOSED', 'This room has been closed.');
  end if;

  if have_m and m.status = 'active' then
    select coalesce(s.last_seen, m.joined_at) >= now() - make_interval(secs => setting_int('reconnect_grace_seconds', 120))
      into present
      from (select 1) x left join room_member_seen s on s.member_id = m.id;
  end if;

  if have_m and m.status = 'active' and present then
    -- Refresh / retry / second tab: same membership, no new slot.
    perform touch_seen(m.id);
    perform bump_room_expiry(r.id);
    return jsonb_build_object('ok', true, 'rejoined', true, 'code', r.code, 'room_id', r.id,
                              'member_id', m.id, 'nickname', m.nickname);
  end if;

  if not have_m and r.locked then
    return rpc_fail('ROOM_LOCKED', 'The host has locked this room to new players.');
  end if;

  if room_occupancy(r.id, uid) >= r.capacity then
    return rpc_fail('ROOM_FULL',
      case when have_m then 'This room filled up while you were away.'
           else format('This room is full (%s of %s players).', r.capacity, r.capacity) end);
  end if;

  if have_m then
    -- Returning player (left, or silent for longer than the grace period):
    -- same row, same seat, same identity.
    begin
      update room_members
         set status = 'active', left_at = null
       where id = m.id;
    exception when unique_violation then
      -- someone else took this nickname while they were away
      if nick is null or lower(nick) = lower(m.nickname) then
        return rpc_fail('NICKNAME_TAKEN', 'Your old nickname is in use now. Enter a different nickname.');
      end if;
      begin
        update room_members set status = 'active', left_at = null, nickname = nick where id = m.id;
      exception when unique_violation then
        return rpc_fail('NICKNAME_TAKEN', 'That nickname is already taken in this room.');
      end;
    end;
    perform touch_seen(m.id);
    perform bump_room_expiry(r.id);
    return jsonb_build_object('ok', true, 'rejoined', true, 'code', r.code, 'room_id', r.id,
                              'member_id', m.id, 'nickname', coalesce(nick, m.nickname));
  end if;

  -- Brand new participant
  if nick is null or char_length(nick) > 30 then
    return rpc_fail('INVALID_NICKNAME', 'Choose a nickname between 1 and 30 characters.');
  end if;
  select coalesce(max(seat), 0) + 1 into seatn from room_members where room_id = r.id;
  begin
    insert into room_members (room_id, user_id, nickname, seat)
    values (r.id, uid, nick, seatn) returning * into m;
  exception when unique_violation then
    return rpc_fail('NICKNAME_TAKEN', 'That nickname is already taken in this room.');
  end;
  perform touch_seen(m.id);
  perform bump_room_expiry(r.id);
  return jsonb_build_object('ok', true, 'rejoined', false, 'code', r.code, 'room_id', r.id,
                            'member_id', m.id, 'nickname', m.nickname);
end $$;

-- 6.3 touch_member (heartbeat) ----------------------------------------------
-- Called every few seconds by an open tab. If the member had been silent past
-- the grace period it re-checks capacity (their slot may have been taken).
create or replace function touch_member(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  m     room_members%rowtype;
  r     rooms%rowtype;
  seen  timestamptz;
  grace int := setting_int('reconnect_grace_seconds', 120);
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  select * into m from room_members where room_id = p_room_id and user_id = uid;
  if not found then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if m.status = 'removed' then return rpc_fail('REMOVED', 'The host removed you from this room.'); end if;
  if m.status = 'left'    then return rpc_fail('LEFT', 'You left this room.'); end if;

  select last_seen into seen from room_member_seen where member_id = m.id;
  if coalesce(seen, m.joined_at) < now() - make_interval(secs => grace) then
    select * into r from rooms where id = p_room_id for update;
    if r.status = 'closed' then return rpc_fail('ROOM_CLOSED', 'This room has been closed.'); end if;
    if room_occupancy(p_room_id, uid) >= r.capacity then
      update room_members set status = 'left', left_at = now() where id = m.id;
      return rpc_fail('ROOM_FULL', 'This room filled up while you were away.');
    end if;
  else
    select * into r from rooms where id = p_room_id;
  end if;

  perform touch_seen(m.id);
  perform bump_room_expiry(p_room_id);
  return jsonb_build_object('ok', true, 'room_status', r.status, 'is_host', r.host_user = uid);
end $$;

-- 6.4 leave_room (intentional departure) ------------------------------------
create or replace function leave_room(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  r    rooms%rowtype;
  m    room_members%rowtype;
  newh uuid;
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  select * into r from rooms where id = p_room_id for update;
  if not found then return rpc_fail('ROOM_NOT_FOUND', 'Room not found.'); end if;
  select * into m from room_members where room_id = p_room_id and user_id = uid;
  if not found or m.status <> 'active' then
    return jsonb_build_object('ok', true, 'already', true);   -- idempotent
  end if;

  update room_members set status = 'left', left_at = now() where id = m.id;

  if r.host_user = uid then
    -- Host policy: an intentional host departure hands the room to the
    -- longest-standing member who is present now (else any active member).
    -- If nobody else is in the room it simply waits, and the host keeps it.
    select mm.user_id into newh
      from room_members mm
      left join room_member_seen s on s.member_id = mm.id
     where mm.room_id = r.id and mm.status = 'active'
     order by (coalesce(s.last_seen, mm.joined_at)
               >= now() - make_interval(secs => setting_int('reconnect_grace_seconds', 120))) desc,
              mm.seat
     limit 1;
    if newh is not null then
      update rooms set host_user = newh where id = r.id;
      insert into moderation_events (room_id, actor_user, action, detail)
      values (r.id, uid, 'host_transferred', jsonb_build_object('reason', 'host_left', 'to_user', newh));
    end if;
  end if;

  if r.status = 'playing' and r.current_player = m.seat then
    perform advance_turn(r.id, null);
  end if;

  return jsonb_build_object('ok', true);
end $$;

-- 6.5 Host controls ----------------------------------------------------------
create or replace function start_game(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  r    rooms%rowtype;
  hseat smallint;
  need int;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> uid then return rpc_fail('NOT_HOST', 'Only the host can start the game.'); end if;
  if r.status = 'closed' then return rpc_fail('ROOM_CLOSED', 'This room has been closed.'); end if;
  if r.status = 'playing' then return jsonb_build_object('ok', true, 'room', room_json(r)); end if;

  need := least(r.capacity, 2);
  if room_occupancy(r.id) < need then
    return rpc_fail('NOT_ENOUGH_PLAYERS',
      format('Waiting for at least %s players to be online.', need));
  end if;

  select seat into hseat from room_members where room_id = r.id and user_id = uid;
  update rooms
     set status = 'playing', started_at = now(), current_player = hseat,
         turn_no = turn_no + 1, current_question_id = null, current_question = null,
         used_question_ids = '{}'
   where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function set_room_mode(p_room_id uuid, p_mode text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> auth.uid() then return rpc_fail('NOT_HOST', 'Only the host can change the mode.'); end if;
  if p_mode is null or p_mode not in ('ONLINE', 'OFFLINE') then
    return rpc_fail('INVALID_MODE', 'Choose Online or Offline.');
  end if;
  if r.status <> 'waiting' then
    return rpc_fail('WRONG_STATE', 'The mode is fixed while a game is running. Return to the lobby first.');
  end if;
  update rooms set mode = p_mode where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function set_room_lock(p_room_id uuid, p_locked boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> auth.uid() then return rpc_fail('NOT_HOST', 'Only the host can lock the room.'); end if;
  update rooms set locked = coalesce(p_locked, false) where id = r.id returning * into r;
  insert into moderation_events (room_id, actor_user, action, detail)
  values (r.id, auth.uid(), case when r.locked then 'lock' else 'unlock' end, null);
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function reset_game(p_room_id uuid, p_mode text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> auth.uid() then return rpc_fail('NOT_HOST', 'Only the host can reset the game.'); end if;
  if r.status = 'closed' then return rpc_fail('ROOM_CLOSED', 'This room has been closed.'); end if;
  if p_mode is not null and p_mode not in ('ONLINE', 'OFFLINE') then
    return rpc_fail('INVALID_MODE', 'Choose Online or Offline.');
  end if;
  update rooms
     set status = 'waiting', current_question_id = null, current_question = null,
         used_question_ids = '{}', turn_no = turn_no + 1, started_at = null,
         mode = coalesce(p_mode, mode)
   where id = r.id returning * into r;
  insert into moderation_events (room_id, actor_user, action, detail)
  values (r.id, auth.uid(), 'reset', jsonb_build_object('mode', r.mode));
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function close_room(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r rooms%rowtype;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> auth.uid() then return rpc_fail('NOT_HOST', 'Only the host can close the room.'); end if;
  if r.status <> 'closed' then
    update rooms
       set status = 'closed', closed_at = now(), closed_reason = 'host',
           current_question_id = null, current_question = null
     where id = r.id returning * into r;
    insert into moderation_events (room_id, actor_user, action, detail)
    values (r.id, auth.uid(), 'close', null);
  end if;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function remove_member(p_room_id uuid, p_member_id uuid, p_lock boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   rooms%rowtype;
  t   room_members%rowtype;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> uid then return rpc_fail('NOT_HOST', 'Only the host can remove players.'); end if;

  select * into t from room_members where id = p_member_id and room_id = p_room_id;
  if not found or t.status = 'removed' then
    return rpc_fail('NOT_MEMBER', 'That player is not in this room.');
  end if;
  if t.user_id = uid then return rpc_fail('WRONG_STATE', 'You cannot remove yourself. Use Leave Room.'); end if;

  update room_members
     set status = 'removed', removed_at = now(), left_at = coalesce(left_at, now())
   where id = t.id;
  if coalesce(p_lock, false) then update rooms set locked = true where id = r.id; end if;
  insert into moderation_events (room_id, actor_user, target_member_id, action, detail)
  values (r.id, uid, t.id, 'remove', jsonb_build_object('nickname', t.nickname, 'locked', coalesce(p_lock, false)));

  if r.status = 'playing' and r.current_player = t.seat then
    perform advance_turn(r.id, uid);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function readmit_member(p_room_id uuid, p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r rooms%rowtype;
  t room_members%rowtype;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> auth.uid() then return rpc_fail('NOT_HOST', 'Only the host can allow a player back.'); end if;
  select * into t from room_members where id = p_member_id and room_id = p_room_id and status = 'removed';
  if not found then return rpc_fail('NOT_MEMBER', 'That player was not removed.'); end if;
  -- Becomes "left": they may rejoin with the code (subject to capacity/lock rules).
  update room_members set status = 'left', removed_at = null where id = t.id;
  insert into moderation_events (room_id, actor_user, target_member_id, action, detail)
  values (r.id, auth.uid(), t.id, 'readmit', jsonb_build_object('nickname', t.nickname));
  return jsonb_build_object('ok', true);
end $$;

-- Manual, guarded host takeover: only if the host has been silent for longer
-- than host_takeover_seconds, and only by the longest-standing present member.
create or replace function claim_host(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  r        rooms%rowtype;
  hseen    timestamptz;
  hactive  boolean;
  first_present uuid;
  wait_s   int := setting_int('host_takeover_seconds', 600);
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.status = 'closed' then return rpc_fail('ROOM_CLOSED', 'This room has been closed.'); end if;
  if r.host_user = uid then return jsonb_build_object('ok', true); end if;

  select (m.status = 'active'), coalesce(s.last_seen, m.joined_at)
    into hactive, hseen
    from room_members m left join room_member_seen s on s.member_id = m.id
   where m.room_id = r.id and m.user_id = r.host_user;
  if coalesce(hactive, false) and hseen > now() - make_interval(secs => wait_s) then
    return rpc_fail('HOST_PRESENT',
      format('The host can be replaced only after %s minutes offline.', greatest(wait_s / 60, 1)));
  end if;

  select mm.user_id into first_present
    from room_members mm left join room_member_seen s on s.member_id = mm.id
   where mm.room_id = r.id and mm.status = 'active' and mm.user_id <> r.host_user
     and coalesce(s.last_seen, mm.joined_at) >= now() - make_interval(secs => setting_int('reconnect_grace_seconds', 120))
   order by mm.seat limit 1;
  if first_present is distinct from uid then
    return rpc_fail('NOT_NEXT_HOST', 'The longest-standing player in the room can take over as host.');
  end if;

  update rooms set host_user = uid where id = r.id returning * into r;
  insert into moderation_events (room_id, actor_user, action, detail)
  values (r.id, uid, 'host_transferred', jsonb_build_object('reason', 'host_offline'));
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

-- 6.6 Gameplay ---------------------------------------------------------------
-- All three take the turn number the client believes is current. A delayed or
-- duplicate request carries an old number and is ignored, so one turn can never
-- be advanced twice.
create or replace function draw_question(p_room_id uuid, p_kind text, p_turn_no int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   rooms%rowtype;
  m   room_members%rowtype;
  q   record;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  select * into m from room_members where room_id = r.id and user_id = uid;
  if r.status <> 'playing' then return rpc_fail('WRONG_STATE', 'The game is not running.'); end if;
  if p_kind is null or p_kind not in ('TRUTH', 'DARE') then
    return rpc_fail('INVALID_KIND', 'Choose truth or dare.');
  end if;
  if r.turn_no is distinct from p_turn_no then
    return jsonb_build_object('ok', false, 'error', 'STALE_TURN', 'message', 'The turn changed.', 'room', room_json(r));
  end if;
  if r.current_player <> m.seat then return rpc_fail('NOT_YOUR_TURN', 'It is not your turn.'); end if;
  if r.current_question is not null then
    return jsonb_build_object('ok', true, 'room', room_json(r));   -- already drawn
  end if;

  select * into q from pick_question(r, p_kind);
  if q.id is null then
    return rpc_fail('NO_QUESTIONS', 'No questions are available for this mode and intensity yet.');
  end if;

  update rooms
     set current_question_id = q.id,
         current_question = jsonb_build_object('id', q.id, 'kind', q.kind, 'category', q.category, 'body', q.body),
         used_question_ids = case when q.used_reset then array[q.id] else used_question_ids || q.id end
   where id = r.id returning * into r;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function skip_question(p_room_id uuid, p_turn_no int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   rooms%rowtype;
  m   room_members%rowtype;
  q   record;
  k   text;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  select * into m from room_members where room_id = r.id and user_id = uid;
  if r.status <> 'playing' then return rpc_fail('WRONG_STATE', 'The game is not running.'); end if;
  if r.turn_no is distinct from p_turn_no then
    return jsonb_build_object('ok', false, 'error', 'STALE_TURN', 'message', 'The turn changed.', 'room', room_json(r));
  end if;
  if r.current_player <> m.seat then return rpc_fail('NOT_YOUR_TURN', 'It is not your turn.'); end if;
  if r.current_question is null then return rpc_fail('WRONG_STATE', 'There is nothing to skip.'); end if;

  k := r.current_question ->> 'kind';
  select * into q from pick_question(r, k);
  insert into messages (room_id, player, nickname, body, kind, member_id)
  values (r.id, m.seat, m.nickname, format('%s skipped a %s.', m.nickname, lower(k)), 'system', m.id);

  if q.id is null then
    update rooms set current_question_id = null, current_question = null where id = r.id returning * into r;
  else
    update rooms
       set current_question_id = q.id,
           current_question = jsonb_build_object('id', q.id, 'kind', q.kind, 'category', q.category, 'body', q.body),
           used_question_ids = case when q.used_reset then array[q.id] else used_question_ids || q.id end
     where id = r.id returning * into r;
  end if;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

create or replace function next_turn(p_room_id uuid, p_turn_no int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  r    rooms%rowtype;
  m    room_members%rowtype;
  cur_present boolean;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  select * into m from room_members where room_id = r.id and user_id = uid;
  if r.status <> 'playing' then return rpc_fail('WRONG_STATE', 'The game is not running.'); end if;
  if r.turn_no is distinct from p_turn_no then
    return jsonb_build_object('ok', false, 'error', 'STALE_TURN', 'message', 'The turn changed.', 'room', room_json(r));
  end if;

  if r.current_player <> m.seat then
    -- Someone else may move the game along only if the current player is gone.
    select exists (
      select 1 from room_members cm left join room_member_seen s on s.member_id = cm.id
       where cm.room_id = r.id and cm.seat = r.current_player and cm.status = 'active'
         and coalesce(s.last_seen, cm.joined_at)
             >= now() - make_interval(secs => setting_int('reconnect_grace_seconds', 120)))
      into cur_present;
    if cur_present then return rpc_fail('NOT_YOUR_TURN', 'It is not your turn.'); end if;
  end if;

  perform advance_turn(r.id, uid);
  select * into r from rooms where id = r.id;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

-- 6.7 Chat -------------------------------------------------------------------
-- client_id makes a retry idempotent and lets the sender match its optimistic
-- bubble to the stored row (and to the Realtime copy) without duplicates.
create or replace function send_message(p_room_id uuid, p_body text, p_client_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  r    rooms%rowtype;
  m    room_members%rowtype;
  body text := btrim(coalesce(p_body, ''));
  row_ messages%rowtype;
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  select * into m from room_members where room_id = p_room_id and user_id = uid;
  if not found or m.status <> 'active' then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  select * into r from rooms where id = p_room_id;
  if r.status = 'closed' then return rpc_fail('ROOM_CLOSED', 'This room has been closed.'); end if;
  if body = '' then return rpc_fail('EMPTY_MESSAGE', 'Write something first.'); end if;
  if char_length(body) > 500 then return rpc_fail('TOO_LONG', 'Messages can be up to 500 characters.'); end if;

  if p_client_id is not null then
    select * into row_ from messages where room_id = p_room_id and client_id = p_client_id;
    if found then return jsonb_build_object('ok', true, 'message', to_jsonb(row_)); end if;
  end if;

  if (select count(*) from messages
       where member_id = m.id and created_at > now() - interval '1 minute')
     >= setting_int('rate_messages_per_minute', 40) then
    return rpc_fail('RATE_LIMITED', 'You are sending messages very quickly. Slow down a little.');
  end if;

  insert into messages (room_id, player, nickname, body, kind, member_id, client_id)
  values (p_room_id, m.seat, m.nickname, body, 'chat', m.id, p_client_id)
  on conflict (room_id, client_id) where client_id is not null do nothing
  returning * into row_;
  if row_.id is null then
    select * into row_ from messages where room_id = p_room_id and client_id = p_client_id;
  end if;
  return jsonb_build_object('ok', true, 'message', to_jsonb(row_));
end $$;

-- 6.8 Reads used for load / resync ------------------------------------------
create or replace function get_room_snapshot(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid   uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  r     rooms%rowtype;
  m     room_members%rowtype;
  mems  jsonb;
  gone  jsonb := '[]'::jsonb;
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  select * into r from rooms where code = v_code;
  if not found then return rpc_fail('ROOM_NOT_FOUND', 'Room not found.'); end if;
  select * into m from room_members where room_id = r.id and user_id = uid;
  if not found then return rpc_fail('NOT_MEMBER', 'You have not joined this room.'); end if;
  if m.status = 'removed' then return rpc_fail('REMOVED', 'The host removed you from this room.'); end if;
  if m.status = 'left'    then return rpc_fail('LEFT', 'You left this room.'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', mm.id, 'user_id', mm.user_id, 'nickname', mm.nickname, 'seat', mm.seat,
           'is_host', mm.user_id = r.host_user,
           'seen_ago', greatest(extract(epoch from now() - coalesce(s.last_seen, mm.joined_at))::int, 0)
         ) order by mm.seat), '[]'::jsonb)
    into mems
    from room_members mm left join room_member_seen s on s.member_id = mm.id
   where mm.room_id = r.id and mm.status = 'active';

  if r.host_user = uid then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nickname', nickname) order by seat), '[]'::jsonb)
      into gone from room_members where room_id = r.id and status = 'removed';
  end if;

  return jsonb_build_object(
    'ok', true,
    'room', room_json(r),
    'me', jsonb_build_object('member_id', m.id, 'nickname', m.nickname, 'seat', m.seat,
                              'is_host', r.host_user = uid),
    'members', mems,
    'removed', gone,
    'config', jsonb_build_object(
        'grace_seconds', setting_int('reconnect_grace_seconds', 120),
        'host_takeover_seconds', setting_int('host_takeover_seconds', 600)));
end $$;

create or replace function my_active_rooms()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.seen desc), '[]'::jsonb)
    from (
      select r.code, m.nickname, r.mode, r.status, r.capacity,
             coalesce(s.last_seen, m.joined_at) as seen
        from room_members m
        join rooms r on r.id = m.room_id
        left join room_member_seen s on s.member_id = m.id
       where m.user_id = auth.uid() and m.status = 'active'
         and r.status <> 'closed' and r.expires_at > now()
       order by coalesce(s.last_seen, m.joined_at) desc
       limit 3
    ) x
$$;

-- Housekeeping for a scheduler (pg_cron / Edge Function with the service role).
-- Marks idle rooms closed; it does not delete anything.
create or replace function close_expired_rooms()
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update rooms
     set status = 'closed', closed_at = now(), closed_reason = 'expired'
   where status <> 'closed' and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Function privileges: nothing is callable by anonymous visitors; only the
--    API functions are callable by signed-in (including anonymous-auth) users.
-- ---------------------------------------------------------------------------
revoke all on function
  setting_int(text, int), rpc_fail(text, text), is_room_member(uuid),
  can_access_room_topic(text), check_rate(uuid, text, int, interval),
  gen_room_code(int), room_occupancy(uuid, uuid), room_json(rooms),
  touch_seen(uuid), bump_room_expiry(uuid), advance_turn(uuid, uuid),
  pick_question(rooms, text), set_updated_at(), close_expired_rooms()
  from public, anon, authenticated;

revoke all on function
  create_room(text, text, text, int), join_room(text, text), touch_member(uuid),
  leave_room(uuid), start_game(uuid), set_room_mode(uuid, text),
  set_room_lock(uuid, boolean), reset_game(uuid, text), close_room(uuid),
  remove_member(uuid, uuid, boolean), readmit_member(uuid, uuid), claim_host(uuid),
  draw_question(uuid, text, int), skip_question(uuid, int), next_turn(uuid, int),
  send_message(uuid, text, uuid), get_room_snapshot(text), my_active_rooms()
  from public, anon;

grant execute on function
  create_room(text, text, text, int), join_room(text, text), touch_member(uuid),
  leave_room(uuid), start_game(uuid), set_room_mode(uuid, text),
  set_room_lock(uuid, boolean), reset_game(uuid, text), close_room(uuid),
  remove_member(uuid, uuid, boolean), readmit_member(uuid, uuid), claim_host(uuid),
  draw_question(uuid, text, int), skip_question(uuid, int), next_turn(uuid, int),
  send_message(uuid, text, uuid), get_room_snapshot(text), my_active_rooms()
  to authenticated;

-- RLS policies call these as the signed-in user, so they need EXECUTE too.
grant execute on function is_room_member(uuid), can_access_room_topic(text) to authenticated;
