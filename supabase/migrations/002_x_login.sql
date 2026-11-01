-- KnightVerse 002: "Connect with X" (OAuth 2.0) so players prove they own the X account,
-- plus a small settings table the admin panel can change (admin password hash, X Client ID).
-- Same rule as before: row level security on, no public policies; only the api function reads these.

create table if not exists public.kv_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.kv_settings enable row level security;

-- the X account id is the proof; the handle is only for display
alter table public.players add column if not exists x_id text;
alter table public.players add column if not exists x_verified_at timestamptz;
create unique index if not exists players_x_id_key on public.players (x_id) where x_id is not null;

-- usernames typed in by hand were never proven, so those players connect again with X
update public.players set x_handle = null where x_id is null and x_handle is not null;

-- every X account ever connected stays tied to that one player,
-- so one X account can't be passed around to farm points on several players
create table if not exists public.x_accounts (
  x_id text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  username text,
  linked_at timestamptz not null default now()
);
create index if not exists x_accounts_player on public.x_accounts (player_id);
alter table public.x_accounts enable row level security;

-- short-lived login attempts (state + PKCE verifier), deleted when used or after 15 minutes
create table if not exists public.x_logins (
  state text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  verifier text not null,
  created_at timestamptz not null default now()
);
create index if not exists x_logins_player on public.x_logins (player_id);
alter table public.x_logins enable row level security;
