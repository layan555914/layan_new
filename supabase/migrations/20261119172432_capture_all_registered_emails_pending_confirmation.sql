create or replace function private.capture_registered_email_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  insert into public.email_notification_subscriptions as current_subscription
    (user_id, email, is_enabled, source, email_confirmed_at, updated_at)
  values
    (
      new.id,
      lower(btrim(new.email)),
      new.email_confirmed_at is not null,
      case when new.email_confirmed_at is not null then 'signup' else 'pending_confirmation' end,
      new.email_confirmed_at,
      now()
    )
  on conflict (user_id) do update
    set email = excluded.email,
        email_confirmed_at = excluded.email_confirmed_at,
        is_enabled = case
          when current_subscription.unsubscribed_at is not null then current_subscription.is_enabled
          else excluded.is_enabled
        end,
        source = case
          when current_subscription.unsubscribed_at is not null then current_subscription.source
          else excluded.source
        end,
        updated_at = now();

  return new;
end;
$function$;

drop trigger if exists capture_registered_email_subscription on auth.users;

create trigger capture_registered_email_subscription
after insert or update of email, email_confirmed_at on auth.users
for each row
execute function private.capture_registered_email_subscription();

insert into public.email_notification_subscriptions as current_subscription
  (user_id, email, is_enabled, source, email_confirmed_at, updated_at)
select
  u.id,
  lower(btrim(u.email)),
  u.email_confirmed_at is not null,
  case when u.email_confirmed_at is not null then 'signup' else 'pending_confirmation' end,
  u.email_confirmed_at,
  now()
from auth.users u
where u.email is not null and btrim(u.email) <> ''
on conflict (user_id) do update
  set email = excluded.email,
      email_confirmed_at = excluded.email_confirmed_at,
      is_enabled = case
        when current_subscription.unsubscribed_at is not null then current_subscription.is_enabled
        else excluded.is_enabled
      end,
      source = case
        when current_subscription.unsubscribed_at is not null then current_subscription.source
        else excluded.source
      end,
      updated_at = now();
