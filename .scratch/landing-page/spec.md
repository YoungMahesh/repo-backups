# Spec: Public Editorial Landing Page, Route Separation, and Interactive Restoration Inspector

Status: done

## Problem Statement

Prospective engineering leaders, DevOps engineers, and security teams who visit the Repository Backup Platform currently encounter an immediate authentication wall or a bare sign-in form at the root URL. This creates several acute product friction points:

1. **Lack of Discovery and Value Communication**: First-time visitors have no way to learn what the platform does, understand how GitHub App read-only permissions protect their code, or evaluate the technical fidelity of point-in-time Git bundle backups before handing over credentials or registering an account.
2. **Coupled Application and Marketing Concerns**: The root URL (`/`) currently acts as a monolithic component blending unauthenticated sign-in/sign-up forms with the full authenticated repository operations dashboard. This prevents public search engine indexing, introduces potential layout shift during session resolution, and entangles public marketing layout needs with sensitive dashboard state.
3. **Unclear Restoration Provenance**: Developers frequently distrust proprietary cloud backup solutions due to vendor lock-in and opaque archive formats (such as proprietary zip or tar dumps). Without a public interactive demonstration of the canonical Restoration Guide workflow (`git clone <bundle-file>`), visitors cannot verify that their Git history, commit graphs, branches, and tags remain 100% sovereign and restorable via native Git tooling without our platform.

## Solution

Transform the root route into a public-facing editorial landing page adhering strictly to the warm-canvas design system, extract authenticated operations to a dedicated dashboard route, isolate credential management to a dedicated login route, and showcase the Git bundle architecture through an interactive terminal demonstration:

1. **Clean Route Separation**:
   - `/`: Public-facing editorial landing page showcasing product capabilities, technical architecture, and domain values.
   - `/login`: Dedicated, focused authentication page supporting both Sign In and Account Creation in the warm-canvas aesthetic.
   - `/dashboard`: The authenticated repository inventory and backup management dashboard.
2. **Dynamic Session-Aware Navigation**:
   - Unauthenticated visitors on `/` see clear "Sign In" and "Start Backing Up" action buttons directing them to `/login`.
   - Authenticated users on `/` see their session recognized in the top navigation with a direct "Go to Dashboard" button, avoiding jarring redirects while allowing them to view the public page.
   - Accessing `/dashboard` without an active session automatically redirects the visitor to `/login`.
   - Accessing `/login` with an active session automatically redirects the user to `/dashboard`.
3. **Warm-Canvas Editorial Aesthetics**:
   - Strict adherence to the design system: tinted cream canvas (`#faf9f5`), serif display headlines (`Cormorant Garamond` / `Copernicus`), warm coral CTAs (`#cc785c`), dark navy product inspection surfaces (`#181715`), humanist body typography (`Inter`), and monospace code rendering (`JetBrains Mono`).
4. **Interactive Restoration Terminal Demo**:
   - An interactive terminal card in the Hero section demonstrating Git bundle verification, instant local repository reconstruction via `git clone`, and encrypted S3 object storage layouts with copy-to-clipboard functionality.
5. **Domain-Aligned Editorial Sections**:
   - **Hero Section**: Serif headline, humanist value proposition, primary CTA, and the interactive terminal inspector.
   - **Feature Matrix**: Four core pillars detailing Read-Only Scoping, True Git Bundles, Automated Retention Windows, and One-Command Native Restoration.
   - **How It Works**: 3-step operational narrative from GitHub App installation to automated S3 backups.
   - **Restoration Showcase**: Deep dive into the canonical Restoration Guide workflow and ref integrity.
   - **Security & Lifecycle Transparency**: Clear exposition of Disconnection and Archive Purge controls.
   - **FAQ Accordion**: 5 collapsible answers addressing read-only permissions, bundle format advantages, S3 storage keys, retention windows, and disconnection safeguards.
   - **Editorial Footer**: Minimalist humanist footer with domain notes, navigation, and copyright.

## User Stories

1. As a first-time visitor, I want to land on a beautifully designed public landing page at `/`, so that I can understand the platform's value proposition before creating an account.
2. As a security-conscious engineer, I want the landing page to explain that GitHub App access is strictly read-only, so that I know our code repositories cannot be modified, deleted, or compromised by write tokens.
3. As a developer evaluating backup fidelity, I want to see an interactive terminal demonstration in the Hero section, so that I can inspect the output of `git bundle verify` on an actual backup bundle.
4. As a developer, I want the interactive terminal to let me switch between verifying ref integrity, running a `git clone` restoration, and viewing encrypted S3 object paths, so that I can explore different technical facets of the backup engine.
5. As a user, I want a one-click copy button on terminal snippets, so that I can easily copy canonical Git commands to my clipboard.
6. As a DevOps engineer, I want a dedicated "Feature Matrix" section explaining the 4 core platform pillars, so that I can review technical capabilities (read-only scoping, `.bundle` format, rolling retention windows, one-command restore).
7. As an engineering manager, I want a clear 3-step "How It Works" section, so that my team understands the operational lifecycle from connecting an installation to automated scheduled S3 backups.
8. As a developer concerned about vendor lock-in, I want a dedicated "Restoration Showcase" section highlighting the canonical Restoration Guide, so that I can see how `git clone <bundle-file>` reconstructs full Git history offline without requiring proprietary extraction scripts or platform software.
9. As a compliance officer, I want a "Security & Lifecycle" section that explains what happens during Disconnection and Archive Purge, so that I understand our organization's full data governance and deletion rights.
10. As a technical evaluator with common questions, I want an accessible FAQ accordion addressing permissions, storage encryption, retention policies, and disconnection behavior, so that I can find immediate answers to security and implementation questions.
11. As a user reviewing the FAQ, I want to expand and collapse individual questions smoothly, so that I can navigate questions without visual clutter.
12. As an unauthenticated visitor, I want a prominent "Start Backing Up" coral button in the Hero and TopNav, so that I can proceed directly to authentication when ready.
13. As an unauthenticated visitor clicking "Start Backing Up" or "Sign In", I want to be navigated to a dedicated `/login` page, so that I have an uncluttered, focused sign-in experience.
14. As a new user on `/login`, I want to toggle between "Sign In" and "Create Account" tabs, so that I can register or log in using email and password without page reloads.
15. As a registered user who successfully logs in on `/login`, I want to be automatically redirected to `/dashboard`, so that I can immediately manage my installations and repositories.
16. As an authenticated user returning to the root URL `/`, I want the top navigation to display a "Go to Dashboard" button instead of "Sign In", so that I can return to my workspace with a single click while still having the freedom to view the public landing page.
17. As an already logged-in user who navigates to `/login`, I want to be automatically redirected to `/dashboard`, so that I am not presented with a redundant login form.
18. As an unauthenticated user attempting to access `/dashboard` directly, I want to be automatically redirected to `/login`, so that protected repository operations and backup configurations are safeguarded against unauthorized access.
19. As a user navigating any section of the landing page, I want the entire page to adhere strictly to the warm-canvas editorial design system (cream canvas, serif headlines, warm coral accents, dark navy code cards, no cool grays), so that the visual presentation feels cohesive, sophisticated, and trustworthy.
20. As a mobile or tablet visitor, I want the landing page layout, terminal demo, and navigation to be fully responsive, so that I can read documentation and evaluate the product comfortably on any viewport width.
21. As a developer navigating the codebase, I want all landing page copy and documentation to strictly utilize the canonical domain vocabulary (`Installation`, `Repository`, `Backup Bundle`, `Backup Job`, `Retention Window`, `Enrolled Repository`, `Restoration Guide`, `Disconnected Installation`, `Disconnection`, `Archive Purge`), so that there is zero conceptual ambiguity.

## Implementation Decisions

1. **Route Hierarchy and Component Decoupling**:
   - Extract the entire authenticated dashboard from the root route into a dedicated dashboard page component.
   - Extract the email/password authentication forms from the root route into a dedicated login page component.
   - Refactor the root route into a clean page compositor that renders the modular landing page sections.
2. **Client-Side Session Navigation Strategy**:
   - The landing page uses the client-side session hook to inspect authentication status without forcing a server-side redirect loop. If a session is present, the top navigation updates its action button to direct users to the dashboard.
   - The login page checks for an active session upon mount and redirects authenticated users to the dashboard.
   - The dashboard page checks for session availability and redirects unauthenticated visitors to the login page.
3. **Modular Landing Page Component Structure**:
   - Create focused landing page components in a dedicated landing component directory:
     - Top Navigation extension supporting marketing anchors and dynamic session actions.
     - Hero Section featuring headline, value proposition, primary call to action, and interactive terminal demo.
     - Terminal Demo component rendering dark navy container with interactive tabs (`verify`, `clone`, `s3`), syntax-highlighted terminal output, and a clipboard copy button.
     - Feature Matrix rendering 4 cards for core platform pillars.
     - How It Works rendering a 3-step operational walkthrough.
     - Restoration Showcase highlighting the canonical Restoration Guide command and ref integrity principles.
     - Security & Lifecycle component highlighting Disconnection safety and user-initiated Archive Purge.
     - FAQ Accordion with accessible disclosure items.
     - Editorial Footer with wordmark, domain links, and legal notice.
4. **Design System Token Adherence**:
   - Background canvas: `#faf9f5` (`bg-canvas`).
   - Surfaces: `#f5f0e8` (`bg-surface-soft`), `#efe9de` (`bg-surface-card`), `#e8e0d2` (`bg-surface-cream-strong`).
   - Terminal & Code Surfaces: `#181715` (`bg-surface-dark`) with `#252320` (`border-surface-dark-elevated`).
   - Typography: `Cormorant Garamond` serif for display headers (`font-serif`), `Inter` for body (`font-sans`), and `JetBrains Mono` for code (`font-mono`).
   - Primary accents: `#cc785c` coral (`bg-primary`, `hover:bg-primary-active`).
   - Borders: `#e6dfd8` (`border-hairline`).
5. **Architectural Decision Record**:
   - Publish ADR 0009 documenting the separation of public marketing, authentication, and application dashboard routes.

## Testing Decisions

A good test exercises external behavior from the user's perspective, avoiding fragile assertions against internal implementation details:

1. **Landing Page Rendering & Interactive Elements**:
   - Render the public landing page with unauthenticated session state.
   - Verify that the Hero headline, value proposition, and primary CTAs are visible with valid links to the login route.
   - Verify that the Terminal Demo renders with the default tab, and that clicking alternate tabs updates the displayed terminal commands and output.
   - Verify that the FAQ accordion items expand and collapse upon interaction.
2. **Session Navigation Awareness**:
   - Render the public landing page with an active authenticated session.
   - Verify that the top navigation renders a "Go to Dashboard" button linking to the dashboard route instead of "Sign In".
3. **Authentication Route Integration**:
   - Render the login page and verify that switching between Sign In and Create Account tabs updates the displayed form fields appropriately.
   - Verify that if an active session exists, the login page triggers a redirect to the dashboard route.
4. **Dashboard Route Protection**:
   - Render the dashboard page with an unauthenticated session state and verify that it initiates redirection to the login route.
   - Render the dashboard page with an active session and verify that the repository inventory and organization cards render correctly.
5. **Prior Art in Codebase**:
   - Existing component and integration tests in the test suite (e.g., component tests using `@testing-library/react` and Vitest) provide direct patterns for session mocking, user interaction testing, and router assertions.

## Out of Scope

- Implementing third-party OAuth providers (e.g., GitHub OAuth) on the login page; Better Auth email/password remains the active authentication mechanism.
- Billing, subscription payment gateways, or multi-tier pricing plans.
- Modifications to the underlying GitHub webhook listeners, S3 backup streaming pipeline, or database schema.
- Changes to existing backup execution logic or cron runners.

## Further Notes

- All 177 existing unit and integration tests across 15 test files must continue passing without regression.
- The new route structure provides an immediate foundation for future public pages (e.g. public restoration documentation, status pages, or compliance documentation) without cluttering the authenticated application space.
