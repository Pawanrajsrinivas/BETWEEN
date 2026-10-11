-- ============================================================================
-- BETWEEN — migration 002: AI deck mode, player gender, synchronized timers,
-- scores, special rounds, and persisted AI card synchronization.
--
-- ADDITIVE AND IDEMPOTENT. Safe to run on top of 001_multiplayer.sql.
-- ============================================================================

alter table rooms
  add column if not exists deck_mode       text     not null default 'builtin',
  add column if not exists ai_model        text     not null default 'openrouter/free',
  add column if not exists timer_seconds   integer  not null default 0,
  add column if not exists special_rounds  boolean  not null default true,
  add column if not exists scores          jsonb    not null default '{}'::jsonb,
  add column if not exists completed_turns integer[] not null default '{}';

alter table room_members
  add column if not exists gender          text;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'rooms_deck_mode_chk') then
    alter table rooms drop constraint rooms_deck_mode_chk;
  end if;
  alter table rooms add constraint rooms_deck_mode_chk
    check (deck_mode in ('DECK', 'AI', 'builtin', 'ai', 'normal'));

  if not exists (select 1 from pg_constraint where conname = 'rooms_timer_seconds_chk') then
    alter table rooms add constraint rooms_timer_seconds_chk check (timer_seconds in (0, 15, 20, 30, 45, 60));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'room_members_gender_chk') then
    alter table room_members add constraint room_members_gender_chk
      check (gender is null or char_length(gender) between 1 and 40);
  end if;
end $$;

-- Update room_json helper to include new synchronized fields
create or replace function room_json(r rooms)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', r.id, 'code', r.code, 'mode', r.mode, 'intensity', r.intensity,
    'capacity', r.capacity, 'status', r.status, 'locked', r.locked,
    'host_user', r.host_user, 'current_player', r.current_player,
    'turn_no', r.turn_no, 'current_question', r.current_question,
    'deck_mode', case when lower(coalesce(r.deck_mode, '')) = 'ai' then 'ai' else 'builtin' end,
    'ai_model', r.ai_model,
    'timer_seconds', r.timer_seconds, 'special_rounds', r.special_rounds,
    'scores', r.scores, 'completed_turns', r.completed_turns,
    'closed_reason', r.closed_reason, 'created_at', r.created_at,
    'expires_at', r.expires_at, 'updated_at', r.updated_at)
$$;

-- Update get_room_snapshot to include member gender
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
           'id', mm.id, 'user_id', mm.user_id, 'nickname', mm.nickname,
           'gender', mm.gender, 'seat', mm.seat,
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
    'me', jsonb_build_object('member_id', m.id, 'nickname', m.nickname, 'gender', m.gender,
                             'seat', m.seat, 'is_host', r.host_user = uid),
    'members', mems,
    'removed', gone,
    'config', jsonb_build_object(
        'grace_seconds', setting_int('reconnect_grace_seconds', 120),
        'host_takeover_seconds', setting_int('host_takeover_seconds', 600)));
end $$;

-- Authenticated participant updates their own gender profile in a room
create or replace function set_member_profile(
  p_room_id uuid,
  p_gender text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m   room_members%rowtype;
  g   text := nullif(regexp_replace(btrim(coalesce(p_gender, '')), '\s+', ' ', 'g'), '');
begin
  if uid is null then
    return rpc_fail('NOT_AUTHENTICATED', 'Please reload the page and try again.');
  end if;
  select * into m from room_members where room_id = p_room_id and user_id = uid and status = 'active';
  if not found then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if g is not null and char_length(g) > 40 then
    g := left(g, 40);
  end if;

  update room_members
     set gender = coalesce(g, gender)
   where id = m.id
   returning * into m;

  return jsonb_build_object('ok', true, 'member_id', m.id, 'gender', m.gender);
end $$;

-- Host-only RPC to update deck/AI mode, AI model, intensity, timer, and special rounds
create or replace function set_room_settings(
  p_room_id uuid,
  p_deck_mode text default null,
  p_ai_model text default null,
  p_intensity text default null,
  p_timer_seconds int default null,
  p_special_rounds boolean default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   rooms%rowtype;
  dm  text := null;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  if r.host_user <> uid then
    return rpc_fail('NOT_HOST', 'Only the host can change room settings.');
  end if;
  if r.status = 'closed' then
    return rpc_fail('ROOM_CLOSED', 'This room has been closed.');
  end if;

  if p_deck_mode is not null then
    if lower(btrim(p_deck_mode)) in ('ai', 'ai_generator') then
      dm := 'AI';
    elsif lower(btrim(p_deck_mode)) in ('deck', 'builtin', 'normal') then
      dm := 'DECK';
    else
      return rpc_fail('INVALID_DECK_MODE', 'Choose Built-in Deck or AI Generator.');
    end if;
  end if;

  if p_intensity is not null and p_intensity not in ('PLAYFUL','PERSONAL','FLIRTY','WILD','AFTER DARK') then
    return rpc_fail('INVALID_INTENSITY', 'Choose a valid theme.');
  end if;
  if p_timer_seconds is not null and p_timer_seconds not in (0, 15, 20, 30, 45, 60) then
    return rpc_fail('INVALID_TIMER', 'Choose a valid timer duration.');
  end if;

  update rooms
     set deck_mode      = coalesce(dm, deck_mode),
         ai_model       = coalesce(nullif(btrim(p_ai_model), ''), ai_model),
         intensity      = coalesce(p_intensity, intensity),
         timer_seconds  = coalesce(p_timer_seconds, timer_seconds),
         special_rounds = coalesce(p_special_rounds, special_rounds)
   where id = r.id
   returning * into r;

  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

-- Authorized turn player or host persists an AI-generated (or replacement) card
create or replace function set_ai_question(
  p_room_id uuid,
  p_turn_no int,
  p_question jsonb,
  p_is_skip boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r   rooms%rowtype;
  m   room_members%rowtype;
  k   text;
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  select * into m from room_members where room_id = r.id and user_id = uid;
  if r.status <> 'playing' then
    return rpc_fail('WRONG_STATE', 'The game is not running.');
  end if;
  if r.turn_no is distinct from p_turn_no then
    return jsonb_build_object('ok', false, 'error', 'STALE_TURN', 'message', 'The turn changed.', 'room', room_json(r));
  end if;
  if r.current_player <> m.seat and r.host_user <> uid then
    return rpc_fail('NOT_YOUR_TURN', 'It is not your turn.');
  end if;
  if p_question is null or coalesce(btrim(p_question ->> 'body'), '') = '' then
    return rpc_fail('INVALID_QUESTION', 'Card prompt cannot be empty.');
  end if;

  k := upper(coalesce(p_question ->> 'kind', 'TRUTH'));
  if k not in ('TRUTH', 'DARE') then k := 'TRUTH'; end if;

  if coalesce(p_is_skip, false) then
    insert into messages (room_id, player, nickname, body, kind, member_id)
    values (r.id, m.seat, m.nickname, format('%s skipped a %s.', m.nickname, lower(k)), 'system', m.id);
  end if;

  update rooms
     set current_question_id = null,
         current_question = p_question || jsonb_build_object(
           'kind', k,
           'turn_no', r.turn_no,
           'issued_at', now()
         )
   where id = r.id
   returning * into r;

  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

-- Complete the current turn and award points atomically once per turn_no
create or replace function complete_turn_score(
  p_room_id uuid,
  p_turn_no int,
  p_points int default 1
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  r    rooms%rowtype;
  m    room_members%rowtype;
  seat_key text;
  cur_score int;
  pts int := greatest(least(coalesce(p_points, 0), 5), 0);
begin
  select * into r from rooms where id = p_room_id for update;
  if not found or not is_room_member(p_room_id) then
    return rpc_fail('NOT_MEMBER', 'You are not in this room.');
  end if;
  select * into m from room_members where room_id = r.id and user_id = uid;
  if r.status <> 'playing' then
    return rpc_fail('WRONG_STATE', 'The game is not running.');
  end if;
  if r.turn_no is distinct from p_turn_no then
    return jsonb_build_object('ok', false, 'error', 'STALE_TURN', 'message', 'The turn changed.', 'room', room_json(r));
  end if;
  if r.current_player <> m.seat and r.host_user <> uid then
    return rpc_fail('NOT_YOUR_TURN', 'It is not your turn.');
  end if;

  if not (r.turn_no = any (r.completed_turns)) and pts > 0 then
    seat_key := r.current_player::text;
    cur_score := coalesce((r.scores ->> seat_key)::int, 0);
    update rooms
       set scores = jsonb_set(coalesce(scores, '{}'::jsonb), array[seat_key], to_jsonb(cur_score + pts)),
           completed_turns = array_append(completed_turns, r.turn_no)
     where id = r.id;
  end if;

  perform advance_turn(r.id, uid);
  select * into r from rooms where id = r.id;
  return jsonb_build_object('ok', true, 'room', room_json(r));
end $$;

revoke all on function
  set_member_profile(uuid, text),
  set_room_settings(uuid, text, text, text, int, boolean),
  set_ai_question(uuid, int, jsonb, boolean),
  complete_turn_score(uuid, int, int)
  from public, anon;

grant execute on function
  set_member_profile(uuid, text),
  set_room_settings(uuid, text, text, text, int, boolean),
  set_ai_question(uuid, int, jsonb, boolean),
  complete_turn_score(uuid, int, int)
  to authenticated;
