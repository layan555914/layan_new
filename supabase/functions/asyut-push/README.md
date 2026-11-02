# ASYUT AQAR background push

This function is deployed as `asyut-push` in the production Supabase project and must keep `verify_jwt = true`.

## Actions

- `get_public_key`: returns the public VAPID key to an authenticated user.
- `save_subscription`: stores that user's browser push subscription. A single endpoint cannot be reassigned to another account.
- `subscription_status`: checks whether this endpoint belongs to the signed-in account.
- `delete_subscription`: removes the signed-in user's subscription.
- `send_offer_push`: admin-only action called after an administrator approves a published `property_offers` record. It matches saved buyer preferences, creates in-app alert rows, and sends Web Push to subscribed devices.

## Key handling

VAPID keys are generated lazily and stored in `public.buyer_push_vapid_config`. RLS is enabled and only `service_role` has table privileges. Never copy the private key into browser code, GitHub, or a public environment variable.

The function uses the built-in Supabase Edge Function environment:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS` or legacy `SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEYS` or legacy `SUPABASE_SERVICE_ROLE_KEY`

The browser stores subscriptions through this function; it must not query `buyer_push_subscriptions` directly.

## Browser requirements

Push requires HTTPS, a supported browser, service-worker support, user permission, and a subscription from `PushManager`. On mobile Safari, users may need to install the site to their Home Screen first. Test the end-to-end flow on real devices before announcing the feature as live.

## Deployment

Current production deployment: version 4, JWT verification enabled. Deploy only through the Supabase Edge Function tooling; keep this source file synchronized with the deployed function.
