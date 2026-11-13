const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUSES = ['Not Started', 'In Progress', 'Completed', 'Partially Completed', 'Skipped', 'Rest Day', 'Outing Day'];
const SCLS = { 'Completed': 'ok', 'Partially Completed': 'part', 'In Progress': 'prog', 'Skipped': 'skip', 'Rest Day': 'rest', 'Outing Day': 'out' };
const isOff = (d) => d.status === 'Rest Day' || d.status === 'Outing Day'; // planned off days don't count against you
const todayISO = () => new Date().toISOString().slice(0, 10);
const rawDay = () => Math.floor((Date.parse(todayISO()) - START_DATE) / 864e5) + 1;
const todayDayNo = () => Math.min(TOTAL_DAYS, Math.max(1, rawDay()));
const score = (d) => (d.status === 'Completed' ? 1 : d.status === 'Partially Completed' ? 0.5 : 0);
const fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

let user = null, tab = 'Dashboard';
const cache = {};

const LISTS = {
  'Job Hunt': { table: 'job_hunt', typeCol: 'type', types: ['Application', 'Referral', 'Mock', 'Interview', 'DSA'], add: 'Add entry',
    sub: 'Applications, referrals, mock interviews and DSA problems.', empty: 'No entries yet. Log your first application or DSA problem.',
    fields: [['company', 'Company / Problem'], ['role', 'Role / Topic'], ['status', 'Status', ['Planned', 'Applied', 'Referred', 'Screening', 'Interview', 'Offer', 'Rejected', 'Done']], ['date', 'Date', 'date'], ['link', 'Link'], ['notes', 'Notes']] },
  'AI Learning': { table: 'ai_learning', typeCol: 'kind', types: ['Topic', 'Exercise', 'Project'], add: 'Add item',
    sub: 'Topics, exercises and projects across LLMs, RAG, agents and deployment.', empty: 'Nothing here yet. Add a topic you are studying.',
    fields: [['topic', 'Topic / Project'], ['resource', 'Resource'], ['status', 'Status', ['Not Started', 'In Progress', 'Completed']], ['notes', 'Notes']] },
  'Startup': { table: 'startup', typeCol: 'kind', types: ['Problem', 'Competitor', 'Idea', 'Interview', 'MVP', 'Customer'], add: 'Add item',
    sub: 'Problems, competitors, ideas, customer interviews, MVP and pilots.', empty: 'No startup items yet. Start with customer problems.',
    fields: [['item', 'Item / Person'], ['status', 'Status', ['Open', 'Shortlisted', 'Selected', 'Done', 'Dropped']], ['date', 'Date', 'date'], ['notes', 'Notes']] },
  'Mondee Learning': { table: 'mondee_log', typeCol: null, types: [], add: 'Add log',
    sub: 'Keep your Mondee work learnings and achievements separate.', empty: 'No logs yet. Capture what you learned at work today.',
    fields: [['date', 'Date', 'date'], ['learning', 'What I learned', 'area'], ['concept', 'Technical concept', 'area'], ['achievement', 'Achievement', 'area']] },
};
// Lucide-style stroke icons (24x24 viewBox)
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  tick: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  coffee:'<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const icon = (n, s = 18) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const NAV = [['Dashboard', 'dashboard'], ['Daily Tracker', 'calendar'], ['Job Hunt', 'briefcase'], ['AI Learning', 'cpu'], ['Startup', 'rocket'], ['Mondee Learning', 'building'], ['Weekly Review', 'clipboard']];

// ---------- Light / dark theme ----------
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark'
  : matchMedia('(prefers-color-scheme: dark)').matches;
function paintTheme() {
  const dark = isDark();
  $('#theme').innerHTML = icon(dark ? 'sun' : 'moon', 19);
  $('#theme').title = $('#theme').ariaLabel = dark ? 'Switch to light mode' : 'Switch to dark mode';
  $('#auththeme').innerHTML = icon(dark ? 'sun' : 'moon', 18);
}
function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* private mode: still applies for this visit */ }
  paintTheme();
}
$('#theme').onclick = toggleTheme;
$('#auththeme').onclick = toggleTheme;
paintTheme();

// ---------- Scroll to top ----------
addEventListener('scroll', () => $('#totop').classList.toggle('show', scrollY > 400), { passive: true });
$('#totop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

// ---------- Custom dropdowns (replace native <select> popups) ----------
const DOT = { 'Completed': 'var(--ok)', 'Partially Completed': 'var(--warn)', 'In Progress': 'var(--accent)', 'Skipped': 'var(--muted)', 'Rest Day': '#0ea5e9', 'Outing Day': '#ec4899', 'Not Started': 'var(--line)' };
const ddDot = (t) => (DOT[t] ? `<i class="dd-dot" style="background:${DOT[t]}"></i>` : '');
let openDD = null;
function closeDD() { if (openDD) { openDD.menu.remove(); openDD.btn.classList.remove('open'); openDD = null; } }
function showDD(sel, btn) {
  closeDD();
  const menu = document.createElement('div');
  menu.className = 'dd-menu'; menu.setAttribute('role', 'listbox');
  menu.innerHTML = [...sel.options].map((o, i) => `<button type="button" class="dd-opt ${i === sel.selectedIndex ? 'on' : ''}" role="option" data-i="${i}">${ddDot(o.text)}<span class="dd-t">${esc(o.text)}</span>${i === sel.selectedIndex ? icon('tick', 15) : ''}</button>`).join('');
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.minWidth = r.width + 'px';
  const h = menu.offsetHeight, below = innerHeight - r.bottom;
  menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = (below >= h + 8 || below > r.top ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + 'px';
  btn.classList.add('open');
  openDD = { menu, btn };
  (menu.querySelector('.on') || menu.firstChild)?.focus();
  menu.onclick = (e) => {
    const o = e.target.closest('.dd-opt'); if (!o) return;
    sel.selectedIndex = +o.dataset.i;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    closeDD(); btn.focus();
  };
  menu.onkeydown = (e) => {
    const opts = [...menu.querySelectorAll('.dd-opt')], i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[Math.max(0, i - 1)].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDD(); btn.focus(); }
    else if (e.key === 'Tab') closeDD();
  };
}
function enhanceSelects() {
  document.querySelectorAll('select:not([data-enh])').forEach((sel) => {
    sel.dataset.enh = '1';
    const wrap = document.createElement('div');
    wrap.className = 'dd ' + sel.className;
    sel.className = '';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dd-btn'; btn.setAttribute('aria-haspopup', 'listbox');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.append(btn, sel);
    sel.hidden = true;
    const paint = () => { const o = sel.options[sel.selectedIndex]; btn.innerHTML = `${ddDot(o?.text)}<span class="dd-t">${esc(o?.text || '')}</span>${icon('down', 16)}`; };
    paint(); sel.addEventListener('change', paint);
    btn.onclick = () => (openDD && openDD.btn === btn ? closeDD() : showDD(sel, btn));
    btn.onkeydown = (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); showDD(sel, btn); } };
  });
}
document.addEventListener('mousedown', (e) => { if (openDD && !openDD.menu.contains(e.target) && !openDD.btn.contains(e.target)) closeDD(); });
addEventListener('scroll', (e) => { if (openDD && !openDD.menu.contains(e.target)) closeDD(); }, true);
addEventListener('resize', closeDD);
new MutationObserver(() => { if (openDD && !document.contains(openDD.btn)) closeDD(); enhanceSelects(); }).observe(document.body, { childList: true, subtree: true });
enhanceSelects();

// ---------- Calendar picker (used in settings) ----------
function mountCalendar(el, getStart, getN, onPick) {
  const pad2 = (n) => String(n).padStart(2, '0');
  let y, m;
  const sync = () => { const [yy, mm] = (getStart() || startISO()).split('-').map(Number); y = yy; m = mm - 1; draw(); };
  function draw() {
    const start = getStart() || startISO(), n = getN();
    const end = n >= 1 ? isoPlus(start, n - 1) : start;
    const first = new Date(Date.UTC(y, m, 1)), lead = first.getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    let cells = '<span></span>'.repeat(lead);
    for (let d = 1; d <= dim; d++) {
      const iso = `${y}-${pad2(m + 1)}-${pad2(d)}`;
      const cls = iso === start ? 'sel' : iso === end ? 'sel end' : iso > start && iso < end ? 'in' : '';
      cells += `<button type="button" class="cd ${cls} ${iso === todayISO() ? 'td' : ''}" data-d="${iso}">${d}</button>`;
    }
    el.innerHTML = `<div class="calh"><button type="button" data-nav="-1" aria-label="Previous month">${icon('left', 16)}</button><b>${label}</b><button type="button" data-nav="1" aria-label="Next month">${icon('right', 16)}</button></div>
      <div class="calw">${'SMTWTFS'.split('').map((x) => `<span>${x}</span>`).join('')}</div><div class="calg">${cells}</div>`;
  }
  el.onclick = (e) => {
    const nav = e.target.closest('[data-nav]'), day = e.target.closest('[data-d]');
    if (nav) { m += +nav.dataset.nav; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); }
    if (day) onPick(day.dataset.d);
  };
  sync();
  return { draw, sync };
}

async function load(table, order) {
  const q = sb.from(table).select('*');
  const { data, error } = await (order ? q.order(order) : q);
  if (error) { alert(error.message); return []; }
  return (cache[table] = data);
}
const toast = (e) => e && alert(e.message);

// ---------- Auth ----------
async function authAction(kind) {
  $('#autherr').textContent = '';
  const creds = { email: $('#email').value.trim(), password: $('#pass').value };
  const { data, error } = kind === 'up' ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
  if (error) return ($('#autherr').textContent = error.message);
  if (kind === 'up' && !data.session) $('#autherr').textContent = 'Check your email to confirm, then sign in.';
}
$('#authform').onsubmit = (e) => { e.preventDefault(); authAction('in'); };
$('#signup').onclick = () => { if ($('#authform').reportValidity()) authAction('up'); };
$('#signout').onclick = () => sb.auth.signOut();
$('#eye').onclick = () => {
  const show = $('#pass').type === 'password';
  $('#pass').type = show ? 'text' : 'password';
  $('#eyeon').style.display = show ? 'none' : '';
  $('#eyeoff').style.display = show ? '' : 'none';
  $('#eye').title = show ? 'Hide password' : 'Show password';
};

let META = {};                       // plan settings stored on the account (user_metadata)
let PLAN_TYPE = 'starter';           // 'starter' | 'blank' | 'ai'
let TRACKS = ['AI', 'Job', 'Startup'];
let HAS_DAYS = false;
const TRACKS_DEFAULT = ['AI', 'Job', 'Startup'];
let bootedFor = null; // Supabase fires several auth events per login; set up the app once per user
sb.auth.onAuthStateChange((_e, session) => {
  user = session?.user ?? null;
  $('#auth').classList.toggle('hide', !!user);
  $('#app').classList.toggle('hide', !user);
  if (!user) { bootedFor = null; chat.open = false; chat.msgs = []; chat.plan = null; drawChat(); return; }
  $('#who').textContent = user.email;
  if (bootedFor === user.id) return;
  bootedFor = user.id;
  META = user.user_metadata || {};
  applyChallenge(META.start_date || '2026-11-13', META.total_days || 89, META);
  boot();
});

// ---------- Start date ----------
const isoPlus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const longDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const startISO = () => new Date(START_DATE).toISOString().slice(0, 10);
const endISO = () => isoPlus(startISO(), TOTAL_DAYS - 1);
const slimPhases = (ph) => ph.map(({ name, from, to, milestone }) => ({ name, from, to, milestone: milestone || '' }));
function applyChallenge(iso, n, meta = META) {
  window.START_DATE = Date.parse(iso + 'T00:00:00Z');
  PLAN_TYPE = meta.plan_type || 'starter';
  TRACKS = Array.isArray(meta.tracks) && meta.tracks.length === 3 ? meta.tracks : TRACKS_DEFAULT;
  setPlan(n, PLAN_TYPE !== 'starter' && meta.phases && meta.phases.length ? meta.phases : null);
  $('#brandsub').textContent = `${longDate(iso)} - ${longDate(endISO())}`;
  document.title = 'Challenge Tracker';
}
const untouched = (d) => d.status === 'Not Started' && !d.notes && !d.next_action && d.actual_hours == null;

// ---------- Date range picker (start + end on one calendar) ----------
function mountRangePicker(el, init) {
  let start = init.start, n = init.n, mode = 'start';
  el.innerHTML = `<div class="dates">
      <button type="button" class="dpick on" data-mode="start"><span class="lbl">Start date</span><b data-f="s"></b></button>
      <button type="button" class="dpick" data-mode="end"><span class="lbl">End date</span><b data-f="e"></b></button>
      <div class="dlen"><span class="lbl">Days</span><b data-f="n"></b></div>
    </div>
    <p class="muted" data-f="hint" style="margin:8px 0 0"></p>
    <div class="cal" data-f="cal"></div>
    <div class="chips" style="margin-top:8px"><span class="muted" style="align-self:center">Quick length:</span>${[30, 60, 89, 100, 180].map((q) => `<button type="button" class="chip" data-n="${q}">${q}</button>`).join('')}</div>`;
  const f = (k) => el.querySelector(`[data-f="${k}"]`);
  const upd = (msg) => {
    f('s').textContent = longDate(start); f('e').textContent = longDate(isoPlus(start, n - 1)); f('n').textContent = n;
    el.querySelectorAll('.dpick').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    f('hint').innerHTML = msg || (mode === 'start' ? 'Click a day to set the <b>start</b> date.' : 'Now click a day to set the <b>end</b> date (14 to 365 days after the start).');
  };
  const cal = mountCalendar(f('cal'), () => start, () => n, (iso) => {
    let msg = '';
    if (mode === 'start') { start = iso; mode = 'end'; }
    else {
      const diff = Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 864e5) + 1;
      n = Math.max(14, Math.min(365, diff));
      if (diff < 14 || diff > 365) msg = 'Length must be 14 to 365 days, so the end date was adjusted.';
    }
    upd(msg); cal.draw();
  });
  el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-n]'); if (c) { n = +c.dataset.n; upd(); cal.draw(); }
    const p = e.target.closest('[data-mode]'); if (p) { mode = p.dataset.mode; upd(); }
  });
  upd();
  return { get: () => ({ start, n }) };
}

// ---------- Challenge settings ----------
function changeSettings() {
  const m = document.createElement('div');
  m.className = 'modal';
  const starter = PLAN_TYPE === 'starter';
  m.innerHTML = `<div class="card"><h3>Challenge settings</h3><div id="rp"></div>
    <p class="muted">Length must be 14 to 365 days. ${starter ? 'The roadmap phases and targets scale to the new length. Days you already worked on keep their notes and hours; untouched days get refreshed tasks.' : 'Your phases stretch to fit the new length. Your day tasks and progress are kept.'}</p>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" id="mc">Cancel</button><button class="btn" id="ms">Save</button></div></div>`;
  document.body.appendChild(m);
  const rp = mountRangePicker($('#rp'), { start: startISO(), n: TOTAL_DAYS });
  m.onclick = (e) => { if (e.target === m || e.target.id === 'mc') m.remove(); };
  $('#ms').onclick = async () => {
    const { start: iso, n } = rp.get();
    const days = await load('days', 'day');
    const oldStart = START_DATE, oldN = TOTAL_DAYS, oldPhases = PHASES;
    const custom = starter ? null : rescalePhases(oldPhases, oldN, n);
    window.START_DATE = Date.parse(iso + 'T00:00:00Z');
    const plan = Object.fromEntries(buildDays(user.id, n, custom).map((r) => [r.day, r]));
    const revert = () => { window.START_DATE = oldStart; setPlan(oldN, starter ? null : oldPhases); };
    const removing = days.filter((d) => d.day > n);
    if (removing.some((d) => !untouched(d)) && !confirm(`Shortening to ${n} days removes days ${n + 1}-${days.length}, and some have progress logged. Continue?`)) return revert();
    $('#ms').disabled = true;
    const fail = (e) => { alert(e.message + (/check constraint/i.test(e.message) ? '\n\nRun the migration at the bottom of supabase/schema.sql in the Supabase SQL Editor first.' : '')); revert(); $('#ms').disabled = false; };
    const patch = { start_date: iso, total_days: n, ...(custom ? { phases: slimPhases(custom) } : {}) };
    const { error: ue } = await sb.auth.updateUser({ data: patch });
    if (ue) return fail(ue);
    const keep = days.filter((d) => d.day <= n).map((d) => { const p = plan[d.day]; return { ...d, date: p.date, phase: p.phase, ...(starter && untouched(d) ? { ai_task: p.ai_task, job_task: p.job_task, startup_task: p.startup_task } : {}) }; });
    if (keep.length) { const { error } = await sb.from('days').upsert(keep, { onConflict: 'id' }); if (error) return fail(error); }
    const adds = Object.values(plan).filter((r) => r.day > days.length);
    if (adds.length) { const { error } = await sb.from('days').insert(adds); if (error) return fail(error); }
    if (removing.length) { const { error } = await sb.from('days').delete().in('id', removing.map((d) => d.id)); if (error) return fail(error); }
    META = { ...META, ...patch };
    applyChallenge(iso, n, META); m.remove(); phaseFilter = 'all'; render();
  };
}

// ---------- First-time setup (no preset plan for new users) ----------
let onbPicker = null;
const TRACK_HINTS = ['Study', 'Health', 'Project'];
const getOnbTracks = () => [0, 1, 2].map((i) => (document.querySelector(`[data-tr="${i}"]`)?.value || '').trim() || TRACK_HINTS[i]);

function onboarding() {
  head('Welcome', 'Set up your challenge. You can change everything later.');
  $('#view').innerHTML = `
  <div class="card step"><h3><span class="stepn">1</span> Choose your dates</h3><div id="rp"></div></div>
  <div class="card step"><h3><span class="stepn">2</span> What will you work on each day?</h3>
    <p class="muted" style="margin-top:-6px">Name up to three daily focus areas, like Study, Fitness or Side project. The starter roadmap uses AI, Job and Startup instead.</p>
    <div class="g3" style="margin:0">${[0, 1, 2].map((i) => `<label><span class="lbl">Focus ${i + 1}</span><input data-tr="${i}" maxlength="30" placeholder="${TRACK_HINTS[i]}"></label>`).join('')}</div></div>
  <div class="card step"><h3><span class="stepn">3</span> How should we fill your days?</h3>
    <div class="opts">
      <button type="button" class="opt" data-src="ai"><span class="oic">${icon('chat', 22)}</span><b>Plan with the AI assistant</b><span class="muted">Chat about your goal and get a day-by-day plan to review.</span></button>
      <button type="button" class="opt" data-src="starter"><span class="oic">${icon('rocket', 22)}</span><b>Use the starter roadmap</b><span class="muted">A 7-phase plan for AI engineering, job hunting and a startup, scaled to your dates.</span></button>
      <button type="button" class="opt" data-src="blank"><span class="oic">${icon('calendar', 22)}</span><b>Start blank</b><span class="muted">Empty days. Add tasks yourself, or use Bulk fill for a range of days.</span></button>
    </div></div>`;
  onbPicker = mountRangePicker($('#rp'), { start: todayISO(), n: 30 });
  $('#view').onchange = null;
  $('#view').onclick = (e) => {
    const o = e.target.closest('[data-src]'); if (!o) return;
    const { start, n } = onbPicker.get();
    if (o.dataset.src === 'ai') return openChat();
    createPlan(o.dataset.src, start, n, getOnbTracks());
  };
}

async function createPlan(type, iso, n, tracks, phases = null) {
  const oldStart = START_DATE;
  window.START_DATE = Date.parse(iso + 'T00:00:00Z');
  const custom = type === 'starter' ? null : type === 'blank' ? [{ name: 'My plan', from: 1, to: n, milestone: '' }] : phases;
  const rows = buildDays(user.id, n, custom);
  const patch = { start_date: iso, total_days: n, plan_type: type, tracks: type === 'starter' ? TRACKS_DEFAULT : tracks, phases: type === 'starter' ? null : slimPhases(PHASES) };
  const fail = (e) => { alert(e.message); window.START_DATE = oldStart; setPlan(89, null); };
  const { error: ue } = await sb.auth.updateUser({ data: patch });
  if (ue) return fail(ue);
  const { error } = await sb.from('days').upsert(rows, { onConflict: 'user_id,day' });
  if (error) return fail(error);
  META = { ...META, ...patch };
  applyChallenge(iso, n, META);
  HAS_DAYS = true; tab = 'Dashboard'; closeChat(); renderTabs(); render();
}

// ---------- Bulk fill a range of days ----------
async function bulkFill() {
  const days = await load('days', 'day');
  const N = TOTAL_DAYS, m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card"><h3>Bulk fill days</h3>
    <p class="muted" style="margin-top:-6px">Set tasks for a range of days at once. Write one task per line; the lines repeat across the days.</p>
    <div style="display:flex;gap:10px"><label style="flex:1"><span class="lbl">From day</span><input type="number" id="bf" min="1" max="${N}" value="1"></label><label style="flex:1"><span class="lbl">To day</span><input type="number" id="bt" min="1" max="${N}" value="${Math.min(N, 7)}"></label></div>
    <p class="muted" id="brng" style="margin:6px 0 10px"></p>
    ${TRACKS.map((t, i) => `<label style="display:block;margin-bottom:10px"><span class="lbl">${esc(t)}</span><textarea id="bk${i}" rows="3" placeholder="One task per line"></textarea></label>`).join('')}
    <label style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><input type="checkbox" id="bo" checked style="width:auto"> Only fill tasks that are empty</label>
    <label style="display:block;margin-bottom:14px"><span class="lbl">Also set the status of these days</span><select id="bs"><option>Keep status</option><option>Rest Day</option><option>Outing Day</option></select></label>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" id="mc">Cancel</button><button class="btn" id="ms">Apply</button></div></div>`;
  document.body.appendChild(m);
  const rng = () => {
    const a = Math.max(1, +$('#bf').value || 1), b = Math.min(N, +$('#bt').value || a);
    const da = days[a - 1], db = days[b - 1];
    $('#brng').textContent = da && db && b >= a ? `${fmtDate(da.date)} to ${fmtDate(db.date)} (${b - a + 1} days)` : 'Choose a valid range.';
  };
  rng(); $('#bf').oninput = rng; $('#bt').oninput = rng;
  m.onclick = (e) => { if (e.target === m || e.target.id === 'mc') m.remove(); };
  $('#ms').onclick = async () => {
    const from = +$('#bf').value, to = +$('#bt').value;
    if (!(from >= 1 && to >= from && to <= N)) return alert(`Choose days between 1 and ${N}.`);
    const lines = [0, 1, 2].map((i) => $(`#bk${i}`).value.split('\n').map((s) => s.trim()).filter(Boolean));
    const keys = ['ai_task', 'job_task', 'startup_task'], onlyEmpty = $('#bo').checked, st = $('#bs').value;
    const rows = days.filter((d) => d.day >= from && d.day <= to).map((d) => {
      const r = { ...d };
      keys.forEach((k, t) => { if (lines[t].length && (!onlyEmpty || !String(d[k] || '').trim())) r[k] = lines[t][(d.day - from) % lines[t].length]; });
      if (st !== 'Keep status') r.status = st;
      return r;
    });
    $('#ms').disabled = true;
    const { error } = await sb.from('days').upsert(rows, { onConflict: 'id' });
    if (error) { $('#ms').disabled = false; return alert(error.message); }
    m.remove(); daily();
  };
}

// ---------- AI plan assistant (chat) ----------
const chat = { open: false, msgs: [], plan: null, busy: false, err: '' };
const SUGGESTIONS = ['Plan 30 days to learn Python', 'Get fit in 60 days', 'Prepare for a job interview in 4 weeks'];
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

function chatContext() {
  if (!HAS_DAYS) {
    const { start, n } = onbPicker ? onbPicker.get() : { start: todayISO(), n: 30 };
    return { mode: 'new_plan', start_date: start, total_days: n, tracks: getOnbTracks() };
  }
  return { mode: 'existing_plan', start_date: startISO(), total_days: TOTAL_DAYS, today_day: todayDayNo(), tracks: TRACKS, current_phases: PHASES.map((p) => ({ name: p.name, from: p.from, to: p.to })) };
}
$('#chatfab').onclick = () => openChat();
function openChat() { chat.open = true; drawChat(); setTimeout(() => $('#chatin')?.focus(), 50); }
function closeChat() { chat.open = false; drawChat(); }

function drawChat() {
  let box = $('#chat');
  if (!box) { box = document.createElement('div'); box.id = 'chat'; document.body.appendChild(box); }
  $('#chatfab').classList.toggle('hide', chat.open || !user);
  box.classList.toggle('open', chat.open);
  if (!chat.open) return;
  const n = chatContext().total_days;
  const preview = chat.plan ? normalizePhases(chat.plan.phases, n) : null;
  box.innerHTML = `<div class="chat-h"><b>${icon('chat', 18)} Plan assistant</b><button type="button" class="chat-x" data-chat="close" aria-label="Close">${icon('x', 18)}</button></div>
    <div class="chat-b" id="chatb">
      <div class="cm a">Hi! Tell me what you want to achieve and I'll draft a day-by-day plan for your ${n} days. You review it before anything changes.</div>
      ${chat.msgs.map((m) => `<div class="cm ${m.role === 'user' ? 'u' : 'a'}">${nl2br(m.content)}</div>`).join('')}
      ${!chat.msgs.length ? `<div class="chips">${SUGGESTIONS.map((s) => `<button type="button" class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      ${chat.busy ? '<div class="cm a typing"><i></i><i></i><i></i></div>' : ''}
      ${chat.err ? `<div class="cm err">${nl2br(chat.err)}</div>` : ''}
      ${preview ? `<div class="plancard"><b>${esc(chat.plan.title || 'Proposed plan')}</b>
        ${preview.map((p) => `<div class="pr"><span class="pill">Days ${p.from}-${p.to}</span> <b>${esc(p.name)}</b><div class="muted">${p.ai.length + p.job.length + p.startup.length} tasks${p.milestone ? ' · ' + esc(p.milestone) : ''}</div></div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sm" data-chat="apply">Apply to my days</button><button type="button" class="btn ghost sm" data-chat="dismiss">Dismiss</button></div></div>` : ''}
    </div>
    <form class="chat-f" id="chatf"><textarea id="chatin" rows="1" placeholder="Describe your goal..." ${chat.busy ? 'disabled' : ''}></textarea><button class="btn" type="submit" ${chat.busy ? 'disabled' : ''} aria-label="Send">${icon('send', 18)}</button></form>`;
  const b = $('#chatb'); b.scrollTop = b.scrollHeight;
  $('#chatf').onsubmit = (e) => { e.preventDefault(); const t = $('#chatin').value.trim(); if (t) sendChat(t); };
  $('#chatin').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatf').requestSubmit(); } };
  box.onclick = (e) => {
    const a = e.target.closest('[data-chat]'), s = e.target.closest('[data-sug]');
    if (s) return sendChat(s.dataset.sug);
    if (!a) return;
    if (a.dataset.chat === 'close') closeChat();
    if (a.dataset.chat === 'dismiss') { chat.plan = null; drawChat(); }
    if (a.dataset.chat === 'apply') applyAiPlan();
  };
}

async function sendChat(text) {
  if (chat.busy) return;
  chat.msgs.push({ role: 'user', content: text }); chat.err = ''; chat.busy = true; drawChat();
  const { data, error } = await sb.functions.invoke('plan-chat', { body: { messages: chat.msgs, context: chatContext() } });
  chat.busy = false;
  if (error) {
    let msg = error.message || 'Something went wrong.';
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (e) { /* not JSON */ }
    if (error.context?.status === 404 || /Failed to send|fetch/i.test(msg)) msg = "The AI assistant isn't set up yet. The site owner needs to deploy the plan-chat function and add the Anthropic key (see the README).";
    chat.err = msg;
  } else {
    chat.msgs.push({ role: 'assistant', content: data.reply || '...' });
    if (data.plan && data.plan.phases) chat.plan = data.plan;
  }
  drawChat();
}

async function applyAiPlan() {
  const raw = chat.plan; if (!raw) return;
  if (!HAS_DAYS) {
    const { start, n } = onbPicker.get();
    const phases = normalizePhases(raw.phases, n);
    if (!phases) return alert('The plan had no phases. Ask the assistant to try again.');
    return createPlan('ai', start, n, getOnbTracks(), phases);
  }
  const n = TOTAL_DAYS, phases = normalizePhases(raw.phases, n);
  if (!phases) return alert('The plan had no phases. Ask the assistant to try again.');
  const days = await load('days', 'day');
  const oldPhases = PHASES, starter = PLAN_TYPE === 'starter';
  const byDay = Object.fromEntries(buildDays(user.id, n, phases).map((r) => [r.day, r]));
  const replace = days.filter((d) => d.status === 'Not Started').length;
  if (!confirm(`Apply "${raw.title || 'this plan'}"? Tasks on ${replace} not-started day${replace === 1 ? '' : 's'} will be replaced. Days you have already worked on keep their tasks.`)) { setPlan(n, starter ? null : oldPhases); return; }
  const rows = days.map((d) => { const p = byDay[d.day]; return p ? { ...d, phase: p.phase, ...(d.status === 'Not Started' ? { ai_task: p.ai_task, job_task: p.job_task, startup_task: p.startup_task } : {}) } : d; });
  const { error } = await sb.from('days').upsert(rows, { onConflict: 'id' });
  if (error) return alert(error.message);
  const patch = { plan_type: 'ai', phases: slimPhases(PHASES) };
  const { error: ue } = await sb.auth.updateUser({ data: patch });
  if (ue) return alert(ue.message);
  META = { ...META, ...patch };
  applyChallenge(startISO(), n, META);
  chat.plan = null; chat.msgs.push({ role: 'assistant', content: 'Done! Your days are updated. Check the Daily Tracker.' });
  drawChat(); render();
}

async function boot() {
  const { count, error } = await sb.from('days').select('id', { count: 'exact', head: true });
  if (error) return alert('Database not ready - did you run supabase/schema.sql?\n' + error.message);
  drawChat();
  HAS_DAYS = count > 0; // new users set up their own plan (dates + starter / blank / AI) instead of getting a preset one
  renderTabs(); render();
}

function renderTabs() {
  $('#tabs').innerHTML = NAV.map(([t, i]) => `<button class="${t === tab ? 'on' : ''}" data-t="${t}"><span class="ic">${icon(i, 18)}</span><span class="lb">${t}</span></button>`).join('');
  $('#tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { goTab(b.dataset.t); } };
}
function goTab(t) { tab = t; renderTabs(); render(); window.scrollTo(0, 0); }
function head(title, sub, actions = '') { $('#ptitle').textContent = title; $('#psub').textContent = sub; $('#pact').innerHTML = actions; }
const render = () => (!HAS_DAYS ? onboarding : { 'Dashboard': dashboard, 'Daily Tracker': daily, 'Weekly Review': weekly }[tab] || (() => listTab(tab)))();

const ring = (pct, size = 120, stroke = 12) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size / 4}" font-weight="800">${pct}%</text></svg>`;
};
const bar = (v, max, cls = '') => `<div class="bar ${cls}"><i style="width:${max ? Math.min(100, (v / max) * 100) : 0}%"></i></div>`;

// ---------- Dashboard ----------
async function dashboard() {
  const [days, jobs, startup] = await Promise.all([load('days', 'day'), load('job_hunt'), load('startup')]);
  const dn = todayDayNo(), raw = rawDay();
  const done = days.reduce((s, d) => s + score(d), 0);
  const N = TOTAL_DAYS;
  const off = days.filter(isOff).length, active = Math.max(1, N - off);
  const pct = Math.round((done / active) * 100);
  const planned = days.filter((d) => !isOff(d)).reduce((s, d) => s + Number(d.planned_hours || 0), 0);
  const actual = days.reduce((s, d) => s + Number(d.actual_hours || 0), 0);
  const phase = PHASES.find((p) => dn >= p.from && dn <= p.to);
  let streak = 0;
  for (let i = dn - 1; i >= 0; i--) { if (!days[i] || isOff(days[i])) continue; if (score(days[i]) > 0) streak++; else if (i < dn - 1) break; }
  const today = days[dn - 1];
  const hello = raw < 1 ? `Starts in ${1 - raw} day${1 - raw > 1 ? 's' : ''}` : raw > N ? 'Challenge complete' : `Day ${dn} of ${N}`;
  head('Dashboard', raw < 1 ? `Your ${N} days begin on ${longDate(startISO())}.` : `${Math.max(0, N - dn)} days to go. Keep the streak alive.`,
    `<button class="btn ghost" id="setstart">${icon('calendar', 16)} ${N} days from ${longDate(startISO())}</button>`);
  $('#setstart').onclick = changeSettings;

  const targetRows = (list, rows, col) => list.map(([k, goal, label]) => {
    const n = rows.filter((r) => r[col] === k).length;
    return `<div class="target"><div class="r"><span>${label}</span><b>${n} <span class="muted">/ ${goal}</span></b></div>${bar(n, goal, n >= goal ? 'ok' : '')}</div>`;
  }).join('');

  $('#view').innerHTML = `
  <div class="card hero">
    ${ring(pct)}
    <div style="flex:1;min-width:220px"><h3>${hello}</h3><p>${phase ? `Phase ${phase.n}: ${esc(phase.name)}` : ''}</p>
      <p style="margin-top:10px;font-size:13px">${phase ? 'Milestone: ' + esc(phase.milestone) : ''}</p></div>
  </div>

  <div class="grid g-stats">
    <div class="card stat"><span class="ico c-ok">${icon('check', 20)}</span><div class="k">Days completed${off ? ` · ${off} off` : ''}</div><div class="v">${done}<span class="muted" style="font-size:15px"> / ${active}</span></div></div>
    <div class="card stat"><span class="ico c-ac">${icon('clock', 20)}</span><div class="k">Hours logged</div><div class="v">${actual}<span class="muted" style="font-size:15px"> / ${planned} h</span></div></div>
    <div class="card stat"><span class="ico c-wn">${icon('flame', 20)}</span><div class="k">Current streak</div><div class="v">${streak}<span class="muted" style="font-size:15px"> day${streak === 1 ? '' : 's'}</span></div></div>
    <div class="card stat">${PLAN_TYPE === 'starter'
      ? `<span class="ico c-bl">${icon('briefcase', 20)}</span><div class="k">Applications sent</div><div class="v">${jobs.filter((j) => j.type === 'Application').length}<span class="muted" style="font-size:15px"> / ${TARGETS.job[0][1]}</span></div></div>`
      : `<span class="ico c-bl">${icon('calendar', 20)}</span><div class="k">Days left</div><div class="v">${Math.max(0, N - dn)}<span class="muted" style="font-size:15px"> / ${N}</span></div></div>`}
  </div>

  <div class="grid g-2">
    <div class="card focus"><h3>Today's focus <span class="pill" style="margin-left:6px">Day ${String(today.day).padStart(2, '0')} · ${fmtDate(today.date)}</span></h3>
      ${isOff(today)
        ? `<div class="task offnote"><span class="offic">${icon(today.status === 'Rest Day' ? 'coffee' : 'pin', 22)}</span><span><b>${today.status === 'Rest Day' ? 'Rest day' : 'Outing day'}</b><br><span class="muted">No tasks today and your streak is safe. Enjoy it, and come back tomorrow.</span></span></div>`
        : [['em-ai', 'ai_task'], ['em-job', 'job_task'], ['em-st', 'startup_task']].map(([c, k], i) => (today[k] || PLAN_TYPE === 'starter' ? `<div class="task"><em class="${c}">${esc(TRACKS[i])}</em><span>${esc(today[k]) || '<span class="muted">No task set</span>'}</span></div>` : '')).join('') || '<div class="task"><span class="muted">No tasks set for today. Add some in the Daily Tracker or with Bulk fill.</span></div>'}
      <div class="seg">${STATUSES.map((s) => `<button class="${s === today.status ? 'on' : ''} ${s === 'Completed' ? 's-ok' : ''}" data-setst="${s}">${s}</button>`).join('')}</div>
      <div style="display:flex;gap:10px;align-items:end"><div style="width:110px"><span class="lbl">Hours today</span><input type="number" step="0.25" data-id="${today.id}" data-k="actual_hours" value="${today.actual_hours ?? ''}"></div>
        <div style="flex:1"><span class="lbl">Quick note</span><input data-id="${today.id}" data-k="notes" value="${esc(today.notes)}" placeholder="What did you learn?"></div></div>
    </div>
    <div class="card"><h3>Challenge map</h3>
      <div class="heat">${days.map((d) => `<button class="${SCLS[d.status] || ''} ${d.day === dn ? 'today' : ''}" data-day="${d.day}" title="Day ${d.day} · ${d.date} · ${d.status}">${d.day}</button>`).join('')}</div>
      <div class="legend"><span><i style="background:var(--ok)"></i>Completed</span><span><i style="background:var(--warn)"></i>Partial</span><span><i style="background:var(--accent)"></i>In progress</span><span><i style="background:var(--line)"></i>Skipped</span><span><i style="background:#0ea5e9"></i>Rest day</span><span><i style="background:#ec4899"></i>Outing day</span><span><i style="background:var(--soft);border:1px solid var(--line)"></i>Not started</span></div>
    </div>
  </div>

  <div class="grid g-2">
    <div class="card" ${PLAN_TYPE === 'starter' ? '' : 'style="grid-column:1/-1"'}><h3>Roadmap</h3>${PHASES.map((p) => {
      const ds = days.filter((d) => d.phase === p.n && !isOff(d)), s = ds.reduce((a, d) => a + score(d), 0);
      return `<div class="phase ${phase && phase.n === p.n ? 'cur' : ''}"><div class="n">${p.n}</div><div><b>${esc(p.name)}</b> <span class="muted">· days ${p.from}-${p.to}</span>${bar(s, ds.length, ds.length && s === ds.length ? 'ok' : '')}<div class="mile">${esc(p.milestone)}</div></div><b>${s}<span class="muted">/${ds.length}</span></b></div>`;
    }).join('')}</div>
    ${PLAN_TYPE === 'starter' ? `<div style="display:grid;gap:16px;align-content:start">
      <div class="card"><h3 class="ih">${icon('briefcase')} Career targets</h3>${targetRows(TARGETS.job, jobs, 'type')}</div>
      <div class="card"><h3 class="ih">${icon('rocket')} Startup targets</h3>${targetRows(TARGETS.startup, startup, 'kind')}</div>
    </div>` : ''}
  </div>`;

  $('#view').onclick = async (e) => {
    const st = e.target.closest('[data-setst]'), dd = e.target.closest('[data-day]');
    if (st) { toast((await sb.from('days').update({ status: st.dataset.setst }).eq('id', today.id)).error); dashboard(); }
    if (dd) { phaseFilter = 'all'; statusFilter = 'all'; pendingJump = +dd.dataset.day; goTab('Daily Tracker'); }
  };
  $('#view').onchange = (e) => saveField('days', e.target);
}

// ---------- Daily tracker ----------
let phaseFilter = 'all', statusFilter = 'all', pendingJump = null;
async function daily() {
  const days = await load('days', 'day');
  const dn = todayDayNo();
  head('Daily Tracker', 'Plan, log hours and capture notes for every day of the challenge.', `<button class="btn ghost" id="bulk">${icon('list', 16)} Bulk fill</button><button class="btn" id="jump">${icon('calendar', 16)} Jump to today</button>`);
  $('#bulk').onclick = bulkFill;
  const trk = (i) => (PLAN_TYPE === 'starter' ? icon(['cpu', 'briefcase', 'rocket'][i], 13) : `<i class="tdot t${i}"></i>`) + ' ' + esc(TRACKS[i]);
  const rows = days.filter((d) => (phaseFilter === 'all' || d.phase === +phaseFilter) && (statusFilter === 'all' || d.status === statusFilter));
  const fld = (d, k, label, n = 2) => `<label><span class="lbl">${label}</span><textarea data-id="${d.id}" data-k="${k}" rows="${n}">${esc(d[k])}</textarea></label>`;
  const num = (d, k, label) => `<label><span class="lbl">${label}</span><input type="number" step="0.25" data-id="${d.id}" data-k="${k}" value="${d[k] ?? ''}"></label>`;
  $('#view').innerHTML = `
  <div class="toolbar">
    <select id="pf"><option value="all">All phases</option>${PHASES.map((p) => `<option value="${p.n}" ${+phaseFilter === p.n ? 'selected' : ''}>Phase ${p.n}: ${esc(p.name)}</option>`).join('')}</select>
    <select id="sf"><option value="all">All statuses</option>${STATUSES.map((s) => `<option ${s === statusFilter ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <span class="muted">${rows.length} days</span>
  </div>
  ${rows.map((d) => `<div class="card day ${SCLS[d.status] || ''} ${d.day === dn ? 'today' : ''}" id="day${d.day}">
    <div class="dhead">
      <div><span class="dno">Day ${String(d.day).padStart(2, '0')}</span><span class="muted">${fmtDate(d.date)}</span> <span class="pill">Phase ${d.phase}</span>${d.day === dn ? ' <span class="pill now">Today</span>' : ''}</div>
      <div class="dctl">
        <button type="button" class="qbtn ${d.status === 'Rest Day' ? 'on rest' : ''}" data-q="Rest Day" data-id="${d.id}" title="Mark as rest day">${icon('coffee', 15)} Rest</button>
        <button type="button" class="qbtn ${d.status === 'Outing Day' ? 'on out' : ''}" data-q="Outing Day" data-id="${d.id}" title="Mark as outing day">${icon('pin', 15)} Outing</button>
        <select class="st" data-id="${d.id}" data-k="status">${STATUSES.map((s) => `<option ${s === d.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
    </div>
    <div class="g3 ${isOff(d) ? 'dim' : ''}">${fld(d, 'ai_task', trk(0))}${fld(d, 'job_task', trk(1))}${fld(d, 'startup_task', trk(2))}</div>
    <div class="g4">${num(d, 'planned_hours', 'Planned h')}${num(d, 'actual_hours', 'Actual h')}${fld(d, 'notes', 'Notes / what I learned', 1)}${fld(d, 'next_action', 'Next action', 1)}</div>
  </div>`).join('') || `<div class="card empty"><div class="big">${icon('calendar', 40)}</div>No days match these filters.</div>`}`;
  $('#pf').onchange = (e) => { phaseFilter = e.target.value; daily(); };
  $('#sf').onchange = (e) => { statusFilter = e.target.value; daily(); };
  const jump = (n) => document.getElementById('day' + n)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  $('#jump').onclick = () => { phaseFilter = 'all'; statusFilter = 'all'; daily().then(() => jump(dn)); };
  $('#view').onclick = async (e) => {
    const q = e.target.closest('[data-q]'); if (!q) return;
    const d = days.find((x) => x.id === q.dataset.id);
    const next = d.status === q.dataset.q ? 'Not Started' : q.dataset.q; // click again to undo
    toast((await sb.from('days').update({ status: next }).eq('id', d.id)).error); daily();
  };
  $('#view').onchange = (e) => { if (!e.target.id) saveField('days', e.target).then(() => e.target.dataset.k === 'status' && daily()); };
  if (pendingJump) { const n = pendingJump; pendingJump = null; setTimeout(() => jump(n), 50); }
}

async function saveField(table, el) {
  const { id, k } = el.dataset; if (!id) return;
  let v = el.value;
  if (el.type === 'number') v = v === '' ? null : Number(v);
  if (el.type === 'date' && v === '') v = null;
  toast((await sb.from(table).update({ [k]: v }).eq('id', id)).error);
}

// ---------- List tabs ----------
let typeFilter = {};
async function listTab(name) {
  const cfg = LISTS[name];
  const all = await load(cfg.table, 'created_at');
  const f = typeFilter[name] || 'all';
  const rows = all.filter((r) => !cfg.typeCol || f === 'all' || r[cfg.typeCol] === f).slice().reverse();
  head(name, cfg.sub, `<button class="btn" id="add">${icon('plus', 16)} ${cfg.add}</button>`);
  const input = (r, [k, label, opt]) => `<label><span class="lbl">${label}</span>${
    opt === 'area' ? `<textarea data-id="${r.id}" data-k="${k}" rows="2">${esc(r[k])}</textarea>`
    : Array.isArray(opt) ? `<select data-id="${r.id}" data-k="${k}">${opt.map((o) => `<option ${o === r[k] ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input ${opt === 'date' ? 'type="date"' : ''} data-id="${r.id}" data-k="${k}" value="${esc(r[k])}">`}</label>`;
  const typeSel = (r) => `<label><span class="lbl">Type</span><select data-id="${r.id}" data-k="${cfg.typeCol}">${cfg.types.map((t) => `<option ${t === r[cfg.typeCol] ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const chips = cfg.typeCol ? `<div class="toolbar chips">${['all', ...cfg.types].map((t) => `<button class="chip ${t === f ? 'on' : ''}" data-f="${t}">${t === 'all' ? 'All' : t}<b>${t === 'all' ? all.length : all.filter((r) => r[cfg.typeCol] === t).length}</b></button>`).join('')}</div>` : '';
  $('#view').innerHTML = chips + (rows.map((r) => `<div class="card entry">${cfg.typeCol ? typeSel(r) : ''}${cfg.fields.map((x) => input(r, x)).join('')}<button class="del" data-del="${r.id}" title="Delete">${icon('x', 16)}</button></div>`).join('')
    || `<div class="card empty"><div class="big">${icon('inbox', 40)}</div>${cfg.empty}</div>`);
  $('#add').onclick = async () => {
    const row = {}; if (cfg.typeCol) row[cfg.typeCol] = f === 'all' ? cfg.types[0] : f;
    toast((await sb.from(cfg.table).insert(row)).error); listTab(name);
  };
  $('#view').onchange = (e) => saveField(cfg.table, e.target);
  $('#view').onclick = async (e) => {
    const c = e.target.closest('[data-f]'); if (c) { typeFilter[name] = c.dataset.f; return listTab(name); }
    const id = e.target.dataset.del;
    if (id && confirm('Delete this entry?')) { toast((await sb.from(cfg.table).delete().eq('id', id)).error); listTab(name); }
  };
}

// ---------- Weekly review ----------
async function weekly() {
  const data = await load('weekly_reviews');
  const by = Object.fromEntries(data.map((r) => [r.week, r]));
  const wk = Math.ceil(todayDayNo() / 7);
  const fmt = (d) => fmtDate(new Date(START_DATE + (d - 1) * 864e5).toISOString().slice(0, 10));
  head('Weekly Review', 'Close each week: what got done, what blocked you, and what comes next.');
  const area = (w, k, label, ph) => `<label><span class="lbl">${label}</span><textarea data-w="${w}" data-k="${k}" rows="3" placeholder="${ph}">${esc(by[w]?.[k])}</textarea></label>`;
  $('#view').innerHTML = Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, i) => i + 1).map((w) => `<div class="card week ${w === wk ? 'cur' : ''}">
    <div class="dhead"><div><span class="dno">Week ${w}</span><span class="muted">${fmt((w - 1) * 7 + 1)} - ${fmt(Math.min(TOTAL_DAYS, w * 7))}</span>${w === wk ? ' <span class="pill now">This week</span>' : ''}</div></div>
    <div class="g3" style="margin:0">${area(w, 'completed', icon('check', 13) + ' Completed', 'What got done')}${area(w, 'blockers', icon('alert', 13) + ' Blockers', 'What got in the way')}${area(w, 'next_priorities', icon('target', 13) + ' Next priorities', 'Top priorities for next week')}</div></div>`).join('');
  $('#view').onclick = null;
  $('#view').onchange = async (e) => {
    const { w, k } = e.target.dataset; if (!w) return;
    const rec = { user_id: user.id, week: +w, [k]: e.target.value };
    toast((await sb.from('weekly_reviews').upsert(rec, { onConflict: 'user_id,week' })).error);
  };
}
