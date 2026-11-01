-- Test encounters (counts_for_ranking = false) can share a date with a real one.
alter table events drop constraint if exists events_season_id_date_key;
create unique index if not exists events_real_per_date on events (season_id, date) where counts_for_ranking;
