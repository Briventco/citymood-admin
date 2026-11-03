# Building the admin portal with Claude Code

Do this **after** the homepage rebuild has finished. There are two parts: about 10 minutes of setup that only you can do, then one prompt for Claude Code.

---

## Part 1: Supabase setup (you, about 10 minutes)

1. **Create the project.** Go to supabase.com, sign in and click **New project**.
   - Name it `citymood-dev`. Use this one for building and testing; a separate production project comes later.
   - Pick the region closest to Lagos.
   - Save the database password somewhere safe.
2. **Turn off public sign-ups.** Open **Authentication → Sign In / Providers**, keep **Email** enabled, and turn **Allow new users to sign up** **off**.
3. **Set the redirect URLs.** Open **Authentication → URL Configuration**.
   - Site URL: `http://localhost:3000`
   - Add the redirect URL `http://localhost:3000/**`
4. **Copy the keys.** Open **Project Settings → API keys** (or **Data API**) and copy three values: the Project URL, the anon or publishable key, and the service role or secret key.
5. **Create the env file.** In the citymood2 folder, create a file named `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your anon or publishable key
   SUPABASE_SERVICE_ROLE_KEY=your service role or secret key
   ```
   Never share the service role key and never commit it. Claude Code will confirm `.env.local` is in `.gitignore`.
6. **Log in to the Supabase CLI.** In the VS Code terminal, run `npx supabase login` and approve it in the browser.

Supabase's menu names change from time to time. If something isn't where these steps say, ask Claude Code or me to find it.

---

## Part 2: The prompt

Start a **new** Claude Code chat and paste the text below. It will run through all of it, committing after each step, and only stop when it needs you.

```
Build the CityMood admin portal and connect the site to Supabase.
Read these fully first:
- docs/design/ADMIN_SPEC.md (source of truth for the admin)
- docs/design/admin/schema.sql and docs/design/admin/rls-tests.sql
- docs/design/DESIGN_SPEC.md sections 2 and 3 (brand rules and tokens apply to the admin too)
- the reference images in docs/design/reference/admin/
Supabase keys are in .env.local. I've already run "npx supabase login".

Work through these steps in order, without stopping for my approval between them. Commit after each step.
If you hit a decision, use the default in ADMIN_SPEC.md section 8, log it in docs/design/OPEN_QUESTIONS.md and continue.
Stop only if you need me to do something (like linking the project) or something would delete work.

1. Setup: create a branch named feature/admin-portal from the current redesign branch. Install
   @supabase/supabase-js, @supabase/ssr, Tiptap (starter kit, link and image extensions), and an HTML sanitizer.
   Check that .env.local is gitignored. Initialise supabase/, link it to my project (ask me for the project ref),
   turn docs/design/admin/schema.sql into the first migration, push it, and generate TypeScript types.
2. Tests: make docs/design/admin/rls-tests.sql runnable as an npm script ("test:rls") against the linked
   citymood-dev database only (never production; it rolls back its fake users), and run it. All checks must pass before you continue.
3. Auth and shell: Supabase clients (browser, server, and a server-only admin client), the /admin route
   protection, sign-in, sign-out, password reset, the AdminSidebar and admin layout. Then create my first
   Admin account: ask me for my email and send me an invite.
4. Articles: the articles list and the article editor exactly like the reference images. Include
   autosave, the publish checklist, scheduling in Lagos time, the Breaking and Featured switches (feature is
   hidden for reporters), tags, byline, SEO fields, slug rules, browser-side image resizing before upload,
   alt text / caption / credit / focal point, and the preview page.
5. Mobile quick publish: the same editor below 768px laid out like quick-publish-mobile-390.png,
   with the camera input and a sticky Publish bar.
6. Front page and ads: the front page screen (lead pin, breaking ticker controls, top stories pins,
   Most read picks), the ad campaign list and form, and the site settings form.
7. Remaining screens: staff (invite, change role, deactivate), media library, categories and tags,
   all built from the same components.
8. Connect the public site: replace the local lib/content layer with a Supabase adapter that keeps the
   same function signatures, following ADMIN_SPEC.md section 5. Publishing calls revalidatePath('/').
   Add a seed script with clearly fake placeholder stories for local development only.
9. QA: run test:rls, lint, typecheck and the build. Search the client bundle for the service role key
   (it must not appear). Run docs/design/scripts/visual-check.mjs on /admin/sign-in, and take
   screenshots of each admin screen at 1440 and 390 wide to compare with docs/design/reference/admin/.
   Fix the differences.

When you're done, give me a short plain-English summary: what works, how to try it (which URL, how to
sign in), what's still missing, and anything I need to decide or do.
```

---

## When it finishes

1. **Sign in.** Go to `localhost:3000/admin/sign-in` and sign in with the invite email.
2. **Try a full publish.**
   - Write a test story, add a photo, mark it **Breaking** and publish it.
   - Check that it appears on the homepage and in the ticker.
3. **Test it on your phone.** Open the same address from a phone on the same Wi-Fi, using the Network URL shown in the terminal, and try the mobile editor.
4. **Report back.** Send me the summary and any screenshots that look off.
