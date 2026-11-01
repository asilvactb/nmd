-- Encounters are planned by number of players (which defines the format), not by courts.
alter table events add column expected_players int check (expected_players in (8, 12, 16, 20, 24));
