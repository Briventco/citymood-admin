# CityMood redesign: rules for Claude Code

Merge this into the repository's root `CLAUDE.md`. If there is no root `CLAUDE.md`, copy this file there. Keep any project rules that already exist.

## Source of truth
- Design spec: `docs/design/DESIGN_SPEC.md`. Read it before touching any UI.
- Tokens: `docs/design/tokens/tokens.css` and `tokens.json`. Copy them into the app's styles. Never hard-code a colour, font or spacing value that has a token.
- Visual reference: `docs/design/reference/*.png`. The `.html` files there are prototypes with inline styles. Read them for proportions; never copy their markup.
- Brand assets: `docs/design/assets/`. Use the logo PNG exactly as supplied.

## Brand rules you must not break
- Lime `#9AFF01` is never text on white or light grey. On light backgrounds it is only a fill behind black text, a 12px marker square with a black outline, or a rule.
- The logo sits only on pure black (#000000). Do not redraw, crop, recolour or rebuild it in CSS or SVG.
- Square corners. No border radius, shadows or gradients. No new colours.
- Headlines use Source Serif 4. Everything else uses Source Sans 3. Self-host both fonts with the latin-ext subset.

## Scope guard
- Build the homepage and the shared shell and components exactly as specified.
- Article, category, search, About, Contact and dashboard layouts are NOT designed yet. Restyle them with the shell, tokens and components, keep their structure, and log layout questions in `docs/design/OPEN_QUESTIONS.md`. Do not invent new page designs.
- Do not add a news alerts sign-up, a social video strip, dark mode, or anything from Phase 2 (tourism booking).
- Do not change the backend data model beyond what the spec needs: a `featured` flag, a `breaking` tag, ad slot config, and view counts for Most read. Ask before any migration.

## How to work
- Explore the codebase first and summarise the stack, routing, styling approach and content source before planning.
- Work mobile-first. Check every component at 390px, 768px and 1280px.
- Use the existing framework, styling system and component patterns. Do not add a new CSS framework or UI library.
- After each phase, run the app and the visual check (`docs/design/scripts/visual-check.mjs`). Compare the screenshots with the references, then fix differences before moving on.
- Run lint, type checks and tests after each phase. Commit per phase with clear messages on a feature branch, never on main.
- Accessibility target is WCAG 2.1 AA. Every icon button has an aria-label, focus is always visible, and touch targets are at least 44px.
- Content in the reference files is fictional placeholder copy. Never ship it as real content. Use real CMS data, or obviously fake seed data in development only.
