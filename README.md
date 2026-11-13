# Challenge Tracker

Static web app (HTML + JS) with Supabase as the backend (Postgres + Auth + Row Level Security).
Choose your own start date and number of days (14-365). Tabs: Dashboard, Daily Tracker (with rest and outing days), Job Hunt, AI Learning, Startup, Mondee Learning, Weekly Review.

## 1. Supabase setup
1. Create a project at https://supabase.com.
2. SQL Editor > New query > paste `supabase/schema.sql` > Run (safe to re-run).
3. Project Settings > API Keys: note the **Project URL** and the **publishable** key. Never use the secret / service_role key here.

## 2. Run locally
```bash
copy config.example.js config.js   # then edit config.js with your URL and key
python -m http.server 3000
```
`config.js` is git-ignored.

## 3. Deploy on Render (keeps the key out of Git)
1. Render > New > Static Site > connect this repo. It reads `render.yaml`
   (build command `node build.js`, publish directory `dist`).
2. Add environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. In Supabase > Authentication > URL Configuration, set **Site URL** and **Redirect URLs** to your Render URL.

`build.js` writes `config.js` into `dist/` at build time from those variables.
Note: the publishable key is still visible to anyone who views the live site, because the browser needs it. Row Level Security is what protects your data.
