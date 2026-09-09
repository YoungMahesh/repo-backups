# 01: Connect GitHub Organization and List Available Repositories

**What to build:**
Enable authenticated users to connect their GitHub organization using a fine-grained GitHub App installation flow. When the user clicks "Connect GitHub Organization", they are redirected to GitHub where they can authorize specific repositories with read-only permissions. Upon redirect back to the platform, the connection is validated cryptographically and linked to their user account. The dashboard displays the connected organization with its avatar, account name, and an inventory table listing all authorized repositories with their privacy badges and default branches. Users can click "Sync from GitHub" to manually refresh the repository inventory at any time.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Users can click "Connect GitHub Organization" on the dashboard to initiate the GitHub App installation flow
- [x] The callback validates a signed state parameter and creates or updates the Installation associated with the authenticated user
- [x] The dashboard renders a connected organization card showing account avatar, organization/user name, and total authorized repositories
- [x] The dashboard renders an inventory table displaying all authorized repositories with repository name, organization prefix, privacy status (Public/Private badge), and default branch
- [x] Users can click a "Sync from GitHub" button on the organization card to immediately re-fetch the authorized repository list from GitHub
- [x] High-level API route tests verify installation linking, state signature validation, and repository inventory synchronization
- [x] UI components strictly adhere to the warm-canvas editorial design system
