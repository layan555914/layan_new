# LAYAN AQAR — Visual identity preview

Status: review-only branch; not merged and not deployed.

## Approved direction implemented
- Direction B (light, clean reading surfaces) with restrained diagonal red motif from Direction C.
- Brand name remains LAYAN AQAR / ليان عقار.
- Original logo file `file_000000004bbc821184c084bfa178e416.jpg` is not modified.
- Logo-derived colors from the supplied visual audit: black `#010106`, royal blue `#0044CA`, electric blue `#029EF8`, cyan `#24C7FD`, red `#C8000C`, white/silver.
- Supporting neutrals: page `#F4F7FC`, surface `#FFFFFF`, text `#0A1020`, secondary text `#4A5568`, borders `#DCE4F2`.
- Blue is the primary interactive color. Red is reserved for price/attention/error and the diagonal accent, not every primary action.
- Typography: Cairo for headings and IBM Plex Sans Arabic for body text.

## Updated preview surfaces
- Homepage, property cards, forms, shared header/footer: `styles.css`
- Company directory and profile: `companies.css`, `companies.html`, `company.html`
- Buyer matching: `buyer.css`
- Premium/commercial ads: `sponsor.css`, `payment.html`
- Admin and password reset: `admin.html`, `reset-password.html`
- Cache-busting and service-worker shell version updated on this branch only.

## Explicitly not changed
- No JavaScript business logic or application functionality.
- No Supabase/database schema, data, settings, credentials, or permissions.
- No original logo asset, brand name, existing sample company records, or old repository.
- No production deployment. Branch only.

## Contrast
- Primary blue `#0044CA` with white text: approx. 7.84:1.
- Secondary text `#4A5568` on white: approx. 7.5:1.
- Bright logo blue `#029EF8` is decorative only on light backgrounds; avoid small text.
- Red is never the sole indicator of a state; labels/text accompany it.

## Review checklist
1. Confirm original logo appearance is unchanged on desktop/mobile.
2. Check homepage, property cards/details, directory, company profile, admin, premium ads, and password reset.
3. Check widths 320px, 360px, tablet, and desktop.
4. Verify keyboard focus, form controls, and text contrast.
5. Check for any remaining legacy color values before merge.
