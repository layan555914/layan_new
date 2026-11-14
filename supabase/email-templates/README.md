# Arabic auth email templates (ASYUT AQAR)

Paste each file into Supabase → Authentication → Emails → Templates. Suggested subjects:

| Template | File | Subject |
|---|---|---|
| Confirm signup | confirm-signup.html | أكّد بريدك على أسيوط عقار |
| Reset password | reset-password.html | إعادة تعيين كلمة المرور — أسيوط عقار |
| Change email address | change-email.html | تأكيد تغيير البريد — أسيوط عقار |
| Magic link / Email OTP | magic-link.html | كود الدخول إلى أسيوط عقار |
| Invite user | invite.html | دعوة للانضمام إلى أسيوط عقار |

These only change the wording and design of the emails. Delivery limits are set by the SMTP
provider: Supabase's built-in sender allows only a few emails per hour, so production needs a
custom SMTP sender (for example Resend or Brevo, both with free tiers) under Authentication → SMTP.

## Reset password link works in any browser (important for phones)

`reset-password.html` links straight to `https://www.asyutq.com/reset-password.html?token_hash={{ .TokenHash }}&type=recovery`
instead of `{{ .ConfirmationURL }}`. The page verifies the one-time token itself, so the link works even when the
email is opened in Gmail's in-app browser or on another device (the PKCE verifier lives only in the browser that
requested the reset). A mail scanner that only loads the link no longer burns the token on Supabase's /verify GET.


## Email OTP activation notes

The Magic Link template is also used by Supabase email OTP. To deliver a six-digit code, the template must contain
`{{ .Token }}` and must not use `{{ .ConfirmationURL }}`. The existing signup-confirmation and password-reset
templates remain separate and are not changed by this OTP template.

The OTP UI and REST flow are implemented as an additional sign-in method. Password sign-in and the current
password-based signup flow remain available. Existing-account OTP requests explicitly disable automatic account
creation; the new-account OTP path supplies the same full name, mobile number, account type and terms acceptance
that the current signup form requires.

Do not paste this template into the production Supabase project until the branch preview and test-project OTP flow
have passed review and the owner explicitly approves activation. The first custom-SMTP rate limit on Supabase may
be 30 messages per hour; Supabase also applies a 60-second cooldown between OTP requests for the same account.
