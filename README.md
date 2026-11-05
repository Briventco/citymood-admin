# CityMood Editorial Admin Portal

The standalone editorial newsroom workspace for [CityMood](https://citymood.ng) — independent news and community reporting covering Badagry Central, Badagry West, Olorunda, and surrounding coastal divisions.

## Overview

This repository houses the full publishing and editorial portal for CityMood reporters, editors, and administrators. It connects directly to the shared Supabase backend to manage articles, photography, front-page curation, advertising campaigns, and staff roles.

### Core Features
- **Articles Desk (`/articles`)**: Publishing lifecycle workflow across Drafts, In Review, Scheduled, and Published statuses.
- **Rich Text Editor (`/articles/[id]`)**: TipTap WYSIWYG editor with live toolbar, inline callouts, headings, quotes, word count, reading time calculator, and SEO fields.
- **Live Article Preview (`/preview/[id]`)**: Exact rendering of how articles appear on the public site prior to publication.
- **Media Library (`/media`)**: Image asset management with interactive focal point picker, alt text, photographer credits, and dimension checks.
- **Front Page Manager (`/front-page`)**: Visual curation of the homepage lead story, top 4 slots, and most-read order.
- **Advertising Campaigns (`/ads`)**: Direct-sold campaigns management (leaderboard, MPU, billboard) with desktop/mobile creative uploads, scheduling, and tracking.
- **Staff Management (`/staff`)**: Role-based access control (Admin, Editor, Reporter) and invite workflows.
- **Taxonomy & Tags (`/taxonomy`)**: Categories and topical tag management.
- **Site Settings (`/settings`)**: Newsroom physical address, newsroom phone, editorial emails, and social channels.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Provide your Supabase project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_STORAGE_BUCKET=article-media
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in with a staff account. There is no demo mode: this app always reads and writes the real Supabase project, so point `.env.local` at a test project if you want to experiment.

---

## Shared Database & Storage Schema

The Supabase migrations for the editorial schema, RLS policies, storage bucket, view counts, and audit logs are located in:
```
supabase/migrations/
```
Run `supabase db push` or apply them in your Supabase dashboard SQL editor.

`lib/admin/supabase/repo.ts` is the data layer and `lib/admin/supabase/map.ts` translates between the live columns and the portal's types. Roles are enforced in the database by RLS and triggers, not only in the UI.

**Never add a foreign key from `articles` or `ad_campaigns` to `article_media`.** The public site embeds `article_media(...)` from both tables, and a second relationship makes those queries fail as ambiguous.

---

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI & Styling**: Tailwind CSS v4, Source Serif 4 & Source Sans 3 self-hosted fonts
- **Rich Text**: TipTap v3 (StarterKit, Extensions, Image)
- **Backend & Auth**: Supabase SSR (`@supabase/ssr`, `@supabase/supabase-js`)
- **Testing**: Vitest

