-- Players can undo their own finos (the "-1" button)
create policy "self finos delete" on finos for delete to authenticated
  using (player_id = current_player_id());
