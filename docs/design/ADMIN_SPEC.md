# CityMood Newsroom: Admin Portal Spec

**Status:** Ready to build
**Version:** 1.0, 13 October 2026
**Backend:** Supabase (Postgres, Auth, Storage), inside the existing Next.js app
**Design reference:** `docs/design/reference/admin/*.png`, plus the matching `.html` files for proportions only

The admin portal uses the same tokens and brand rules as the public site (`DESIGN_SPEC.md`, sections 2 and 3). The one difference is the layout: a black sidebar and a light grey (`--cm-paper`) work area with white panels.

---

## 1. Scope

### Confirmed (Proposed Website Structure, section 6)
- Secure staff login
- Create, edit, preview, publish and unpublish articles
- Save drafts, and schedule publication
- Upload featured images
- Set categories, authors, tags and SEO metadata
- Manage basic staff roles
- View and edit existing articles

### Needed by the approved homepage design
These are fields and simple settings, not new features:
- A **Feature on homepage** switch on each article
- A **Breaking news** switch on each article (shows in the ticker for 6 hours)
- Front page pins for the lead story and the top stories row
- A curated **Most read** list

### Approved extras (decided 13 Oct 2026)
- **Ad slots manager:** add, change and end ad campaigns per slot, with dates, without a redeploy.
- **Mobile quick publish:** a phone layout of the editor for reporters in the field.

### Decided against
- **A "send to editor" review step.** Reporters publish their own stories. Editors can edit or unpublish any story.

### Not in scope
- News alerts
- Analytics dashboards (view counts may come later)
- Comments
- Two-factor authentication
- Phase 2 tourism and booking features

---

## 2. Roles

| Role | Can do |
|---|---|
| **Reporter** | <ul><li>Create, edit and publish their own stories</li><li>Delete their own drafts</li><li>Upload photos</li><li>Mark their own story as breaking</li></ul>They **cannot** feature stories on the homepage, change a byline, or edit other people's stories. |
| **Editor** | <ul><li>Everything a Reporter can do, on **any** story</li><li>Unpublish stories and change bylines</li><li>Feature stories, and run the Front page (pins, breaking ticker, Most read)</li><li>Delete stories and media</li></ul> |
| **Admin** | <ul><li>Everything an Editor can do</li><li>Manage staff and invites</li><li>Manage categories</li><li>Manage ad campaigns</li><li>Edit site settings (contact details, social links)</li></ul> |

Enforce roles **in the database** with row-level security (RLS) and triggers (see `admin/schema.sql`), not only in the UI. Hiding a button is not security.

---

## 3. Architecture

### App structure
- **Routes** live in the same Next.js app, under `/admin`. Use a separate route group with its own layout, so public pages never load admin code.
- **Supabase client:** use `@supabase/ssr` with cookie sessions.
  - Server components and server actions use the user's session (anon key plus RLS).
  - The **service role key** is used only in server-only modules (`import 'server-only'`) for staff invites. It must never reach the browser.
- **Access control:** a `proxy.ts` / middleware (whichever your Next.js version uses) checks the session for every `/admin` route except `/admin/sign-in`. Every server action then re-checks the role, because middleware alone is not enough.
- **Public site:** reads only through the `live_articles` view and the public tables, using the anon key. Swap the existing `lib/content` local layer for a Supabase adapter with the same function signatures, so homepage components don't change.

### Scheduling (no cron job)
An article is **live** when `status` is `published` or `scheduled` **and** `publish_at <= now()`.
- **Publish now** sets `status = 'published'` and `publish_at = now()`.
- **Schedule** sets `status = 'scheduled'` and a future `publish_at`.

The homepage already revalidates every 60–120 seconds, so scheduled stories appear on time without any background job. Publishing also calls `revalidatePath('/')` so the change shows immediately.

### Rich text
- Use **Tiptap**, restricted to these elements:
  - paragraphs
  - H2
  - bold and italic
  - links
  - blockquote
  - bullet list
  - inline image from the media library
- Store the Tiptap JSON in `body`, and generate sanitized HTML into `body_html` on save, on the server. Public pages render `body_html`.

### Images
- **Resize in the browser before upload:** longest side 2000px, WebP (JPEG fallback), quality around 0.8. This saves reporters' mobile data and storage space.
- Store files in a public Storage bucket called `media`, at `yyyy/mm/<uuid>.webp`. Record width, height, alt text, caption, credit and focal point in the `media` table.
- On the public site, serve images through `next/image`, with the Supabase host added to `images.remotePatterns`. Apply the focal point with `object-position`.

### Auth
**Sign-in and passwords**
- Email and password only. **Public sign-ups must be disabled** in Supabase (Authentication settings).
- **Password reset:** use Supabase's reset email, which links to `/admin/reset-password`.
- **Session length:** "Keep me signed in" means a long session. Without it, the session ends when the browser closes.
- **Sign-in screen:** its sentence about attempt limits must match the rate limit configured in Supabase. Otherwise, remove the sentence.

**Inviting staff** (Admin only)
1. A server action calls `auth.admin.inviteUserByEmail`.
2. A database trigger creates the profile as an **inactive reporter**.
3. The same server action, using the service role, then sets the chosen role and activates the profile.

New sign-ups can never choose their own role.

**Removing staff**
- Set `profiles.is_active = false` and remove their sessions.
- Their stories and bylines stay.

---

## 4. Screens

Build every screen to its reference image. Where a screen has no image, build it from the same components.

| Route | Reference | Notes |
|---|---|---|
| `/admin/sign-in` | `sign-in-1440.png` | Split layout: black brand panel, white form. Stacks on mobile with the form first. |
| `/admin/articles` | `articles-1440.png` | <ul><li>Status tabs with counts: All, Drafts, Scheduled, Published, Unpublished</li><li>Search by headline, tag or author</li><li>Category and author filters</li><li>Paginated table with a status marker shape for each status</li><li>"Breaking" and "Featured" flags</li><li>Reporters see everyone's stories but can only open their own for editing</li></ul> |
| `/admin/articles/new` and `/admin/articles/[id]` | `article-editor-1440.png` | <ul><li>Autosaves the draft every 10 seconds and on blur, showing "Saved X ago"</li><li>"Ready to publish" checklist: **headline, category, and alt text if there is an image** are required to publish or schedule. Standfirst, image and search description are recommended only.</li><li>Character counters: headline 100, search title 60, search description 155 (warn, don't block)</li><li>The slug is generated from the headline, editable until first publish, and locked after that</li><li>"Preview" opens `/admin/preview/[id]` in a new tab</li></ul> |
| Same editor route below 768px | `quick-publish-mobile-390.png` | <ul><li>Single column, in this order: photo, headline, category, breaking switch, story</li><li>"More details" collapses standfirst, tags, byline and SEO</li><li>Sticky bottom bar with Preview and Publish</li><li>"Take photo" uses `<input type="file" accept="image/*" capture="environment">`</li></ul> |
| `/admin/front-page` | `front-page-1440.png` | <ul><li>Lead story: automatic or pinned</li><li>Breaking ticker: list of live items, with "Extend 6 h" and "End now"</li><li>Top stories: pin, unpin and reorder 4 slots, where empty slots fill automatically</li><li>Most read: curated list, up to 5</li><li>Ad slots: current campaign per slot, "Add campaign" and "Change creative" (Admin only; Editors see read-only)</li></ul> |
| `/admin/ads/[id]` | none | Campaign form: slot, advertiser name, desktop creative, mobile creative, link URL, alt text, start and end dates. Show the slot's required pixel size beside each upload. |
| `/admin/staff` | `staff-1440.png` | Admin only. Invite form, role change, deactivate. |
| `/admin/media` | none | Grid of uploads with search. Click an item to edit alt text, caption, credit and focal point. |
| `/admin/taxonomy` | none | Categories (Admin: add, rename, reorder, hide) and tags (Editor: rename, merge, delete). |
| `/admin/settings` | none | Admin: site settings form. These values feed the public footer and the Contact page. |
| `/admin/preview/[id]` | none | Renders the article in the public style. The article page isn't designed yet, so use a plain layout built from the tokens and flag it. |

### Shared admin components
- **AdminSidebar:**
  - black background, with the logo at 72px and "NEWSROOM" in lime
  - a lime "New article" button
  - nav items, with the active item marked by a 4px lime left border and a `#1A1A18` background
  - the signed-in user at the bottom
  - below 1024px it collapses to a top bar with a menu button
- **PageHeader:** a serif 40px title, with a 6px black rule below it.
- **Panel:** white background, 1px `--cm-rule` border, 18–22px padding, a section title in uppercase Sans 800 at 14px. No radius and no shadow.
- **Switch:** `role="switch"` with `aria-checked`. 52×30px. On: lime track. Off: white track. Both have a black border and a black knob.
- **StatusMarker** (the shape carries the meaning, not colour alone):
  - Published: lime square
  - Draft: outline square
  - Scheduled: outline circle
  - Unpublished: dashed outline
- **Buttons:**
  - Primary: lime, with a 2px black border
  - Secondary: white, with a 2px black border
  - Destructive: a text-style button with an underline
  - All buttons are at least 44px tall
- **Field:** a visible label above the input and a 1px `#8A8A84` border. Invalid fields get a 2px black border plus an icon and a text message. No red, because it isn't in the palette.

### States every screen needs
- **Loading:** skeleton rows in `--cm-paper`.
- **Empty:** for example, "No drafts yet. Start a new article."
- **Error:** a plain sentence with a retry. Never show raw error codes.
- **Unsaved changes:** a warning before the user leaves the editor.
- **Permission denied:** show "You don't have access to this page" and a link back, never a blank page.

---

## 5. How the homepage reads this data

| Homepage module | Rule |
|---|---|
| Lead story | The `lead` pin, if it is live. Otherwise the newest live article with `featured = true` and a featured image. |
| Top stories | Pins `top_1` to `top_4`. Empty slots are filled with the newest live articles that aren't already used on the homepage. |
| Breaking ticker | Live articles where `breaking = true` and `breaking_until > now()`, newest first, at most 5. |
| Category blocks, Latest, People | Same rules as `DESIGN_SPEC.md` section 5, now read from Supabase. |
| Most read | `most_read_picks`, in position order. Picks that aren't live are skipped. |
| Ad slots | The campaign for that slot where `now()` is between `starts_at` and `ends_at`. If there is none, show the house ad. |
| Footer and Contact | `site_settings`. |

---

## 6. Security checklist

- [ ] RLS is enabled on **every** table, and the Supabase security advisor reports no issues.
- [ ] Public sign-ups are disabled. The email redirect URLs only allow the production domain and localhost.
- [ ] The service role key appears only in server-only files. Search the client bundle after a build to confirm.
- [ ] Every server action re-checks the session and role.
- [ ] Rich text HTML is sanitized on the server before it is stored in `body_html`.
- [ ] Uploads are limited to images only and 10 MB before resizing.
- [ ] Automated tests prove that:
  - a Reporter cannot update another person's article, feature a story, or change a byline
  - anon users cannot read drafts or future scheduled stories
  - Editors cannot manage staff or ads

---

## 7. Hosting notes (for CityMood, outside the ₦240,000 fee)

- **Use the Supabase Free plan only for building and testing.** Free projects pause after a week of inactivity, have no automatic backups, and have 1 GB of storage.
- **Go live on Supabase Pro.** It starts at $25 a month and adds daily backups and image transformations. Pick the region closest to Lagos that Supabase offers.
- **Hosting the Next.js app** (for example on Vercel) is a separate cost decision.

---

## 8. Open questions

| # | Question | Default |
|---|---|---|
| A1 | Who are the first Admin and Editors? | Caleb as the first Admin, who then invites the rest |
| A2 | Should reporters' breaking items need an editor to approve them? | No. Editors can end any item from the Front page. |
| A3 | Article page design (used by Preview) | Plain token-based layout until it is designed |
| A4 | Can view counts for Most read come later? | Yes. Add an `article_views` table in a later phase. |
