# Prompts for Claude Code

Paste these into Claude Code one at a time, from the root of the CityMood repository. Wait for each phase to finish, and review it before you send the next one.

Before you start, make sure the handoff pack is in the repo at `docs/design/`, and that its `CLAUDE.md` rules are merged into the root `CLAUDE.md`. See README.md.

---

## Prompt 0: Explore and plan (use plan mode)

Turn on plan mode first (Shift+Tab until it says "plan mode"), then paste:

```
We're rebuilding the CityMood website's front end to match a new approved design.
The design handoff is in docs/design/. Read these fully before anything else:
- docs/design/DESIGN_SPEC.md (source of truth)
- docs/design/tokens/tokens.css and tokens.json
- docs/design/QA_CHECKLIST.md
- docs/design/OPEN_QUESTIONS.md
Then look at the reference screenshots in docs/design/reference/ (homepage-mobile-390.png,
homepage-tablet-768.png, homepage-desktop-1280.png, brand-foundations.png).

Then explore this codebase and tell me:
1. The stack: framework, rendering (SSR/SSG/SPA), styling approach, package manager, test and lint setup.
2. Where content comes from (CMS, database, API), and the article model's fields
   (title, slug, standfirst/excerpt, body, image + alt, category, tags, author, published date).
   Does it already have a featured flag, tags, view counts and an image focal point?
3. The current routes and page templates, and which existing components we can reuse or must replace.
4. How fonts and images are currently loaded.

Then propose a phased plan that follows the phases below. For each phase, list the files you'll
create or change, and any data-model change you'd need (I must approve those first).
Flag every place where the spec doesn't fit this codebase, instead of quietly deviating.
Do not write code yet.

Phases:
1. Foundations: tokens, self-hosted fonts, global styles, focus styles, skip link.
2. Global shell: SiteHeader, SectionNav, MobileMenu, BreakingTicker, AdSlot, SiteFooter, used on every page.
3. Shared components: CategoryLabel, SectionHeader, all StoryCard variants, LatestRail, PeopleBand, MostRead.
4. Homepage: compose the sections in the spec's order, with data rules (dedupe, empty sections,
   featured lead, breaking tag) and caching.
5. Other existing pages: restyle with the shell, tokens and components, keeping their structure.
   Log layout questions in OPEN_QUESTIONS.md. Don't invent new layouts.
6. QA: run the full QA_CHECKLIST, fix issues, write a summary.
```

Review the plan. Approve or correct it, especially any data-model changes. Then turn off plan mode.

---

## Prompt 1: Foundations

```
Implement Phase 1 (Foundations) from the approved plan.
- Create a feature branch named redesign/citymood-direction-1 if we're not on one already.
- Add the tokens from docs/design/tokens/tokens.css to the app's global styles
  (and to the Tailwind theme via tokens/tailwind.theme.js, only if the repo already uses Tailwind).
- Self-host Source Serif 4 (600, 700) and Source Sans 3 (400, 700, 800, 300 italic) with the
  latin and latin-ext subsets, font-display: swap. Preload only Serif 700 and Sans 400.
- Global base: body on white in Source Sans 3, black text, square corners, focus-visible styles
  (3px black outline with 2px offset on light backgrounds, lime on black), a skip link, lang="en".
- Add the logo from docs/design/assets/citymood-logo.png to the public assets.
Then build a temporary dev-only route (/__design) that shows the tokens, the type scale and the
Yoruba test string "Àgbádárìgì Ọjà Ẹ̀kọ́ ṣ" in every weight, and screenshot it at 390 and 1280.
Run lint, typecheck and tests, then commit. Stop and show me the screenshots.
```

---

## Prompt 2: Global shell

```
Implement Phase 2 (Global shell) exactly as specified in DESIGN_SPEC.md sections 4.1 to 4.5 and 4.12:
SiteHeader, SectionNav, MobileMenu, BreakingTicker, AdSlot and SiteFooter. Use them in the
shared layout so every page gets them.
Pay special attention to:
- MobileMenu: aria-expanded/aria-controls, Esc closes it, focus trap and focus return, body scroll
  lock, and a no-JS fallback.
- BreakingTicker: content from the "breaking" tag (max 5, 6-hour expiry, configurable), hidden when
  empty, pause/play control, no motion with prefers-reduced-motion, no aria-live, no text cut off mid-word.
- AdSlot: leaderboard / mpu / billboard sizes per breakpoint with reserved space, an "Advertisement"
  label, a house ad "Advertise with CityMood" when empty, and creatives configurable without a deploy
  (use the CMS if possible, otherwise a config file, and tell me which you chose).
- Categories in the nav come from the CMS, not hard-coded.
- Footer contact details come from config, with placeholders for now.
Run node docs/design/scripts/visual-check.mjs against the local dev server, compare the header and
footer with the reference screenshots, and fix the differences. Run lint, typecheck and tests,
then commit. Stop and show me the 390px and 1280px screenshots.
```

---

## Prompt 3: Shared components

```
Implement Phase 3 (Shared components): CategoryLabel, SectionHeader, the StoryCard variants (lead,
standard, section-lead, compact, list, latest, portrait, feature), LatestRail, PeopleBand and MostRead,
per DESIGN_SPEC.md sections 4.6 to 4.11 and the image rules in section 3.
- Every card is an <article> with one headline link. Heading level is a prop.
- Cards without images render the text-only version, never a grey box.
- Images: responsive srcset/sizes, modern formats, reserved aspect ratio, lazy below the fold,
  and a priority option for the lead.
- MostRead: use view counts if the codebase has them. Otherwise propose the lightest server-side
  counter, or an editor-curated fallback, and ask me before adding a migration.
Add the components to the /__design route with realistic edge cases: a 140-character headline,
a 3-word headline, no image, Yoruba names. Screenshot it at 390 and 1280, fix issues, commit,
then stop and show me.
```

---

## Prompt 4: Homepage

```
Implement Phase 4: rebuild the homepage to match DESIGN_SPEC.md section 5 exactly, using real data.
- Desktop and mobile section order exactly as listed. All six categories must appear on mobile.
- Data rules: featured lead (falling back to newest with an image), an article appears at most once
  (Most read excepted), hide empty sections, ticker only when breaking items exist.
- Caching / revalidation as the spec says, adapted to our framework.
- JSON-LD for NewsMediaOrganization and WebSite with SearchAction, plus Open Graph tags.
Then run docs/design/scripts/visual-check.mjs at 390/768/1280 and compare side by side with
docs/design/reference/homepage-*.png. List every visible difference, fix them, and re-run until they
match apart from real content and real photos. Run Lighthouse mobile and report LCP, CLS and total
JS against the budget in section 7. Commit, then stop and show me the screenshots and the numbers.
```

---

## Prompt 5: Other existing pages

```
Implement Phase 5. For every other existing public page (article, category/archive, search, About,
Contact), apply the new shell, tokens and shared components, but keep each page's current structure.
These layouts are not designed yet, so do not invent new designs. Where a page clearly needs a design
decision, add it to docs/design/OPEN_QUESTIONS.md with a screenshot path and a suggested default.
Make sure the article page uses the type tokens for headline, standfirst, byline and body text,
and an AdSlot mpu where an ad already exists. Do not restyle the editorial dashboard beyond the tokens.
Screenshot each page at 390 and 1280, commit, then stop and summarise.
```

---

## Prompt 6: QA and handover

```
Run the full docs/design/QA_CHECKLIST.md against the running app. For each item, mark it pass or fail
with evidence (a screenshot path, an axe result or a Lighthouse number). Fix every failure you can,
re-run, and then write docs/design/IMPLEMENTATION_REPORT.md with: what was built, deviations from the
spec and why, remaining open questions, and how to change ad creatives, breaking news and featured
stories. Commit, then open a pull request (or give me the summary if PRs aren't set up).
```

---

## Tips while it works

- If the output drifts from the design, say: "Compare your screenshot with docs/design/reference/homepage-desktop-1280.png and list every difference before changing code."
- If it starts adding features, say: "Check the scope guard in CLAUDE.md, and remove anything outside it."
- Start a fresh session between phases if the conversation gets long. CLAUDE.md and the spec carry the context forward.
