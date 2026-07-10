-- Projects gain a display color, set during the one-screen project creation flow
-- (name + color + initial fields/categories), per docs/architecture.md's Navigation
-- Structure. Stored as a hex string; the app offers a fixed set of preset swatches
-- rather than a free-form color picker, so no format validation beyond "text" is needed.
alter table projects add column if not exists color text;
