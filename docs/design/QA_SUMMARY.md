# CityMood homepage: QA summary

Branch `redesign/citymood-direction-1`, 13 October 2026. Checked against `QA_CHECKLIST.md`.
Dev checks used the fictional seed content. Performance used a production build with `CONTENT_SEED=1`.

**Result: 27 of 29 checks pass. Two are partial; both need a decision, not a code fix (see the end).**

## Brand

| Check | Result | Evidence |
|---|---|---|
| Logo is the supplied PNG, only on black, ≥64px | Pass | Byte-identical copy (`cmp`); used at 72/104px (header), 120px (footer), 64px (house ad), all on `--cm-black` |
| No lime text on white or paper | Pass | Script checked every visible text node coloured `#9AFF01`; all sit on black |
| No radius, shadows, gradients or off-token colours | Pass | 0 elements with radius, box-shadow or gradient; no raw hex outside `globals.css` tokens; Tailwind radius/shadow scales removed |
| Serif headlines, Sans everything else, self-hosted | Pass | `public/fonts/*.woff2`; 0 third-party requests |
| Yoruba test string renders | Pass | `/__design` shows it in all six weights; needs the extra `vietnamese` subset (OPEN_QUESTIONS #7) |

## Layout

| Check | Result | Evidence |
|---|---|---|
| 390px matches reference, all six categories, no horizontal scroll | Pass | `screenshots/compare-390.png` |
| 768px two-column grids, mobile header, no horizontal scroll | Pass | `screenshots/compare-768.png`; spec order used rather than the PNG's (OPEN_QUESTIONS #13, #14) |
| 1280px matches reference | Pass | `screenshots/compare-1280.png` |
| 320px width and 200% zoom | Pass | No horizontal scroll at 320px or at 640px (1280px at 200%) |
| Each article at most once (Most read excepted) | Pass | Unit test over the full seed set (`lib/homepage.test.ts`) |
| Empty categories hide; no breaking hides the ticker | Pass | Unit tests for both rules |
| No-image articles use text-only cards | Pass | Seed includes no-image stories; no grey boxes |

## Ads

| Check | Result | Evidence |
|---|---|---|
| Every slot has an "Advertisement" label | Pass | |
| Sizes per breakpoint, space reserved | Pass | Measured: 970×90 / 300×250 / 970×250 desktop, 728×90 + 300×250 tablet, 300×250 mobile; CLS 0.001 |
| Empty slot shows the house ad | Pass | |
| Creatives changeable without a deploy | **Partial** | `config/ads.ts` supports image, link, alt and dates, but there is no CMS, so a change needs a redeploy (OPEN_QUESTIONS #9) |

## Accessibility

| Check | Result | Evidence |
|---|---|---|
| Automated audit | Pass | axe: no serious/critical at 390/768/1280; Lighthouse accessibility 100 |
| Skip link is the first Tab stop | Pass | |
| Focus always visible | Pass | 72 Tab stops: 3px black outline on light, lime inside black areas |
| Mobile menu | Pass | aria-expanded and label update, focus moves in, trapped, Esc closes and returns focus, page scroll locked; works without JS (`<details>`) |
| Ticker | Pass | Not animated (one headline + Next), so no pause needed; 0 animations with reduced motion; no `aria-live` |
| One h1, logical h2/h3 | Pass | h1 = lead headline; sections h2; cards h3 |
| Tap targets ≥44px | Pass | visual-check reports none smaller |

## Performance (production build, mobile)

| Check | Result | Evidence |
|---|---|---|
| LCP < 2.5s, CLS < 0.1 | **Partial** | Lighthouse with applied throttling: LCP 1.2s, CLS 0.001, performance 99. Lighthouse's simulated estimate swings between 1.8s and 3.0s across runs (performance 95–99); the remaining time is the framework's hydration work on a 4× slower CPU. |
| Lead not lazy; others lazy with srcset | Pass | Lead `loading=eager`, `fetchpriority=high`, preloaded; the other 20 images lazy with `srcset` (AVIF/WebP) |
| ≤2 font preloads; no Google Fonts | Pass | Serif 700 and Sans 400 (latin) only |
| JS within budget | Pass | Our code: one 11KB gzipped chunk. Framework runtime (React/Next) about 133KB, excluded by the spec. framer-motion removed. |

## SEO

| Check | Result | Evidence |
|---|---|---|
| NewsMediaOrganization and WebSite + SearchAction JSON-LD | Pass | Parsed from the page. Not run through Google's Rich Results test (needs a public URL). |
| Open Graph image and title | Pass | Lead image; default share image (logo on black, 1200×630) when there is no lead image; Lighthouse SEO 100 |

## Scope

| Check | Result |
|---|---|
| No alerts sign-up, video strip, dark mode or Phase 2 | Pass: newsletter, video showcase, stats, directory and tourism hub removed |
| Unbuilt layouts logged, not invented | Pass: OPEN_QUESTIONS #10 (Phase 5 skipped, so those links 404 for now) |

## Needs a decision

1. **A content source.** There is no CMS. A production build shows the shell and "No stories yet". Seed stories are dev-only.
2. **The missing pages.** Article, category, search, latest, About, Contact, Advertise and the policy pages don't exist, so every link and the search form 404.
3. **Ad changes without a deploy.** This needs the CMS (or a remote config) chosen in point 1.
4. **The simulated LCP budget.** Measured LCP passes; Lighthouse's simulation is borderline. Confirm on a real mid-range Android once the site is on a real host.
