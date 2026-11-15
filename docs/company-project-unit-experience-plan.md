# ASYUT AQAR — Company, project, and unit experience

## Goal

Build on the existing company and service-provider profiles so that a visitor can move naturally from a company to its projects and from a project to its available property offers, without replacing the current property-listing flow.

## Phase 1 — company and service-provider profile consistency

- Keep the existing shared `company.html` route for approved company profiles and published directory entities.
- Keep existing company and marketplace cards linking to that shared route.
- Present the claim action near the top of published directory-entity profiles using the exact Arabic label **استلم ملفك مجانًا**.
- Keep claim submission behind the existing authenticated request and manual review workflow. A submitted claim must not grant edit rights.
- Present services, public contact details, coverage areas, gallery items, sources, and the platform disclaimer in consistent sections.
- Keep company-owned approved profiles and the existing verified manager/editor controls intact.

## Phase 2 — public developer project profiles (implemented)

- The directory's published-project cards open a dedicated `project.html` profile using the project's database ID.
- The route accepts the public project slug as an alternate lookup key.
- Project records are read through the existing public Supabase Data API and are rendered only when `public_visible = true` and `verification_status = published`.
- Profiles show only fields available on the approved project record: name, type, description, published status, area, location text, reported size, unit count (when present), and review date (when present).
- Publicly readable project-source links and publicly published related entities are displayed with their recorded relation type.
- A map may show exact coordinates only when the project explicitly permits public location display and the coordinate source is public and high-confidence/official. Otherwise, it shows an explicitly labelled area/location search, not a project pin.
- The page clearly states that directory inclusion is informational, not a partnership, recommendation, or licence verification. Project status and availability must be confirmed directly with the relevant authority/developer.
- Unpublished and review-only records remain inaccessible from this public route. The route does not query private project tables.

## Phase 3 — property/unit details (not yet implemented)

Continue using the existing property details route and property-offer data model. Where a property offer is linked to a project, show the project and developer context and link back to the project profile.

Property details may include type, area, rooms, delivery, price, payment terms, amenities, location, photos, and inquiry actions only where those fields exist in the approved offer data. Availability and payment terms must be presented as time-sensitive and subject to direct confirmation.

## Data and security boundary

The current repository contains the shared company profile route, the new public project-profile route, and the existing property details route. The project directory already includes relationships to published entities and public sources, but the existing `property_offers` table does not contain a verified foreign-key relationship to `directory_projects`.

Do not create public project or unit records by inventing data, and do not add or alter production tables, RLS, Storage policies, RPC permissions, or authentication as part of the UI-only phase. Before implementing Phase 3, inspect the live schema and existing property-offer relationships read-only, then propose a migration and access model for explicit approval.

## Acceptance checks

- Company cards and service-provider cards continue to open the shared company profile route.
- Published directory entities display a clear claim action.
- Claim requests continue to require authentication and manual review.
- No user can gain edit permissions merely by submitting a claim.
- Published project cards open the dedicated project profile.
- Only public, published project records can be rendered.
- Project source links and related entities are shown only when their rows are publicly accessible and published.
- No unapproved exact map pin is created.
- Existing property details and inquiry flows remain unchanged.
- Project and property relationships are only displayed when backed by approved data.
