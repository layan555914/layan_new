-- Add an opt-in for notifications about every newly published property offer.
-- Existing subscribers keep their current matching-alert setting; general alerts default off.
ALTER TABLE public.buyer_preferences
  ADD COLUMN IF NOT EXISTS all_notifications_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.buyer_preferences.all_notifications_enabled IS
  'Whether this buyer wants an in-app and push alert for every newly published property offer, in addition to optional preference-matched alerts.';
