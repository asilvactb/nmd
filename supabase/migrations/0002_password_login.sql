-- Email + password accounts, validated by the admins.
-- Anyone can create an account (no emails are sent), but it sees nothing until an admin
-- approves the request and links the account to a player.

create table signup_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  player_id uuid references players (id) on delete cascade, -- existing player they say they are
  new_name text,                                            -- or a new player
  new_side side,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  check (player_id is not null or (new_name is not null and new_side is not null))
);
alter table signup_requests enable row level security;

create policy "own request read" on signup_requests for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "own request create" on signup_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "own request update" on signup_requests for update to authenticated
  using (user_id = auth.uid() and status <> 'approved')
  with check (user_id = auth.uid() and status = 'pending');
create policy "admins manage requests" on signup_requests for all to authenticated
  using (is_admin()) with check (is_admin());

-- Names of players without an account, for the sign-up form
create or replace function unclaimed_players()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from players where active and user_id is null order by name
$$;
grant execute on function unclaimed_players() to anon, authenticated;

-- Admin approves: link the account to the chosen (or a new) player
create or replace function approve_signup(req uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r signup_requests;
  pid uuid;
begin
  if not is_admin() then raise exception 'Só para admins.'; end if;
  select * into r from signup_requests where user_id = req;
  if r is null then raise exception 'Pedido não encontrado.'; end if;

  if r.player_id is not null then
    update players set user_id = r.user_id, email = r.email
    where id = r.player_id and user_id is null
    returning id into pid;
    if pid is null then raise exception 'Esse jogador já tem conta.'; end if;
  else
    insert into players (name, side, email, user_id)
    values (r.new_name, r.new_side, r.email, r.user_id)
    returning id into pid;
  end if;

  update signup_requests set status = 'approved' where user_id = req;
  return pid;
end $$;
grant execute on function approve_signup(uuid) to authenticated;

-- Accounts are now linked only by approve_signup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists link_player_on_signup();

-- ---------------------------------------------------------------- profile photos

alter table players add column avatar_path text;
alter table signup_requests add column avatar_path text not null default '';

-- Public bucket: photos are shown across the app
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Each account writes only inside its own folder: avatars/<user id>/...
create policy "avatar upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Players change their own photo
create or replace function set_my_avatar(path text) returns void
language sql security definer set search_path = public as $$
  update players set avatar_path = path where user_id = auth.uid()
$$;
grant execute on function set_my_avatar(text) to authenticated;

-- Approval also carries the photo over
create or replace function approve_signup(req uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r signup_requests;
  pid uuid;
begin
  if not is_admin() then raise exception 'Só para admins.'; end if;
  select * into r from signup_requests where user_id = req;
  if r is null then raise exception 'Pedido não encontrado.'; end if;

  if r.player_id is not null then
    update players set user_id = r.user_id, email = r.email, avatar_path = nullif(r.avatar_path, '')
    where id = r.player_id and user_id is null
    returning id into pid;
    if pid is null then raise exception 'Esse jogador já tem conta.'; end if;
  else
    insert into players (name, side, email, user_id, avatar_path)
    values (r.new_name, r.new_side, r.email, r.user_id, nullif(r.avatar_path, ''))
    returning id into pid;
  end if;

  update signup_requests set status = 'approved' where user_id = req;
  return pid;
end $$;

-- The ranking view exposes the photo
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
  bool_or(ep.joker) as joker_used,
  p.avatar_path
from players p
join event_points ep on ep.player_id = p.id
join events e on e.id = ep.event_id and e.counts_for_ranking
left join pairs pr on pr.event_id = e.id and (pr.left_player = p.id or pr.right_player = p.id)
left join lateral (select count(*) as n from pairs x where x.event_id = e.id) ev_size on true
group by e.season_id, p.id;

-- Pre-registered emails (set by an admin on the player) are approved automatically
create or replace function claim_by_email() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  req signup_requests;
begin
  if mail = '' then return null; end if;
  select * into req from signup_requests where user_id = auth.uid();
  update players set user_id = auth.uid(),
                     avatar_path = coalesce(nullif(req.avatar_path, ''), avatar_path)
  where lower(email) = mail and user_id is null
  returning id into pid;
  if pid is not null then
    update signup_requests set status = 'approved', player_id = pid where user_id = auth.uid();
  end if;
  return pid;
end $$;
grant execute on function claim_by_email() to authenticated;
