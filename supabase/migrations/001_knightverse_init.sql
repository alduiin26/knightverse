-- KnightVerse: players, arena battles, daily hero uses, InfoFi quests and post reviews.
-- All access goes through the "api" edge function (server key). Row level security is
-- switched on with no public policies, so the public site key cannot read or write tables.

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  nickname text not null,
  x_handle text,
  game_points integer not null default 0,
  infofi_points integer not null default 0,
  wins integer not null default 0,
  battles integer not null default 0,
  ip_hash text,
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index if not exists players_nickname_key on public.players (lower(nickname));
create unique index if not exists players_x_key on public.players (lower(x_handle)) where x_handle is not null;
create index if not exists players_game_rank on public.players (game_points desc, created_at asc) where not banned;
create index if not exists players_infofi_rank on public.players (infofi_points desc, created_at asc) where not banned;
create index if not exists players_ip on public.players (ip_hash, created_at);

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  mode text not null check (mode in ('pvp', 'boss')),
  boss_id text,
  team text[] not null,
  enemy text[] not null default '{}',
  rival text,
  seed bigint not null,
  day date not null default ((now() at time zone 'utc')::date),
  status text not null default 'started' check (status in ('started', 'won', 'lost', 'void')),
  points integer not null default 0,
  turns integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists battles_player_day on public.battles (player_id, day);

-- how many battles each hero fought today (3 per hero per day)
create table if not exists public.hero_uses (
  player_id uuid not null references public.players(id) on delete cascade,
  day date not null,
  nft_id text not null,
  uses integer not null default 0,
  primary key (player_id, day, nft_id)
);

-- the three daily X tasks; the admin panel replaces the post link every day (round goes up)
create table if not exists public.daily_tasks (
  kind text primary key check (kind in ('like', 'retweet', 'reply')),
  tweet_url text,
  tweet_id text,
  round integer not null default 0,
  points integer not null,
  updated_at timestamptz not null default now()
);
insert into public.daily_tasks (kind, points) values ('like', 10), ('retweet', 15), ('reply', 15)
on conflict (kind) do nothing;

create table if not exists public.task_claims (
  player_id uuid not null references public.players(id) on delete cascade,
  task text not null,
  round integer not null default 0,
  started_at timestamptz not null default now(),
  claimed_at timestamptz,
  points integer not null default 0,
  primary key (player_id, task, round)
);

create table if not exists public.post_submissions (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  url text not null,
  tweet_id text not null unique,
  day date not null default ((now() at time zone 'utc')::date),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points integer not null default 0,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index if not exists post_one_per_day on public.post_submissions (player_id, day) where status <> 'rejected';
create index if not exists post_status on public.post_submissions (status, created_at);

alter table public.players enable row level security;
alter table public.battles enable row level security;
alter table public.hero_uses enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.task_claims enable row level security;
alter table public.post_submissions enable row level security;

-- ---------------------------------------------------------------- start a battle (checks + uses one fight per hero)
create or replace function public.kv_start_battle(
  p_player uuid, p_mode text, p_boss text, p_team text[], p_enemy text[], p_rival text, p_seed bigint, p_limit integer
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  d date := (now() at time zone 'utc')::date;
  n text;
  u integer;
  bid uuid;
begin
  perform 1 from players where id = p_player for update;
  foreach n in array p_team loop
    select uses into u from hero_uses where player_id = p_player and day = d and nft_id = n;
    if coalesce(u, 0) >= p_limit then
      raise exception 'no_uses:%', n;
    end if;
  end loop;
  foreach n in array p_team loop
    insert into hero_uses (player_id, day, nft_id, uses) values (p_player, d, n, 1)
    on conflict (player_id, day, nft_id) do update set uses = hero_uses.uses + 1;
  end loop;
  insert into battles (player_id, mode, boss_id, team, enemy, rival, seed, day)
  values (p_player, p_mode, p_boss, p_team, coalesce(p_enemy, '{}'), p_rival, p_seed, d)
  returning id into bid;
  return bid;
end;
$$;

-- ---------------------------------------------------------------- finish a battle and add the points
create or replace function public.kv_finish_battle(p_battle uuid, p_player uuid, p_win boolean, p_points integer, p_turns integer)
returns table (game_points integer, wins integer, battles integer)
language plpgsql
set search_path = public
as $$
begin
  update battles b set status = case when p_win then 'won' else 'lost' end, points = p_points, turns = p_turns, finished_at = now()
  where b.id = p_battle and b.player_id = p_player and b.status = 'started';
  if not found then
    raise exception 'battle_closed';
  end if;
  return query
  update players p set game_points = p.game_points + p_points, wins = p.wins + (case when p_win then 1 else 0 end), battles = p.battles + 1, last_seen = now()
  where p.id = p_player
  returning p.game_points, p.wins, p.battles;
end;
$$;

-- ---------------------------------------------------------------- claim an X task after the waiting time
create or replace function public.kv_claim_task(p_player uuid, p_task text, p_round integer, p_points integer, p_wait integer)
returns table (status text, infofi_points integer, wait_left integer)
language plpgsql
set search_path = public
as $$
declare
  c record;
  total integer;
begin
  select * into c from task_claims where player_id = p_player and task = p_task and round = p_round for update;
  if not found then
    return query select 'not_started'::text, null::integer, null::integer; return;
  end if;
  if c.claimed_at is not null then
    return query select 'already_done'::text, null::integer, null::integer; return;
  end if;
  if c.started_at > now() - make_interval(secs => p_wait) then
    return query select 'too_early'::text, null::integer, ceil(extract(epoch from (c.started_at + make_interval(secs => p_wait) - now())))::integer; return;
  end if;
  update task_claims set claimed_at = now(), points = p_points where player_id = p_player and task = p_task and round = p_round;
  update players set infofi_points = players.infofi_points + p_points, last_seen = now() where id = p_player returning players.infofi_points into total;
  return query select 'ok'::text, total, 0;
end;
$$;

-- ---------------------------------------------------------------- admin: approve / reject a submitted post
create or replace function public.kv_review_post(p_id bigint, p_approve boolean, p_points integer)
returns table (status text, player_id uuid)
language plpgsql
set search_path = public
as $$
declare
  s record;
begin
  select * into s from post_submissions where id = p_id for update;
  if not found or s.status <> 'pending' then
    return query select 'not_pending'::text, null::uuid; return;
  end if;
  update post_submissions set status = case when p_approve then 'approved' else 'rejected' end,
    points = case when p_approve then p_points else 0 end, reviewed_at = now()
  where id = p_id;
  if p_approve then
    update players set infofi_points = players.infofi_points + p_points where id = s.player_id;
  end if;
  return query select (case when p_approve then 'approved' else 'rejected' end)::text, s.player_id;
end;
$$;

revoke all on function public.kv_start_battle(uuid, text, text, text[], text[], text, bigint, integer) from public;
revoke all on function public.kv_finish_battle(uuid, uuid, boolean, integer, integer) from public;
revoke all on function public.kv_claim_task(uuid, text, integer, integer, integer) from public;
revoke all on function public.kv_review_post(bigint, boolean, integer) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.kv_start_battle(uuid, text, text, text[], text[], text, bigint, integer) from anon, authenticated';
    execute 'revoke all on function public.kv_finish_battle(uuid, uuid, boolean, integer, integer) from anon, authenticated';
    execute 'revoke all on function public.kv_claim_task(uuid, text, integer, integer, integer) from anon, authenticated';
    execute 'revoke all on function public.kv_review_post(bigint, boolean, integer) from anon, authenticated';
  end if;
end $$;
