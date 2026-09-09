## Instructions

- Use `pnpm` instead of `npm`.
- If you make any changes to the database schema, generate a database migration with `pnpm run db-generate` and apply it with `pnpm run db-migrate`.
- If you think this Next.js version's APIs, conventions, or file structure differ from your training data, read the relevant guide in `node_modules/next/dist/docs/` before writing code.
- When implementing a ticket, include the ticket status update in the same commit: update its `Status:` line to `done` (or the appropriate state) and check off all completed acceptance criteria (`- [ ]` to `- [x]`). A ticket is only `done` when every acceptance criterion is met. Do NOT split this into a separate docs-only commit.
- When creating, modifying, or reviewing UI components, layouts, or styling, strictly adhere to the design system in [DESIGN.md](DESIGN.md) (warm-canvas palette, serif/sans typographic split, tokens, and Do's and Don'ts).

## Tech stack

- Authentication: [better-auth](https://better-auth.com/docs/basic-usage)
- Database: Postgres with [drizzle-orm](https://orm.drizzle.team/docs/overview)
- Design system: Warm-canvas editorial ([DESIGN.md](DESIGN.md))

## Agent skills

### Issue tracker

Local markdown files in `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository (`CONTEXT.md` and `docs/adr/` at the repo root). See `docs/agents/domain.md`.
