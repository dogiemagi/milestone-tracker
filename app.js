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

sb.auth.onAuthStateChange((_e, session) => {
  user = session?.user ?? null;
  $('#auth').classList.toggle('hide', !!user);
  $('#app').classList.toggle('hide', !user);
  if (user) { $('#who').textContent = user.email; const m = user.user_metadata || {}; applyChallenge(m.start_date || '2026-11-13', m.total_days || 89); boot(); }
});

// ---------- Start date ----------
const isoPlus = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const longDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const startISO = () => new Date(START_DATE).toISOString().slice(0, 10);
const endISO = () => isoPlus(startISO(), TOTAL_DAYS - 1);
function applyChallenge(iso, n) {
  window.START_DATE = Date.parse(iso + 'T00:00:00Z');
  setPlan(n);
  $('#brandsub').textContent = `${longDate(iso)} - ${longDate(endISO())}`;
  document.title = 'Challenge Tracker';
}
const untouched = (d) => d.status === 'Not Started' && !d.notes && !d.next_action && d.actual_hours == null;

function changeSettings() {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card"><h3>Challenge settings</h3>
    <div class="dates">
      <button type="button" class="dpick on" data-mode="start"><span class="lbl">Start date</span><b id="sdt"></b></button>
      <button type="button" class="dpick" data-mode="end"><span class="lbl">End date</span><b id="edt"></b></button>
      <div class="dlen"><span class="lbl">Days</span><b id="nlen"></b></div>
    </div>
    <p class="muted" id="hint" style="margin:8px 0 0">Pick the <b>start</b> date on the calendar, then the <b>end</b> date.</p>
    <div id="cal" class="cal"></div>
    <div class="chips" style="margin-top:8px"><span class="muted" style="align-self:center">Quick length:</span>${[30, 60, 89, 100, 180].map((n) => `<button type="button" class="chip" data-n="${n}">${n}</button>`).join('')}</div>
    <input type="hidden" id="sd" value="${startISO()}"><input type="hidden" id="nd" value="${TOTAL_DAYS}">
    <p class="muted">Length must be 14 to 365 days. The roadmap phases and targets scale to the new length. Days you already worked on keep their notes and hours; untouched days get refreshed tasks.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" id="mc">Cancel</button><button class="btn" id="ms">Save</button></div></div>`;
  document.body.appendChild(m);
  let mode = 'start';
  const clampN = (n) => Math.max(14, Math.min(365, n));
  const upd = () => {
    const v = $('#sd').value, n = +$('#nd').value;
    $('#sdt').textContent = longDate(v); $('#edt').textContent = longDate(isoPlus(v, n - 1)); $('#nlen').textContent = n;
    m.querySelectorAll('.dpick').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    $('#hint').innerHTML = mode === 'start' ? 'Click a day to set the <b>start</b> date.' : 'Now click a day to set the <b>end</b> date (14 to 365 days after the start).';
  };
  const cal = mountCalendar($('#cal'), () => $('#sd').value, () => +$('#nd').value || 0, (iso) => {
    if (mode === 'start') { $('#sd').value = iso; mode = 'end'; }
    else {
      const diff = Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse($('#sd').value + 'T00:00:00Z')) / 864e5) + 1;
      $('#nd').value = clampN(diff);
      if (diff < 14 || diff > 365) $('#hint').dataset.warn = '1';
    }
    upd(); cal.draw();
    if ($('#hint').dataset.warn) { $('#hint').dataset.warn = ''; $('#hint').innerHTML = 'Length must be 14 to 365 days, so the end date was adjusted.'; }
  });
  upd();
  m.onclick = (e) => {
    if (e.target === m || e.target.id === 'mc') m.remove();
    const c = e.target.closest('[data-n]'); if (c) { $('#nd').value = c.dataset.n; upd(); cal.draw(); }
    const p = e.target.closest('[data-mode]'); if (p) { mode = p.dataset.mode; upd(); }
  };
  $('#ms').onclick = async () => {
    const iso = $('#sd').value, n = Math.round(+$('#nd').value);
    if (!iso || !(n >= 14 && n <= 365)) return alert('Choose a start date and between 14 and 365 days.');
    const days = await load('days', 'day');
    const oldStart = START_DATE;
    window.START_DATE = Date.parse(iso + 'T00:00:00Z');
    const plan = Object.fromEntries(buildDays(user.id, n).map((r) => [r.day, r]));
    const removing = days.filter((d) => d.day > n);
    if (removing.some((d) => !untouched(d)) && !confirm(`Shortening to ${n} days removes days ${n + 1}-${days.length}, and some have progress logged. Continue?`)) { window.START_DATE = oldStart; setPlan(TOTAL_DAYS); return; }
    $('#ms').disabled = true;
    const fail = (e) => { alert(e.message + (/check constraint/i.test(e.message) ? '\n\nRun the migration at the bottom of supabase/schema.sql in the Supabase SQL Editor first.' : '')); window.START_DATE = oldStart; $('#ms').disabled = false; };
    const { error: ue } = await sb.auth.updateUser({ data: { start_date: iso, total_days: n } });
    if (ue) return fail(ue);
    const keep = days.filter((d) => d.day <= n).map((d) => { const p = plan[d.day]; return { ...d, date: p.date, phase: p.phase, ...(untouched(d) ? { ai_task: p.ai_task, job_task: p.job_task, startup_task: p.startup_task } : {}) }; });
    if (keep.length) { const { error } = await sb.from('days').upsert(keep, { onConflict: 'id' }); if (error) return fail(error); }
    const adds = Object.values(plan).filter((r) => r.day > days.length);
    if (adds.length) { const { error } = await sb.from('days').insert(adds); if (error) return fail(error); }
    if (removing.length) { const { error } = await sb.from('days').delete().in('id', removing.map((d) => d.id)); if (error) return fail(error); }
    applyChallenge(iso, n); m.remove(); phaseFilter = 'all'; render();
  };
}

async function boot() {
  const { count, error } = await sb.from('days').select('id', { count: 'exact', head: true });
  if (error) return alert('Database not ready - did you run supabase/schema.sql?\n' + error.message);
  if (count === 0) toast((await sb.from('days').insert(buildDays(user.id))).error);
  renderTabs(); render();
}

function renderTabs() {
  $('#tabs').innerHTML = NAV.map(([t, i]) => `<button class="${t === tab ? 'on' : ''}" data-t="${t}"><span class="ic">${icon(i, 18)}</span><span class="lb">${t}</span></button>`).join('');
  $('#tabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { goTab(b.dataset.t); } };
}
function goTab(t) { tab = t; renderTabs(); render(); window.scrollTo(0, 0); }
function head(title, sub, actions = '') { $('#ptitle').textContent = title; $('#psub').textContent = sub; $('#pact').innerHTML = actions; }
const render = () => ({ 'Dashboard': dashboard, 'Daily Tracker': daily, 'Weekly Review': weekly }[tab] || (() => listTab(tab)))();

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
    <div class="card stat"><span class="ico c-bl">${icon('briefcase', 20)}</span><div class="k">Applications sent</div><div class="v">${jobs.filter((j) => j.type === 'Application').length}<span class="muted" style="font-size:15px"> / ${TARGETS.job[0][1]}</span></div></div>
  </div>

  <div class="grid g-2">
    <div class="card focus"><h3>Today's focus <span class="pill" style="margin-left:6px">Day ${String(today.day).padStart(2, '0')} · ${fmtDate(today.date)}</span></h3>
      ${isOff(today)
        ? `<div class="task offnote"><span class="offic">${icon(today.status === 'Rest Day' ? 'coffee' : 'pin', 22)}</span><span><b>${today.status === 'Rest Day' ? 'Rest day' : 'Outing day'}</b><br><span class="muted">No tasks today and your streak is safe. Enjoy it, and come back tomorrow.</span></span></div>`
        : `<div class="task"><em class="em-ai">AI</em><span>${esc(today.ai_task)}</span></div>
      <div class="task"><em class="em-job">JOB</em><span>${esc(today.job_task)}</span></div>
      <div class="task"><em class="em-st">STARTUP</em><span>${esc(today.startup_task)}</span></div>`}
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
    <div class="card"><h3>Roadmap</h3>${PHASES.map((p) => {
      const ds = days.filter((d) => d.phase === p.n && !isOff(d)), s = ds.reduce((a, d) => a + score(d), 0);
      return `<div class="phase ${phase && phase.n === p.n ? 'cur' : ''}"><div class="n">${p.n}</div><div><b>${esc(p.name)}</b> <span class="muted">· days ${p.from}-${p.to}</span>${bar(s, ds.length, ds.length && s === ds.length ? 'ok' : '')}<div class="mile">${esc(p.milestone)}</div></div><b>${s}<span class="muted">/${ds.length}</span></b></div>`;
    }).join('')}</div>
    <div style="display:grid;gap:16px;align-content:start">
      <div class="card"><h3 class="ih">${icon('briefcase')} Career targets</h3>${targetRows(TARGETS.job, jobs, 'type')}</div>
      <div class="card"><h3 class="ih">${icon('rocket')} Startup targets</h3>${targetRows(TARGETS.startup, startup, 'kind')}</div>
    </div>
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
  head('Daily Tracker', 'Plan, log hours and capture notes for every day of the challenge.', `<button class="btn" id="jump">${icon('calendar', 16)} Jump to today</button>`);
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
    <div class="g3 ${isOff(d) ? 'dim' : ''}">${fld(d, 'ai_task', icon('cpu', 13) + ' AI task')}${fld(d, 'job_task', icon('briefcase', 13) + ' Job task')}${fld(d, 'startup_task', icon('rocket', 13) + ' Startup task')}</div>
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
