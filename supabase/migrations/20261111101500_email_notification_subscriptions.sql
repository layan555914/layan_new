-- ASYUT AQAR: email notifications for approved and published listings.
-- Only users who explicitly opt in receive announcement emails.
create table if not exists public.email_notification_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_enabled boolean not null default false,
  source text not null default 'signup',
  email_confirmed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  welcome_sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_notification_subscriptions_enabled_idx
  on public.email_notification_subscriptions (is_enabled, created_at);

create table if not exists public.email_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id text not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'queued'
    check (status = any (array['queued','sent','failed']::text[])),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_notification_deliveries_once_per_recipient
    unique (source_table, source_id, recipient_user_id)
);

create index if not exists email_notification_deliveries_status_idx
  on public.email_notification_deliveries (status, created_at);

alter table public.email_notification_subscriptions enable row level security;
alter table public.email_notification_deliveries enable row level security;

revoke all on table public.email_notification_subscriptions from anon, authenticated;
revoke all on table public.email_notification_deliveries from anon, authenticated;
grant all on table public.email_notification_subscriptions to service_role;
grant all on table public.email_notification_deliveries to service_role;
