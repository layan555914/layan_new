select cron.schedule(
  'asyut-aqar-thursday-email-digest',
  '0 8 * * 4',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'asyutq_weekly_digest_project_url')
             || '/functions/v1/email-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'asyutq_weekly_digest_publishable_key'),
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'asyutq_weekly_digest_publishable_key'),
        'x-asyut-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'asyutq_weekly_digest_cron_token')
      ),
      body := jsonb_build_object('action', 'weekly_digest'),
      timeout_milliseconds := 120000
    );
  $job$
);
