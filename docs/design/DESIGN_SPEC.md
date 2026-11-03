# CityMood Digital Gateway: Homepage Design Spec

**Direction:** 1, "Window to Badagry"
**Status:** Ready to build (homepage and shared components). Other Phase 1 page layouts are not designed yet.
**Version:** 1.0, 13 October 2026
**Owner:** Brivent Global Innovations, for CityMood Communications

This is the source of truth for the build. If this spec, the reference HTML and the screenshots disagree, follow this order:

1. This spec
2. `tokens/tokens.css`
3. `reference/*.png` screenshots
4. `reference/*.html` static pages

The reference HTML is a design prototype written with inline styles. Use it to check layout and proportions. Do **not** copy its markup or inline styles into the codebase. Rebuild it as proper components using the tokens.

---

## 1. Scope

### In scope (confirmed by the Phase 1 brief)

- **Homepage:** the full layout in this spec.
- **Global shell, used on every page:**
  - site header
  - section navigation and mobile menu
  - breaking ticker
  - footer
  - ad slot component
- **Shared components:** story cards, section headers, category labels and the Most read list. Article, category, archive and search pages will reuse them.
- **Advertising:** slots for direct-sold ads.
- **Social links:** social-sharing and social profile links.

### Not designed yet: do not invent layouts

The layouts for these pages have not been designed:

- Article pages
- Category and archive pages
- Search
- About and Contact
- The editorial dashboard

On these pages you may apply the global shell, the tokens and the shared components. Keep their existing structure. List anything that needs a proper layout decision in `docs/design/OPEN_QUESTIONS.md`.

### Out of scope: do not build

- A news alerts or newsletter sign-up. The brief marks this as unconfirmed.
- An "On CityMood socials" video strip. It was proposed in Direction 2 and is not approved.
- Anything from Phase 2: tourism booking or hospitality referrals.
- Dark mode. The brand uses fixed black and white areas, so there is no theme switch.

---

## 2. Brand rules (non-negotiable)

1. **Logo:** use `assets/citymood-logo.png` exactly as supplied.
   - Do not redraw, recolour, crop or stretch it, and do not rebuild it in CSS or SVG.
   - It is a black square image, so place it only on pure `#000000` backgrounds, where its edges disappear.
   - Minimum display height is 64px. Alt text: `CityMood`.
2. **Lime `#9AFF01` is never text on white or paper.** That pairing has a contrast ratio of 1.26:1. On light backgrounds lime may only appear as:
   - a fill behind black text (16.7:1)
   - a 12px marker square with a 1px black outline, next to black text
   - a rule or border
3. **Only one lime.** The softer magazine lime (`#A8CE3B`) is not used on the website. This is pending final sign-off from CityMood. If it changes, update only `--cm-lime`.
4. **Square corners everywhere.** No border radius, no shadows and no gradients.
5. **No invented colours.** Category colour coding, orange, red "breaking" labels and so on are not part of the brand. Breaking news uses black on lime.
6. **Taglines:** "Window to Badagry" goes in the masthead. "…Badagry and beyond" may appear in the footer or About page. Do not write new slogans.

---

## 3. Foundations

### Colour

| Token | Hex | Use |
|---|---|---|
| `--cm-lime` | #9AFF01 | Fills, markers, rules; text only on black |
| `--cm-black` | #000000 | Masthead, footer, dark bands, headlines, body |
| `--cm-white` | #FFFFFF | Reading background |
| `--cm-paper` | #F3F3EF | Ad bands, neutral strips |
| `--cm-rule` | #D9D9D4 | 1px dividers on white |
| `--cm-rule-dark` | #333330 | 1px dividers on black |
| `--cm-meta` | #5C5C58 | Bylines, times, captions (6.7:1) |
| `--cm-meta-on-dark` | #B8B8B2 | Secondary text on black (10.5:1) |
| `--cm-ink-soft` | #222222 | Standfirsts and summaries |

### Typography

- **Source Serif 4** is used for headlines.
- **Source Sans 3** is used for everything else.
- **Self-host both fonts** with a package such as `@fontsource`, or with the framework's font loader. Do not load them from the Google Fonts CDN in production. Many readers are on mobile data, and self-hosting removes an extra connection.
- **Include the `latin` and `latin-ext` subsets.** Yoruba place names and personal names need `latin-ext`, for example Àgbádárìgì, Ọjà and Ẹ̀kọ́.
- **Load only these weights:**
  - Serif: 600 and 700
  - Sans: 400, 700, 800, and 300 italic for the tagline
- **Font loading:** use `font-display: swap`, and preload only Serif 700 and Sans 400.

The type scale lives in `tokens.css`. It is mobile-first, with desktop sizes from 1024px. Key roles:

| Role | Mobile | Desktop | Font and weight |
|---|---|---|---|
| Lead headline | 30/1.08 | 50/1.05 | Serif 700 |
| Feature headline | 26/1.1 | 40/1.08 | Serif 700 |
| Band title ("People of Badagry") | 30/1 | 44/1 | Serif 700 |
| Section lead card | 24/1.12 | 30/1.1 | Serif 700 |
| Card headline | 19/1.2 | 22/1.2 | Serif 700 |
| List headline | 18/1.25 | 19/1.25 | Serif 600 |
| Standfirst | 17/1.5 | 20/1.5 | Sans 400 |
| Summary | 16/1.45 | 17/1.45 | Sans 400 |
| Section heading | 19 | 22 | Sans 800, uppercase |
| Kicker (category label) | 13 | 14 | Sans 800, uppercase, 0.1em tracking |
| Metadata | 13 | 14 | Sans 400, with 700 for emphasis |
| Labels ("Advertisement", "Breaking") | 11 | 11 | Sans 800, uppercase, 0.12–0.14em tracking |

Never truncate a headline with an ellipsis. Headlines wrap. Editors control headline length.

### Layout

- **Container:** max width 1240px, centred.
- **Side gutter:** 16px below 640px, 24px from 640px.
- **Breakpoints:**
  - `sm` 640px
  - `md` 768px
  - `lg` 1024px, where the desktop layouts and type sizes start
  - `xl` 1280px
- **Mobile first:** build for 360–390px wide, then add columns as space allows.
- **Column gaps:** 28–40px on desktop and 16–24px on mobile.
- **Rules:**
  - A section starts with a **6px black top rule**.
  - Items within a section are separated by **1px `--cm-rule`** lines.
  - The section nav has a **2px black bottom rule**.
  - The footer starts with an **8px lime top rule**.
- **No cards with backgrounds or shadows.** Structure comes from rules and whitespace.

### Images

| Context | Ratio |
|---|---|
| Lead story, desktop | 16:9 |
| Lead story, mobile | 3:2 |
| Standard card | 3:2 |
| Section lead card | 16:10 |
| Portrait (People of Badagry) | 4:5 |
| Culture feature, desktop | 16:9 |
| Culture feature, mobile | 4:3 |
| Thumbnail, mobile compact card | 1:1, 96px |
| Thumbnail, desktop compact card | 3:2, 180px wide |

Image handling rules:

- Use `object-fit: cover` and keep the editor's focal point if the CMS stores one.
- Serve responsive images (`srcset` and `sizes`) in modern formats (AVIF or WebP, with JPEG fallback).
- Give the lead image priority (`fetchpriority="high"`, not lazy). Lazy-load every image below the fold.
- Reserve the aspect-ratio box before the image loads, so there is no layout shift.
- **No-image fallback:** if an article has no image, render the text-only version of the card. Never show a grey placeholder box on the live site.
- Captions are 13–14px in `--cm-meta`. The photo credit goes at the end, for example "Photo: CityMood".

---

## 4. Components

Build each one as a reusable component in the codebase's framework. Names below are suggestions; follow the repo's naming conventions.

### 4.1 SiteHeader (masthead)

**Desktop (from 1024px):**
- A black bar, in this order: logo (104px tall), the tagline block, then a search form pushed to the right.
- **Tagline block:**
  - "WINDOW TO BADAGRY" in Sans 300 italic, 17px, 0.42em tracking, white.
  - Below it, today's date and "Badagry, Lagos State" in Sans 14px, `--cm-meta-on-dark`.
- **Search form:** a white input, 46px tall, plus a square lime submit button containing a black search icon.
  - The button has `aria-label="Search"`.
  - The input has a visually hidden `<label>`.
  - The form submits to the existing search route.

**Mobile (below 1024px):**
- A black bar laid out as: menu button (48×48) on the left, logo (72px tall) in the centre, search button (48×48) on the right.
- The search button opens a search field or goes to the search page, whichever the codebase already supports.

**Date:** render it on the server in the Africa/Lagos timezone.

### 4.2 SectionNav

**Desktop:**
- A white bar with a 2px black bottom rule. Links are Sans 700, 16px, with 14px × 16px padding.
- Section order:
  1. Home
  2. Local News
  3. Community & People
  4. Business & Development
  5. Politics & Public Affairs
  6. Culture & Events
  7. Tourism & Heritage
- **Active item:** lime background with black text, plus `aria-current="page"`.
- **Category source:** read categories from the CMS, because the brief says categories must be configurable. Do not hard-code them. Use the order above as the default seed.

**Mobile:**
- The same links in a horizontally scrolling strip under the header, with short labels: Local, Community, Business, Politics, Culture, Heritage.
- No visible scrollbar is required, but the strip must stay keyboard scrollable.

### 4.3 MobileMenu

- Opened by the header menu button.
  - The button has `aria-expanded` and `aria-controls`.
  - Its label switches between "Open menu" and "Close menu".
  - The icon switches from a hamburger to a lime X.
- **Panel:** black, full width, pushed below the header.
  - A search form at the top.
  - Then the section links, each 52px tall, separated by `--cm-rule-dark`. The active link is lime with black text.
  - Then About, Contact and Advertise.
- **Behaviour:**
  - Esc closes the menu.
  - Focus moves into the panel on open and returns to the button on close.
  - Focus is trapped while the menu is open.
  - The page behind does not scroll.
- **Without JavaScript,** the menu must still be reachable, for example as a `<details>` element or a link to a sections page.

### 4.4 BreakingTicker

**Appearance:**
- A black strip, at least 52px tall, directly under the nav.
- A "BREAKING" label: black text on lime, Sans 800, 13px, uppercase.
- Headlines are white Sans 600 links, separated by small lime squares (`aria-hidden`).

**Content:**
- Published articles carrying the tag **`breaking`**, newest first, maximum 5.
- Each item expires after a configurable window, 6 hours by default.
- **If there are no breaking items, the whole strip is not rendered.**

**Motion:**
- If you animate the strip as a horizontal marquee, it must have a visible **Pause / Play** button (44×44) to meet WCAG 2.2.2.
- With `prefers-reduced-motion: reduce` it must not move. Show the newest item and let the rest be reached by Tab or a "next" control.
- Text must never be cut off mid-word in the static state. Fade the right edge, or show one item at a time.

**Accessibility:** wrap it in `<section aria-label="Breaking news">`. Do not use `aria-live`, because a looping ticker would announce constantly.

### 4.5 AdSlot

The site sells ads directly, so slots must be predictable, clearly labelled and stable.

**Visible label:** every slot has an "ADVERTISEMENT" label above it: 11px Sans 700, `--cm-meta`, centred.

**Sizes** (fix the box size so it never causes layout shift):

| Slot | Desktop (≥1024px) | Tablet (640–1023px) | Mobile (<640px) |
|---|---|---|---|
| `leaderboard` | 970×90 | 728×90 | 320×50 |
| `mpu` | 300×250 | 300×250 | 300×250 |
| `billboard` | 970×250 | 728×90 | 300×250 |

**Background:** leaderboard and billboard sit on a full-width `--cm-paper` band. The MPU sits in its column.

**When no campaign is booked:**
- Show a house ad: a black panel with the logo, the line "Advertise with CityMood" and a link to the advertise or contact page.
- Never leave an empty dashed box on the live site. The dashed outline is only for development or preview mode.

**Implementation:**
- Make the creative configurable without a deploy: image, link and alt text per slot, plus start and end dates. Use the CMS if it supports this; otherwise use a simple config file. Raise it in `OPEN_QUESTIONS.md` if neither exists.
- Ad links open in the same tab and use `rel="sponsored noopener"`.

### 4.6 CategoryLabel (kicker)

- A 12px lime square with a 1px black outline, an 8px gap, then the category name in Sans 800, uppercase, 0.1em tracking, black.
- On black backgrounds, drop the square and set the text in lime instead.
- It links to the category page.

### 4.7 SectionHeader

- A 6px black top rule with 12px padding above the row.
- In the row: a 14px lime marker square, then the title (Sans 800, 22px desktop / 19px mobile, uppercase). A "See all" link sits on the right (Sans 700, 15px), with a tap area at least 44px tall, linking to the category page.

### 4.8 StoryCard variants

Every card is an `<article>`. The headline is a heading (`h2` or `h3`, following page order) wrapping one link to the article. Image `alt` text comes from the CMS.

| Variant | Used for | Structure |
|---|---|---|
| `lead` | Homepage lead | Image (16:9 desktop, 3:2 mobile, full-bleed on mobile) → CategoryLabel → lead headline → standfirst → metadata line |
| `standard` | Top stories row, Tourism & Heritage | 3:2 image → kicker → card headline |
| `section-lead` | First story in a category block | 16:10 image → card-large headline → summary |
| `compact` | Local and Politics blocks, mobile secondary stories | Desktop: 180px 3:2 thumbnail on the left, headline and summary on the right. Mobile: text on the left, 96px square thumbnail on the right |
| `list` | Rest of a category block | Headline only (list size), 1px rule below |
| `latest` | Latest rail | Meta line ("10:42 · Public Affairs", 13px Sans 700, `--cm-meta`), then list headline. Show "Yesterday" or a date when the story is older than today |
| `portrait` | People of Badagry (on black) | 4:5 image → lime role and place line ("Canoe builder, Topo") → white Serif 600 headline |
| `feature` | Culture feature | Large image with caption on one side; on the other, CategoryLabel → feature headline → standfirst → 2 related links |

Metadata line format: `By {Author} · {12 Oct 2026} · {6} min read`. The date uses the "12 Oct 2026" format in the Africa/Lagos timezone.

### 4.9 LatestRail

- A heading "LATEST" (Sans 800, 15px, uppercase) under a 6px black rule.
- An optional small lime "LIVE" badge on the right. Show it only if the rail updates automatically; otherwise leave it out.
- Five `latest` items, then an "All latest news" button: 48px tall, 2px black border, linking to the archive.

### 4.10 PeopleBand

- A full-width black section with a lime kicker "COMMUNITY & PEOPLE" and the band title "People of Badagry".
- Four `portrait` cards: in a grid on desktop, in a horizontal scroll row on mobile with each card about 210px wide.
- Data: latest 4 articles in the Community & People category that have a portrait-orientation image. Optionally, an editor-set flag `feature_people`.

### 4.11 MostRead

- A black box with heading "MOST READ" (Sans 800, uppercase, white).
- Numbered items: the numeral in Serif 700 at 34px (30px on mobile) in lime, then the headline in white Serif 600.
- Use 4 items on desktop and 3 on mobile.
- **Data:** the most viewed in the last 7 days.
  - If the codebase has no view counting, add a lightweight server-side counter. Do not add a third-party analytics script just for this.
  - Otherwise, fall back to an editor-curated list.
  - Record which option you chose in `OPEN_QUESTIONS.md`.

### 4.12 SiteFooter

- Black, with an 8px lime top rule. It has four groups:
  1. **Brand:** logo (120px tall) and a short description: "Independent news for Badagry and surrounding communities. Published by CityMood Communications."
  2. **Contact:** address, newsroom phone, newsroom email and corrections email. All are placeholders until CityMood provides them; keep them in config, not hard-coded.
  3. **CityMood:** About us, Contact, Advertise with us, Corrections policy, Privacy notice and Terms of use.
  4. **Follow:**
     - Facebook (CityMood Badagry)
     - Instagram (@citymoodbadagry)
     - TikTok (@citymoodbadagry)
- Group headings are lime Sans 800 uppercase. Links are white, with 44px tap height on mobile.
- Bottom line: "© {year} CityMood Communications", 13px, `--cm-meta-on-dark`.

---

## 5. Homepage composition

### Desktop (from 1024px), top to bottom

1. SiteHeader
2. SectionNav
3. BreakingTicker, only when there are breaking items
4. AdSlot `leaderboard`
5. **Lead row:** a `lead` card (about two-thirds of the width) next to the LatestRail (about one-third)
6. **Top stories row:** four `standard` cards in four columns, one per category where possible. Cards never repeat the lead story.
7. **Category pair:** Local News and Politics & Public Affairs, side by side. Each is a SectionHeader, one `compact` card and two `list` items.
8. **PeopleBand**, full width
9. **Business & Development:** a `section-lead` card, three `list` items and an AdSlot `mpu`, as three columns
10. **Culture & Events:** a `feature` card
11. AdSlot `billboard`
12. **Tourism & Heritage and Most read:** two `standard` cards (two-thirds of the width) next to the MostRead box (one-third)
13. SiteFooter

### Mobile (below 640px), top to bottom

1. SiteHeader (mobile)
2. SectionNav strip
3. BreakingTicker
4. `lead` card
5. LatestRail (4 items and the button)
6. AdSlot `mpu`
7. Two `compact` cards (top stories)
8. PeopleBand (horizontal scroll)
9. Local News block
10. Politics & Public Affairs block
11. Culture `feature` (image first)
12. MostRead (3 items)
13. Business & Development block
14. AdSlot `mpu`, as the second slot
15. Tourism & Heritage block
16. SiteFooter

The mobile reference screenshot leaves out some category blocks to stay short. **All six categories must appear on mobile**, in the order above.

### Tablet (640–1023px)

Use the mobile order with two-column grids for the card rows and the category pair. Use the desktop header from 1024px only.

### Data rules

- **Lead story:** the newest published article flagged `featured`, or pinned by an editor if the CMS supports pinning. Otherwise, the newest article.
- **Deduplication:** an article appears **at most once** on the homepage. Fill slots in this order: lead, then latest, then top stories, then category blocks, then People, Culture, Tourism, and finally Most read. Most read is the one exception; it may repeat articles shown elsewhere.
- **Empty sections:** if a category has no articles, hide its block entirely. Never show an empty heading.
- **Caching:** cache or statically regenerate the homepage. Revalidate on publish if the stack supports it; otherwise every 60–120 seconds.

---

## 6. Accessibility (WCAG 2.1 AA minimum)

- **Skip link:** add "Skip to main content" as the first focusable element.
- **Landmarks:** use `header`, `nav`, `main`, `aside` for ads and rails, and `footer`.
- **Headings:** one `h1` per page. On the homepage it is the lead headline. Section titles are `h2` and card headlines `h3`.
- **Contrast:** follow the colour rules in section 2. Body text is at least 4.5:1, and large text at least 3:1.
- **Focus:** always visible.
  - On light backgrounds: a 3px solid black outline with 2px offset.
  - On black backgrounds: a 3px lime outline.
  - Never `outline: none` without a replacement.
- **Touch targets:** at least 44×44px, including nav links, "See all" links, icon buttons and footer links on mobile.
- **Icon buttons:** every icon-only button has an `aria-label`. Decorative SVGs are `aria-hidden="true"`.
- **Ticker:** pause control and reduced-motion support, as in section 4.4.
- **Images:** every content image has alt text from the CMS, and the dashboard should require it. Decorative images use `alt=""`.
- **Language:** `lang="en"` on `<html>`. Yoruba words do not need special markup.
- **Zoom:** the layout works at 200% zoom and at 320px width with no horizontal scrolling.

---

## 7. Performance budget (readers on mobile data)

| Metric | Target | Test condition |
|---|---|---|
| Largest Contentful Paint | under 2.5s | Throttled 4G, mid-range Android |
| Cumulative Layout Shift | under 0.1 | Ad slots and images reserved |
| Total JavaScript on the homepage | under 100KB gzipped, excluding the framework runtime if unavoidable | |
| Font files preloaded | 2 at most | |
| Third-party scripts | none, apart from analytics already in the codebase | |
| Homepage HTML | usable without JavaScript | Menu and search still work |

---

## 8. SEO and metadata

- **Homepage structured data:** JSON-LD for `NewsMediaOrganization` (name CityMood, logo, `sameAs` the social profiles) and `WebSite` with a `SearchAction` that points at the search route.
- **Open Graph and Twitter cards:** use the lead story image on the homepage, or a default share image. The default should be the logo on black, at 1200×630.
- **Titles:** the homepage title is "CityMood: News from Badagry and surrounding communities". Confirm the wording with CityMood.

---

## 9. Edge cases to handle

- **Very long headlines** (more than 120 characters) wrap without breaking the grid.
- **Very short headlines** (2–3 words) do not leave awkward empty columns.
- **Articles with no image** use the text-only card. The lead story is the exception: if the lead has no image, choose the next featured article that has one.
- **Uncategorised articles** never appear in category blocks.
- **Yoruba diacritics** render correctly in every font weight. Test: "Àgbádárìgì Ọjà Ẹ̀kọ́ ṣ".
- **An empty homepage** (no articles) still renders the shell and a friendly message.
- **Ad creatives** with the wrong aspect ratio are letterboxed inside the slot, never stretched.

---

## 10. Open decisions (do not block the build; keep them configurable)

| Decision | Current default | Owner |
|---|---|---|
| Single lime or both limes | Single, #9AFF01 | CityMood |
| Contact details, address, corrections email | Placeholders in config | CityMood |
| Credit for the cultural-performance photo | "Photo: CityMood" pending | CityMood |
| Most read data source | Server view count, else curated | Dev team |
| Facebook page URL | Placeholder link | CityMood |
| Production domain (videos show citymood.ng) | To confirm | CityMood |
| Homepage page title wording | As in section 8 | CityMood |
