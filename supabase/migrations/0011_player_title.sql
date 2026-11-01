-- Honorary title shown on the profile (e.g. "Presidente"), set by admins
alter table players add column if not exists title text;
