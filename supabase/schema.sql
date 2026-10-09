-- BETWEEN realtime foundation
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_name text not null,
  guest_name text,
  intensity text not null default 'PLAYFUL',
  status text not null default 'waiting',
  current_player smallint not null default 1,
  current_question_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references rooms(id) on delete cascade,
  player smallint not null,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('TRUTH','DARE')),
  intensity text not null,
  body text not null,
  active boolean not null default true
);

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table messages;

insert into questions(kind,intensity,body) values
('TRUTH','PLAYFUL','What is the most embarrassing thing you did at school?'),
('TRUTH','PERSONAL','What is something you rarely tell people about yourself?'),
('TRUTH','FLIRTY','What was your first impression of me?'),
('DARE','PLAYFUL','Send the other player your funniest selfie.'),
('DARE','PERSONAL','Let the other player choose your next profile picture for 10 minutes.'),
('DARE','FLIRTY','Give the other player a compliment you actually mean.'),
('TRUTH','WILD','What is the boldest thing you have ever done on impulse?'),
('DARE','WILD','Let the other player ask you one question you must answer honestly.');