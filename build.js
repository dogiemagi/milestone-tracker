// Render build step: copies the site to dist/ and writes config.js from environment variables,
// so the Supabase URL and key never need to be committed to Git.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable.');
  process.exit(1);
}

fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
for (const f of ['index.html', 'app.js', 'phases.js']) fs.copyFileSync(f, path.join('dist', f));
fs.writeFileSync(
  path.join('dist', 'config.js'),
  `window.SUPABASE_URL = ${JSON.stringify(url)};\nwindow.SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`
);
console.log('Built dist/ with Supabase config from environment.');
