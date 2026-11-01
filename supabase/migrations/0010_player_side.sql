-- Every player confirms the side they play on (left/right) and can change it in their profile.
alter table players add column side_confirmed boolean not null default false;

create or replace function set_my_side(new_side side) returns void
language sql security definer set search_path = public as $$
  update players set side = new_side, side_confirmed = true where user_id = auth.uid()
$$;
grant execute on function set_my_side(side) to authenticated;

-- Sign-up now always carries the side (signup_requests.new_side)
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
    update players set user_id = r.user_id, email = r.email,
                       avatar_path = nullif(r.avatar_path, ''),
                       side = coalesce(r.new_side, side),
                       side_confirmed = side_confirmed or r.new_side is not null
    where id = r.player_id and user_id is null
    returning id into pid;
    if pid is null then raise exception 'Esse jogador já tem conta.'; end if;
  else
    insert into players (name, side, side_confirmed, email, user_id, avatar_path)
    values (r.new_name, r.new_side, true, r.email, r.user_id, nullif(r.avatar_path, ''))
    returning id into pid;
  end if;

  update signup_requests set status = 'approved' where user_id = req;
  return pid;
end $$;

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
                     avatar_path = coalesce(nullif(req.avatar_path, ''), avatar_path),
                     side = coalesce(req.new_side, side),
                     side_confirmed = side_confirmed or req.new_side is not null
  where lower(email) = mail and user_id is null
  returning id into pid;
  if pid is not null then
    update signup_requests set status = 'approved', player_id = pid where user_id = auth.uid();
  end if;
  return pid;
end $$;
