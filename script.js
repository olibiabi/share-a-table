/* =========================================================
   Share a Table — same table, different plates.
   A food mini-game where every choice is an action,
   and the table rearranges itself around what you pick.
   Illustrations: generated once with google/nano-banana-2
   through the ITP Replicate proxy, saved in /assets.
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const C = { red: '#C92A1E', paper: '#FBF7EF' };

/* ---------- small helpers ---------- */
function rng(seed) {
  let s = (seed * 9301 + 49297) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// a wobbly closed shape (used for hot-sauce drops)
function blob(cx, cy, rx, ry, j = 0.08, n = 10, seed = 1) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + (r() * 2 - 1) * j;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  const f = v => v.toFixed(2);
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const s = mid(pts[n - 1], pts[0]);
  let d = `M${f(s[0])},${f(s[1])}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % n]);
    d += ` Q${f(p[0])},${f(p[1])} ${f(m[0])},${f(m[1])}`;
  }
  return d + 'Z';
}
const src = name => `assets/${name}.webp`;
const img = (name, style = '') => `<img src="${src(name)}" alt="" draggable="false" style="${style}">`;
// how toasted the bread looks (0 = raw, 1 = charcoal)
const toastFilter = t => `sepia(${Math.min(1, t * 1.4).toFixed(2)}) saturate(${(1 + t * 2.4 - (t > .7 ? (t - .7) * 5 : 0)).toFixed(2)}) hue-rotate(${(-10 * t).toFixed(1)}deg) brightness(${(1 - t * t * 0.78 - t * 0.08).toFixed(2)})`;

// preload so nothing pops in mid-game
['plate0', 'plate1', 'plate2', 'plate3', 'plate4', 'soup', 'cilantro', 'pizza', 'pineapple', 'pineapplebowl', 'bread', 'toaster',
  'cerealbox', 'milk', 'bowlempty', 'bowlfull', 'egg', 'hotsauce', 'flame', 'chili', 'cake', 'strawberry', 'hull', 'pizzabox', 'pizzaboxclosed',
  'slice', 'tomato', 'tablecloth', 'susan', 'napkin'].forEach(n => { new Image().src = src(n); });

/* ---------- plates ---------- */
const PLATES = [
  { name: 'Tomato Dots', src: 'plate0' },
  { name: 'Garden Scallop', src: 'plate1' },
  { name: 'Sunny Stripes', src: 'plate2' },
  { name: 'Plum Glaze', src: 'plate3' },
  { name: 'Blue Flowers', src: 'plate4' },
];

// a person's whole meal on their plate — the "self-portrait"
function plateHTML(p) {
  const put = (name, x, y, w, rot = 0, extra = '') =>
    `<img src="${src(name)}" alt="" draggable="false" style="left:${x}%;top:${y}%;width:${w}%;transform:translate(-50%,-50%) rotate(${rot}deg);${extra}">`;
  let h = `<div class="plated">${img(PLATES[p.plate].src, 'width:100%')}`;
  h += put('bread', 36, 38, 27, -10, `filter:${toastFilter(p.toast)}`);
  const pin = Math.round(p.pineapple * 5);
  for (let i = 0; i < pin; i++) h += put('pineapple', 62 + (i % 3) * 7, 30 + Math.floor(i / 3) * 8, 10, i * 40 - 20);
  if (p.cilantro > 0.55) {
    const n = Math.round(p.cilantro * 5);
    for (let i = 0; i < n; i++) h += put('cilantro', 44 + (i % 3) * 8, 58 + Math.floor(i / 3) * 8, 13, i * 70 - 30);
  } else if (p.cilantro < 0.35) {
    // the little pile of picked-out leaves on the rim
    for (let i = 0; i < 3; i++) h += put('cilantro', 15 + i * 4, 66 + i * 4, 10, i * 60 - 40);
  }
  if (p.lastSlice) h += put('slice', 40, 70, 17, 150);
  h += put(p.strawberryLast ? 'strawberry' : 'hull', 66, 62, p.strawberryLast ? 13 : 12, 12);
  const drops = Math.round(p.spice * 9), r = rng(drops + 3);
  if (drops) {
    let d = '';
    for (let i = 0; i < drops; i++) d += `<path d="${blob(42 + r() * 30, 44 + r() * 20, 1.3 + r() * 1.3, 1.3 + r() * 1.3, 0.25, 7, i)}" fill="${C.red}"/>`;
    h += `<svg class="drops" viewBox="0 0 100 100">${d}</svg>`;
  }
  return h + '</div>';
}

/* ---------- state ---------- */
const blank = () => ({ name: 'You', plate: 0, cilantro: 0.7, pineapple: 0.4, toast: 0.5, milkFirst: 0, spice: 0, strawberryLast: 0, lastSlice: 0, dish: '', memory: '' });
let me = blank();

/* ---------- classmates at the table (demo data; class version reads these from Firebase) ---------- */
const DINERS = [
  { name: 'Maya', plate: 1, cilantro: 0.9, pineapple: 0, toast: 0.55, milkFirst: 0, spice: 0.9, strawberryLast: 1, lastSlice: 1, dish: 'Jollof rice', memory: 'My aunt, at every family party' },
  { name: 'Jonas', plate: 4, cilantro: 0.05, pineapple: 0, toast: 0.8, milkFirst: 0, spice: 0.2, strawberryLast: 1, lastSlice: 0, dish: 'Potato soup', memory: 'My grandpa, on cold Sunday nights' },
  { name: 'Priya', plate: 2, cilantro: 1, pineapple: 0.3, toast: 0.4, milkFirst: 1, spice: 1, strawberryLast: 0, lastSlice: 1, dish: 'Dal and rice', memory: 'My mom, when I came home late from school' },
  { name: 'Leo', plate: 0, cilantro: 0.1, pineapple: 0.9, toast: 0.3, milkFirst: 1, spice: 0.4, strawberryLast: 0, lastSlice: 1, dish: 'Pão de queijo', memory: 'My dad, every Saturday morning' },
  { name: 'Hana', plate: 3, cilantro: 0, pineapple: 0.4, toast: 0.5, milkFirst: 0, spice: 0.75, strawberryLast: 1, lastSlice: 0, dish: 'Kimchi stew', memory: 'My best friend, the night after my breakup' },
  { name: 'Sam', plate: 2, cilantro: 0.5, pineapple: 1, toast: 0.95, milkFirst: 0, spice: 0.6, strawberryLast: 0, lastSlice: 1, dish: 'Mac and cheese', memory: 'My roommate, during finals week' },
  { name: 'Wen', plate: 0, cilantro: 0, pineapple: 0.1, toast: 0.45, milkFirst: 0, spice: 1, strawberryLast: 1, lastSlice: 0, dish: 'Tomato and egg noodles', memory: 'My grandma, whenever I was sick' },
];

/* ---------- napkin themes (stand-in for an embedding model) ---------- */
const THEMES = {
  care: { label: 'the taste of being taken care of', words: ['sick', 'cold', 'flu', 'grandma', 'grandpa', 'nana', 'nonna', 'granny', 'soup', 'congee', 'porridge', 'broth', 'rain', 'tired', 'comfort', 'fever', 'winter', 'night'] },
  home: { label: 'the taste of an ordinary day at home', words: ['mom', 'mum', 'mother', 'dad', 'father', 'morning', 'saturday', 'sunday', 'breakfast', 'school', 'home', 'after', 'weekend', 'kitchen', 'everyday', 'dinner'] },
  celebration: { label: 'the taste of everyone together', words: ['party', 'birthday', 'christmas', 'holiday', 'wedding', 'new year', 'festival', 'thanksgiving', 'aunt', 'uncle', 'family', 'eid', 'diwali', 'lunar', 'celebrat'] },
  friendship: { label: 'the taste of someone showing up for you', words: ['friend', 'roommate', 'partner', 'breakup', 'finals', 'late', 'dorm', 'boyfriend', 'girlfriend', 'classmate', 'exam', 'deadline', 'moved'] },
};
function themeOf(p) {
  const text = `${p.dish} ${p.memory}`.toLowerCase();
  let best = 'home', score = 0;
  for (const [k, t] of Object.entries(THEMES)) {
    const s = t.words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
    if (s > score) { score = s; best = k; }
  }
  return best;
}
DINERS.forEach(d => { d.theme = themeOf(d); });

/* ---------- matching ---------- */
const KEYS = ['cilantro', 'pineapple', 'toast', 'milkFirst', 'spice', 'strawberryLast', 'lastSlice'];
const WEIGHTS = { cilantro: 1.6, pineapple: 1, toast: 0.7, milkFirst: 0.8, spice: 1.2, strawberryLast: 1, lastSlice: 1 };
function simOn(key, a, b) {
  if (key === 'napkin') return a.theme === b.theme ? 1 : 0.25;
  return 1 - Math.abs(a[key] - b[key]);
}
function simAll(a, b) {
  let s = 0, w = 0;
  KEYS.forEach(k => {
    let ww = WEIGHTS[k];
    // sharing a dislike bonds people more than sharing a like
    if (k === 'cilantro' && a.cilantro < 0.3 && b.cilantro < 0.3) ww *= 1.5;
    s += simOn(k, a, b) * ww; w += ww;
  });
  return 0.8 * (s / w) + 0.2 * simOn('napkin', a, b);
}
function tags(a, b) {
  const t = [];
  if (a.cilantro < 0.3 && b.cilantro < 0.3) t.push('Cilantro Haters Club');
  else if (a.cilantro > 0.7 && b.cilantro > 0.7) t.push('Cilantro Lovers');
  else if (Math.abs(a.cilantro - b.cilantro) > 0.6) t.push("You Pick It, I'll Eat It");
  if (a.lastSlice && b.lastSlice) t.push('Last Slice Rivals');
  if (!a.lastSlice && !b.lastSlice) t.push('Polite Lid Closers');
  if (a.strawberryLast && b.strawberryLast) t.push('Best for Last');
  if (!a.strawberryLast && !b.strawberryLast) t.push('Strawberry Snatchers');
  if (a.milkFirst && b.milkFirst) t.push('Milk-First Weirdos');
  if (a.spice > 0.6 && b.spice > 0.6) t.push('Fire Breathers');
  if (a.pineapple > 0.6 && b.pineapple > 0.6) t.push('Team Pineapple');
  if (a.pineapple < 0.1 && b.pineapple < 0.1) t.push('Pizza Purists');
  if (Math.abs(a.toast - b.toast) < 0.12) t.push('Same Toast Twins');
  if (a.theme === b.theme) t.push('Same Kind of Comfort');
  if (Math.abs(a.pineapple - b.pineapple) > 0.7 && !t.includes("You Pick It, I'll Eat It")) t.push("You Pick It, I'll Eat It");
  return t.slice(0, 4);
}
function fusedMods(a, b) {
  const m = [];
  if (a.cilantro < 0.3 && b.cilantro < 0.3) m.push('absolutely no cilantro');
  else if (Math.abs(a.cilantro - b.cilantro) > 0.5) m.push('cilantro on the side, for one of you');
  else if (a.cilantro > 0.7 && b.cilantro > 0.7) m.push('buried in cilantro');
  const sp = (a.spice + b.spice) / 2;
  if (sp > 0.65) m.push('extra hot sauce'); else if (sp < 0.2) m.push('no heat at all');
  if (a.strawberryLast && b.strawberryLast) m.push('a strawberry on top, saved for last');
  if (a.lastSlice && b.lastSlice) m.push('cut into two last slices, to avoid a fight');
  m.push(`with toast, ${toastWord((a.toast + b.toast) / 2)}`);
  return m.slice(0, 3);
}
const toastWord = t => t < 0.2 ? 'barely warm' : t < 0.45 ? 'lightly golden' : t < 0.7 ? 'golden brown' : t < 0.88 ? 'dark and crunchy' : 'charcoal';

/* ---------- persona ---------- */
function persona(p) {
  const T = [];
  if (p.cilantro < 0.35) T.push({ adj: 'Cilantro-Free', noun: 'Cilantro Skeptic', s: 1 - p.cilantro });
  else if (p.cilantro > 0.75) T.push({ adj: 'Herb-Loving', noun: 'Herb Enthusiast', s: p.cilantro });
  if (p.spice > 0.5) T.push({ adj: 'Fire-Breathing', noun: 'Fire-Eater', s: p.spice });
  else if (p.spice === 0) T.push({ adj: 'Mild-Mannered', noun: 'Heat Dodger', s: 0.55 });
  if (p.pineapple > 0.55) T.push({ adj: 'Tropical', noun: 'Pineapple Rebel', s: p.pineapple });
  else if (p.pineapple === 0) T.push({ adj: 'Purist', noun: 'Pizza Purist', s: 0.6 });
  if (p.toast > 0.82) T.push({ adj: 'Charred', noun: 'Charcoal Connoisseur', s: p.toast });
  else if (p.toast < 0.22) T.push({ adj: 'Barely-Toasted', noun: 'Pale Toast Romantic', s: 1 - p.toast });
  if (p.milkFirst) T.push({ adj: 'Chaotic', noun: 'Milk-First Rebel', s: 0.85 });
  T.push(p.strawberryLast ? { adj: 'Patient', noun: 'Saver of Strawberries', s: 0.7 } : { adj: 'Impatient', noun: 'Strawberry Snatcher', s: 0.66 });
  T.push(p.lastSlice ? { adj: 'Unapologetic', noun: 'Last-Slice Bandit', s: 0.75 } : { adj: 'Polite', noun: 'Lid Closer', s: 0.5 });
  T.sort((x, y) => y.s - x.s);
  return { title: `The ${T[1].adj} ${T[0].noun}`, traits: T.map(t => t.noun) };
}

/* =========================================================
   Firebase: everyone's plates, shared live
   /shareATable/plates/{anonymous uid} = one plate per person
   ========================================================= */
const FB = { ok: false, uid: null, api: null, ref: null, plates: [], onChange: null };
const NUM_KEYS = ['cilantro', 'pineapple', 'toast', 'milkFirst', 'spice', 'strawberryLast', 'lastSlice'];
async function initFirebase() {
  const cfg = window.shareTableFirebaseConfig || {};
  if (!cfg.apiKey || !cfg.databaseURL) return;
  try {
    const V = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const [appM, dbM, authM] = await Promise.all([import(V + 'firebase-app.js'), import(V + 'firebase-database.js'), import(V + 'firebase-auth.js')]);
    const app = appM.initializeApp(cfg);
    const cred = await authM.signInAnonymously(authM.getAuth(app));
    FB.uid = cred.user.uid;
    FB.api = dbM;
    FB.ref = dbM.ref(dbM.getDatabase(app), 'shareATable/plates');
    dbM.onValue(FB.ref, snap => {
      const all = [];
      snap.forEach(c => {
        const v = c.val() || {};
        if (c.key === FB.uid || typeof v.dish !== 'string') return;
        const p = { id: c.key, name: String(v.name || 'Someone').slice(0, 20), plate: clamp(Math.round(+v.plate || 0), 0, PLATES.length - 1), dish: String(v.dish).slice(0, 60), memory: String(v.memory || '').slice(0, 80), createdAt: +v.createdAt || 0 };
        NUM_KEYS.forEach(k => { p[k] = clamp(+v[k] || 0); });
        p.theme = themeOf(p);
        all.push(p);
      });
      all.sort((a, b) => b.createdAt - a.createdAt);
      FB.plates = all.slice(0, 80);
      FB.ok = true;
      if (FB.onChange) FB.onChange();
    }, err => console.warn('Firebase read failed', err));
  } catch (err) {
    console.warn('Firebase unavailable, using sample diners only', err);
  }
}
async function savePlate(p) {
  if (!FB.ref || !FB.uid) return false;
  const data = { name: p.name.slice(0, 20), plate: p.plate, dish: p.dish.slice(0, 60), memory: p.memory.slice(0, 80), createdAt: Date.now() };
  NUM_KEYS.forEach(k => { data[k] = Math.round(clamp(+p[k] || 0) * 1000) / 1000; });
  try { await FB.api.set(FB.api.child(FB.ref, FB.uid), data); return true; }
  catch (err) { console.warn('Could not save plate', err); return false; }
}
// real classmates first; sample diners fill any empty seats
function tablePeople() {
  const real = FB.plates.map(p => ({ ...p }));
  const need = Math.max(0, 7 - real.length);
  return real.concat(DINERS.slice(0, need).map((d, i) => ({ ...d, id: 'sample-' + i, sample: true })));
}
initFirebase();

/* ---------- step bar ---------- */
const COURSES = [
  { id: 'cilantro', short: 'Soup', title: 'The Soup', prompt: 'A bowl of noodle soup arrives, covered in cilantro. Tap the leaves you want gone. Or sprinkle on more.' },
  { id: 'pineapple', short: 'Pizza', title: 'The Pizza', prompt: 'Someone put pineapple on your pizza. Tap a piece to flick it off, or drag more on from the bowl.' },
  { id: 'toast', short: 'Toast', title: 'The Toast', prompt: 'Press and hold the toaster. Let go when it looks just right.' },
  { id: 'cereal', short: 'Cereal', title: 'The Cereal', prompt: 'Breakfast. An empty bowl. What goes in first?' },
  { id: 'sauce', short: 'Hot Sauce', title: 'The Hot Sauce', prompt: 'Two eggs, one bottle. Tap the bottle to shake it — as many times as you dare.' },
  { id: 'cake', short: 'Cake', title: 'The Cake', prompt: 'A slice of strawberry cake. Take a bite. Anywhere you like.' },
  { id: 'slice', short: 'Last Slice', title: 'The Last Slice', prompt: 'One slice left in the box. Nobody is looking. Drag it to your plate, or close the lid.' },
  { id: 'napkin', short: 'Napkin', title: 'The Napkin', prompt: "Before you leave the table, write something on the napkin. It's the part of you the other choices can't show." },
];
function setSteps(i) {
  $('#steps').innerHTML = i < 0 ? '' : COURSES.map((c, k) =>
    `<li class="${k < i ? 'done' : k === i ? 'now' : ''}">${k + 1}. ${c.short}</li>`).join('') +
    `<li class="${i >= COURSES.length ? 'now' : ''}">Table</li>`;
}
function setHeat(v) { document.body.style.setProperty('--heat', v); }

/* ---------- dragging (pointer events, works with touch) ---------- */
function startDrag(el, e, stage, onDrop) {
  e.preventDefault();
  const rect = stage.getBoundingClientRect();
  const toPct = ev => ({ x: (ev.clientX - rect.left) / rect.width * 100, y: (ev.clientY - rect.top) / rect.height * 100 });
  const p0 = toPct(e), o = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  const off = { x: o.x - p0.x, y: o.y - p0.y };
  let moved = false;
  el.classList.add('dragging');
  const move = ev => {
    const p = toPct(ev);
    if (Math.hypot(p.x - p0.x, p.y - p0.y) > 1.5) moved = true;
    el.style.left = (p.x + off.x) + '%'; el.style.top = (p.y + off.y) + '%';
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    el.classList.remove('dragging');
    onDrop({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), moved, from: o });
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
// an image placed on the stage, centered at x,y (% of stage), w = % of stage width
function addItem(stage, { x, y, w, name, cls = '', rot = 0 }) {
  const el = document.createElement('div');
  el.className = 'item ' + cls;
  el.style.left = x + '%'; el.style.top = y + '%'; el.style.width = w + '%';
  el.innerHTML = img(name, rot ? `transform:rotate(${rot}deg)` : '');
  stage.appendChild(el);
  return el;
}

/* =========================================================
   Screens
   ========================================================= */
function renderIntro() {
  setSteps(-1); setHeat(0);
  me = blank();
  const bits = [
    [9, 16, -12, 'tomato', 12], [86, 14, 14, 'strawberry', 9], [6, 66, 10, 'bread', 11], [90, 62, -18, 'chili', 9],
    [22, 86, 20, 'pineapple', 8], [76, 86, -8, 'cilantro', 9], [68, 6, 6, 'egg', 9], [28, 8, 18, 'slice', 8],
  ];
  app.innerHTML = `<section class="intro">
    ${bits.map(([x, y, r, n, w], i) => `<div class="scatter" style="left:${x}%;top:${y}%;width:clamp(70px, ${w}vw, 170px);rotate:${r}deg;animation-delay:${-i * 0.7}s">${img(n)}</div>`).join('')}
    <div class="intro-card">
      <p class="sub">same table, different plates</p>
      <h1>Share a <em>Table</em></h1>
      <p class="lede">Eight small things to eat. No questions — just pick out, pour, shake and bite. Then the table rearranges itself around you, so you can see who you'd actually get along with.</p>
      <button class="btn" id="go">Take a seat</button>
    </div>
  </section>`;
  $('#go').onclick = renderPlateDraw;
}

function renderPlateDraw() {
  setSteps(-1);
  app.innerHTML = `<section class="course">
    <div class="text">
      <p class="no">Before we eat</p>
      <h1>Your plate</h1>
      <p class="prompt">Everyone at this table gets a plate. You don't choose it — it's handed to you, like the universe you were born into.</p>
      <p class="feedback" id="fb"></p>
      <div class="row"><button class="btn" id="draw">Draw a plate</button><button class="btn green" id="next" hidden>Start eating →</button></div>
    </div>
    <div class="stage plate-stack" id="stage"></div>
  </section>`;
  const stage = $('#stage');
  const els = PLATES.map((p, i) => addItem(stage, { x: 50 + (i - 2) * 2.5, y: 50 - (i - 2) * 3, w: 62, name: p.src, rot: (i - 2) * 9 }));
  $('#draw').onclick = () => {
    me.plate = Math.floor(Math.random() * PLATES.length);
    els.forEach((el, i) => {
      if (i === me.plate) { el.style.left = '50%'; el.style.top = '50%'; el.style.width = '80%'; el.style.zIndex = 9; el.style.transform = 'translate(-50%,-50%) rotate(-8deg)'; }
      else { el.style.transition = 'left .7s ease-in, opacity .6s'; el.style.left = (i < me.plate ? -20 : 120) + '%'; el.style.opacity = 0; }
    });
    $('#fb').innerHTML = `You got the <b>${PLATES[me.plate].name}</b> plate.`;
    $('#draw').hidden = true; $('#next').hidden = false;
  };
  $('#next').onclick = () => renderCourse(0);
}

function renderCourse(i) {
  const c = COURSES[i];
  setSteps(i); setHeat(0);
  app.innerHTML = `<section class="course">
    <div class="text">
      <p class="no">Course No. ${i + 1}</p>
      <h1>${c.title}</h1>
      <p class="prompt">${c.prompt}</p>
      <p class="feedback" id="fb"></p>
      <div class="extra" id="extra"></div>
      <button class="btn" id="next" disabled>${i === COURSES.length - 1 ? 'Leave the table →' : 'Next →'}</button>
    </div>
    <div class="stage" id="stage"></div>
  </section>`;
  const ui = {
    say(msg) { $('#fb').textContent = msg; },
    ready(msg) { if (msg) this.say(msg); $('#next').disabled = false; },
    extra(html) { $('#extra').innerHTML = html; return $('#extra'); },
  };
  SETUP[c.id].finish = null;
  $('#next').onclick = () => {
    if (SETUP[c.id].finish) SETUP[c.id].finish();
    i + 1 < COURSES.length ? renderCourse(i + 1) : renderTable();
  };
  SETUP[c.id]($('#stage'), ui);
}

/* ---------- the eight courses ---------- */
const SETUP = {
  cilantro(stage, ui) {
    addItem(stage, { x: 50, y: 50, w: 94, name: 'soup', cls: 'still' });
    const r = rng(42);
    let leaves = 0, picked = 0, added = 0;
    const update = () => {
      me.cilantro = clamp(leaves / 20);
      ui.ready(leaves === 0 ? 'Not a single leaf left. Respect.'
        : added > 0 && leaves > 14 ? 'More cilantro! A true believer.'
        : picked > 0 && leaves < 7 ? 'Picking very carefully…'
        : picked > 0 ? 'A little cilantro is fine, I guess.'
        : 'Leaving it all in? Bold.');
    };
    const addLeaf = fresh => {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 25;
      const el = addItem(stage, { x: 50 + Math.cos(a) * rr, y: 50 + Math.sin(a) * rr, w: 16, name: 'cilantro', rot: Math.floor(r() * 360), cls: 'clickable' + (fresh ? ' drop-in' : '') });
      el.addEventListener('click', () => {
        if (el.dataset.gone) return;
        el.dataset.gone = 1; leaves--; picked++;
        el.classList.remove('drop-in'); el.classList.add('flick');
        setTimeout(() => el.remove(), 600);
        update();
      });
      leaves++;
    };
    for (let k = 0; k < 14; k++) addLeaf(false);
    ui.extra(`<button class="btn ghost" id="more">+ sprinkle more</button>`);
    $('#more').onclick = () => { for (let k = 0; k < 3; k++) { addLeaf(true); added++; } update(); };
    ui.ready('Look at all that cilantro.');
  },

  pineapple(stage, ui) {
    const PC = { x: 42, y: 46, r: 30 };
    addItem(stage, { x: PC.x, y: PC.y, w: 72, name: 'pizza', cls: 'still' });
    let count = 0;
    const update = () => {
      me.pineapple = clamp(count / 10);
      ui.ready(count === 0 ? 'Pizza, as nature intended.'
        : count <= 3 ? 'Just a little sweetness.'
        : count <= 7 ? 'Team pineapple. Proudly.'
        : "That's a pineapple with some pizza on it.");
    };
    const onPizza = (x, y) => Math.hypot(x - PC.x, y - PC.y) < PC.r;
    const chunk = (x, y) => {
      const el = addItem(stage, { x, y, w: 12, name: 'pineapple', rot: Math.floor(Math.random() * 360) });
      el.addEventListener('pointerdown', e => startDrag(el, e, stage, ({ x, y, moved }) => {
        if (!moved) { el.classList.add('flick'); setTimeout(() => el.remove(), 600); count--; update(); return; }
        if (!onPizza(x, y)) { el.classList.add('fall'); setTimeout(() => el.remove(), 500); count--; update(); }
      }));
      return el;
    };
    [[30, 38], [52, 32], [44, 58], [58, 50]].forEach(([x, y]) => { chunk(x, y); count++; });
    const bowl = addItem(stage, { x: 85, y: 85, w: 27, name: 'pineapplebowl', cls: 'source' });
    bowl.addEventListener('pointerdown', e => {
      const rect = stage.getBoundingClientRect();
      const el = chunk((e.clientX - rect.left) / rect.width * 100, (e.clientY - rect.top) / rect.height * 100);
      startDrag(el, e, stage, ({ x, y }) => {
        if (onPizza(x, y)) { count++; update(); }
        else { el.classList.add('fall'); setTimeout(() => el.remove(), 500); }
      });
    });
    ui.ready('Four pieces of pineapple, sitting right there.');
  },

  toast(stage, ui) {
    stage.insertAdjacentHTML('beforeend', `<p class="hold-hint">press &amp; hold</p>`);
    const toaster = addItem(stage, { x: 50, y: 62, w: 78, name: 'toaster', cls: 'toaster' });
    // the bread lives in a layer cut off at the slot's front lip, so it can only ever stick out of the slot
    stage.insertAdjacentHTML('beforeend', `<div class="slotclip"></div>`);
    const bread = addItem($('.slotclip', stage), { x: 43.8, y: 36, w: 30, name: 'bread', cls: 'toast-bread' });
    const bImg = $('img', bread);
    let t = 0, holding = false, last = 0;
    const paint = () => { bImg.style.filter = toastFilter(t); };
    const loop = now => {
      if (!holding) return;
      t = clamp(t + (now - last) / 6000); last = now; paint();
      if (t >= 1) { release(); return; }
      requestAnimationFrame(loop);
    };
    const press = e => {
      e.preventDefault();
      if (holding) return;
      holding = true; last = performance.now();
      bread.classList.remove('popped'); bread.style.top = '54%';
      toaster.classList.add('on'); ui.say('toasting…');
      requestAnimationFrame(loop);
    };
    const release = () => {
      if (!holding) return;
      holding = false;
      toaster.classList.remove('on');
      bread.classList.add('popped'); bread.style.top = '26%';
      setTimeout(() => { bread.style.top = '36%'; }, 450);
      me.toast = t;
      ui.ready({ 'barely warm': 'Barely warm. Basically bread.', 'lightly golden': 'Lightly golden. Gentle.', 'golden brown': 'Golden brown. Textbook.', 'dark and crunchy': 'Dark and crunchy. Serious.', charcoal: 'Charcoal. On purpose?' }[toastWord(t)]);
      $('.hold-hint', stage).textContent = 'hold again for darker';
    };
    [toaster, bread].forEach(el => el.addEventListener('pointerdown', press));
    window.addEventListener('pointerup', release);
    SETUP.toast.finish = () => { window.removeEventListener('pointerup', release); me.toast = t; };
  },

  cereal(stage, ui) {
    // four versions of the same bowl, stacked and bottom-aligned: empty → one thing in → both in
    stage.insertAdjacentHTML('beforeend', `<div class="bowlstack">
      ${img('bowlempty', '')}${img('bowlcereal', '')}${img('bowlmilk', '')}${img('bowlfull', '')}</div>`);
    const show = name => stage.querySelectorAll('.bowlstack img').forEach(im => im.classList.toggle('on', im.src.endsWith(`/${name}.webp`)));
    show('bowlempty');
    // where each container sits at rest, and where it goes so its stream lands in the bowl
    const P = {
      cereal: { rest: { x: 17, y: 32, w: 27, name: 'cerealbox' }, pour: { x: 40.4, y: 37.5, w: 30, name: 'cerealpour' } },
      milk: { rest: { x: 83, y: 32, w: 19, name: 'milk' }, pour: { x: 60, y: 35, w: 30, name: 'milkpour' } },
    };
    const els = {};
    const place = (which, st) => {
      const el = els[which], p = P[which][st];
      el.style.left = p.x + '%'; el.style.top = p.y + '%'; el.style.width = p.w + '%';
      $('img', el).src = src(p.name);
    };
    ['cereal', 'milk'].forEach(w => { const r = P[w].rest; els[w] = addItem(stage, { x: r.x, y: r.y, w: r.w, name: r.name, cls: 'pourer' }); });
    let busy = false;
    const pour = (which, after, then) => {
      els[which].classList.add('lifting');
      place(which, 'pour');
      setTimeout(() => show(after), 700);
      setTimeout(() => { place(which, 'rest'); }, 1500);
      setTimeout(() => { els[which].classList.remove('lifting'); then && then(); }, 2000);
    };
    const choose = first => {
      if (busy) return; busy = true;
      const second = first === 'milk' ? 'cereal' : 'milk';
      me.milkFirst = first === 'milk' ? 1 : 0;
      ui.say(first === 'milk' ? 'Milk first?! Okay…' : 'Cereal first. A classic.');
      pour(first, first === 'milk' ? 'bowlmilk' : 'bowlcereal', () => setTimeout(() => pour(second, 'bowlfull', () =>
        ui.ready(first === 'milk' ? 'Milk first. The internet has opinions about you.' : 'Cereal, then milk. The way most people do it.')), 300));
    };
    els.cereal.addEventListener('click', () => choose('cereal'));
    els.milk.addEventListener('click', () => choose('milk'));
  },

  sauce(stage, ui) {
    addItem(stage, { x: 46, y: 54, w: 84, name: PLATES[me.plate].src, cls: 'still' });
    addItem(stage, { x: 36, y: 46, w: 34, name: 'egg', cls: 'still', rot: -10 });
    addItem(stage, { x: 58, y: 64, w: 31, name: 'egg', cls: 'still', rot: 50 });
    stage.insertAdjacentHTML('beforeend', `<svg class="drops-layer" viewBox="0 0 100 100"><g id="drops"></g></svg>`);
    const drops = $('#drops', stage);
    ui.extra(`<div class="hand" style="font-size:20px;color:#7a6a60">heat</div><div class="meter" id="meter">${'<i></i>'.repeat(12)}</div>`);
    const bottle = addItem(stage, { x: 87, y: 26, w: 24, name: 'hotsauce', cls: 'bottle' });
    let shakes = 0;
    const r = rng(11);
    const flames = [];
    const spots = [[8, 92], [92, 92], [22, 97], [78, 97], [3, 72], [97, 74], [50, 99], [36, 98], [64, 98], [2, 52]];
    bottle.addEventListener('click', () => {
      bottle.classList.remove('shake'); void bottle.offsetWidth; bottle.classList.add('shake');
      shakes++;
      me.spice = clamp(shakes / 12);
      for (let k = 0; k < 2; k++) {
        const x = 26 + r() * 42, y = 36 + r() * 36;
        drops.insertAdjacentHTML('beforeend', `<path class="drop" d="${blob(x, y, 1.6 + r() * 1.8, 1.6 + r() * 1.8, 0.25, 7, shakes * 3 + k)}" fill="${C.red}"/>`);
      }
      [...$('#meter').children].forEach((m, k) => m.classList.toggle('on', k < shakes));
      setHeat(clamp((shakes - 4) / 8) * 0.9);
      if (shakes >= 8 && flames.length < Math.min(10, (shakes - 7) * 2)) {
        const [x, y] = spots[flames.length];
        flames.push(addItem(stage, { x, y, w: 11, name: 'flame', cls: 'flame drop-in' }));
        const [x2, y2] = spots[flames.length] || spots[0];
        if (flames.length < 10) flames.push(addItem(stage, { x: x2, y: y2, w: 9, name: 'flame', cls: 'flame drop-in' }));
      }
      ui.ready(shakes <= 3 ? 'Just a kiss of heat.' : shakes <= 7 ? 'Now we’re talking.' : shakes <= 11 ? 'Your mouth is on fire.' : 'Are you… okay??');
    });
    ui.ready('Zero shakes is an answer too.');
  },

  cake(stage, ui) {
    const cake = addItem(stage, { x: 50, y: 60, w: 74, name: 'cake', cls: 'clickable' });
    const berry = addItem(stage, { x: 60, y: 31, w: 17, name: 'strawberry', cls: 'clickable', rot: 14 });
    const cImg = $('img', cake);
    // each bite is a hole punched into the cake image with a CSS mask
    const spots = [[14, 52, 13], [20, 76, 12], [30, 62, 14], [12, 32, 12], [38, 44, 13], [40, 80, 12], [52, 60, 14], [56, 36, 13]];
    let n = 0, decided = false, berryGone = false;
    const bite = () => {
      if (n >= spots.length) return;
      n++;
      const m = spots.slice(0, n).map(([x, y, r]) => `radial-gradient(circle at ${x}% ${y}%, transparent ${r}%, #000 ${r + 0.6}%)`).join(',');
      cImg.style.webkitMaskImage = m; cImg.style.maskImage = m;
      cImg.style.webkitMaskComposite = 'source-in'; cImg.style.maskComposite = 'intersect';
    };
    cake.addEventListener('click', () => {
      bite();
      if (!decided) { decided = true; me.strawberryLast = 1; ui.ready('Saving the strawberry for last, huh?'); }
    });
    berry.addEventListener('click', () => {
      if (berryGone) return;
      berryGone = true;
      $('img', berry).src = src('hull');
      berry.style.width = '13%'; berry.style.top = '35%';
      if (!decided) { decided = true; me.strawberryLast = 0; ui.ready('Straight for the best part. No regrets.'); }
      else ui.ready('And now, finally, the strawberry. Worth the wait.');
    });
  },

  slice(stage, ui) {
    const openBox = addItem(stage, { x: 38, y: 44, w: 62, name: 'pizzabox', cls: 'still' });
    const closedBox = addItem(stage, { x: 38, y: 58, w: 50, name: 'pizzaboxclosed', cls: 'still boxclosed' });
    addItem(stage, { x: 83, y: 82, w: 30, name: PLATES[me.plate].src, cls: 'still' });
    const slice = addItem(stage, { x: 38, y: 62, w: 24, name: 'slice', rot: -20 });
    let decided = false;
    slice.addEventListener('pointerdown', e => {
      if (decided) return;
      startDrag(slice, e, stage, ({ x, y, from }) => {
        if (Math.hypot(x - 83, y - 82) < 15) {
          decided = true; me.lastSlice = 1;
          slice.style.left = '83%'; slice.style.top = '81%';
          $('#closeLid').disabled = true;
          ui.ready("It's yours now. Nobody saw. Probably.");
        } else { slice.style.left = from.x + '%'; slice.style.top = from.y + '%'; }
      });
    });
    ui.extra(`<button class="btn ghost" id="closeLid">close the lid</button>`);
    $('#closeLid').onclick = () => {
      if (decided) return;
      decided = true; me.lastSlice = 0;
      slice.style.transition = 'opacity .2s'; slice.style.opacity = 0;
      openBox.classList.add('gone'); closedBox.classList.add('show');
      $('#closeLid').disabled = true;
      ui.ready('You closed the lid. Someone else will be very happy.');
    };
  },

  napkin(stage, ui) {
    stage.style.aspectRatio = 'auto';
    stage.innerHTML = `<form class="napkin" id="napkinForm" autocomplete="off">
      <label for="dish">a dish someone made for you that you'd want to eat again</label>
      <input id="dish" maxlength="60" placeholder="grandma's chicken soup" />
      <label for="memory">who made it? when?</label>
      <input id="memory" maxlength="80" placeholder="whenever I was sick as a kid" />
      <label for="who" class="sign">sign it</label>
      <input id="who" class="sign" maxlength="20" placeholder="your name" />
    </form>`;
    const check = () => {
      const ok = $('#dish').value.trim().length > 1;
      $('#next').disabled = !ok;
      ui.say(ok ? 'Folding it carefully…' : '');
    };
    stage.addEventListener('input', check);
    $('#napkinForm').addEventListener('submit', e => { e.preventDefault(); if (!$('#next').disabled) $('#next').click(); });
    SETUP.napkin.finish = () => {
      me.dish = $('#dish').value.trim();
      me.memory = $('#memory').value.trim() || 'someone who cared';
      me.name = $('#who').value.trim() || 'You';
      me.theme = themeOf(me);
      savePlate(me);
    };
    setTimeout(() => $('#dish').focus(), 50);
  },
};

/* =========================================================
   The table — a lazy Susan you spin instead of walking around
   ========================================================= */
const TOKENS = [
  { key: 'cilantro', label: 'cilantro', name: 'cilantro' },
  { key: 'pineapple', label: 'pineapple', name: 'pineapple' },
  { key: 'toast', label: 'toast', name: 'bread' },
  { key: 'milkFirst', label: 'cereal', name: 'cerealbox' },
  { key: 'spice', label: 'hot sauce', name: 'hotsauce' },
  { key: 'strawberryLast', label: 'strawberry', name: 'strawberry' },
  { key: 'lastSlice', label: 'last slice', name: 'slice' },
  { key: 'napkin', label: 'napkin', name: 'napkin' },
];
// seat angles (deg, 90 = bottom where you sit), ordered from nearest to farthest
const SEATS = [135, 45, 180, 0, 225, 315, 270];

function describe(key, p) {
  switch (key) {
    case 'cilantro': return p.cilantro < 0.3 ? 'picks it all out' : p.cilantro > 0.75 ? 'extra, please' : 'leaves a few';
    case 'pineapple': return p.pineapple < 0.1 ? 'never on pizza' : p.pineapple > 0.6 ? 'piles it on' : 'a little is fine';
    case 'toast': return toastWord(p.toast);
    case 'milkFirst': return p.milkFirst ? 'milk first' : 'cereal first';
    case 'spice': return p.spice < 0.1 ? 'no heat' : p.spice < 0.5 ? 'a few shakes' : 'drowns it';
    case 'strawberryLast': return p.strawberryLast ? 'saves it' : 'eats it first';
    case 'lastSlice': return p.lastSlice ? 'takes it' : 'closes the lid';
    case 'napkin': return p.dish;
    default: return '';
  }
}

function renderTable() {
  setSteps(COURSES.length); setHeat(0);
  const ps = persona(me);
  app.innerHTML = `<section class="table-screen">
    <aside class="me-panel">
      <p class="eyebrow">${esc(me.name === 'You' ? 'your' : me.name + "'s")} plate</p>
      <div class="me-plate">${plateHTML(me)}</div>
      <h2 class="persona">${ps.title}</h2>
      <ul class="traits">${ps.traits.slice(0, 5).map(t => `<li>${t}</li>`).join('')}</ul>
      <p class="napkin-mini">“${esc(me.dish)}” — ${esc(me.memory)}</p>
      <button class="btn ghost" id="again">eat again</button>
    </aside>
    <div class="table-wrap">
      <p class="hint">Spin the lazy Susan — tap a dish, and the table rearranges around you.</p>
      <p class="count" id="count"></p>
      <div class="table" id="table">
        <div class="cloth">${img('tablecloth')}</div>
        <div class="susan" id="susan">
          ${img('susan', 'position:absolute;inset:0;width:100%')}
          ${TOKENS.map((t, i) => {
            const a = (i / TOKENS.length) * Math.PI * 2 - Math.PI / 2;
            return `<button class="token" data-i="${i}" title="${t.label}" aria-label="${t.label}" style="left:${50 + Math.cos(a) * 35}%;top:${50 + Math.sin(a) * 35}%">${img(t.name)}</button>`;
          }).join('')}
          <button class="token center active" data-i="all" aria-label="everything"><span>all of it</span></button>
        </div>
        <div id="seats"></div>
      </div>
    </div>
    <aside id="match"></aside>
  </section>`;
  $('#again').onclick = renderIntro;

  const seatsEl = $('#seats');
  const seatPos = deg => ({ x: 50 + Math.cos(deg * Math.PI / 180) * 41, y: 50 + Math.sin(deg * Math.PI / 180) * 41 });
  const youPos = seatPos(90);
  let people = [], focus = 'all', rot = 0, selected = null;

  const build = () => {
    people = tablePeople();
    seatsEl.innerHTML = `<div class="seat me" style="left:${youPos.x}%;top:${youPos.y}%"><div class="p">${plateHTML(me)}</div><span class="nm">${esc(me.name)}</span></div>` +
      people.map((p, i) => `<button class="seat" data-i="${i}" style="left:50%;top:50%"><div class="p">${plateHTML(p)}</div><span class="nm">${esc(p.name)}${p.sample ? ' <small>sample</small>' : ''}</span><span class="ds"></span></button>`).join('');
    const real = people.filter(p => !p.sample).length;
    $('#count').textContent = real === 0 ? 'No classmates here yet — you are the first. Sample diners are keeping you company.'
      : `${real} classmate${real === 1 ? '' : 's'} at this table${real < 7 ? ' · empty seats filled with sample diners' : ''}`;
    selected = null;
  };
  const arrange = () => {
    const score = p => focus === 'all' ? simAll(me, p) : simOn(focus, me, p) * 0.85 + simAll(me, p) * 0.15;
    const ranked = people.map((p, i) => ({ i, s: score(p) })).sort((a, b) => b.s - a.s);
    const seated = ranked.slice(0, SEATS.length);
    const hi = seated[0].s, lo = seated[seated.length - 1].s;
    ranked.forEach(({ i, s }, k) => {
      const el = seatsEl.querySelector(`.seat[data-i="${i}"]`);
      if (k >= SEATS.length) { el.classList.add('folded'); el.style.left = '50%'; el.style.top = '50%'; return; }
      el.classList.remove('folded');
      const pos = seatPos(SEATS[k]);
      el.style.left = pos.x + '%'; el.style.top = pos.y + '%';
      el.style.opacity = (0.4 + 0.6 * ((s - lo) / (hi - lo || 1))).toFixed(2);
      el.querySelector('.ds').textContent = focus === 'all' ? `${Math.round(simAll(me, people[i]) * 100)}% same table` : describe(focus, people[i]);
    });
    if (selected === null || focus !== 'all' || !seated.some(r => r.i === selected)) select(seated[0].i);
  };
  const select = i => {
    selected = i;
    seatsEl.querySelectorAll('.seat').forEach(s => s.classList.toggle('selected', s.dataset.i == i));
    showMatch(people[i]);
  };
  seatsEl.addEventListener('click', e => { const s = e.target.closest('.seat[data-i]'); if (s && !s.classList.contains('folded')) select(+s.dataset.i); });
  build();
  // new classmates sit down live
  let lastIds = people.map(p => p.id).join();
  FB.onChange = () => {
    if (!document.body.contains(seatsEl)) { FB.onChange = null; return; }
    const ids = tablePeople().map(p => p.id).join();
    if (ids === lastIds) return;
    lastIds = ids; build(); requestAnimationFrame(arrange);
  };

  const susan = $('#susan');
  susan.addEventListener('click', e => {
    const t = e.target.closest('.token');
    if (!t) return;
    susan.querySelectorAll('.token').forEach(x => x.classList.toggle('active', x === t));
    if (t.dataset.i === 'all') { focus = 'all'; }
    else {
      const i = +t.dataset.i;
      focus = TOKENS[i].key;
      // rotate so the chosen dish comes round to you (bottom); take the short way
      const target = 180 - (i / TOKENS.length) * 360;
      const delta = ((target - rot) % 360 + 540) % 360 - 180;
      rot += delta;
      susan.style.setProperty('--rot', rot + 'deg');
    }
    arrange();
  });
  requestAnimationFrame(arrange);
}

function showMatch(d) {
  const s = Math.round(simAll(me, d) * 100);
  const tg = tags(me, d);
  const same = me.theme === d.theme;
  $('#match').innerHTML = `<div class="menu-card">
    <p class="eyebrow">tonight's menu for</p>
    <h3>${esc(me.name)} &amp; ${esc(d.name)}</h3>
    <p class="pct">${s}% same table</p>
    <div class="tags">${tg.map(t => `<span class="tag">${t}</span>`).join('') || '<span class="tag">Opposites at one table</span>'}</div>
    <hr class="divider" />
    <p class="dish-label">a dish only you two would order</p>
    <p class="dish">${esc(me.dish)} × ${esc(d.dish)}</p>
    <p class="mods">${fusedMods(me, d).join(' · ')}</p>
    <hr class="divider" />
    <p class="why">${same
      ? `Your napkins are about different food, but the same feeling: <b>${THEMES[me.theme].label}</b>.`
      : `Your napkins taste different — yours is ${THEMES[me.theme].label}, theirs is ${THEMES[d.theme].label}. Maybe that's the interesting part.`}</p>
    <p class="quote">“${esc(me.dish)}” — ${esc(me.memory)}</p>
    <p class="quote">“${esc(d.dish)}” — ${esc(d.memory)}</p>
  </div>
  <p class="note">${d.sample ? 'This is a sample diner, holding a seat until more classmates sit down.' : 'A real classmate. Their plate was saved when they signed their napkin.'} Napkins are grouped by keywords for now.</p>`;
}

$('#logo').onclick = renderIntro;
renderIntro();
