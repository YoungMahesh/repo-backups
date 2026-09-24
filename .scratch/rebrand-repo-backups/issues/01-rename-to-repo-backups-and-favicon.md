# 01: Rename Repo Manage to Repo Backups & Add Warm-Canvas Favicon

**What to build:**
Update all user-facing branding and metadata from "Repo Manage" to "Repo Backups", update package and infrastructure configuration to `repo-backups`, update fallback slugs and client headers, replace the default Next.js template favicon with the warm-canvas 4-spoke radial starburst mark (`app/icon.svg` and `app/favicon.ico`), and update all automated test assertions.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `package.json` package name updated to `"repo-backups"`.
- [x] `app/layout.tsx` metadata title updated to `"Repo Backups — GitHub Repository Backups"`.
- [x] `components/ui/top-nav.tsx` brand title updated to `"Repo Backups"`.
- [x] `components/landing/landing-footer.tsx` brand title and copyright updated to `"Repo Backups"`.
- [x] `app/login/page.tsx` brand title and authentication headings updated to `"Repo Backups"`.
- [x] `components/github/setup-banner.tsx` GitHub App naming recommendation updated to `"Repo Backups"`.
- [x] `components/landing/terminal-demo.tsx` and `components/landing/restoration-showcase.tsx` demo S3 bucket paths updated to `s3://repo-backups/...` and `repo-backups-vault`.
- [x] `lib/github/crypto.ts` and `lib/github/client.ts` fallback slugs, key phrases, and User-Agent headers updated to `repo-backups-app`.
- [x] `docker-compose.yml`, `deploy.sh`, and `Dockerfile` updated to reference `repo-backups`.
- [x] `app/icon.svg` created with dark navy `#181715` squircle and warm coral `#cc785c` 4-spoke radial burst mark per DESIGN.md.
- [x] `app/favicon.ico` updated to match the warm-canvas brand icon.
- [x] All unit and integration test assertions updated and passing.
