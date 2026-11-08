# Arabic auth email templates (ASYUT AQAR)

Paste each file into Supabase → Authentication → Emails → Templates. Suggested subjects:

| Template | File | Subject |
|---|---|---|
| Confirm signup | confirm-signup.html | أكّد بريدك على أسيوط عقار |
| Reset password | reset-password.html | إعادة تعيين كلمة المرور — أسيوط عقار |
| Change email address | change-email.html | تأكيد تغيير البريد — أسيوط عقار |
| Magic link | magic-link.html | رابط الدخول إلى أسيوط عقار |
| Invite user | invite.html | دعوة للانضمام إلى أسيوط عقار |

These only change the wording and design of the emails. Delivery limits are set by the SMTP
provider: Supabase's built-in sender allows only a few emails per hour, so production needs a
custom SMTP sender (for example Resend or Brevo, both with free tiers) under Authentication → SMTP.

## Reset password link works in any browser (important for phones)

`reset-password.html` links straight to `https://layan-eg.com/reset-password.html?token_hash={{ .TokenHash }}&type=recovery`
instead of `{{ .ConfirmationURL }}`. The page verifies the one-time token itself, so the link works even when the
email is opened in Gmail's in-app browser or on another device (the PKCE verifier lives only in the browser that
requested the reset). A mail scanner that only loads the link no longer burns the token on Supabase's /verify GET.
