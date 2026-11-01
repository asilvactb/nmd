-- Finos are a single group counter: an admin records the total at the end of each Sunday.
alter table finos alter column player_id drop not null;
drop policy if exists "self finos" on finos;
create unique index finos_one_per_event on finos (event_id) where player_id is null and event_id is not null;
