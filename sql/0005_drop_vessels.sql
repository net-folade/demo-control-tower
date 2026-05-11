-- 0005_drop_vessels.sql
-- One-time cleanup: drop the AIS-era vessel tables and view.
--
-- Context: PLAN.md originally specified aisstream.io for live vessel positions,
-- but AISStream's free terrestrial-AIS network has effectively no coverage of
-- West African waters (verified with global vs. Ghana bbox probes — 0 messages
-- over Ghana, plenty everywhere else). Slice 3 pivoted to GPHA's annual port
-- statistics. The vessel tables are unused and removed to keep the schema honest.
--
-- Run once in the Supabase SQL editor.

drop view if exists v_active_vessels_near_port;
drop table if exists vessel_positions;
drop table if exists vessels;
