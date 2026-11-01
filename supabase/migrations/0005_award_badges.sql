-- Awards point to the player who won them, so medals show up on player profiles.
alter table awards add column player_id uuid references players (id) on delete set null;
create index on awards (player_id);
