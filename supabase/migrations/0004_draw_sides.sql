-- Registrations happen on WhatsApp: the admin running the draw puts each player on the
-- left or right for that Sunday. The side chosen here overrides the player's usual side.
alter table registrations add column side side;
