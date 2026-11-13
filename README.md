# 89-Day Challenge Tracker

Static web app (HTML + JS) with Supabase as the backend (Postgres + Auth + Row Level Security).
Tabs: Dashboard, Daily Tracker (89 days pre-filled from the roadmap), Job Hunt, AI Learning, Startup, Mondee Learning, Weekly Review.

## 1. Supabase setup
1. Create a project at https://supabase.com.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run.
3. Project Settings > API: copy the **Project URL** and **anon public key** into `config.js`.
4. (Optional, easier for personal use) Authentication > Providers > Email > turn off "Confirm email".
5. Authentication > URL Configuration: add your deployed URL as Site URL once you have it.

The anon key is meant to be public; Row Level Security restricts each user to their own rows. Never put the `service_role` key in this repo.

## 2. Run locally
```bash
npx serve .
```

## 3. Deploy
**Render:** New > Static Site > connect the Git repo. Build command: empty. Publish directory: `.` (or use the included `render.yaml` Blueprint).
**GitHub Pages:** Settings > Pages > deploy from `main` branch, root folder.

## 4. First use
Create an account. The 89 days (13 Nov 2026 to 9 Feb 2027) are seeded automatically on first login.
