-- Match the fields already persisted by the Tahir Tracker client models.
-- Previously cloud upserts of settings could fail with PostgREST missing-column
-- errors (onboarding_completed, enabled_modules, legacy_cleanup_done).
-- Edited petrol refills could likewise fail on updated_at.
-- Additive only: preserve all existing IDs, ownership, settings and records.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS legacy_cleanup_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB;

ALTER TABLE public.petrol_refills
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
