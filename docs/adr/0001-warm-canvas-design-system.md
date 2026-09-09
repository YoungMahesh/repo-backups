# 0001: Warm-Canvas Editorial Design System

## Status
accepted

## Context and Decision
We have adopted the "warm-canvas editorial" design system specified in [DESIGN.md](../../DESIGN.md) as the authoritative visual language for all user-facing interfaces in this repository. The system anchors on a tinted cream canvas (`#faf9f5`), serif display headlines (`Copernicus` 400 with negative letter-spacing), warm coral CTAs (`#cc785c`), and dark navy product surfaces (`#181715`).

Because `Copernicus` (serif) and `StyreneB` (humanist sans) are proprietary typefaces, web implementations standardise on open Google Fonts fallbacks: `EB Garamond` / `Cormorant Garamond` for display serif headlines, `Inter` for body and UI elements, and `JetBrains Mono` for code blocks.

## Consequences
- All agent and human work creating or modifying UI components, layouts, and styles must strictly adhere to the tokens and "Do's and Don'ts" in `DESIGN.md` (e.g., no cool grays, no pure white canvas, no bold serif headlines).
- Generic utility styling (e.g., standard Tailwind zinc or cool grays) is forbidden on user-facing pages.
