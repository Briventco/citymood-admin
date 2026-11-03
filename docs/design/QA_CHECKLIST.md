# CityMood homepage: acceptance checklist

Run this checklist before each phase is marked done, and before the redesign is merged.

## Brand
- [ ] The logo is the supplied PNG, unaltered, only on #000000, at least 64px tall.
- [ ] No lime text on white or paper anywhere (search the CSS for `--cm-lime` on light backgrounds).
- [ ] No border radius, shadows, gradients or colours outside `tokens.css`.
- [ ] Headlines in Source Serif 4, everything else in Source Sans 3, both self-hosted.
- [ ] Yoruba test string renders correctly: Àgbádárìgì Ọjà Ẹ̀kọ́ ṣ

## Layout (compare with `reference/*.png`)
- [ ] 390px: matches `homepage-mobile-390.png`, with all six category blocks present and no horizontal scroll.
- [ ] 768px: two-column grids, mobile header, no horizontal scroll.
- [ ] 1280px: matches `homepage-desktop-1280.png`.
- [ ] 320px width and 200% zoom: nothing overlaps or cuts off.
- [ ] Every article appears at most once on the homepage (Most read excepted).
- [ ] Empty categories hide their block. No breaking items hides the ticker.
- [ ] Articles without images use the text-only card, with no grey boxes.

## Ads
- [ ] Every slot shows an "Advertisement" label.
- [ ] Slot sizes match the spec at each breakpoint, and reserve their space (no layout shift).
- [ ] An empty slot shows the "Advertise with CityMood" house ad, not a dashed box.
- [ ] Creatives can be changed without a code deploy.

## Accessibility (WCAG 2.1 AA)
- [ ] The automated audit (axe or Lighthouse) shows no serious or critical issues.
- [ ] The skip link works and is the first Tab stop.
- [ ] Tab through the whole page: focus is visible everywhere (black outline on light, lime on dark).
- [ ] Mobile menu: aria-expanded updates, Esc closes it, focus is trapped while open and returned on close.
- [ ] Ticker: the pause button works, nothing moves with prefers-reduced-motion, and there is no aria-live.
- [ ] One h1 (the lead headline), with logical h2 and h3 below it.
- [ ] All tap targets are at least 44×44px on mobile.

## Performance (Lighthouse mobile, throttled)
- [ ] LCP under 2.5s, CLS under 0.1.
- [ ] Lead image not lazy-loaded; all images below the fold lazy-loaded with srcset.
- [ ] At most 2 font preloads. No Google Fonts CDN request in production.
- [ ] Homepage JavaScript stays inside the budget in the spec.

## SEO
- [ ] NewsMediaOrganization and WebSite (with SearchAction) JSON-LD validate.
- [ ] Open Graph image and title present.

## Scope
- [ ] No alerts sign-up, social video strip, dark mode or Phase 2 features.
- [ ] Unbuilt page layouts are logged in `OPEN_QUESTIONS.md`, not invented.
