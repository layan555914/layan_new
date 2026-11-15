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

## Phase 2 — developer project profiles

A dedicated project profile should include:

- Project name, developer/company relationship, project type, and location.
- Project description, media gallery, and public source/verification notes.
- Development status and expected delivery only when supplied and approved.
- A map showing an appropriately generalized area unless an exact public location has been verified.
- A list of linked property offers, with each offer opening the existing property details route.

The project page must not imply that a project is licensed, under construction, available for reservation, or independently verified unless there is evidence and an explicit verification state supporting that claim.

## Phase 3 — property/unit details

Continue using the existing property details route and property-offer data model. Where a property offer is linked to a project, show the project and developer context and link back to the project profile.

Property details may include type, area, rooms, delivery, price, payment terms, amenities, location, photos, and inquiry actions only where those fields exist in the approved offer data. Availability and payment terms must be presented as time-sensitive and subject to direct confirmation.

## Data and security boundary

The current repository contains the shared company profile route and the existing property details route. No dedicated project-profile route or verified project-to-property relationship was found during this review.

Do not create public project or unit records by inventing data, and do not add or alter production tables, RLS, Storage policies, RPC permissions, or authentication as part of the UI-only phase. Before implementing Phases 2–3, inspect the live schema and existing property-offer relationships read-only, then propose a migration and access model for explicit approval.

## Acceptance checks

- Company cards and service-provider cards continue to open the shared company profile route.
- Published directory entities display a clear claim action.
- Claim requests continue to require authentication and manual review.
- No user can gain edit permissions merely by submitting a claim.
- Existing property details and inquiry flows remain unchanged.
- Project and property relationships are only displayed when backed by approved data.
