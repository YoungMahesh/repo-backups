# 0009: Public Editorial Landing Page, Route Separation, and Interactive Restoration Inspector

## Status
accepted

## Context and Decision
Prior to this decision, the root route (`/`) served as a monolithic component blending unauthenticated sign-in/sign-up forms with the authenticated repository operations dashboard. This introduced multiple issues:
1. **Lack of Discovery & Public Value Communication**: First-time visitors encountered an immediate authentication barrier without understanding platform value, read-only scoping guarantees, or the Git bundle architecture.
2. **Coupled Concerns**: Application state, repository synchronization, and marketing presentation were entangled in a single client component, impeding performance and layout stability.
3. **Unclear Restoration Provenance**: Developers evaluating the service had no interactive mechanism to inspect the canonical Restoration Guide workflow (`git clone <bundle-file>`) or verify ref integrity before registering.

We have separated these concerns into dedicated, focused routes:
- `/`: A public-facing editorial landing page adhering strictly to the warm-canvas design system (`DESIGN.md`). It features an interactive terminal restoration demo, a 4-pillar feature matrix, a 3-step operational lifecycle, a restoration showcase, lifecycle governance transparency, and an accessible FAQ.
- `/login`: A dedicated authentication route providing tabbed switching between Sign In and Create Account forms, with automatic redirect to `/dashboard` upon authentication.
- `/dashboard`: The protected application dashboard housing repository inventory, GitHub App installation controls, on-demand backups, and user-initiated Archive Purge modals. Unauthenticated visitors are automatically redirected to `/login`.

Top navigation dynamically reflects session state without jarring redirects: unauthenticated visitors on `/` see clear "Sign In" and "Start Backing Up" CTAs, while authenticated visitors see their active session recognized with a direct "Go to Dashboard" button.

## Consequences
- The public root page communicates architectural integrity and sovereignty before credential entry.
- Public search engines can index technical and security capabilities without encountering an authentication wall.
- Authenticated operations remain strictly guarded behind session boundaries on `/dashboard`.
- Clean route boundaries simplify future additions of public documentation, status pages, and compliance disclosures.
