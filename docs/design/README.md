# CityMood design handoff pack (Direction 1: Window to Badagry)

Everything Claude Code needs to rebuild the CityMood front end to the approved homepage design.

## Setup

1. **Copy this folder into the repository** as `docs/design/`, so the files sit at `docs/design/DESIGN_SPEC.md` and so on.
2. **Merge `CLAUDE.md` into the repo's root `CLAUDE.md`.** If the repo has none, move this one to the root. Claude Code reads it automatically at the start of every session.
3. **Open Claude Code in the repo** and work through `IMPLEMENTATION_PROMPT.md` one phase at a time.

## What's inside

| File | Purpose |
|---|---|
| `DESIGN_SPEC.md` | Source of truth: brand rules, tokens, components, homepage layout, data rules, accessibility, performance, edge cases |
| `CLAUDE.md` | Standing rules for Claude Code: brand, scope guard, how to work |
| `IMPLEMENTATION_PROMPT.md` | Phase-by-phase prompts to paste, with a review stop after each phase |
| `QA_CHECKLIST.md` | Acceptance checks for every phase and before merge |
| `OPEN_QUESTIONS.md` | Running list of decisions for CityMood; Claude Code adds to it |
| `tokens/tokens.css` | CSS custom properties: colour, type scale, spacing, rules |
| `tokens/tokens.json` | The same tokens as data |
| `tokens/tailwind.theme.js` | Tailwind mapping; use only if the repo already uses Tailwind |
| `reference/homepage-*.png` | Rendered references at 390, 768 and 1280px |
| `reference/brand-foundations.png` | Palette, type and contrast rules at a glance |
| `reference/*.html` | Static prototype pages; for proportions only, never copy their markup |
| `assets/citymood-logo.png` | The supplied logo, unaltered |
| `assets/badagry-performers.jpg` | The supplied cover photo, cropped to the image area (credit to confirm) |
| `scripts/visual-check.mjs` | Takes screenshots at 3 widths, runs axe and checks horizontal scroll, h1 count and tap targets |

## Notes

- **The reference content is fictional placeholder copy.** Never ship it.
- **Only the homepage and the shared components are designed.** Other pages get the new shell and styling, keeping their current structure, until their layouts are designed.
- **Two decisions are still open: the lime and the contact details.** Both are isolated in tokens and config, so changing them later is a one-line edit.
