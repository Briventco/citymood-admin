# CityMood Editorial Admin Portal

The standalone editorial newsroom workspace for [CityMood](https://citymood.ng) — independent news and community reporting covering Badagry Central, Badagry West, Olorunda, and surrounding coastal divisions.

## Overview

This repository houses the full publishing and editorial portal for CityMood reporters, editors, and administrators. It connects directly to the shared Supabase backend to manage articles, photography, front-page curation, advertising campaigns, and staff roles.

### Core Features
- **Articles Desk (`/admin/articles`)**: Publishing lifecycle workflow across Drafts, In Review, Scheduled, and Published statuses.
- **Rich Text Editor (`/admin/articles/[id]`)**: TipTap WYSIWYG editor with live toolbar, inline callouts, headings, quotes, word count, reading time calculator, and SEO fields.
- **Live Article Preview (`/admin/preview/[id]`)**: Exact rendering of how articles appear on the public site prior to publication.
- **Media Library (`/admin/media`)**: Image asset management with interactive focal point picker, alt text, photographer credits, and dimension checks.
- **Front Page Manager (`/admin/front-page`)**: Visual curation of the homepage lead story, top 4 slots, and most-read order.
- **Advertising Campaigns (`/admin/ads`)**: Direct-sold campaigns management (leaderboard, MPU, billboard) with desktop/mobile creative uploads, scheduling, and tracking.
- **Staff Management (`/admin/staff`)**: Role-based access control (Admin, Editor, Reporter) and invite workflows.
- **Taxonomy & Tags (`/admin/taxonomy`)**: Categories and topical tag management.
- **Site Settings (`/admin/settings`)**: Newsroom physical address, newsroom phone, editorial emails, and social channels.

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=media
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (which redirects to `/admin`).

---

## Shared Database & Storage Schema

The Supabase migrations for the editorial schema, RLS policies, storage bucket, view counts, and audit logs are located in:
```
supabase/migrations/
```
Run `supabase db push` or apply them in your Supabase dashboard SQL editor.

---

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI & Styling**: Tailwind CSS v4, Source Serif 4 & Source Sans 3 self-hosted fonts
- **Rich Text**: TipTap v3 (StarterKit, Extensions, Image)
- **Backend & Auth**: Supabase SSR (`@supabase/ssr`, `@supabase/supabase-js`)
- **Testing**: Vitest

