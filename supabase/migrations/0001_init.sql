-- NMD — Nunca Mais é Domingo
-- Initial schema

create type side as enum ('L', 'R');
create type event_status as enum ('registration', 'pairs_published', 'live', 'finished');

-- Players (members and wild cards). Linked to auth users by email on first login.
create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  email text unique,
  name text not null unique,
  aliases text[] not null default '{}',
  side side not null,
  is_wild_card boolean not null default false,
  is_admin boolean not null default false,
  birth_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,               -- e.g. "Inverno 2026/27"
  kind text not null check (kind in ('inverno', 'verao', 'ferias')),
  starts_on date not null,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_current_season on seasons (is_current) where is_current;

create table events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id) on delete cascade,
  date date not null,
  status event_status not null default 'registration',
  format_id text,                           -- rr4, rr6, g8, g10, g12 (+ "-direct")
  pairing_mode text not null default 'ranking' check (pairing_mode in ('ranking', 'weighted', 'draw')),
  courts int not null default 2,
  counts_for_ranking boolean not null default true,
  notes text,
  pairing_log jsonb,
  created_at timestamptz not null default now(),
  unique (season_id, date)
);

create table registrations (
  event_id uuid not null references events (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  joker boolean not null default false,
  volunteer_switch boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table fixed_pair_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  player_a uuid not null references players (id) on delete cascade,
  player_b uuid not null references players (id) on delete cascade,
  reason text not null check (reason in ('winners', 'bombos', 'training', 'admin'))
);

create table pairs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  left_player uuid not null references players (id),
  right_player uuid not null references players (id),
  reason text not null,
  group_name text,
  seed int,
  final_position int
);
create index on pairs (event_id);

create table matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  stage text not null check (stage in ('group', 'knockout')),
  group_name text,
  round int,
  knockout_id text,
  label text,
  pair_a uuid references pairs (id) on delete cascade,
  pair_b uuid references pairs (id) on delete cascade,
  score_a int check (score_a between 0 and 6),
  score_b int check (score_b between 0 and 6),
  updated_by uuid references players (id),
  updated_at timestamptz not null default now()
);
create index on matches (event_id);

-- Ranking points per player per event (placement, repasto-only bonus, admin adjustments)
create table event_points (
  event_id uuid not null references events (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  kind text not null check (kind in ('placement', 'repasto_only', 'adjustment')),
  base numeric not null,
  points numeric not null,
  joker boolean not null default false,
  note text,
  primary key (event_id, player_id, kind)
);

-- Who brought the food (Regulamento ponto 7)
create table repasto (
  event_id uuid not null references events (id) on delete cascade,
  player_id uuid not null references players (id) on delete cascade,
  primary key (event_id, player_id)
);

-- Finos (beer, 20cl) — drinks and fines
create table finos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  event_id uuid references events (id) on delete set null,
  quantity int not null check (quantity > 0),
  kind text not null default 'drink' check (kind in ('drink', 'fine')),
  note text,
  created_by uuid references players (id),
  created_at timestamptz not null default now()
);

-- Treasury (Tesouraria)
create table ledger (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind in ('credit', 'debit')),
  player_id uuid references players (id) on delete set null,
  counterparty text,
  amount numeric(10, 2) not null,
  reason text,
  pending boolean not null default false,
  created_by uuid references players (id),
  created_at timestamptz not null default now()
);

-- Hall of fame (Prémios NMD)
create table awards (
  id uuid primary key default gen_random_uuid(),
  season_name text not null,
  award text not null,
  winner text
);

-- ---------------------------------------------------------------- helpers

create or replace function current_player_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from players where user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from players where user_id = auth.uid()), false)
$$;

-- Link a new auth user to the player with the same email
create or replace function link_player_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update players set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function link_player_on_signup();

-- Season ranking
create or replace view season_ranking with (security_invoker = true) as
select
  e.season_id,
  p.id as player_id,
  p.name,
  p.side,
  p.is_wild_card,
  coalesce(sum(ep.points), 0) as points,
  count(distinct ep.event_id) filter (where ep.kind = 'placement') as events_played,
  count(distinct pr.event_id) filter (where pr.final_position = 1) as wins,
  count(distinct pr.event_id) filter (where pr.final_position = ev_size.n) as bombos,
  bool_or(ep.joker) as joker_used
from players p
join event_points ep on ep.player_id = p.id
join events e on e.id = ep.event_id and e.counts_for_ranking
left join pairs pr on pr.event_id = e.id and (pr.left_player = p.id or pr.right_player = p.id)
left join lateral (select count(*) as n from pairs x where x.event_id = e.id) ev_size on true
group by e.season_id, p.id;

-- ---------------------------------------------------------------- RLS
-- Only emails registered by an admin in players can see anything.

alter table players enable row level security;
alter table seasons enable row level security;
alter table events enable row level security;
alter table registrations enable row level security;
alter table fixed_pair_requests enable row level security;
alter table pairs enable row level security;
alter table matches enable row level security;
alter table event_points enable row level security;
alter table repasto enable row level security;
alter table finos enable row level security;
alter table ledger enable row level security;
alter table awards enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players','seasons','events','registrations','fixed_pair_requests',
                           'pairs','matches','event_points','repasto','finos','ledger','awards'] loop
    execute format('create policy "members read" on %I for select to authenticated using (current_player_id() is not null)', t);
    execute format('create policy "admins write" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Members sign themselves up / out while registration is open
create policy "self register" on registrations for insert to authenticated
  with check (player_id = current_player_id()
              and exists (select 1 from events where id = event_id and status = 'registration'));
create policy "self unregister" on registrations for delete to authenticated
  using (player_id = current_player_id()
         and exists (select 1 from events where id = event_id and status = 'registration'));
create policy "self joker" on registrations for update to authenticated
  using (player_id = current_player_id()) with check (player_id = current_player_id());

-- Anyone can log finos for themselves
create policy "self finos" on finos for insert to authenticated
  with check (player_id = current_player_id() and kind = 'drink');

-- Live results
alter publication supabase_realtime add table matches;
