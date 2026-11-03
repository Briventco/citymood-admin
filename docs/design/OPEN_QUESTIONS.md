# Open questions

Claude Code adds to this file during the build. CityMood or Brivent answer each question here.

| # | Question | Context / page | Default used meanwhile | Answer |
|---|---|---|---|---|
| 1 | Single lime (#9AFF01) or keep the magazine lime too? | Brand | Single lime | |
| 2 | Newsroom address, phone, emails, corrections email | Footer, Contact | Placeholders in config | Verified from CityMood Badagry: 10, Agric Road (Opposite Local Government Secretariat), Ajara, Badagry Central; phone +234 904 558 7616; email citymoodbadagry@gmail.com |
| 3 | Credit for the cultural-performance photo | Culture feature | "Photo: CityMood" | Confirmed: "Photo: CityMood" |
| 4 | Facebook page URL | Footer | Placeholder link | Confirmed: https://www.facebook.com/citymoodbadagry |
| 5 | Production domain (videos show citymood.ng) | SEO, structured data | To confirm | Confirmed: https://citymood.ng |
| 6 | Most read data source | Homepage | Server view count, else curated | |
| 7 | Font subsets: the spec asks for `latin` + `latin-ext`, but Yoruba Ẹ, Ọ, ọ and the combining tone marks (U+0300, U+0301) live in the `vietnamese` subset. Without it they fall back to Georgia/Arial. | Fonts, all pages | `vietnamese` subset added too; `unicode-range` means it only downloads when a page uses those characters (about 6–8KB per weight) | |
| 8 | Font weights: spec §3 loads Serif 600/700 and Sans 400/700/800/300i, but `tokens.json` lists Serif 500 and Sans 600, and §4.4 sets ticker headlines in Sans 600. | Fonts, BreakingTicker | Spec §3 list only; ticker headlines will use Sans 700 | |
| 9 | Ad creatives "changeable without a deploy" | AdSlot | Production campaigns now live in Supabase `ad_campaigns` and are managed at `/admin/ads`; `config/ads.ts` remains a development fallback. Creative approval and overlap policy remain newsroom decisions. | |
| 10 | Pages that don't exist yet: article, category, search, latest, About, Contact, Advertise, Corrections, Privacy, Terms | All links | Phase 5 was skipped, so links point to the planned URLs (`/{category}/{slug}`, `/{category}`, `/search?q=`, `/latest`, `/about`…) and currently 404, including the search form | |
| 11 | No CMS or database is connected | Whole site | Content comes from `lib/content`. Fictional seed stories load only in development (or with `CONTENT_SEED=1`). A production build shows the shell and a "No stories yet" message until a CMS adapter is added. | |
| 12 | Breaking ticker motion | BreakingTicker | No marquee: one headline at a time with a 44px "Next" button, so nothing moves and no Pause control is needed (WCAG 2.2.2, reduced motion). Headlines wrap instead of being cut. | |
| 13 | Tablet order: the spec says use the mobile order; the tablet reference PNG shows the desktop order | Homepage 640–1023px | Followed the spec (mobile order, two-column card rows) | |
| 14 | Category pair on tablet: the spec says two columns | Homepage 640–1023px | Local and Politics stay stacked below 1024px, as in the tablet reference; the 180px compact thumbnail leaves too little room for headlines in two columns | |
| 15 | Ad slots per breakpoint | Homepage | Leaderboard from 640px only (the mobile order has none). Billboard from 1024px only. Below 1024px: MPU after Latest and MPU after Business. | |
| 16 | LIVE badge on the Latest rail | LatestRail | Left out: the rail refreshes with the page (every 90s), not live | |
| 17 | Revalidate on publish | Homepage caching | No publish event exists, so pages regenerate every 90 seconds (`revalidate` in the root layout) | |
| 18 | Top stories selection | Homepage | One per category, newest first, preferring a story with an image in each category | |
| 19 | Link prefetching | All links to unbuilt routes | `prefetch={false}`: prefetch would 404 today, and on mobile data it would download every visible story in the background. Revisit when the routes exist. | |
| 20 | Experimental `inlineCss` (Next 16) | Performance | On: the ~7KB Tailwind stylesheet is inlined, removing the only render-blocking request. Turn it off if it causes problems, or if most readers return often and would benefit from a cached stylesheet. | |
| 21 | Fallback fonts | Fonts | Metric-matched local fallbacks (Arial, Times New Roman) added to the font stacks, so swapping in the non-preloaded weights doesn't shift layout (CLS 0.022 → 0.001) | |
