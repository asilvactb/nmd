-- Each match gets a jornada (time slot) and a court.
alter table matches add column slot int, add column court int;
alter table events alter column courts set default 4;
