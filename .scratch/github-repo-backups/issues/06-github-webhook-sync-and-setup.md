# 06: GitHub App Webhook Sync and Setup Experience

**What to build:**
Enable real-time synchronization between GitHub App settings and the platform's repository inventory, and provide a guided onboarding experience for configuring GitHub App credentials. Implement a webhook endpoint (`/api/github/webhook`) verifying HMAC-SHA256 signatures (`X-Hub-Signature-256`) that handles `installation_repositories` events (`added` and `removed`), instantly updating the available repository inventory when an organization admin adds or removes repositories on GitHub. Additionally, render an editorial setup banner on the dashboard whenever GitHub App environment variables are not yet configured, explaining exactly how to register the GitHub App with the required read-only permissions.

**Blocked by:** 01: Connect GitHub Organization and List Available Repositories

**Status:** ready-for-agent

- [ ] A webhook endpoint (`/api/github/webhook`) verifies incoming payload signatures against `GITHUB_APP_WEBHOOK_SECRET`
- [ ] Receiving an `installation_repositories` event with action `added` inserts the new repositories into the user's inventory
- [ ] Receiving an `installation_repositories` event with action `removed` removes or deactivates the revoked repositories in the inventory
- [ ] If GitHub App credentials (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, etc.) are missing, the dashboard displays an editorial setup banner
- [ ] The setup banner provides clear step-by-step instructions on creating the GitHub App with read-only permissions (`Contents: read`, `Metadata: read`) and callback URLs
- [ ] High-level tests verify valid and invalid webhook signature handling and inventory updates upon repository added/removed payloads
