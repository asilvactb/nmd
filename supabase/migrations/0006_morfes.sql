-- Morfes (repasto): players volunteer themselves to bring the food for an upcoming Sunday.
create policy "self morfes add" on repasto for insert to authenticated
  with check (player_id = current_player_id()
              and exists (select 1 from events e where e.id = event_id and e.status <> 'finished')
              and (select count(*) from repasto r where r.event_id = repasto.event_id) < 2);
create policy "self morfes remove" on repasto for delete to authenticated
  using (player_id = current_player_id()
         and exists (select 1 from events e where e.id = event_id and e.status <> 'finished'));
