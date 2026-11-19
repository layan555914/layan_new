create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://ebyhwqkmhxbgocngpqfe.supabase.co',
  'asyutq_weekly_digest_project_url'
);
select vault.create_secret(
  'sb_publishable_8PlFI202E-pIZRAG61L2sA_aSoJ3Qwt',
  'asyutq_weekly_digest_publishable_key'
);
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'asyutq_weekly_digest_cron_token'
);

create or replace function public.verify_email_digest_cron_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select coalesce(
    (select bool_or(decrypted_secret = p_token)
     from vault.decrypted_secrets
     where name = 'asyutq_weekly_digest_cron_token'),
    false
  );
$function$;

revoke all on function public.verify_email_digest_cron_token(text) from public, anon, authenticated;
grant execute on function public.verify_email_digest_cron_token(text) to service_role;
