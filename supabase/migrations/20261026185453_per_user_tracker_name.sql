-- Workspace branding stays on the existing owner-scoped settings row.
-- No records or ownership policies are rewritten.
BEGIN;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS tracker_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.settings
  ADD CONSTRAINT settings_tracker_name_length
  CHECK (tracker_name IS NULL OR char_length(btrim(tracker_name)) BETWEEN 1 AND 60);

COMMIT;
