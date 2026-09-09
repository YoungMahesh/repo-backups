# 0002: GitHub App Installation Model for Fine-Grained Repository Authorization

## Status
accepted

## Context and Decision
Users need to connect GitHub organizations while granting access exclusively to specific repositories with read-only permissions. 

We decided to use a GitHub App installation model rather than standard OAuth apps. Standard OAuth apps require broad account-level or organization-level read scopes that expose all repositories, whereas GitHub Apps allow organization admins during installation to explicitly choose "Only select repositories" and enforce strict read-only permissions (`Contents: read`, `Metadata: read`) at the GitHub API boundary.

## Consequences
- The platform authenticates using GitHub App credentials (App ID, Private Key, Webhook Secret) and generates short-lived Installation Access Tokens for repository operations.
- Users are redirected to the GitHub App installation URL (`https://github.com/apps/<app-slug>/installations/new`) to select or change authorized repositories.
- The platform cannot access any repository outside of those explicitly granted during the App installation.
