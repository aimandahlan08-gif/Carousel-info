/* ===== Paper2Poster app: user interface, editing, exports ===== */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LIBS = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfw: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  mp4: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.js',
  pptx: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  tess: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  tessWorker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  tessCore: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  tessLang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int',
};
const loaded = {};
function loadScript(url) { return loaded[url] ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => { delete loaded[url]; rej(new Error('Could not load ' + url)); }; document.head.appendChild(s); }); }

// ---------- state ----------
const S = { brand: { series: '', avatar: '' }, cfg: { audience: 'students', author: false }, model: null, slides: [], poster: null, theme: 'sheet', posterSize: 'a0l', handle: '', figures: [], sel: { tab: 'carousel', slide: 0, block: 'intro', talk: 0 }, talk: null, source: { name: 'Example paper', example: true, pageCount: 3, pagesRead: 3, twoColPages: 0 } };
let pdfDoc = null;
const imgs = {}; // figure id -> HTMLImageElement or canvas
const slideCanvases = new Map();
let slideWarn = {}, posterInfo = { rects: [], warn: [] };

// ---------- example paper (fictional) ----------
function exampleLines() {
  const L = []; let page = 1, y = 790;
  const push = (text, size, bold) => { if (y < 70) { page++; y = 790; } L.push({ text, size, bold: !!bold, page, y, x: 60, pageH: 842, pageW: 595 }); y -= size * 1.35; };
  const para = (t, size = 10) => { const words = t.split(' '); let line = ''; for (const w of words) { if ((line + ' ' + w).length > 88) { push(line, size); line = w; } else line = line ? line + ' ' + w : w; } if (line) push(line, size); y -= 4; };
  push('Example Journal of Student Wellbeing 4 (2026)', 8);
  push('Pedal Power: Cycling to Campus and Loneliness', 18, true);
  push('Among First-Year University Students', 18, true);
  push('Sofia Marquez, Hamid Tan, Grace Liu', 11);
  push('Department of Psychology, Example University', 8.5);
  push('https://doi.org/10.0000/example.2026.014', 8.5);
  push('Abstract', 12, true);
  para("Loneliness is common in the first year of university, yet little is known about whether everyday travel habits shape students' social connection. We surveyed 486 first-year students (N = 486) at two campuses. Students who cycled to campus at least three days a week reported 18% lower loneliness scores than students who travelled by car. Cycling days were linked to lower loneliness (r = −.21, p < .001). Active commuting may be a simple, low-cost way for universities to support student wellbeing.");
  push('Keywords: loneliness, active commuting, cycling, first-year students', 10);
  push('1. Introduction', 12, true);
  para('Starting university is a major life transition, and many first-year students report feeling lonely during their first semester (Hall et al., 2021). Loneliness is linked to poorer mental health, lower engagement, and higher dropout risk. Universities have invested in clubs and peer mentoring, but these programmes reach only some students. Daily routines may matter too. Cycling and walking create repeated, informal chances to meet the same people, and physical activity itself improves mood (Martin et al., 2014). However, little is known about whether the way students travel to campus is related to how connected they feel. The aim of this study was to test whether cycling to campus is associated with lower loneliness among first-year students.');
  push('2. Method', 12, true);
  para('We used a cross-sectional online survey in the sixth week of the autumn semester. Students reported how many days per week they cycled, walked, took the bus, or drove to campus. Loneliness was measured with the three-item UCLA Loneliness Scale, which ranges from 3 to 9. We used multiple regression to test whether cycling days predicted loneliness, controlling for age, gender, living situation, and distance from campus.');
  push('2.1 Participants', 11, true);
  para('Participants were 486 first-year undergraduates aged 18 to 24 years (M = 19.2, SD = 1.3) recruited through course mailing lists. In total, 57% identified as women, and 41% lived in student housing.');
  push('3. Results', 12, true);
  para('Students who cycled to campus at least three days a week reported 18% lower loneliness scores than students who drove. Mean loneliness fell steadily with the number of cycling days, from 6.1 among non-cyclists to 4.4 among daily cyclists. Cycling days were negatively correlated with loneliness (r = −.21, p < .001). In the regression model, cycling remained a significant predictor of lower loneliness after controlling for covariates (β = −.19, p < .001). Regular cyclists were 2.3 times more likely to say they had made a new friend on their way to campus. Walking showed a smaller association with loneliness, and bus use showed none.');
  push('Figure 1. Mean loneliness score by cycling days per week.', 8.5);
  push('4. Discussion', 12, true);
  para('Our findings suggest that active commuting, and cycling in particular, is linked to how connected first-year students feel. The pattern is consistent with research showing that physical activity and repeated informal contact both support wellbeing (Martin et al., 2014). These results highlight that campus transport policy could also be wellbeing policy. Safe bike lanes, secure parking, and bike-share schemes are practical steps universities can take.');
  push('5. Limitations', 12, true);
  para('This study has limitations. The cross-sectional design means we cannot conclude that cycling reduces loneliness; less lonely students may simply be more likely to cycle. All measures were self-reported. Future research should follow students over time and test campus cycling programmes directly.');
  push('6. Conclusion', 12, true);
  para('Cycling to campus is associated with lower loneliness among first-year students. Supporting active travel is a low-cost way for universities to help new students feel connected.');
  push('References', 12, true);
  para('Hall, J., et al. (2021). Loneliness in the first year of university. Example Review, 2, 1–10.');
  return { lines: L, pageCount: page, pagesRead: page, twoColPages: 0 };
}
function exampleFigure() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 820;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 820);
  const data = [['0 days', 6.1], ['1–2 days', 5.6], ['3–4 days', 5.0], ['5+ days', 4.4]];
  const L = 150, B = 690, T = 110, Wd = 980;
  x.fillStyle = '#222'; x.font = '600 34px "IBM Plex Sans", Arial, sans-serif'; x.fillText('Mean loneliness score by cycling days per week', 60, 62);
  x.strokeStyle = '#ddd'; x.lineWidth = 2; x.font = '26px "IBM Plex Sans", Arial'; x.fillStyle = '#555'; x.textAlign = 'right';
  for (let v = 3; v <= 7; v++) { const yy = B - (v - 3) / 4 * (B - T); x.beginPath(); x.moveTo(L, yy); x.lineTo(L + Wd, yy); x.stroke(); x.fillText(v, L - 18, yy + 9); }
  x.textAlign = 'center';
  data.forEach(([k, v], i) => { const bw = 150, cx = L + 120 + i * 240, yy = B - (v - 3) / 4 * (B - T); x.fillStyle = i === 3 ? '#1F5F8B' : '#8FB3CC'; x.fillRect(cx - bw / 2, yy, bw, B - yy); x.fillStyle = '#222'; x.font = '600 30px "IBM Plex Sans", Arial'; x.fillText(v.toFixed(1), cx, yy - 14); x.font = '26px "IBM Plex Sans", Arial'; x.fillStyle = '#444'; x.fillText(k, cx, B + 40); });
  x.save(); x.translate(50, 400); x.rotate(-Math.PI / 2); x.fillStyle = '#555'; x.font = '24px "IBM Plex Sans", Arial'; x.fillText('UCLA-3 score (3–9)', 0, 0); x.restore();
  x.fillStyle = '#777'; x.font = 'italic 22px "IBM Plex Sans", Arial'; x.textAlign = 'left'; x.fillText('Fictional example data', L, 800);
  return c.toDataURL('image/png');
}

// ---------- persistence & history ----------
const KEY = 'paper2poster-v1';
function snapshot() { return JSON.stringify({ slides: S.slides, talk: S.talk, poster: S.poster, theme: S.theme, posterSize: S.posterSize, handle: S.handle, meta: metaOf(S.model) }); }
function metaOf(m) { return m ? { title: m.title, authors: m.authors, affiliations: m.affiliations, journal: m.journal, year: m.year, doi: m.doi, keywords: m.keywords } : null; }
const hist = { past: [], future: [], last: null, t: 0 };
function commit(now) {
  clearTimeout(hist.t);
  const go = () => { const snap = snapshot(); if (snap === hist.last) return; if (hist.last) hist.past.push(hist.last); if (hist.past.length > 80) hist.past.shift(); hist.last = snap; hist.future = []; updateUndo(); save(); };
  if (now) go(); else hist.t = setTimeout(go, 450);
}
function restoreSnap(snap) { const o = JSON.parse(snap); Object.assign(S, { slides: o.slides, talk: o.talk || null, poster: o.poster, theme: o.theme, posterSize: o.posterSize, handle: o.handle }); Object.assign(S.model, o.meta); hist.last = snap; fillMeta(); renderThemes(); renderAll(true); save(); updateUndo(); }
function undo() { commit(true); if (!hist.past.length) return; hist.future.push(hist.last); restoreSnap(hist.past.pop()); }
function redo() { if (!hist.future.length) return; hist.past.push(hist.last); restoreSnap(hist.future.pop()); }
function updateUndo() { $('#undoBtn').disabled = !hist.past.length; $('#redoBtn').disabled = !hist.future.length; }
// projects are kept in IndexedDB (room for big theses and figures); localStorage keeps a slim copy as a fallback
const IDB = {
  db: null,
  open() { return this.db ||= new Promise((res, rej) => { try { const r = indexedDB.open('paper2poster', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }); },
};
let saveT = 0;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    const data = { v: 1, at: Date.now(), model: S.model, slides: S.slides, talk: S.talk, poster: S.poster, theme: S.theme, posterSize: S.posterSize, handle: S.handle, source: S.source, figures: S.figures };
    let idbOk = false;
    try { idbOk = await IDB.set(KEY, JSON.parse(JSON.stringify(data))); } catch (e) { idbOk = false; }
    try {
      const slim = { ...data, model: { ...S.model, pageText: idbOk ? [] : S.model.pageText }, figures: idbOk ? [] : S.figures, inIdb: idbOk };
      let str = JSON.stringify(slim);
      if (str.length > 4.5e6) { slim.figures = []; slim.model = { ...slim.model, pageText: [], parts: [] }; str = JSON.stringify(slim); }
      localStorage.setItem(KEY, str);
    } catch (e) {}
  }, 600);
}
async function loadProject() {
  let a = null; try { a = await IDB.get(KEY); } catch (e) { a = null; }
  const b = loadSaved();
  if (a && (!b || (a.at || 0) >= (b.at || 0))) return a;
  return b;
}
function loadSaved() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ---------- UI helpers ----------
let toastT = 0;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
function notice(html, kind) { const n = $('#notice'); if (!html) { n.hidden = true; return; } n.className = 'notice' + (kind === 'err' ? ' err' : ''); n.innerHTML = html; n.hidden = false; }
let themeKey = '', themeVal = null;
const theme = () => { const k = S.theme + '|' + (S.brand.accent || ''); if (k !== themeKey) { themeKey = k; themeVal = S.brand.accent ? R.withAccent(R.THEMES[S.theme], S.brand.accent) : R.THEMES[S.theme]; } return themeVal; };
let logoImg = null;
async function setLogo(src) {
  S.brand.logo = src || ''; logoImg = null;
  if (src) { const im = new Image(); im.src = src; try { await im.decode(); logoImg = im; } catch (e) { S.brand.logo = ''; } }
  const pv = $('#bLogoPrev'); if (pv) pv.style.backgroundImage = logoImg ? `url("${S.brand.logo}")` : '';
  const del = $('#bLogoDel'); if (del) del.hidden = !logoImg;
}
function colorHint() {
  const T = theme(), h = $('#bColorHint'); $('#bColorReset').hidden = !S.brand.accent;
  if (S.brand.accent) $('#bColor').value = S.brand.accent;
  h.hidden = !(S.brand.accent && T.adjusted); h.textContent = T.adjusted ? `Your colour was darkened slightly (${T.accent}) so text stays readable on this theme.` : '';
}
const visibleSlides = () => S.slides.filter(s => !s.hidden);
function figImg(id) { return id ? imgs[id] : null; }
function sheetStats() { if (S.poster && !S.poster.sheet && S.model) S.poster.sheet = P2P.buildSheet(S.model); return (S.poster && S.poster.sheet && S.poster.sheet.stats) || []; }
function footerText() { return P2P.shortCite(S.model); }
let avatarImg = null;
const brandCtx = () => ({ handle: (S.handle || '').trim(), series: (S.brand.series || '').trim(), avatar: avatarImg });
const BKEY = 'paper2poster-brand';
function saveBrand() { try { localStorage.setItem(BKEY, JSON.stringify({ handle: S.handle, series: S.brand.series, avatar: S.brand.avatar, audience: S.cfg.audience, author: S.cfg.author, presenter: S.cfg.presenter || '', talkType: S.cfg.talkType || 'paper', logo: S.brand.logo || '', accent: S.brand.accent || '' })); } catch (e) {} }
async function loadBrand() {
  try { const b = JSON.parse(localStorage.getItem(BKEY) || 'null'); if (b) { S.handle = b.handle || ''; S.brand.series = b.series || ''; S.brand.avatar = b.avatar || ''; S.cfg.audience = b.audience || 'students'; S.cfg.author = !!b.author; S.cfg.presenter = b.presenter || ''; S.cfg.talkType = b.talkType || 'paper'; S.brand.accent = b.accent || ''; S.brand.logo = b.logo || ''; } } catch (e) {}
  await setAvatar(S.brand.avatar); await setLogo(S.brand.logo);
}
async function setAvatar(src) {
  S.brand.avatar = src || ''; avatarImg = null;
  if (src) { const im = new Image(); im.src = src; try { await im.decode(); avatarImg = im; } catch (e) { S.brand.avatar = ''; } }
  const pv = $('#bAvPrev'); if (pv) pv.style.backgroundImage = avatarImg ? `url("${S.brand.avatar}")` : '';
  const del = $('#bAvDel'); if (del) del.hidden = !avatarImg;
}
function fillBrand() {
  colorHint();
  $('#mHandle').value = S.handle || ''; $('#bSeries').value = S.brand.series || ''; $('#cAud').value = S.cfg.audience;
  $('#vAuthor').checked = !!S.cfg.author; $('#vShare').checked = !S.cfg.author;
}
function applyVoice() {
  const cfg = { ...S.cfg, series: S.brand.series };
  const by = r => S.slides.find(s => s.role === r);
  const review = S.model.mode === 'review';
  const h = by('hook');
  if (h) {
    const sa = by('sample'), f1 = by('finding1');
    const info = review ? { review: true, n: S.slides.filter(s => s.role === 'topic' && !s.hidden).length } : { hero: f1 && f1.big, sample: sa && sa.big ? { n: sa.big, unit: sa.bigLabel || 'participants' } : null };
    h.hooks = P2P.hookOptions(S.model, cfg, info); h.hookIndex = 0; h.heading = h.hooks[0];
    h.label = S.brand.series || (cfg.author ? (review ? 'Our new review' : 'Our new research') : (review ? 'Review' : 'New research'));
  }
  const we = S.cfg.author, set = (r, t) => { const s = by(r); if (s) s.heading = t; };
  if (!review) { set('problem', we ? 'Why we did this study' : 'Why this study matters'); set('method', we ? 'What we did' : 'What they did'); set('finding2', we ? 'We also found' : 'They also found'); }
  const c = by('cite'); if (c) { c.heading = `Read ${we ? 'our' : 'the'} full ${review ? 'review' : 'paper'}`; c.body = P2P.ctaFor(S.cfg); }
  scheduleRender(); renderInspector(); commit(true);
}
function refreshCheat() { const c = S.slides.find(s => s.type === 'cheat'); if (c) c.items = P2P.cheatFrom(S.slides, S.model.mode === 'review'); }

async function fontsReady(T) { try { await Promise.all(R.fontSpecs(T).map(f => document.fonts.load(f))); } catch (e) {} }

// ---------- rendering ----------
let rT = 0, rQueued = false;
function scheduleRender() { if (rQueued) return; rQueued = true; requestAnimationFrame(() => { rQueued = false; renderCanvases(); }); }

function renderCanvases() {
  const T = theme();
  const vis = visibleSlides();
  slideWarn = {};
  const ctxBase = { footer: footerText(), keywords: S.model.keywords, meta: metaOf(S.model), brand: brandCtx(), stats: sheetStats() };
  S.slides.forEach(s => {
    let cv = slideCanvases.get(s.id);
    if (!cv) { cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350; slideCanvases.set(s.id, cv); }
    const idx = s.hidden ? Math.max(0, vis.length - 1) : vis.indexOf(s);
    const n = s.hidden ? Math.max(1, vis.length) : vis.length;
    slideWarn[s.id] = R.renderSlide(cv, s, idx, n, T, { ...ctxBase, figure: figImg(s.figureId) });
  });
  drawStrip();
  drawBig();
  drawPoster();
  if (S.sel.tab === 'talk') renderTalk();
  updateWarnBoxes();
  if (typeof updateFactBadge === 'function') updateFactBadge();
  $('#ctCar').textContent = vis.length;
}

function drawStrip() {
  const strip = $('#strip');
  const vis = visibleSlides();
  if (strip.childElementCount !== S.slides.length || [...strip.children].some((b, i) => b.dataset.id !== S.slides[i].id)) {
    strip.innerHTML = '';
    S.slides.forEach((s, i) => {
      const b = document.createElement('button'); b.className = 'thumb'; b.dataset.id = s.id; b.type = 'button';
      const c = document.createElement('canvas'); c.width = 216; c.height = 270;
      b.append(c);
      const cap = document.createElement('div'); cap.className = 'cap'; b.append(cap);
      b.addEventListener('click', () => { S.sel.slide = S.slides.indexOf(s); drawStrip(); drawBig(); renderInspector(); });
      strip.append(b);
    });
  }
  [...strip.children].forEach((b, i) => {
    const s = S.slides[i]; const c = b.querySelector('canvas');
    const g = c.getContext('2d'); g.drawImage(slideCanvases.get(s.id), 0, 0, 216, 270);
    b.classList.toggle('off', !!s.hidden);
    b.setAttribute('aria-current', i === S.sel.slide);
    const n = s.hidden ? '—' : String(vis.indexOf(s) + 1).padStart(2, '0');
    b.querySelector('.cap').innerHTML = `<span class="n">${n}</span><span>${esc(s.label)}${s.hidden ? ' (hidden)' : ''}</span>${(slideWarn[s.id] || []).length ? '<i class="dotw" title="Needs attention"></i>' : ''}`;
    b.setAttribute('aria-label', `Slide ${n}: ${s.label}`);
  });
}
function drawBig() {
  const s = S.slides[S.sel.slide]; if (!s) return;
  const g = $('#bigSlide').getContext('2d'); g.drawImage(slideCanvases.get(s.id), 0, 0);
}
function drawPoster() {
  ensureBillboard(); const pl = $('#pLayout'); if (pl && S.poster) pl.value = S.poster.layout || 'billboard';
  const size = R.POSTER_SIZES[S.posterSize];
  const cv = $('#posterCv');
  const scale = Math.min(1, 1500 / size.w);
  cv.width = Math.round(size.w * scale); cv.height = Math.round(size.h * scale);
  cv.style.width = Math.round(size.w > size.h ? 980 : 760) + 'px';
  const g = cv.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0);
  posterInfo = R.renderPoster(g, S.poster, posterMeta(), theme(), size, figMap());
  posterInfo.scale = scale;
  if (S.sel.tab === 'poster' && S.poster.layout === 'story') document.querySelectorAll('[data-col]').forEach(sel => { const o = sel.options[0]; const c = (posterInfo.cols || {})[sel.dataset.col]; if (o) o.textContent = 'Auto' + (c != null ? ` (now ${c + 1})` : ''); });
  $('#pMeta').innerHTML = `<span>${esc(size.label)}</span><span>Title ${posterInfo.titlePt} pt</span>${posterInfo.statementPt ? `<span>${S.poster.layout === 'story' ? 'Take-home' : 'Main finding'} ${posterInfo.statementPt} pt</span>` : ''}<span>Body ${posterInfo.bodyPt} pt</span>${posterInfo.words ? `<span>${posterInfo.words} words</span>` : ''}${posterInfo.warn.length ? '<span style="color:var(--warn)">Needs attention</span>' : '<span style="color:var(--good)">Fits</span>'}`;
  $('#ctPos').textContent = posterInfo.warn.length ? '!' : '';
}
function posterMeta() { const m = metaOf(S.model); return { ...m, affiliations: m.affiliations || [], authors: m.authors || [], logo: logoImg }; }
function figMap() { const o = {}; for (const f of S.figures) if (imgs[f.id]) o[f.id] = imgs[f.id]; return o; }

function renderAll(rebuildInspector) {
  if (rebuildInspector) renderInspector();
  renderFigs();
  renderCanvases();
  if (!$('#checkModal').hidden) renderExtracted();
}

// ---------- left rail ----------
function fillMeta() {
  const m = S.model;
  $('#mTitle').value = m.title || ''; $('#mAuthors').value = (m.authors || []).join(', '); $('#mAff').value = (m.affiliations || []).join('\n');
  $('#mJournal').value = m.journal || ''; $('#mYear').value = m.year || ''; $('#mDoi').value = m.doi || ''; $('#mKw').value = (m.keywords || []).join(', ');
  $('#fileName').textContent = S.source.name; $('#fileChip').title = S.source.name;
}
function bindMeta() {
  const map = { mTitle: v => S.model.title = v, mAuthors: v => S.model.authors = v.split(',').map(s => s.trim()).filter(Boolean), mAff: v => S.model.affiliations = v.split('\n').map(s => s.trim()).filter(Boolean), mJournal: v => S.model.journal = v, mYear: v => S.model.year = v, mDoi: v => S.model.doi = v.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//, ''), mKw: v => S.model.keywords = v.split(',').map(s => s.trim()).filter(Boolean), mHandle: v => S.handle = v };
  for (const [id, fn] of Object.entries(map)) $('#' + id).addEventListener('input', e => { fn(e.target.value); if (id === 'mHandle') saveBrand(); scheduleRender(); commit(); });
}
function renderThemes() {
  $('#themes').innerHTML = Object.entries(R.THEMES).map(([k, T]) => {
    const c = R.themeContrast(T);
    return `<button class="th" type="button" data-k="${k}" aria-pressed="${k === S.theme}"><div class="sw" style="background:${T.bg};color:${T.ink};font-family:'${T.display.family}',${T.display.fb};font-weight:${T.display.weight}">Aa<i style="background:${T.accent}"></i></div><span class="nm">${T.name}</span><span class="ok" style="${c.pass ? '' : 'color:var(--bad)'}" title="${c.checks.map(x => `${x.what}: ${x.r.toFixed(1)}:1 (needs ${x.need})`).join('\n')}">${c.pass ? 'Contrast AA ✓' : 'Contrast fails'}</span></button>`;
  }).join('');
}
$('#themes').addEventListener('click', async e => { const b = e.target.closest('.th'); if (!b) return; S.theme = b.dataset.k; renderThemes(); await fontsReady(theme()); scheduleRender(); commit(true); });

function renderFigs() {
  $('#figCount').textContent = S.figures.length || '';
  $('#figs').innerHTML = S.figures.map(f => `<div class="fig" title="${esc(f.label)}"><img src="${f.src}" alt="${esc(f.label)}"><button type="button" data-del="${f.id}" aria-label="Remove ${esc(f.label)}">×</button></div>`).join('');
  $('#cropBtn').disabled = !pdfDoc;
  $('#figHint').textContent = pdfDoc ? 'Crop charts or tables straight from the PDF, then place them on a slide or the poster.' : (S.source.example ? 'Upload a PDF to crop its figures. The example comes with one chart.' : 'Upload the PDF again to crop figures from it. You can also add an image file.');
}
$('#figs').addEventListener('click', e => {
  const id = e.target.dataset.del; if (!id) return;
  S.figures = S.figures.filter(f => f.id !== id); delete imgs[id];
  S.slides.forEach(s => { if (s.figureId === id) s.figureId = null; });
  S.poster.blocks.forEach(b => { if (b.figureId === id) b.figureId = null; });
  renderAll(true); commit(true);
});
async function addFigure(src, label) {
  const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const img = new Image(); img.src = src; try { await img.decode(); } catch (e) { toast('That image could not be read.'); return null; }
  imgs[id] = img; S.figures.push({ id, label, src });
  // auto place on empty slots
  const fs = S.slides.find(s => s.type === 'figure' && !s.figureId); if (fs) fs.figureId = id;
  const fb = S.poster.blocks.find(b => b.kind === 'figure' && !b.figureId); if (fb) { fb.figureId = id; if (!fb.caption) fb.caption = label; }
  if (S.poster.bb && !S.poster.bb.figureId) { S.poster.bb.figureId = id; if (!S.poster.bb.caption) S.poster.bb.caption = label; }
  if (S.talk) { const ks = S.talk.slides.find(x => x.kind === 'stat' && /key result/i.test(x.title) && !x.figureId); if (ks) ks.figureId = id; }
  if (S.poster.story && !S.poster.story.figureId) { S.poster.story.figureId = id; if (!S.poster.story.caption) S.poster.story.caption = label; }
  renderAll(true); commit(true);
  return id;
}
$('#imgInput').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => addFigure(r.result, f.name.replace(/\.[^.]+$/, '')); r.readAsDataURL(f); e.target.value = ''; });

// rebuild with inline confirm
$('#rebuildBtn').addEventListener('click', () => {
  const row = $('#rebuildRow');
  row.innerHTML = '<span class="hint" style="flex-basis:100%">Replace all your edits?</span><button class="btn sm primary" id="rbYes">Rebuild</button><button class="btn sm" id="rbNo">Cancel</button>';
  $('#rbYes').onclick = () => { buildOutputs(); placeExistingFigures(); resetRebuildRow(); renderAll(true); commit(true); toast('Rebuilt from the paper'); };
  $('#rbNo').onclick = resetRebuildRow;
});
function resetRebuildRow() { $('#rebuildRow').innerHTML = '<button class="btn sm" id="rebuildBtn2">Rebuild from paper</button>'; $('#rebuildBtn2').onclick = () => $('#rebuildBtn').click(); }
$('#exampleBtn').addEventListener('click', () => { loadExample(); toast('Loaded the example paper'); });

function placeExistingFigures() {
  if (!S.figures.length) return;
  const f = S.figures[0];
  const fs = S.slides.find(s => s.type === 'figure'); if (fs) fs.figureId = f.id;
  const fb = S.poster.blocks.find(b => b.kind === 'figure'); if (fb) { fb.figureId = f.id; fb.caption = f.label; }
}

// ---------- inspector ----------
function wcTag(text, limit) { const n = P2P.wc(text); return `<span class="wc ${limit && n > limit ? 'over' : ''}">${n} words${limit ? ` · aim ≤ ${limit}` : ''}</span>`; }
const ICON_OPTS = () => Object.entries(R.ICON_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const FIG_OPTS = sel => `<option value="">No figure</option>` + S.figures.map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.label)}</option>`).join('');

function renderInspector() {
  const el = $('#insp');
  if (typeof AI !== 'undefined' && AI.ctl) AI.ctl.abort();
  if (S.sel.tab === 'poster') return renderPosterInspector(el);
  if (S.sel.tab === 'talk') return renderTalkInspector(el);
  if (S.sel.tab === 'kit') { el.innerHTML = `<div class="insp-h"><span class="t">Post kit</span></div><div class="sec"><p class="hint">Everything you need to post: caption, first comment, alt text, a LinkedIn post, a thread and a plain-language summary. It is written from your slides, so edit the slides first.</p><p class="hint">Export the matching files from the Export menu at the top.</p></div>`; return; }
  if (S.sel.tab === 'extracted') { el.innerHTML = `<div class="insp-h"><span class="t">How this works</span></div><div class="sec"><p class="hint">This tab shows what the app read from the PDF, with no AI involved. It finds headings by font size, bold text and a dictionary of section names. It then ranks each section's sentences with TextRank, adding points for statistics and phrases like "we found".</p><p class="hint">If a section is missing, check the headings in the PDF. You can still edit any slide by hand.</p></div>`; return; }
  const s = S.slides[S.sel.slide]; if (!s) { el.innerHTML = ''; return; }
  const vis = visibleSlides(); const pos = s.hidden ? 'Hidden' : `Slide ${vis.indexOf(s) + 1} of ${vis.length}`;
  let h = `<div class="insp-h"><span class="t">${esc(s.label)}</span><span class="s">${pos} · ${s.type}</span></div><div class="sec"><div class="warns" id="warns"></div>`;
  h += `<div class="row"><label class="toggle"><input type="checkbox" id="iShow" ${s.hidden ? '' : 'checked'}> Include in carousel</label><div class="spacer"></div><button class="btn sm" id="iPlay">Play animation</button><button class="btn sm" id="iPng">Save as PNG</button></div>`;
  h += `<label class="f">Label<input type="text" id="iLabel" value="${esc(s.label)}"></label>`;
  if (s.type === 'text') h += `<label class="f">Layout<select id="iLayout"><option value="classic">Classic</option><option value="bold">Bold colour</option><option value="quote">Big quote</option></select></label>`;
  if (s.type === 'hook') {
    h += `<label class="f">Headline<textarea id="iHeading" rows="4">${esc(s.heading)}</textarea></label><p class="hint">Wrap a word in *stars* to colour it.</p><div class="row"><button class="btn sm" id="iHook">Try another headline</button><span class="wc">${s.hookIndex + 1} of ${s.hooks.length}</span></div>`;
    h += `<label class="f">Small line at the bottom<input type="text" id="iBody" value="${esc(s.body)}"></label>`;
  } else if (s.type !== 'stat') {
    h += `<label class="f">Heading<input type="text" id="iHeading" value="${esc(s.heading)}"></label>`;
  }
  if (s.type === 'stat') {
    h += `<div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="f">Big number<input type="text" id="iBig" value="${esc(s.big)}"></label><label class="f">Under the number<input type="text" id="iBigLabel" value="${esc(s.bigLabel)}"></label></div>`;
  }
  if (s.type === 'list') {
    h += `<label class="f">Bullets (one per line)<textarea id="iBullets" rows="7">${esc((s.bullets || []).join('\n'))}</textarea></label><div class="row"><button class="btn sm" id="iMore">Use other method sentences</button><button class="btn sm" id="iShortB">Shorten</button></div><div id="iWc">${wcTag((s.bullets || []).join(' '), 40)}</div>`;
  }
  if (['text', 'stat', 'figure', 'cite'].includes(s.type)) {
    h += `<label class="f">${s.type === 'cite' ? 'Call to action' : s.type === 'stat' ? 'Caption' : 'Text'}<textarea id="iBody" rows="6">${esc(s.body)}</textarea></label><div id="iWc">${wcTag(s.body, 40)}</div>`;
    if (s.options && s.options.length > 1) h += `<div class="row"><button class="btn sm" id="iSwap">Swap sentence</button><span class="wc">option ${((s.optIndex || 0) % s.options.length) + 1} of ${s.options.length}</span><button class="btn sm" id="iShort">Shorten</button></div>`;
    else if (s.type !== 'cite') h += `<div class="row"><button class="btn sm" id="iShort">Shorten</button></div>`;
  }
  if (s.type === 'cheat') h += `<label class="f">Cards (one per line: Title | text)<textarea id="iItems" rows="7">${esc((s.items || []).map(it => `${it.title || ''} | ${it.big ? '*' + it.big + '* ' : ''}${it.text || ''}`).join('\n'))}</textarea></label><div class="row"><button class="btn sm" id="iCheatRefresh">Refresh from the slides</button></div>`;
  const srcList = s.type === 'list' ? (s.srcs || []).slice(0, 3) : (s.srcs && s.srcs.length ? [s.srcs[(s.optIndex || 0) % s.srcs.length]] : []);
  if (srcList.length) h += `<details class="src"${s.type === 'list' ? '' : ' open'}><summary>From the paper${srcList[0].where ? ' · ' + esc(srcList[0].where) : ''}</summary>${srcList.map(x => `<p>${esc(x.text)}</p>`).join('')}</details>`;
  if (s.type === 'text') h += `<label class="f">Step diagram (optional, one step per line)<textarea id="iSteps" rows="3" placeholder="Assess\nTreat\nRefer">${esc((s.steps || []).join('\n'))}</textarea></label>`;
  if (R.visualFor({ ...s, visual: 'auto' })) h += `<label class="f">Graphic<select id="iVis"><option value="auto">${({ donut: 'Donut chart', bars: 'Comparison bars', people: 'People grid', steps: 'Step diagram' })[R.visualFor({ ...s, visual: 'auto' }).kind]}</option><option value="none" ${s.visual === 'none' ? 'selected' : ''}>None</option></select></label>`;
  if (s.type === 'figure') h += `<label class="f">Figure<select id="iFig">${FIG_OPTS(s.figureId)}</select></label>${S.figures.length ? '' : '<p class="hint">Add a figure from the left panel to show it on this slide.</p>'}`;
  if (s.type !== 'cite') h += `<label class="f">Icon<select id="iIcon">${ICON_OPTS()}</select></label>`;
  h += aiSlideBox(s);
  h += `<div class="row"><button class="btn sm ghost" id="iUp" ${S.sel.slide === 0 ? 'disabled' : ''}>Move earlier</button><button class="btn sm ghost" id="iDown" ${S.sel.slide === S.slides.length - 1 ? 'disabled' : ''}>Move later</button></div></div>`;
  el.innerHTML = h;
  tuck(el, ['#iShow', '#iLabel', '#iLayout', '#iSteps', '#iVis', '#iIcon', '#iUp', 'details.src']);
  wireAiSlide(s);
  updateWarnBoxes();
  const on = (id, ev, fn) => { const x = $('#' + id); if (x) x.addEventListener(ev, fn); };
  const changed = () => { scheduleRender(); commit(); };
  on('iShow', 'change', e => { s.hidden = !e.target.checked; renderInspector(); scheduleRender(); commit(true); });
  on('iLabel', 'input', e => { s.label = e.target.value; changed(); });
  on('iHeading', 'input', e => { s.heading = e.target.value; changed(); });
  on('iBody', 'input', e => { s.body = e.target.value; const w = $('#iWc'); if (w) w.innerHTML = wcTag(s.body, 40); changed(); });
  on('iBig', 'input', e => { s.big = e.target.value; changed(); });
  on('iBigLabel', 'input', e => { s.bigLabel = e.target.value; changed(); });
  on('iBullets', 'input', e => { s.bullets = e.target.value.split('\n'); $('#iWc').innerHTML = wcTag(s.bullets.join(' '), 40); changed(); });
  on('iHook', 'click', () => { s.hookIndex = (s.hookIndex + 1) % s.hooks.length; s.heading = s.hooks[s.hookIndex]; renderInspector(); scheduleRender(); commit(true); });
  on('iSwap', 'click', () => { s.optIndex = ((s.optIndex || 0) + 1) % s.options.length; s.body = s.options[s.optIndex]; if (s.bigOptions && s.bigOptions[s.optIndex] !== undefined) s.big = s.bigOptions[s.optIndex] || s.big; renderInspector(); scheduleRender(); commit(true); });
  on('iShort', 'click', () => { const before = s.body; s.body = P2P.shorten(s.body, Math.max(12, Math.round(P2P.wc(s.body) * 0.7))); if (s.body === before) toast('This is already as short as the app can make it. Edit it by hand.'); renderInspector(); scheduleRender(); commit(true); });
  on('iShortB', 'click', () => { s.bullets = s.bullets.filter(Boolean).map(b => P2P.shorten(b, 12)); renderInspector(); scheduleRender(); commit(true); });
  on('iMore', 'click', () => { const o = s.options || []; if (o.length <= 3) { toast('No other method sentences found.'); return; } s.optStart = ((s.optStart || 0) + 3) % o.length; s.bullets = [0, 1, 2].map(k => o[(s.optStart + k) % o.length]); renderInspector(); scheduleRender(); commit(true); });
  on('iFig', 'change', e => { s.figureId = e.target.value || null; scheduleRender(); commit(true); });
  const ic = $('#iIcon'); if (ic) { ic.value = s.icon || 'spark'; ic.addEventListener('change', e => { s.icon = e.target.value; scheduleRender(); commit(true); }); }
  on('iUp', 'click', () => moveSlide(-1)); on('iDown', 'click', () => moveSlide(1));
  on('iPng', 'click', () => saveSlidePng(s));
  on('iPlay', 'click', () => playSlide(s));
  const lay = $('#iLayout'); if (lay) { lay.value = s.layout || 'classic'; lay.addEventListener('change', e => { s.layout = e.target.value; scheduleRender(); commit(true); }); }
  on('iItems', 'input', e => { s.items = e.target.value.split('\n').map(l => { const i = l.indexOf('|'); return i < 0 ? { title: l.trim(), text: '' } : { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() }; }).filter(it => it.title || it.text); changed(); });
  on('iCheatRefresh', 'click', () => { refreshCheat(); renderInspector(); scheduleRender(); commit(true); });
  on('iSteps', 'input', e => { s.steps = e.target.value.split('\n'); changed(); });
  on('iVis', 'change', e => { s.visual = e.target.value; scheduleRender(); commit(true); });
}
function moveSlide(d) { const i = S.sel.slide, j = i + d; if (j < 0 || j >= S.slides.length) return; [S.slides[i], S.slides[j]] = [S.slides[j], S.slides[i]]; S.sel.slide = j; renderAll(true); commit(true); }
function updateWarnBoxes() {
  const box = $('#warns'); if (!box) return;
  let w = [];
  if (S.sel.tab === 'carousel') { const s = S.slides[S.sel.slide]; w = s ? (slideWarn[s.id] || []) : []; }
  else if (S.sel.tab === 'poster') w = posterInfo.warn || [];
  box.innerHTML = w.map(x => `<div class="warn">${esc(x)}</div>`).join('');
}

function ensureBillboard() {
  if (!S.poster) return;
  if (!S.poster.bb && S.model) S.poster.bb = P2P.buildBillboard(S.model);
  if (!S.poster.story && S.model) S.poster.story = P2P.buildStory(S.model);
  if (!S.poster.sheet && S.model) S.poster.sheet = P2P.buildSheet(S.model);
  if (!S.poster.layout) S.poster.layout = 'sheet';
}
const EFFECTS = ['benefit', 'mixed', 'none', 'risk'];
function renderStoryInspector(el) {
  const st = S.poster.story, bb = S.poster.bb || {};
  const ncols = R.POSTER_SIZES[S.posterSize].w > R.POSTER_SIZES[S.posterSize].h ? 3 : 2;
  const auto = posterInfo.cols || {};
  const colSel = id => `<label class="f">Column<select data-col="${id}"><option value="">Auto${auto[id] != null ? ` (now ${auto[id] + 1})` : ''}</option>${Array.from({ length: ncols }, (_, i) => `<option value="${i}" ${st.cols && st.cols[id] != null && st.cols[id] !== '' && +st.cols[id] === i ? 'selected' : ''}>Column ${i + 1}</option>`).join('')}</select></label>`;
  const blk = (id, title, body) => `<div class="blk" data-b="${id}" aria-current="${id === S.sel.block}"><h4><span>${title}</span></h4>${body}</div>`;
  const ta = (k, rows, val) => `<textarea data-s="${k}" rows="${rows}">${esc(val ?? st[k] ?? '')}</textarea>`;
  const inp = (k, label, ph = '') => `<label class="f">${label}<input type="text" data-s="${k}" value="${esc(st[k] || '')}" placeholder="${esc(ph)}"></label>`;
  let h = `<div class="insp-h"><span class="t">Story poster</span><span class="s">Numbered sections · click the poster to jump to a part</span></div><div class="sec"><div class="warns" id="warns"></div>`;
  h += blk('header', 'Header', inp('eyebrow', 'Topic line above the title', 'COMPUTATIONAL MODELLING · EMOTION') + inp('conference', 'Conference and year', 'ICAP 2026, Kuala Lumpur') + inp('posterNo', 'Poster number', 'Poster B-14') + '<p class="hint" style="margin:0">Title, authors and affiliations come from the Paper panel on the left.</p>');
  h += blk('take', 'Take-home', inp('takeLabel', 'Label') + `<label class="f">One sentence. Wrap words in *stars* to colour them${ta('take', 3)}</label>` + (AI.fn ? `<div class="row"><button class="btn sm" type="button" data-sai="take">${SPARK}Sharpen with Claude</button></div><div class="ai-out" data-sout="take" hidden></div>` : ''));
  h += blk('question', 'Section: question', inp('qTitle', 'Heading') + ta('question', 5) + colSel('question'));
  h += blk('method', 'Section: method', inp('methodTitle', 'Heading') + `<label class="f">Boxes, one per line: Title | text<textarea data-s="steps" rows="6">${esc((st.steps || []).map(x => `${x.title || ''} | ${x.text || ''}`).join('\n'))}</textarea></label><label class="toggle"><input type="checkbox" data-hl ${((st.steps || []).slice(-1)[0] || {}).hl ? 'checked' : ''}> Highlight the last box</label><label class="f">Small note under the boxes${ta('methodNote', 3)}</label>` + colSel('method'));
  h += blk('result', 'Section: key result', inp('resultSec', 'Heading') + `<label class="f">Card title: the result as a sentence${ta('resultTitle', 3)}</label><label class="f">Figure in the card<select data-s="figureId">${FIG_OPTS(st.figureId)}</select></label>` + inp('caption', 'Figure caption') + `<p class="hint" style="margin:0">With no figure, the card shows the key numbers:</p>` + [0, 1, 2].map(i => { const n = (bb.numbers || [])[i] || { big: '', label: '' }; return `<div class="row" style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px"><input type="text" data-num="${i}" data-nf="big" value="${esc(n.big)}" aria-label="Number ${i + 1}"><input type="text" data-num="${i}" data-nf="label" value="${esc(n.label)}" aria-label="Label ${i + 1}"></div>`; }).join('') + inp('tableTitle', 'Table title', 'Key results') + `<div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><input type="text" data-th="0" value="${esc((st.tHead || [])[0] || 'Result')}" aria-label="First column heading"><input type="text" data-th="1" value="${esc((st.tHead || [])[1] || 'Value')}" aria-label="Second column heading"></div><label class="f">Rows, one per line: Label | Value<textarea data-s="table" rows="6">${esc((st.table || []).map(r => `${r.label} | ${r.value}`).join('\n'))}</textarea></label><label class="f">Note under the table${ta('resultNote', 3)}</label>` + colSel('result'));
  h += blk('findings', 'Section: findings', inp('fTitle', 'Heading') + `<label class="f">Points, one per line. Start with "H1 |" to set the badge${`<textarea data-s="items" rows="6">${esc((st.items || []).map(i => `${i.tag} | ${i.text}`).join('\n'))}</textarea>`}</label>` + inp('limLabel', 'Note label', 'Limitations') + ta('lim', 3) + colSel('findings'));
  h += blk('why', 'Why it matters (dark card)', inp('whyTitle', 'Heading') + ta('why', 4) + colSel('why'));
  h += blk('refs', 'Key references', `<label class="f">One per line, e.g. Smith et al. (2020)${`<textarea data-s="refs" rows="5">${esc((st.refs || []).join('\n'))}</textarea>`}</label><p class="hint" style="margin:0">Found from the in-text citations the paper uses most. The QR code links to the DOI.</p>`);
  h += `<div class="row"><button class="btn sm ghost" type="button" id="stReset">Rebuild story from the paper</button></div></div>`;
  el.innerHTML = h;
  updateWarnBoxes();
  const changed = now => { scheduleRender(); commit(now); };
  el.querySelectorAll('[data-s]').forEach(i2 => i2.addEventListener(i2.tagName === 'SELECT' ? 'change' : 'input', e => {
    const k = i2.dataset.s, v = e.target.value;
    if (k === 'steps') { const hl = ((st.steps || []).slice(-1)[0] || {}).hl; st.steps = v.split('\n').map(l => { const i = l.indexOf('|'); return { title: (i < 0 ? l : l.slice(0, i)).trim(), text: i < 0 ? '' : l.slice(i + 1).trim() }; }).filter(x => x.title || x.text); if (hl && st.steps.length) st.steps[st.steps.length - 1].hl = true; }
    else if (k === 'table') st.table = v.split('\n').map(l => { const i = l.indexOf('|'); return { label: (i < 0 ? l : l.slice(0, i)).trim(), value: i < 0 ? '' : l.slice(i + 1).trim() }; }).filter(r => r.label || r.value);
    else if (k === 'items') st.items = v.split('\n').map((l, n) => { const m = l.match(/^\s*([A-Za-z]?\d{1,2})\s*\|\s*(.*)$/); return m ? { tag: m[1], text: m[2].trim() } : { tag: String(n + 1), text: l.trim() }; }).filter(x => x.text);
    else if (k === 'refs') st.refs = v.split('\n').map(x => x.trim()).filter(Boolean);
    else if (k === 'figureId') st.figureId = v || null;
    else st[k] = v;
    changed(i2.tagName === 'SELECT');
  }));
  const hlBox = el.querySelector('[data-hl]'); if (hlBox) hlBox.addEventListener('change', e => { (st.steps || []).forEach(x => delete x.hl); if (e.target.checked && st.steps.length) st.steps[st.steps.length - 1].hl = true; changed(true); });
  el.querySelectorAll('[data-th]').forEach(i2 => i2.addEventListener('input', e => { st.tHead = st.tHead || ['Result', 'Value']; st.tHead[+i2.dataset.th] = e.target.value; changed(); }));
  el.querySelectorAll('[data-col]').forEach(i2 => i2.addEventListener('change', e => { st.cols = st.cols || {}; if (e.target.value === '') delete st.cols[i2.dataset.col]; else st.cols[i2.dataset.col] = +e.target.value; changed(true); }));
  el.querySelectorAll('[data-num]').forEach(i2 => i2.addEventListener('input', e => { bb.numbers = bb.numbers || []; const i = +i2.dataset.num; while (bb.numbers.length <= i) bb.numbers.push({ big: '', label: '' }); bb.numbers[i][i2.dataset.nf] = e.target.value; changed(); }));
  const reset = $('#stReset'); if (reset) reset.addEventListener('click', () => { commit(true); S.poster.story = P2P.buildStory(S.model); renderInspector(); changed(true); toast('Story rebuilt from the paper. Press Undo to go back.'); });
  el.querySelectorAll('[data-sai]').forEach(b => b.addEventListener('click', async () => {
    const out = el.querySelector('[data-sout="take"]');
    const t = await ask(`${FACTS}\n\nWrite the take-home message of this paper for the strip under a conference poster's title. One sentence, at most 25 words, plain language, ideally with a memorable contrast. Put the 2 to 5 most important words between *asterisks* so they can be coloured. Reply with only the sentence.\n\nCurrent sentence:\n${String(st.take || '').replace(/\*/g, '')}\n\nPaper excerpt:\n${paperContext()}`, out, { tier: 'default', cache: false });
    if (t) offerUse(out, t.replace(/^"|"$/g, ''), v => { st.take = v; });
  }));
  el.querySelectorAll('.blk').forEach(box => box.addEventListener('focusin', () => { S.sel.block = box.dataset.b; el.querySelectorAll('.blk').forEach(x => x.setAttribute('aria-current', x === box)); }));
  const cur = el.querySelector('.blk[aria-current=true]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}

function renderBillboardInspector(el) {
  const bb = S.poster.bb;
  const words = R.bbWords(bb);
  const sw = P2P.wc(String(bb.statement || '').replace(/\*/g, ''));
  const kinds = R.visualsFor(bb, figMap());
  const blk = (id, title, body) => `<div class="blk" data-b="${id}" aria-current="${id === S.sel.block}"><h4><span>${title}</span></h4>${body}</div>`;
  let h = `<div class="insp-h"><span class="t">Billboard poster</span><span class="s">${words} words · aim for under 300 · click the poster to jump</span></div><div class="sec"><div class="warns" id="warns"></div>`;
  h += blk('statement', 'Main finding', `<label class="f">Label<input type="text" data-k="label" value="${esc(bb.label)}"></label><label class="f">The one sentence people should remember<textarea data-k="statement" rows="4">${esc(bb.statement)}</textarea></label><p class="hint" style="margin:0">${sw} words. Under 20 reads best from a distance. Wrap words in *stars* to colour them.</p>${AI.fn ? `<div class="row"><button class="btn sm" type="button" data-bai="statement">${SPARK}Write a punchier headline</button></div><div class="ai-out" data-bout="statement" hidden></div>` : ''}`);
  h += blk('numbers', 'Key numbers', [0, 1, 2].map(i => { const n = (bb.numbers || [])[i] || { big: '', label: '' }; return `<div class="row" style="display:grid;grid-template-columns:96px minmax(0,1fr);gap:6px"><input type="text" data-num="${i}" data-nf="big" value="${esc(n.big)}" aria-label="Number ${i + 1}" placeholder="7"><input type="text" data-num="${i}" data-nf="label" value="${esc(n.label)}" aria-label="Label ${i + 1}" placeholder="studies included"></div>`; }).join('') + '<p class="hint" style="margin:0">Leave a row empty to hide it.</p>');
  const p = bb.prisma || {};
  const visOpts = [['auto', 'Automatic'], ['prisma', 'PRISMA flow'], ['grid', 'Evidence grid'], ['figure', 'Figure'], ['items', 'At a glance (topics)'], ['none', 'None']];
  let vis = `<label class="f">Show<select data-k="visual">${visOpts.map(([v, l]) => `<option value="${v}" ${(bb.visual || 'auto') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p class="hint" style="margin:0">Showing: ${kinds.length ? kinds.map(k => ({ prisma: 'PRISMA flow', grid: 'evidence grid', figure: 'figure', items: 'topics' })[k]).join(' and ') : 'nothing'}.</p>`;
  vis += `<details ${bb.prisma ? 'open' : ''}><summary class="hint">PRISMA numbers</summary><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">${[['identified', 'Records identified'], ['duplicates', 'Duplicates removed'], ['screened', 'Records screened'], ['fulltext', 'Full texts assessed'], ['included', 'Studies included']].map(([k, l]) => `<label class="f">${l}<input type="text" inputmode="numeric" data-pr="${k}" value="${p[k] != null ? p[k] : ''}"></label>`).join('')}</div></details>`;
  vis += `<details ${(bb.grid || []).length ? 'open' : ''}><summary class="hint">Evidence grid</summary><label class="f" style="margin-top:6px">One per line: Outcome | benefit, mixed, none or risk<textarea data-k="grid" rows="6">${esc((bb.grid || []).map(r => `${r.outcome} | ${r.effect}`).join('\n'))}</textarea></label>${bb.gridAuto && (bb.grid || []).length ? '<div class="warn">Detected automatically from sentences in the paper. Check every row against your results before printing.</div>' : ''}${AI.fn ? `<div class="row"><button class="btn sm" type="button" data-bai="grid">${SPARK}Build the grid with Claude</button></div><div class="ai-out" data-bout="grid" hidden></div>` : ''}</details>`;
  vis += `<label class="f">Figure<select data-k="figureId">${FIG_OPTS(bb.figureId)}</select></label><label class="f">Figure caption<input type="text" data-k="caption" value="${esc(bb.caption || '')}"></label>`;
  if ((bb.items || []).length || S.model.mode === 'review') vis += `<label class="f">At a glance (one per line: Title | text)<textarea data-k="items" rows="5">${esc((bb.items || []).map(i => `${i.title} | ${i.text}`).join('\n'))}</textarea></label>`;
  h += blk('visual', 'Visual', vis);
  h += blk('background', 'Background', `<textarea data-k="background" rows="4">${esc(bb.background || '')}</textarea>`);
  for (const [id, t] of [['method', 'Method'], ['meaning', 'What it means'], ['limits', 'Limitations']]) h += blk(id, t, `<label class="f">One point per line<textarea data-k="${id}" rows="4">${esc((bb[id] || []).join('\n'))}</textarea></label>`);
  h += `<div class="row"><button class="btn sm ghost" type="button" id="bbReset">Rebuild billboard from the paper</button></div></div>`;
  el.innerHTML = h;
  updateWarnBoxes();
  const changed = (now) => { scheduleRender(); commit(now); };
  el.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', e => {
    const k = inp.dataset.k, v = e.target.value;
    if (['method', 'meaning', 'limits'].includes(k)) bb[k] = v.split('\n').map(x => x.trim()).filter(Boolean);
    else if (k === 'grid') { bb.grid = v.split('\n').map(l => { const i = l.indexOf('|'); const o = (i < 0 ? l : l.slice(0, i)).trim(); let ef = (i < 0 ? '' : l.slice(i + 1)).trim().toLowerCase(); if (/no/.test(ef)) ef = 'none'; if (!EFFECTS.includes(ef)) ef = 'mixed'; return { outcome: o, effect: ef }; }).filter(r => r.outcome); bb.gridAuto = false; }
    else if (k === 'items') bb.items = v.split('\n').map(l => { const i = l.indexOf('|'); return { title: (i < 0 ? l : l.slice(0, i)).trim(), text: i < 0 ? '' : l.slice(i + 1).trim() }; }).filter(x => x.title);
    else if (k === 'figureId') bb.figureId = v || null;
    else bb[k] = v;
    if (inp.tagName === 'SELECT') renderBillboardInspector(el);
    changed(inp.tagName === 'SELECT');
  }));
  el.querySelectorAll('[data-num]').forEach(inp => inp.addEventListener('input', e => {
    bb.numbers = bb.numbers || []; const i = +inp.dataset.num;
    while (bb.numbers.length <= i) bb.numbers.push({ big: '', label: '' });
    bb.numbers[i][inp.dataset.nf] = e.target.value; changed();
  }));
  el.querySelectorAll('[data-pr]').forEach(inp => inp.addEventListener('input', e => {
    bb.prisma = bb.prisma || {}; const v = e.target.value.replace(/[^\d]/g, '');
    bb.prisma[inp.dataset.pr] = v ? +v : null; changed();
  }));
  const reset = $('#bbReset'); if (reset) reset.addEventListener('click', () => { commit(true); S.poster.bb = P2P.buildBillboard(S.model); renderInspector(); changed(true); toast('Billboard rebuilt from the paper. Press Undo to go back.'); });
  el.querySelectorAll('[data-bai]').forEach(b => b.addEventListener('click', async () => {
    const kind = b.dataset.bai, out = el.querySelector(`[data-bout="${kind}"]`);
    if (kind === 'statement') {
      const t = await ask(`${FACTS}\n\nWrite the single most important finding of this paper as one sentence for the centre of a conference poster that people read from 3 metres away. At most 18 words, plain language, no jargon. Put the 2 to 4 most important words between *asterisks* so they can be coloured. Reply with only the sentence.\n\nCurrent sentence:\n${String(bb.statement || '').replace(/\*/g, '')}\n\nPaper excerpt:\n${paperContext()}`, out, { tier: 'default', cache: false });
      if (t) offerUse(out, t.replace(/^"|"$/g, ''), v => { bb.statement = v; });
    } else {
      const rows = await ask(`${FACTS}\n\nFrom this systematic review, list up to 6 outcomes the included studies measured and the overall direction of the evidence for each. Reply with only a JSON array of objects like {"outcome": "Loneliness", "effect": "benefit"}, where outcome is at most 3 words and effect is one of "benefit", "mixed", "none" or "risk". Use only outcomes the excerpt reports.\n\nPaper excerpt:\n${paperContext()}`, out, { json: true, tier: 'default', cache: false });
      if (Array.isArray(rows)) {
        const clean = rows.filter(r => r && r.outcome).slice(0, 6).map(r => ({ outcome: String(r.outcome).slice(0, 40), effect: EFFECTS.includes(r.effect) ? r.effect : 'mixed' }));
        out.querySelector('.ai-text').textContent = clean.map(r => `${r.outcome}: ${r.effect}`).join('\n');
        offerUse(out, clean.map(r => `${r.outcome} | ${r.effect}`).join('\n'), () => { bb.grid = clean; bb.gridAuto = false; });
      }
    }
  }));
  el.querySelectorAll('.blk').forEach(box => box.addEventListener('focusin', () => { S.sel.block = box.dataset.b; el.querySelectorAll('.blk').forEach(x => x.setAttribute('aria-current', x === box)); }));
  const cur = el.querySelector('.blk[aria-current=true]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}

// ---------- study sheet poster editor ----------
const SHEET_TONES = { light: 'Light card', outline: 'Outlined', dark: 'Dark highlight', warn: 'Warning (coral)', key: 'Key message', plain: 'No background' };
const blockText = b => b.k === 'p' ? b.text : b.k === 'ul' ? b.items.join('\n') : b.k === 'flow' || b.k === 'stages' ? (b.steps || b.items).map(x => `${x.title || ''} | ${x.text || ''}`).join('\n') : b.k === 'table' ? b.rows.map(r => r.join(' | ')).join('\n') : b.k === 'big' ? `${b.big} | ${b.label || ''}` : '';
const BLOCK_LABEL = { p: 'Text', ul: 'Points, one per line', flow: 'Steps, one per line: Title | text', stages: 'Cards, one per line: Title | text', table: 'Rows, one per line: cell | cell', big: 'Big number | label' };
function setBlockText(b, v) {
  const lines = v.split('\n').map(x => x.trim()).filter(Boolean), pair = l => { const i = l.indexOf('|'); return [(i < 0 ? l : l.slice(0, i)).trim(), i < 0 ? '' : l.slice(i + 1).trim()]; };
  if (b.k === 'p') b.text = v;
  else if (b.k === 'ul') b.items = lines;
  else if (b.k === 'flow') { const last = (b.steps || []).findIndex(x => x.tone === 'accent'); b.steps = lines.map((l, i) => { const [t, x] = pair(l); return { title: t, text: x, tone: last >= 0 && i === lines.length - 1 ? 'accent' : '' }; }); }
  else if (b.k === 'stages') b.items = lines.map((l, i) => { const [t, x] = pair(l); const old = (b.items || [])[i] || {}; return { tag: old.tag || `Finding ${i + 1}`, title: x ? t : '', text: x || t, icon: old.icon || 'bulb' }; });
  else if (b.k === 'table') b.rows = lines.map(l => l.split('|').map(x => x.trim()));
  else if (b.k === 'big') { const [t, x] = pair(v); b.big = t; b.label = x; }
}
function renderSheetInspector(el) {
  const sh = S.poster.sheet;
  const blk = (id, title, body) => `<div class="blk" data-b="${id}" aria-current="${id === S.sel.block}"><h4><span>${title}</span></h4>${body}</div>`;
  let h = `<div class="insp-h"><span class="t">Study sheet poster</span><span class="s">Numbered cards · click the poster to jump to a card</span></div><div class="sec"><div class="warns" id="warns"></div>`;
  h += blk('header', 'Header', `<label class="f">Line above the title<input type="text" data-h="eyebrow" value="${esc(sh.eyebrow || '')}"></label><label class="f">Under the title<input type="text" data-h="subtitle" value="${esc(sh.subtitle || '')}"></label><label class="f">Number chips, one per line: number | label<textarea data-h="stats" rows="3">${esc((sh.stats || []).map(x => `${x.big} | ${x.label}`).join('\n'))}</textarea></label>`);
  const vis = sh.cards.filter(c => !c.hidden);
  sh.cards.forEach((c, ci) => {
    const n = c.hidden ? '' : vis.indexOf(c) + 1 + ' · ';
    let b = `<label class="toggle"><input type="checkbox" data-c="${ci}" data-f="show" ${c.hidden ? '' : 'checked'}> Show this card</label>`;
    b += `<label class="f">Heading<input type="text" data-c="${ci}" data-f="title" value="${esc(c.title || '')}"></label>`;
    c.blocks.forEach((bl, bi) => { if (BLOCK_LABEL[bl.k]) b += `<label class="f">${BLOCK_LABEL[bl.k]}${bl.k === 'big' ? `<input type="text" data-c="${ci}" data-b2="${bi}" value="${esc(blockText(bl))}">` : `<textarea data-c="${ci}" data-b2="${bi}" rows="${bl.k === 'p' ? 3 : 4}">${esc(blockText(bl))}</textarea>`}</label>`; });
    b += `<details class="more"><summary>More options</summary><div class="more-b"><div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="f">Colour<select data-c="${ci}" data-f="tone">${Object.entries(SHEET_TONES).map(([k, v]) => `<option value="${k}" ${c.tone === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="f">Width<select data-c="${ci}" data-f="span">${[1, 2, 3].map(k => `<option value="${k}" ${(c.span || 1) === k ? 'selected' : ''}>${k} column${k > 1 ? 's' : ''}</option>`).join('')}</select></label></div>`;
    b += `<label class="f">Figure in this card<select data-c="${ci}" data-f="fig">${FIG_OPTS(sh.figCard === c.id ? sh.figureId : null)}</select></label>`;
    b += `<div class="row"><button class="btn sm ghost" type="button" data-c="${ci}" data-mv="-1" ${ci === 0 ? 'disabled' : ''}>Move earlier</button><button class="btn sm ghost" type="button" data-c="${ci}" data-mv="1" ${ci === sh.cards.length - 1 ? 'disabled' : ''}>Move later</button></div></div></details>`;
    h += blk(c.id, `${n}${esc(c.title || 'Card')}${c.hidden ? ' (hidden)' : ''}`, b);
  });
  h += `<p class="hint">Wrap words in **double stars** to make them bold, or *single stars* to colour them.</p><div class="row"><button class="btn sm ghost" type="button" id="shReset">Rebuild from the paper</button></div></div>`;
  el.innerHTML = h;
  updateWarnBoxes();
  const changed = now => { scheduleRender(); commit(now); };
  el.querySelectorAll('[data-h]').forEach(i2 => i2.addEventListener('input', e => {
    const k = i2.dataset.h, v = e.target.value;
    if (k === 'stats') sh.stats = v.split('\n').map(l => { const i = l.indexOf('|'); return { big: (i < 0 ? l : l.slice(0, i)).trim(), label: i < 0 ? '' : l.slice(i + 1).trim() }; }).filter(x => x.big).slice(0, 3);
    else sh[k] = v;
    changed();
  }));
  el.querySelectorAll('[data-b2]').forEach(i2 => i2.addEventListener('input', e => { setBlockText(sh.cards[+i2.dataset.c].blocks[+i2.dataset.b2], e.target.value); changed(); }));
  el.querySelectorAll('[data-f]').forEach(i2 => i2.addEventListener(i2.type === 'text' ? 'input' : 'change', e => {
    const c = sh.cards[+i2.dataset.c], f = i2.dataset.f;
    if (f === 'show') { c.hidden = !e.target.checked; renderInspector(); changed(true); return; }
    if (f === 'title') { c.title = e.target.value; changed(); return; }
    if (f === 'tone') c.tone = e.target.value;
    if (f === 'span') c.span = +e.target.value;
    if (f === 'fig') { sh.figureId = e.target.value || null; sh.figCard = e.target.value ? c.id : null; renderInspector(); }
    changed(true);
  }));
  el.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.c, j = i + +b.dataset.mv; [sh.cards[i], sh.cards[j]] = [sh.cards[j], sh.cards[i]]; S.sel.block = sh.cards[j].id; renderInspector(); changed(true); }));
  $('#shReset').addEventListener('click', () => { commit(true); S.poster.sheet = P2P.buildSheet(S.model); renderInspector(); changed(true); toast('Rebuilt from the paper. Press Undo to go back.'); });
  el.querySelectorAll('.blk').forEach(box => box.addEventListener('focusin', () => { S.sel.block = box.dataset.b; el.querySelectorAll('.blk').forEach(x => x.setAttribute('aria-current', x === box)); }));
  const cur = el.querySelector('.blk[aria-current=true]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}
function renderPosterInspector(el) {
  ensureBillboard();
  if (S.poster.layout === 'billboard') return renderBillboardInspector(el);
  if (S.poster.layout === 'story') return renderStoryInspector(el);
  if (S.poster.layout === 'sheet') return renderSheetInspector(el);
  let h = `<div class="insp-h"><span class="t">Poster</span><span class="s">Click a block on the poster to jump to it</span></div><div class="sec"><div class="warns" id="warns"></div>`;
  const colOpt = c => [0, 1, 2].map(k => `<option value="${k}" ${k === c ? 'selected' : ''}>Column ${k + 1}</option>`).join('');
  for (const b of S.poster.blocks) {
    h += `<div class="blk" data-b="${b.id}" aria-current="${b.id === S.sel.block}"><h4><span>${esc(b.heading || b.kind)}</span><span>${b.kind}</span></h4>`;
    if (b.kind !== 'callout') h += `<label class="f">Heading<input type="text" data-f="heading" value="${esc(b.heading)}"></label>`;
    if (b.kind === 'text' || b.kind === 'callout') h += `<label class="f">${b.kind === 'callout' ? 'Takeaway' : 'Text'}<textarea data-f="text" rows="${b.kind === 'callout' ? 3 : 6}">${esc(b.text)}</textarea></label><div class="row"><span class="wc">${P2P.wc(b.text)} words</span><div class="spacer"></div><button class="btn sm" data-act="short">Shorten</button></div>`;
    if (b.kind === 'bullets') h += `<label class="f">Bullets (one per line)<textarea data-f="bullets" rows="6">${esc(b.bullets.join('\n'))}</textarea></label>`;
    if (b.kind === 'stats') b.stats.forEach((st, k) => { h += `<div class="row" style="display:grid;grid-template-columns:90px minmax(0,1fr);gap:6px"><input type="text" data-st="${k}" data-sf="big" value="${esc(st.big)}" aria-label="Number ${k + 1}"><input type="text" data-st="${k}" data-sf="label" value="${esc(st.label)}" aria-label="Label ${k + 1}"></div>`; });
    if (b.kind === 'figure') h += `<label class="f">Figure<select data-f="figureId">${FIG_OPTS(b.figureId)}</select></label><label class="f">Caption<input type="text" data-f="caption" value="${esc(b.caption)}"></label>`;
    h += aiPosterBtn(b);
    h += `<label class="f">Position<select data-f="col">${colOpt(b.col)}</select></label></div>`;
  }
  h += '</div>';
  el.innerHTML = h;
  updateWarnBoxes();
  wireAiPoster(el);
  el.querySelectorAll('.blk').forEach(box => {
    const b = S.poster.blocks.find(x => x.id === box.dataset.b);
    box.addEventListener('focusin', () => { S.sel.block = b.id; el.querySelectorAll('.blk').forEach(x => x.setAttribute('aria-current', x === box)); });
    box.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', e => {
      const f = inp.dataset.f, v = e.target.value;
      if (f === 'bullets') b.bullets = v.split('\n'); else if (f === 'col') b.col = +v; else if (f === 'figureId') b.figureId = v || null; else b[f] = v;
      scheduleRender(); commit(inp.tagName === 'SELECT');
    }));
    box.querySelectorAll('[data-st]').forEach(inp => inp.addEventListener('input', e => { b.stats[+inp.dataset.st][inp.dataset.sf] = e.target.value; scheduleRender(); commit(); }));
    const sh = box.querySelector('[data-act=short]'); if (sh) sh.addEventListener('click', () => {
      const sents = P2P.splitSentences(b.text); const keep = sents.length > 1 ? sents.slice(0, Math.max(1, sents.length - 1)) : sents;
      b.text = keep.map(x => P2P.shorten(x, 26)).join(' '); renderPosterInspector(el); scheduleRender(); commit(true);
    });
  });
  const cur = el.querySelector('.blk[aria-current=true]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
}
$('#posterCv').addEventListener('click', e => {
  const cv = e.currentTarget, r = cv.getBoundingClientRect();
  const size = R.POSTER_SIZES[S.posterSize];
  const x = (e.clientX - r.left) / r.width * size.w, y = (e.clientY - r.top) / r.height * size.h;
  const hit = posterInfo.rects.find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
  if (hit) { S.sel.block = hit.id; renderInspector(); if (matchMedia('(max-width: 760px)').matches) openSheet('insp'); const t = $(`.blk[data-b="${hit.id}"] textarea, .blk[data-b="${hit.id}"] input`); if (t) t.focus({ preventScroll: false }); }
});

// ---------- extracted view ----------
function renderExtracted() {
  const m = S.model, src = S.source;
  const secs = P2P.ORDER.filter(k => m.sections[k]);
  const review = m.mode === 'review', topics = m.topics || [];
  const missing = review ? [] : P2P.ORDER.filter(k => !m.sections[k] && k !== 'participants');
  const statHl = t => esc(t).replace(/\u0000/g, '');
  let h = `<div class="summary"><span class="chip">${src.pagesRead} of ${src.pageCount} pages read</span><span class="chip">${src.twoColPages} two-column page${src.twoColPages === 1 ? '' : 's'}</span>${review ? `<span class="chip good">Review article · ${topics.length} topics</span>` : ''}<span class="chip ${secs.length || review ? 'good' : 'warn'}">${secs.length} standard section${secs.length === 1 ? '' : 's'} found</span>${missing.length ? `<span class="chip warn">Not found: ${missing.map(k => P2P.LABELS[k]).join(', ')}</span>` : ''}${m.doi ? '<span class="chip good">DOI found</span>' : '<span class="chip warn">No DOI found</span>'}</div>`;
  for (const k of secs) {
    const s = m.sections[k];
    h += `<div class="card"><h3><span class="k">${P2P.LABELS[k]}</span>${esc(s.heading)}<span class="w">${s.words} words · ${s.sentences.length} sentences</span></h3>`;
    h += (s.ranked || []).slice(0, 5).map(x => `<div class="sent"><span class="sc">${x.score.toFixed(2)}</span><span>${statHl(x.text)}${x.stats.map(t => `<span class="stat">${esc(t)}</span>`).join('')}</span></div>`).join('') || '<p class="hint">No full sentences found in this section.</p>';
    h += '</div>';
  }
  topics.forEach((tp, i) => {
    h += `<div class="card"><h3><span class="k">Topic ${i + 1}</span>${esc(tp.heading)}<span class="w">${tp.words} words · page ${tp.page}</span></h3>`;
    h += (tp.ranked || []).slice(0, 3).map(x => `<div class="sent"><span class="sc">${x.score.toFixed(2)}</span><span>${statHl(x.text)}${x.stats.map(t => `<span class="stat">${esc(t)}</span>`).join('')}</span></div>`).join('') + '</div>';
  });
  if (!secs.length && !topics.length) h += '<div class="card"><h3>No sections recognised</h3><p class="hint">The app could not find headings like Introduction, Method or Results. The paper may use unusual headings or a layout the app cannot read yet.</p></div>';
  $('#ex').innerHTML = factCard() + aiPaperCard() + h;
  const fw = $('#fcWhich'); if (fw) { fw.value = S.fcWhich || 'talk'; fw.addEventListener('change', e => { S.fcWhich = e.target.value; renderExtracted(); }); }
  wireAiPaper();
}

// ---------- modes and steps ----------
// mode = what the user is making (social | poster | talk); step = 1 Content, 2 Look, 3 Download
const MODE_TAB = { social: 'carousel', poster: 'poster', talk: 'talk' };
const MODE_NAME = { social: 'Social post', poster: 'Poster', talk: 'Presentation' };
const UIKEY = 'paper2poster-ui';
const ui = { mode: null, step: 1 };
try { const u = JSON.parse(localStorage.getItem(UIKEY) || 'null'); if (u && MODE_TAB[u.mode]) ui.mode = u.mode; } catch (e) {}
const saveUi = () => { try { localStorage.setItem(UIKEY, JSON.stringify({ mode: ui.mode })); } catch (e) {} };
function showHome() {
  ui.home = true; openSheet(null);
  $('#homePaper').textContent = (S.model && S.model.title) ? S.model.title : 'your paper';
  document.querySelectorAll('.pick-mode').forEach(c => c.setAttribute('aria-current', String(c.dataset.mode === ui.mode)));
  applyView();
}
function setMode(m, step = 1) {
  if (!MODE_TAB[m]) return;
  ui.mode = m; ui.home = false; ui.step = step; saveUi();
  S.sel.tab = MODE_TAB[m];
  applyView();
}
function setStep(n) { if (!ui.mode) return showHome(); ui.home = false; ui.step = Math.max(1, Math.min(3, n)); applyView(); window.scrollTo && window.scrollTo(0, 0); }
function applyView() {
  const home = ui.home || !ui.mode, step = ui.step, tab = S.sel.tab;
  document.body.classList.toggle('home', home);
  ['step-1', 'step-2', 'step-3'].forEach(c => document.body.classList.toggle(c, !home && c === 'step-' + step));
  document.querySelectorAll('.mode').forEach(x => x.setAttribute('aria-selected', String(!home && x.dataset.mode === ui.mode)));
  document.querySelectorAll('#steps [data-step]').forEach(x => { if (+x.dataset.step === step && !home) x.setAttribute('aria-current', 'step'); else x.removeAttribute('aria-current'); });
  $('#vHome').hidden = !home;
  $('#vDownload').hidden = home || step !== 3;
  const showPreview = !home && step !== 3;
  $('#vCarousel').hidden = !(showPreview && tab === 'carousel'); $('#vPoster').hidden = !(showPreview && tab === 'poster'); $('#vTalk').hidden = !(showPreview && tab === 'talk');
  $('#lookPoster').hidden = ui.mode !== 'poster'; $('#lookTalk').hidden = ui.mode !== 'talk';
  // the talk toolbar's extras only matter while editing content
  document.querySelectorAll('#vTalk .tbar, #tTime, #tHint, #tAiBar').forEach(x => { x.style.display = step === 1 ? '' : 'none'; });
  $('#vTalk .tscript').style.display = step === 1 ? '' : 'none';
  $('#aiBar').style.display = step === 1 ? '' : 'none'; $('#aiBarOut').style.display = step === 1 ? '' : 'none';
  $('#fabEdit').textContent = tab === 'poster' ? 'Edit poster' : 'Edit slide';
  $('#fabEdit').hidden = home || step !== 1; $('#fabLook').hidden = home || step !== 2;
  $('#stepBack').textContent = step === 1 ? 'Back to start' : step === 2 ? 'Back: Content' : 'Back: Look';
  $('#stepNext').textContent = step === 1 ? 'Next: Look' : step === 2 ? 'Next: Download' : 'Done';
  $('#stepNext').hidden = step === 3;
  if (!home && tab === 'talk') { $('#tAiBar').hidden = !AI.fn || step !== 1; renderTalk(); }
  if (!home && step === 3) renderDownloads();
  if (!home) renderInspector();
  updateFactBadge();
}
document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode, ui.mode === b.dataset.mode ? ui.step : Math.min(ui.step, 2))));
document.querySelectorAll('.pick-mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode, 1)));
document.querySelectorAll('#steps [data-step]').forEach(b => b.addEventListener('click', () => setStep(+b.dataset.step)));
$('#stepBack').addEventListener('click', () => ui.step === 1 ? showHome() : setStep(ui.step - 1));
$('#stepNext').addEventListener('click', () => setStep(ui.step + 1));
$('#homeBtn').addEventListener('click', showHome);
$('#dlBtn').addEventListener('click', () => ui.mode ? setStep(3) : showHome());
// downloads that fit what you are making
const DLS = {
  social: [['zip', 'Carousel images', 'PNG slides in a ZIP, 1080 × 1350. Post them as an Instagram carousel.', true], ['video45', 'Carousel video', 'Animated MP4 for the feed, 4:5'], ['video916', 'Reel or Story video', 'Animated MP4, 9:16'], ['lipdf', 'LinkedIn carousel', 'PDF for a LinkedIn document post'], ['ga', 'Graphical abstract', 'PNG, 1600 × 900, for journals and slides'], ['share', 'Share to an app', 'Copy the caption and save the right file for Instagram, TikTok, LinkedIn, X or WhatsApp']],
  poster: [['poster', 'Poster for printing', 'PDF at 150 dpi, at full poster size', true], ['posterpng', 'Poster image', 'PNG preview to share or check']],
  talk: [['rehearse', 'Rehearse first', 'Full-screen practice with your script and a timer', false], ['pptx', 'PowerPoint', 'Editable slides with your script in the speaker notes', true], ['talkpdf', 'Slides PDF', '16:9, opens anywhere'], ['script', 'Speaker script', 'Printable PDF with timings'], ['pptxtheme', 'PowerPoint with theme fonts', "Uses the theme's Google fonts. Install them first."], ['scriptmd', 'Script as text', 'A .md file you can edit anywhere']],
};
function renderDownloads() {
  const m = ui.mode || 'social';
  $('#dlTitle').textContent = `Download your ${MODE_NAME[m].toLowerCase()}`;
  $('#dlList').innerHTML = (m === 'social' ? prepubWarn() : '') + DLS[m].map(([x, t, d, main]) => `<button class="dli${main ? ' main' : ''}" type="button" data-dl="${x}"><strong>${esc(t)}</strong><span>${esc(d)}</span></button>`).join('');
  $('#dlList').querySelectorAll('[data-dl]').forEach(b => b.addEventListener('click', () => runExport(b.dataset.dl)));
  $('#dlSocial').hidden = m !== 'social';
  if (m === 'social') renderKit();
}
// settings drawer
function openSettings(where) {
  $('#tPresenter').value = S.cfg.presenter || ''; $('#tEvent').value = (S.talk && S.talk.event) || '';
  $('#setDrawer').hidden = false; $('#setBg').hidden = false;
  const h = where && $('#set-' + where); if (h && h.scrollIntoView) h.scrollIntoView({ block: 'start' });
  $('#setClose').focus();
}
function closeSettings() { $('#setDrawer').hidden = true; $('#setBg').hidden = true; }
$('#setBtn').addEventListener('click', () => openSettings());
$('#setClose').addEventListener('click', closeSettings);
$('#setBg').addEventListener('click', closeSettings);
document.addEventListener('click', e => { const b = e.target.closest('[data-open-set]'); if (b) openSettings(b.dataset.openSet); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#setDrawer').hidden) closeSettings(); });
// fact check badge and panel
let fcT = 0;
function updateFactBadge() {
  clearTimeout(fcT);
  fcT = setTimeout(() => {
    const b = $('#fcBadge'); if (!b || !S.model || !ui.mode) return;
    try {
      if (ui.mode === 'talk') ensureTalk();
      const items = ui.mode === 'social' ? carouselClaims() : ui.mode === 'poster' ? posterClaims() : talkClaims(visibleTalk());
      const res = P2P.factCheck(S.model, items), bad = res.filter(r => r.status === 'number' || r.status === 'none').length, ph = res.filter(r => r.status === 'placeholder').length;
      b.className = 'fcb ' + (bad || ph ? 'warn' : 'ok');
      b.textContent = bad ? `! ${bad} to check` : ph ? `[ ] ${ph} to fill in` : '✓ All matched';
      b.title = 'Fact check: every claim traced to the paper. Click for details.';
    } catch (e) { b.className = 'fcb'; b.textContent = 'Fact check'; }
  }, 500);
}
function openCheck() { S.fcWhich = { social: 'carousel', poster: 'poster', talk: 'talk' }[ui.mode] || 'talk'; renderExtracted(); $('#checkModal').hidden = false; $('#checkClose').focus(); }
function closeCheck() { $('#checkModal').hidden = true; }
$('#fcBadge').addEventListener('click', openCheck);
$('#checkClose').addEventListener('click', closeCheck);
$('#checkModal').addEventListener('click', e => { if (e.target.id === 'checkModal') closeCheck(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#checkModal').hidden) closeCheck(); });
// tuck rarely used editor fields under "More options"
function tuck(el, ids) {
  const sec = el.querySelector('.sec'); if (!sec) return;
  const nodes = [];
  ids.forEach(q => el.querySelectorAll(q).forEach(n => { let w = n; while (w.parentElement && w.parentElement !== sec) w = w.parentElement; if (w.parentElement === sec && !nodes.includes(w)) nodes.push(w); }));
  if (!nodes.length) return;
  const d = document.createElement('details'); d.className = 'more'; d.open = !!S.moreOpen;
  d.innerHTML = '<summary>More options</summary><div class="more-b"></div>';
  d.addEventListener('toggle', () => { S.moreOpen = d.open; });
  const box = d.querySelector('.more-b');
  nodes.forEach(n => box.append(n));
  sec.append(d);
}
$('#pSize').innerHTML = Object.entries(R.POSTER_SIZES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
$('#pSize').addEventListener('change', e => { S.posterSize = e.target.value; scheduleRender(); commit(true); });
$('#pLayout').addEventListener('change', e => { ensureBillboard(); S.poster.layout = e.target.value; renderInspector(); scheduleRender(); commit(true); });

// ---------- build ----------
function buildOutputs() {
  S.slides = P2P.buildSlides(S.model, { ...S.cfg, series: S.brand.series });
  S.poster = P2P.buildPoster(S.model);
  S.talk = null; S.talk = { ...P2P.buildTalk(S.model, talkCfg()), edited: false };
  S.sel.slide = 0; S.sel.block = 'intro'; S.sel.talk = 0; if (typeof talkCanvases !== 'undefined') { talkCanvases.clear(); $('#tStrip').innerHTML = ''; }
}
async function loadExample() {
  pdfDoc = null;
  const exl = exampleLines();
  S.model = P2P.buildModel(exl, {}); if (typeof AI !== 'undefined') AI.chat = [];
  S.source = { name: 'Example paper (fictional)', example: true, pageCount: exl.pageCount, pagesRead: exl.pagesRead, twoColPages: 0 };
  S.figures = []; for (const k in imgs) delete imgs[k];
  buildOutputs();
  hist.past = []; hist.future = []; hist.last = null;
  fillMeta();
  notice('<strong>Example paper.</strong> This is a fictional study so you can see how the app works. Upload your own PDF to start.');
  await addFigure(exampleFigure(), 'Figure 1. Loneliness by cycling days');
  renderAll(true); commit(true);
}

// ---------- PDF upload ----------
function progressNotice(label, k, n) { notice(`<span class="busy"><span class="spin"></span> ${label} ${k} of ${n}…</span> <progress max="${n}" value="${k}" style="vertical-align:middle;width:160px"></progress>`); }
// build the model in a background worker so a 300-page thesis does not freeze the page
function modelInWorker(ex, meta) {
  return new Promise((resolve, reject) => {
    let wk;
    try {
      const src = $('#coreSrc') && $('#coreSrc').textContent;
      if (!src || typeof Worker === 'undefined') throw new Error('no worker');
      const code = src + '\nself.onmessage = e => { try { postMessage({ ok: true, m: P2P.buildModel(e.data.ex, e.data.meta) }); } catch (err) { postMessage({ ok: false, err: String(err && err.stack || err) }); } };';
      wk = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    } catch (e) { reject(e); return; }
    const t = setTimeout(() => { wk.terminate(); reject(new Error('timeout')); }, 120000);
    wk.onmessage = e => { clearTimeout(t); wk.terminate(); e.data.ok ? resolve(e.data.m) : reject(new Error(e.data.err)); };
    wk.onerror = e => { clearTimeout(t); wk.terminate(); reject(e); };
    wk.postMessage({ ex, meta });
  });
}
async function buildModelSafe(ex, meta) {
  try { return await modelInWorker(ex, meta); } catch (e) { return P2P.buildModel(ex, meta); }
}
async function ocrPdf(doc, maxPages) {
  await loadScript(LIBS.tess);
  progressNotice('Starting text recognition (OCR): page', 0, maxPages);
  const worker = await Tesseract.createWorker('eng', 1, { workerPath: LIBS.tessWorker, corePath: LIBS.tessCore, langPath: LIBS.tessLang });
  const lines = [];
  try {
    for (let p = 1; p <= maxPages; p++) {
      progressNotice('Recognising text (OCR): page', p, maxPages);
      const page = await doc.getPage(p), vp1 = page.getViewport({ scale: 1 }), sc = 2, vp = page.getViewport({ scale: sc });
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const { data } = await worker.recognize(cv);
      for (const ln of (data.lines || [])) {
        const t = String(ln.text || '').replace(/\s+/g, ' ').trim();
        if (!t || (ln.confidence != null && ln.confidence < 35)) continue;
        const ra = ln.rowAttributes || {}, h = (ra.row_height ? ra.row_height - (ra.descenders || 0) * 0 : (ln.bbox.y1 - ln.bbox.y0)) / sc;
        lines.push({ text: t, size: Math.round(h / (ra.row_height ? 1.15 : 1.3) * 10) / 10, bold: false, page: p, y: vp1.height - ln.bbox.y0 / sc, x: ln.bbox.x0 / sc, pageH: vp1.height, pageW: vp1.width });
      }
    }
  } finally { try { await worker.terminate(); } catch (e) {} }
  return { lines, pageCount: doc.numPages, pagesRead: maxPages, twoColPages: 0, ocr: true };
}
async function handlePdf(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { toast('Please choose a PDF file.'); return; }
  notice(`<span class="busy"><span class="spin"></span> Opening <strong>${esc(file.name)}</strong>…</span>`);
  try {
    await loadScript(LIBS.pdf); await loadScript(LIBS.pdfw);
    pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfw;
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
    let meta = {}; try { const md = await doc.getMetadata(); meta = { title: md.info?.Title || '', author: md.info?.Author || '' }; } catch (e) {}
    const ex = await P2P.extractLines(doc, { maxPages: 300, onProgress: (k, n) => { if (n > 8) progressNotice('Reading page', k, n); } });
    if (ex.lines.length < 15) {
      const n = Math.min(doc.numPages, 40);
      notice(`<strong>No text found in this PDF.</strong> It is probably a scanned image. The app can read it with text recognition (OCR) on your device. This takes about 5 to 10 seconds a page${doc.numPages > 40 ? ', and reads the first 40 pages' : ''}. <button class="btn sm primary" type="button" id="ocrGo">Read it with OCR</button>`, 'err');
      $('#ocrGo').addEventListener('click', async () => {
        try { const ox = await ocrPdf(doc, n); if (ox.lines.length < 15) { notice('<strong>Text recognition found too little text.</strong> Try a clearer scan, or the publisher\'s PDF.', 'err'); return; } await finishPdf(doc, ox, meta, file.name); }
        catch (err) { console.error(err); notice('<strong>Text recognition could not run.</strong> Check your connection: the OCR engine downloads the first time you use it.', 'err'); }
      });
      return;
    }
    await finishPdf(doc, ex, meta, file.name);
  } catch (err) {
    console.error(err);
    notice(`<strong>That PDF could not be read.</strong> ${esc(/password/i.test(err.message) ? 'It is password-protected. Remove the password and try again.' : 'It may be damaged or use an unusual format. Try downloading it again.')}`, 'err');
  }
}
async function finishPdf(doc, ex, meta, name) {
  notice(`<span class="busy"><span class="spin"></span> Finding sections in ${ex.pagesRead} page${ex.pagesRead === 1 ? '' : 's'}…</span>`);
  const model = await buildModelSafe(ex, meta);
  pdfDoc = doc;
  S.model = model; if (typeof AI !== 'undefined') AI.chat = [];
  S.source = { name, example: false, pageCount: ex.pageCount, pagesRead: ex.pagesRead, twoColPages: ex.twoColPages, ocr: !!ex.ocr };
  S.figures = []; for (const k in imgs) delete imgs[k];
  buildOutputs();
  hist.past = []; hist.future = []; hist.last = null;
  fillMeta();
  const found = Object.keys(model.sections).length, nTopics = (model.topics || []).length;
  const ocrNote = ex.ocr ? ' Read with text recognition (OCR), so check spelling and numbers in the Fact check.' : '';
  if (model.mode === 'review') notice(`Read as a <strong>review article</strong> with ${nTopics} topic${nTopics === 1 ? '' : 's'}. Each topic became a key-point slide.${ocrNote}`);
  else notice(found >= 3 ? (ocrNote ? ocrNote.trim() : '') : `<strong>Only ${found} section${found === 1 ? '' : 's'} recognised.</strong> Check "What the app found", then edit the slides by hand where needed.${ocrNote}`);
  if (ex.pageCount > ex.pagesRead) toast(`Read the first ${ex.pagesRead} of ${ex.pageCount} pages.`, 4200);
  else if (model.figurePages.length) toast(`Read ${ex.pagesRead} pages. Figures found on page ${model.figurePages.slice(0, 4).join(', ')}. Use "Crop from PDF" to add them.`, 4200);
  else toast(`Read ${ex.pagesRead} pages`);
  renderAll(true); commit(true);
  showHome();
}
$('#pdfInput').addEventListener('change', e => { handlePdf(e.target.files[0]); e.target.value = ''; });
let dragN = 0;
window.addEventListener('dragenter', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragN++; $('#drop').hidden = false; } });
window.addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) $('#drop').hidden = true; });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => {
  e.preventDefault(); dragN = 0; $('#drop').hidden = true;
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (/^image\//.test(f.type)) { const r = new FileReader(); r.onload = () => addFigure(r.result, f.name.replace(/\.[^.]+$/, '')); r.readAsDataURL(f); }
  else handlePdf(f);
});

// ---------- figure cropper ----------
const crop = { page: 1, scale: 1, sel: null, start: null };
async function openCrop() {
  if (!pdfDoc) return;
  $('#cropModal').hidden = false;
  const fp = new Set(S.model.figurePages || []);
  $('#pageBtns').innerHTML = Array.from({ length: pdfDoc.numPages }, (_, i) => `<button class="pg ${fp.has(i + 1) ? 'has' : ''}" data-p="${i + 1}" type="button" title="${fp.has(i + 1) ? 'Has a figure or table caption' : ''}">${i + 1}</button>`).join('');
  await showPage(fp.size ? [...fp][0] : 1);
  $('#cropClose').focus();
}
async function showPage(p) {
  crop.page = p; crop.sel = null; $('#cropSel').hidden = true; $('#cropAdd').disabled = true;
  document.querySelectorAll('.pg').forEach(b => b.setAttribute('aria-current', +b.dataset.p === p));
  const page = await pdfDoc.getPage(p);
  const vp1 = page.getViewport({ scale: 1 });
  crop.scale = Math.min(3, 1800 / vp1.width);
  const vp = page.getViewport({ scale: crop.scale });
  const cv = $('#cropCv'); cv.width = vp.width; cv.height = vp.height;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  try { await page.render({ canvasContext: g, viewport: vp }).promise; } catch (e) { toast('Some parts of this page could not be drawn.'); }
  $('#cropName').value = `Figure (page ${p})`;
}
$('#pageBtns').addEventListener('click', e => { const b = e.target.closest('.pg'); if (b) showPage(+b.dataset.p); });
const wrapEl = $('#cropWrap');
function relPos(e) { const r = $('#cropCv').getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; }
wrapEl.addEventListener('pointerdown', e => { crop.start = relPos(e); wrapEl.setPointerCapture(e.pointerId); });
wrapEl.addEventListener('pointermove', e => {
  if (!crop.start) return; const p = relPos(e);
  const s = { x: Math.min(p.x, crop.start.x), y: Math.min(p.y, crop.start.y), w: Math.abs(p.x - crop.start.x), h: Math.abs(p.y - crop.start.y) };
  crop.sel = s; const el = $('#cropSel'); el.hidden = false;
  Object.assign(el.style, { left: s.x * 100 + '%', top: s.y * 100 + '%', width: s.w * 100 + '%', height: s.h * 100 + '%' });
});
wrapEl.addEventListener('pointerup', () => { crop.start = null; $('#cropAdd').disabled = !(crop.sel && crop.sel.w > 0.03 && crop.sel.h > 0.03); });
$('#cropAdd').addEventListener('click', async () => {
  const cv = $('#cropCv'), s = crop.sel; if (!s) return;
  const sx = Math.round(s.x * cv.width), sy = Math.round(s.y * cv.height), sw = Math.round(s.w * cv.width), sh = Math.round(s.h * cv.height);
  const out = document.createElement('canvas'); out.width = sw; out.height = sh;
  out.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
  await addFigure(out.toDataURL('image/png'), $('#cropName').value.trim() || `Figure (page ${crop.page})`);
  closeCrop(); toast('Figure added and placed on the slides and poster');
});
function closeCrop() { $('#cropModal').hidden = true; $('#cropBtn').focus(); }
$('#cropBtn').addEventListener('click', openCrop);
$('#cropClose').addEventListener('click', closeCrop);
$('#cropModal').addEventListener('click', e => { if (e.target.id === 'cropModal') closeCrop(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#cropModal').hidden) closeCrop(); });

// ---------- export ----------
const slug = () => (S.model.title || 'paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'paper';
async function saveFile(filename, data) {
  let d = null;
  try { d = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { d = null; }
  if (!d) {
    // outside Claude (for example on GitHub Pages): a normal browser download
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('Downloaded ' + filename); return true;
    } catch (e) { toast('The file could not be saved in this browser.', 4200); return false; }
  }
  try { await d.save({ filename, data }); toast('Saved ' + filename); return true; }
  catch (e) { if (e && e.code === 'declined') toast('Save cancelled'); else if (e && e.code === 'rate_limited') toast('A save is already open. Finish it first.'); else toast('The file could not be saved.'); return false; }
}
const toBlob = (cv, type = 'image/png', q) => new Promise(r => cv.toBlob(r, type, q));
async function saveSlidePng(s) { const vis = visibleSlides(); const n = String(Math.max(0, vis.indexOf(s)) + 1).padStart(2, '0'); await saveFile(`${slug()}-slide-${n}.png`, await toBlob(slideCanvases.get(s.id))); }
$('#exportCar').addEventListener('click', async e => {
  const btn = e.currentTarget; btn.disabled = true;
  try {
    await loadScript(LIBS.zip);
    const zip = new JSZip(); const vis = visibleSlides();
    for (let i = 0; i < vis.length; i++) zip.file(`${slug()}-${String(i + 1).padStart(2, '0')}.png`, await toBlob(slideCanvases.get(vis[i].id)));
    const blob = await zip.generateAsync({ type: 'blob' });
    await saveFile(`${slug()}-carousel.zip`, blob);
  } catch (err) { toast('Could not build the ZIP. Check your connection and try again.'); }
  btn.disabled = false;
});
async function renderPosterTo(scale) {
  const size = R.POSTER_SIZES[S.posterSize];
  const cv = document.createElement('canvas'); cv.width = Math.round(size.w * scale); cv.height = Math.round(size.h * scale);
  const g = cv.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, 0);
  R.renderPoster(g, S.poster, posterMeta(), theme(), size, figMap());
  return cv;
}
$('#posterPng').addEventListener('click', async () => {
  const size = R.POSTER_SIZES[S.posterSize];
  const scale = Math.min(1.5, Math.sqrt(15e6 / (size.w * size.h)));
  await saveFile(`${slug()}-poster-preview.png`, await toBlob(await renderPosterTo(scale)));
});
$('#exportPoster').addEventListener('click', async e => {
  const btn = e.currentTarget; btn.disabled = true;
  notice('<span class="busy"><span class="spin"></span> Building the print PDF at 150 dpi…</span>');
  try {
    await loadScript(LIBS.jspdf);
    const { jsPDF } = window.jspdf;
    const size = R.POSTER_SIZES[S.posterSize];
    const scale = 150 / 72, stripPt = 420;
    const pdf = new jsPDF({ orientation: size.w > size.h ? 'landscape' : 'portrait', unit: 'pt', format: [size.w, size.h], compress: true });
    const T = theme(), meta = posterMeta(), figs = figMap();
    for (let y0 = 0; y0 < size.h; y0 += stripPt) {
      const h = Math.min(stripPt, size.h - y0);
      const cv = document.createElement('canvas'); cv.width = Math.round(size.w * scale); cv.height = Math.round(h * scale);
      const g = cv.getContext('2d'); g.setTransform(scale, 0, 0, scale, 0, -y0 * scale);
      R.renderPoster(g, S.poster, meta, T, size, figs);
      pdf.addImage(cv.toDataURL('image/jpeg', 0.94), 'JPEG', 0, y0, size.w, h, undefined, 'FAST');
      await new Promise(r => setTimeout(r, 0));
    }
    notice(S.source.example ? '<strong>Example paper.</strong> This is a fictional study so you can see how the app works. Upload your own PDF to start.' : '');
    await saveFile(`${slug()}-poster-${S.posterSize}.pdf`, pdf.output('blob'));
  } catch (err) { console.error(err); notice('<strong>The poster PDF could not be built.</strong> Try again, or save the PNG preview instead.', 'err'); }
  btn.disabled = false;
});

// ---------- Ask Claude (optional AI layer, uses the viewer's own Claude account) ----------
const AI = { fn: null, ctl: null, chat: [] };
const SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z"/></svg>';
const FACTS = 'Rules: use only facts stated in the paper excerpt below. Copy every number, percentage and statistic exactly as written; never invent, round or estimate numbers. Never mention the excerpt, the paper text, or what it does or does not say; if there is not enough information for a part, use null for it (or keep the current text). Be brief: short sentences, no filler. No emoji, no exclamation marks, no markdown formatting.';
const PLAIN = 'Write in plain, friendly English that a first-year university student would understand.';
function aiCopy(code) {
  return ({ rate_limited: 'You have reached your Claude usage limit for now. Try again later.', session_expired: 'Sign in to Claude again, then try again.', refused: 'Claude could not help with this text. Edit it a little and try again.', prompt_too_large: 'This paper is too long to send in one go.', invalid_json: 'Claude\'s answer came back in the wrong shape. Try again.', empty_completion: 'Claude returned nothing. Try again.', not_granted: 'Claude was not allowed for this page, so the Claude buttons are hidden. Everything else still works.', sampling_disabled: 'Claude is not available for this account.' })[code] || 'Could not reach Claude. Try again.';
}
const AI_OFF = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
function aiDisable(code) { AI.fn = null; toast(aiCopy(code), 4500); renderInspector(); renderAiBar(); if (!$('#checkModal').hidden) renderExtracted(); }
function paperContext(max = 24000) {
  const m = S.model;
  let out = `TITLE: ${m.title}\nAUTHORS: ${(m.authors || []).join(', ')}\n${m.journal || m.year ? `PUBLISHED: ${[m.journal, m.year].filter(Boolean).join(', ')}\n` : ''}${m.doi ? `DOI: ${m.doi}\n` : ''}`;
  for (const k of P2P.ORDER) {
    const s = m.sections[k]; if (!s) continue;
    const body = s.text.length < 2600 ? s.text : (s.ranked || []).slice(0, 9).sort((a, b) => a.order - b.order).map(x => x.text).join(' ');
    out += `\n## ${P2P.LABELS[k]}\n${body.replace(/\n/g, ' ')}\n`;
  }
  for (const tp of (m.topics || [])) {
    const body = tp.text.length < 1800 ? tp.text : (tp.ranked || []).slice(0, 7).sort((a, b) => a.order - b.order).map(x => x.text).join(' ');
    out += `\n## Topic: ${tp.heading}\n${body.replace(/\n/g, ' ')}\n`;
  }
  return out.slice(0, max);
}
function paperText() { return Object.values(S.model.sections).map(s => s.text).join(' ') + ' ' + S.model.title; }
function numberInPaper(big) {
  const nums = String(big || '').match(/\d+(?:[.,]\d+)?/g); if (!nums) return true;
  const txt = paperText().replace(/(\d),(\d{3})/g, '$1$2');
  return nums.every(n => txt.includes(n.replace(/,(\d{3})/g, '$1')));
}
function aiShell(out) {
  out.hidden = false;
  out.innerHTML = '<div class="ai-text"><span class="busy"><span class="spin"></span> Thinking…</span></div><div class="row ai-actions"><button class="btn sm" type="button" data-stop>Stop</button></div>';
  return { txt: out.querySelector('.ai-text'), act: out.querySelector('.ai-actions') };
}
async function ask(input, out, opts = {}) {
  if (!AI.fn) return null;
  AI.ctl?.abort();
  const ctl = AI.ctl = new AbortController();
  const ui = aiShell(out);
  ui.act.querySelector('[data-stop]').onclick = () => ctl.abort();
  try {
    const call = opts.json ? AI.fn.json : AI.fn;
    const r = await call(input, { signal: ctl.signal, modelTier: opts.tier || 'quick', cache: opts.cache ?? true, onText: opts.json ? undefined : ({ text }) => { ui.txt.textContent = text; } });
    ui.act.innerHTML = '';
    if (opts.json) return r;
    ui.txt.textContent = r.text.trim();
    if (r.truncated) ui.act.innerHTML = '<span class="hint">The answer was cut short.</span>';
    return r.text.trim();
  } catch (e) {
    const code = e && e.code;
    ui.txt.textContent = code === 'refused' ? '' : (e && e.text) || (code === 'cancelled' ? 'Stopped.' : '');
    ui.act.innerHTML = code === 'cancelled' ? '' : `<span class="hint">${esc(aiCopy(code))}</span>`;
    if (AI_OFF.includes(code)) aiDisable(code);
    return null;
  } finally { if (AI.ctl === ctl) AI.ctl = null; }
}
function offerUse(out, text, apply) {
  const a = out.querySelector('.ai-actions');
  if (META.test(text)) { a.innerHTML = '<span class="hint">The paper has no more detail for this slide, so it is best kept as it is or edited by hand.</span>'; return; }
  a.innerHTML = '<button class="btn sm primary" type="button" data-use>Use this</button><button class="btn sm" type="button" data-x>Discard</button>';
  a.querySelector('[data-use]').onclick = () => { commit(true); apply(text); scheduleRender(); commit(true); renderInspector(); toast('Updated. Press Undo to go back.'); };
  a.querySelector('[data-x]').onclick = () => { out.hidden = true; };
}
function offerCopy(out, text) {
  const a = out.querySelector('.ai-actions');
  a.innerHTML = '<button class="btn sm primary" type="button" data-copy>Copy</button>';
  a.querySelector('[data-copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(text); toast('Copied'); }
    catch (e) { const r = document.createRange(); r.selectNodeContents(out.querySelector('.ai-text')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Press Ctrl+C to copy the selected text'); }
  };
}
const META = /\b(the|this) (excerpt|paper text|text provided|provided text)\b|\bdoes not (describe|say|mention|cover|list|give)\b|\bnot (stated|mentioned|described) in\b/i;
const cleanLines = t => t.split('\n').map(l => l.replace(/^\s*([-•*–]|\d+[.)])\s*/, '').trim()).filter(Boolean);

// slide inspector box
function aiSlideBox(s) {
  if (!AI.fn) return '';
  let b = '';
  if (s.type === 'hook') b = '<button class="btn sm" type="button" data-ai="hooks">Suggest headlines</button>';
  else if (s.type === 'list') b = '<button class="btn sm" type="button" data-ai="rewrite">Rewrite simply</button><button class="btn sm" type="button" data-ai="explain">Explain the terms</button>';
  else if (s.type === 'cite') b = '<button class="btn sm" type="button" data-ai="caption">Write the post caption</button>';
  else b = '<button class="btn sm" type="button" data-ai="rewrite">Rewrite simply</button><button class="btn sm" type="button" data-ai="explain">Explain the terms</button>';
  return `<div class="ai"><div class="ai-h">${SPARK}<span>Ask Claude</span><span class="hint">uses your Claude account</span></div><div class="row">${b}</div><div class="ai-out" id="aiOut" hidden></div></div>`;
}
function wireAiSlide(s) {
  const box = document.querySelector('#insp .ai'); if (!box) return;
  const out = $('#aiOut');
  box.querySelectorAll('[data-ai]').forEach(btn => btn.addEventListener('click', async () => {
    const kind = btn.dataset.ai;
    if (kind === 'rewrite' && s.type === 'list') {
      const t = await ask(`${FACTS} ${PLAIN}\n\nRewrite these "${s.label}" points for an Instagram carousel slide as exactly 3 short points, each at most 8 words. Reply with one point per line and nothing else.\n\nCurrent points:\n${(s.bullets || []).filter(Boolean).join('\n')}\n\nPaper excerpt:\n${paperContext()}`, out);
      if (t) offerUse(out, t, v => { s.bullets = cleanLines(v).slice(0, 4); });
    } else if (kind === 'rewrite') {
      const lim = s.type === 'stat' ? 18 : s.type === 'figure' ? 20 : 22;
      const t = await ask(`${FACTS} ${PLAIN}\n\nRewrite the text for the "${s.label}" slide of an Instagram carousel about this paper so a non-expert understands it in one read. Keep the meaning${s.big ? ` and keep the number ${s.big} in it` : ''}. At most ${lim} words; fewer is better. Reply with only the new slide text. If the paper gives nothing more for this slide, reply with the current text shortened.\n\nCurrent slide text:\n${s.body}\n\nPaper excerpt:\n${paperContext()}`, out);
      if (t) offerUse(out, t.replace(/^"|"$/g, ''), v => { s.body = v; });
    } else if (kind === 'explain') {
      await ask(`${FACTS} ${PLAIN}\n\nA reader sees this slide and may not know the research terms or statistics in it. Explain each technical term or statistic on its own line, in the form "term: meaning". At most 5 lines. If nothing is technical, say so in one sentence.\n\nSlide text:\n${s.type === 'list' ? (s.bullets || []).join('\n') : [s.big, s.body].filter(Boolean).join('\n')}\n\nPaper excerpt:\n${paperContext(8000)}`, out);
    } else if (kind === 'hooks') {
      const arr = await ask(`${FACTS}\n\nWrite 5 different scroll-stopping headlines for the first slide of an Instagram carousel about this paper. Each at most 10 words and accurate to the paper. Mix styles: a question, a surprising number from the results, a plain statement. Reply with only a JSON array of 5 strings.\n\nPaper excerpt:\n${paperContext()}`, out, { json: true, cache: false });
      if (Array.isArray(arr)) {
        const list = arr.map(String).filter(Boolean).slice(0, 6);
        out.querySelector('.ai-text').innerHTML = '<p class="hint" style="margin:0 0 6px">Pick one to use:</p>' + list.map((h, i) => `<button class="pick" type="button" data-i="${i}">${esc(h)}</button>`).join('');
        out.querySelectorAll('.pick').forEach(p => p.onclick = () => { commit(true); const h = list[+p.dataset.i]; s.hooks = [h, ...s.hooks.filter(x => x !== h)]; s.hookIndex = 0; s.heading = h; scheduleRender(); commit(true); renderInspector(); toast('Headline updated'); });
      }
    } else if (kind === 'caption') {
      const t = await writeCaption(out);
      if (t) offerCopy(out, t);
    }
  }));
}
function writeCaption(out) {
  const m = S.model;
  return ask(`${FACTS} ${PLAIN}\n\nWrite an Instagram caption to go with a carousel that explains this paper. Structure: one hook line; then 2 to 3 short sentences on what the study found and why it matters; then a line crediting ${P2P.shortCite(m) || 'the authors'}${m.journal ? ' in ' + m.journal : ''}; ${m.doi ? `then "Full paper: doi.org/${m.doi}"; ` : ''}then a final line of 4 to 6 relevant hashtags. Plain text with line breaks. Reply with only the caption.\n\nPaper excerpt:\n${paperContext()}`, out, { tier: 'default' });
}

// carousel-wide bar
function renderAiBar() {
  const bar = $('#aiBar'); bar.hidden = !AI.fn; const tb = $('#tAiBar'); if (tb) tb.hidden = !AI.fn; if (!AI.fn && $('#tAiOut')) $('#tAiOut').hidden = true;
  if (!AI.fn) { $('#aiBarOut').hidden = true; }
}
async function polishAll() {
  const out = $('#aiBarOut');
  if (S.model.mode === 'review') return polishReview(out);
  const j = await ask(`${FACTS} ${PLAIN} No hashtags.\n\nRewrite the text of an Instagram carousel (1080x1350 slides) that explains this paper to a general audience. Reply with only this JSON object:\n{"hook": "headline for slide 1, max 10 words", "problem": "why the study was needed, max 22 words", "method": ["3 short points about what the researchers did, max 8 words each"], "sample": {"big": "the sample size exactly as in the paper, e.g. 612", "label": "who took part, max 4 words", "caption": "max 16 words"}, "finding1": {"big": "the single most striking number from the results, copied exactly, e.g. 41%", "caption": "what that number means, max 18 words"}, "finding2": "a second key result, max 20 words", "why": "why it matters, max 22 words", "limitation": "the main limitation, max 18 words"}\nUse null for any part the paper does not support.\n\nPaper excerpt:\n${paperContext()}`, out, { json: true, tier: 'default', cache: false });
  if (!j || typeof j !== 'object') return;
  commit(true);
  ensureRoles();
  const by = r => S.slides.find(s => s.role === r);
  const str = v => (typeof v === 'string' && v.trim() && !META.test(v)) ? v.trim() : null;
  const skipped = []; let n = 0;
  const h = by('hook'); if (h && str(j.hook)) { h.heading = str(j.hook); h.hooks = [h.heading, ...h.hooks.filter(x => x !== h.heading)]; h.hookIndex = 0; n++; }
  const pr = by('problem'); if (pr && str(j.problem)) { pr.body = str(j.problem); n++; }
  const me = by('method'); if (me && Array.isArray(j.method) && j.method.length) { me.bullets = j.method.map(String).filter(Boolean).slice(0, 4); n++; }
  const sa = by('sample'); if (sa && j.sample) { if (str(j.sample.big) || typeof j.sample.big === 'number') { const b = String(j.sample.big); if (numberInPaper(b)) sa.big = b; else skipped.push('sample size'); } if (str(j.sample.label)) sa.bigLabel = str(j.sample.label); if (str(j.sample.caption)) sa.body = str(j.sample.caption); n++; }
  const f1 = by('finding1'); if (f1 && j.finding1) { const b = String(j.finding1.big ?? ''); if (b && numberInPaper(b)) f1.big = b; else if (b) skipped.push('key finding number'); if (str(j.finding1.caption)) f1.body = str(j.finding1.caption); n++; }
  const f2 = by('finding2'); if (f2 && str(j.finding2)) { f2.body = str(j.finding2); n++; }
  const wy = by('why'); if (wy && str(j.why)) { wy.body = str(j.why); n++; }
  const li = by('limits'); if (li && str(j.limitation)) { li.body = str(j.limitation); li.hidden = false; n++; }
  refreshCheat(); scheduleRender(); commit(true); renderInspector();
  out.querySelector('.ai-text').textContent = `Updated ${n} slides.${skipped.length ? ` Kept the original ${skipped.join(' and ')} because Claude's number was not found in the paper.` : ''} Press Undo to go back.`;
}
async function polishReview(out) {
  const pts = S.slides.filter(s => s.role === 'topic');
  const j = await ask(`${FACTS} ${PLAIN} No hashtags.\n\nThis paper is a review article. Rewrite the text of an Instagram carousel that teaches its key points to a general audience. Reply with only this JSON object:\n{"hook": "headline for slide 1, max 10 words", "overview": "why this topic matters, max 22 words", "points": [${pts.map(p => `{"heading": "max 5 words, about: ${p.heading.replace(/"/g, '')}", "text": "the single most useful fact about this topic, max 20 words"}`).join(', ')}], "takeaway": "the bottom line, max 20 words"}\nKeep the points in the same order and about the same topics.\n\nPaper excerpt:\n${paperContext()}`, out, { json: true, tier: 'default', cache: false });
  if (!j || typeof j !== 'object') return;
  commit(true);
  const str = v => (typeof v === 'string' && v.trim() && !META.test(v)) ? v.trim() : null;
  let n = 0;
  const h = S.slides.find(s => s.role === 'hook'); if (h && str(j.hook)) { h.heading = str(j.hook); h.hooks = [h.heading, ...h.hooks.filter(x => x !== h.heading)]; h.hookIndex = 0; n++; }
  const ov = S.slides.find(s => s.role === 'problem'); if (ov && str(j.overview)) { ov.body = str(j.overview); n++; }
  (Array.isArray(j.points) ? j.points : []).forEach((p, i) => { const sl = pts[i]; if (!sl || !p) return; if (str(p.heading)) sl.heading = str(p.heading); if (str(p.text)) { sl.body = str(p.text); n++; } });
  const tk = S.slides.find(s => s.role === 'why'); if (tk && str(j.takeaway)) { tk.body = str(j.takeaway); n++; }
  refreshCheat(); scheduleRender(); commit(true); renderInspector();
  out.querySelector('.ai-text').textContent = `Updated ${n} slides. Press Undo to go back.`;
}
function ensureRoles() {
  let t = 0;
  for (const s of S.slides) {
    if (s.role) continue;
    if (s.type === 'hook' || s.type === 'cite') s.role = s.type;
    else if (s.type === 'list') s.role = 'method';
    else if (s.type === 'figure') s.role = 'finding2';
    else if (s.type === 'stat') s.role = s.bigLabel ? 'sample' : 'finding1';
    else if (s.type === 'text') s.role = ['problem', 'why', 'limits'][t++] || 'text';
  }
}
$('#aiPolish').addEventListener('click', polishAll);
$('#aiCaption').addEventListener('click', async () => { const out = $('#aiBarOut'); const t = await writeCaption(out); if (t) offerCopy(out, t); });

// poster blocks
function aiPosterBtn(b) { return AI.fn && ['text', 'callout', 'bullets'].includes(b.kind) ? `<div class="row"><button class="btn sm" type="button" data-aip="${b.id}">${SPARK}Rewrite with Claude</button></div><div class="ai-out" data-aio="${b.id}" hidden></div>` : ''; }
function wireAiPoster(el) {
  el.querySelectorAll('[data-aip]').forEach(btn => btn.addEventListener('click', async () => {
    const b = S.poster.blocks.find(x => x.id === btn.dataset.aip);
    const out = el.querySelector(`[data-aio="${b.id}"]`);
    const ctx = `\n\nPaper excerpt:\n${paperContext()}`;
    let t;
    if (b.kind === 'callout') t = await ask(`${FACTS}\n\nWrite the key takeaway of this paper for an academic conference poster as one clear sentence of at most 25 words. Reply with only the sentence.${ctx}`, out);
    else if (b.kind === 'bullets') t = await ask(`${FACTS}\n\nRewrite the "${b.heading}" section of an academic conference poster as 3 or 4 concise points, each at most 18 words, for a mixed academic audience. Reply with one point per line and nothing else.\n\nCurrent points:\n${b.bullets.filter(Boolean).join('\n')}${ctx}`, out);
    else t = await ask(`${FACTS}\n\nRewrite the "${b.heading}" section of an academic conference poster so it is clear and concise for a mixed academic audience. At most ${Math.max(40, Math.min(90, P2P.wc(b.text)))} words. Keep statistics exactly. Reply with only the section text.\n\nCurrent text:\n${b.text}${ctx}`, out);
    if (t) offerUse(out, t, v => { if (b.kind === 'bullets') b.bullets = cleanLines(v).slice(0, 5); else b.text = v.replace(/^"|"$/g, ''); });
  }));
}

// paper Q&A on the "What the app found" tab
function aiPaperCard() {
  if (!AI.fn) return '';
  const turns = AI.chat.map(t => `<div class="q">${esc(t.q)}</div><div class="a">${esc(t.a || '')}</div>`).join('');
  return `<div class="card ai-card"><h3>${SPARK} Ask Claude about this paper</h3><p class="hint">Uses your own Claude account. Answers are based only on the text the app read from the PDF.</p><div class="row"><button class="btn sm" type="button" data-q="Explain this paper simply in 5 short lines starting with '- ': what was studied, who took part, what was found (with the key numbers), why it matters, and the main limitation.">Explain this paper simply</button><button class="btn sm" type="button" data-q="Explain the study design and each statistic reported in the results in plain language, one short line each starting with '- '.">Explain the methods and statistics</button></div><div class="ai-chat" id="aiChat">${turns}</div><form class="row" id="aiAsk"><input type="text" id="aiQ" placeholder="Ask a question, for example: Who took part?" style="flex:1;min-width:0"><button class="btn sm primary" type="submit">Ask</button></form></div>`;
}
function wireAiPaper() {
  const card = document.querySelector('.ai-card'); if (!card) return;
  const go = async q => {
    if (!q.trim()) return;
    const turn = { q: q.trim(), a: '' }; AI.chat.push(turn);
    const chat = $('#aiChat');
    chat.insertAdjacentHTML('beforeend', `<div class="q">${esc(turn.q)}</div><div class="a"></div>`);
    const out = chat.lastElementChild;
    const msgs = [];
    AI.chat.forEach((t, i) => {
      msgs.push({ role: 'user', content: i === 0 ? `${FACTS} ${PLAIN} Answer questions about this paper. If the excerpt does not say, reply that the paper text does not say. Keep answers short.\n\nPaper excerpt:\n${paperContext()}\n\nQuestion: ${t.q}` : t.q });
      if (t !== turn) msgs.push({ role: 'assistant', content: t.a || '(no answer)' });
    });
    const a = await ask(msgs, out, { tier: 'default', cache: false });
    const tx = out.querySelector('.ai-text'); turn.a = a || (tx ? tx.textContent : '');
    if (!a) { AI.chat = AI.chat.filter(t => t !== turn || t.a); }
    out.scrollIntoView({ block: 'nearest' });
  };
  card.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => go(b.dataset.q)));
  $('#aiAsk').addEventListener('submit', e => { e.preventDefault(); const q = $('#aiQ').value; $('#aiQ').value = ''; go(q); });
}

(async () => {
  try { AI.fn = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { AI.fn = null; }
  if (AI.fn) { renderAiBar(); renderInspector(); if (!$('#checkModal').hidden) renderExtracted(); }
})();

// ---------- animation preview & video ----------
const TR = 0.45, FPS = 30;
const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function slideDuration(s) {
  if (s.type === 'hook') return 3.6;
  if (s.type === 'cite') return 4.5;
  const words = P2P.wc(s.body || '') + (s.bullets || []).reduce((a, b) => a + P2P.wc(b), 0) + P2P.wc(s.heading || '');
  return Math.min(8, Math.max(3.5, R.animEnd(s) + 1.0 + words * 0.2));
}
let playRaf = 0;
function playSlide(s) {
  cancelAnimationFrame(playRaf);
  const vis = visibleSlides(), k = Math.max(0, vis.indexOf(s)), n = Math.max(1, vis.length);
  const end = R.animEnd(s) + 0.4, t0 = performance.now(), cv = $('#bigSlide');
  const data = { footer: footerText(), keywords: S.model.keywords, meta: metaOf(S.model), brand: brandCtx(), stats: sheetStats(), figure: figImg(s.figureId) };
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    if (S.slides[S.sel.slide] !== s || t >= end) { drawBig(); return; }
    R.renderSlide(cv, s, k, n, theme(), data, t);
    playRaf = requestAnimationFrame(tick);
  };
  if (S.sel.tab === 'carousel') cv.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  tick();
}
async function buildVideo(progress, story) {
  renderCanvases();
  const vis = visibleSlides(), T = theme(), W = 1080, H = 1350;
  if (!vis.length) throw new Error('no slides');
  const base = { footer: footerText(), keywords: S.model.keywords, meta: metaOf(S.model), brand: brandCtx(), stats: sheetStats() };
  const plan = []; let total = 0;
  vis.forEach((s, j) => { const d = slideDuration(s) + (j ? TR : 0); plan.push({ s, start: total }); total += d; });
  const frames = Math.ceil(total * FPS);
  const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
  const work = document.createElement('canvas'); work.width = W; work.height = H;
  const EW = W, EH = story ? 1920 : H;
  const encCv = story ? document.createElement('canvas') : out;
  if (story) { encCv.width = EW; encCv.height = EH; }
  const sg = story ? encCv.getContext('2d') : null, sMeta = metaOf(S.model);
  const frame = f => { drawFrame(f); if (story) R.renderStory(sg, out, T, base.brand, sMeta); };
  const drawFrame = f => {
    const t = f / FPS; let k = plan.length - 1; while (k > 0 && plan[k].start > t) k--;
    const p = plan[k], local = t - p.start, at = local - (k ? TR : 0);
    let cur;
    if (at > R.animEnd(p.s) + 0.1) cur = slideCanvases.get(p.s.id);
    else { R.renderSlide(work, p.s, k, vis.length, T, { ...base, figure: figImg(p.s.figureId) }, Math.max(0, at)); cur = work; }
    g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
    if (k && local < TR) { const e = easeIO(local / TR); g.drawImage(slideCanvases.get(plan[k - 1].s.id), -e * W, 0); g.drawImage(cur, (1 - e) * W, 0); }
    else g.drawImage(cur, 0, 0);
  };
  // fast path: encode frame by frame (Chrome, Edge, Safari 16.4+, recent Firefox)
  if (window.VideoEncoder && window.VideoFrame) {
    let codec = null;
    for (const c of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
      try { const r = await VideoEncoder.isConfigSupported({ codec: c, width: EW, height: EH, bitrate: 7e6, framerate: FPS }); if (r.supported) { codec = c; break; } } catch (e) {}
    }
    if (codec) {
      await loadScript(LIBS.mp4);
      const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: EW, height: EH }, fastStart: 'in-memory' });
      let err = null;
      const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { err = e; } });
      enc.configure({ codec, width: EW, height: EH, bitrate: 7e6, framerate: FPS });
      for (let f = 0; f < frames; f++) {
        if (err) throw err;
        frame(f);
        const fr = new VideoFrame(encCv, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
        enc.encode(fr, { keyFrame: f % (FPS * 2) === 0 }); fr.close();
        while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
        if (f % 10 === 0) { progress(f / frames); await new Promise(r => setTimeout(r, 0)); }
      }
      await enc.flush(); muxer.finalize();
      if (err) throw err;
      return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
    }
  }
  // slower path: record the canvas in real time
  if (!encCv.captureStream || !window.MediaRecorder) throw new Error('unsupported');
  const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('unsupported');
  const rec = new MediaRecorder(encCv.captureStream(FPS), { mimeType: mime, videoBitsPerSecond: 7e6 });
  const chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  frame(0); rec.start(250);
  const t0 = performance.now();
  await new Promise(res => { const tick = () => { const el = (performance.now() - t0) / 1000; if (el >= total) return res(); frame(Math.min(frames - 1, Math.floor(el * FPS))); progress(el / total); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  rec.stop(); await stopped;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}
function defaultNotice() { notice(S.source.example ? '<strong>Example paper.</strong> This is a fictional study so you can see how the app works. Upload your own PDF to start.' : ''); }
$('#exportVideo').addEventListener('click', async e => {
  const btn = e.currentTarget; btn.disabled = true;
  const secs = Math.round(visibleSlides().reduce((a, s, j) => a + slideDuration(s) + (j ? TR : 0), 0));
  notice(`<span class="busy"><span class="spin"></span> Making your ${secs}-second video… <strong id="vidPct">0%</strong></span>`);
  try {
    const { blob, ext } = await buildVideo(p => { const el = $('#vidPct'); if (el) el.textContent = Math.round(p * 100) + '%'; }, videoStory);
    defaultNotice();
    await saveFile(`${slug()}-${videoStory ? 'reel-9x16' : 'carousel-4x5'}.${ext}`, blob);
  } catch (err) {
    console.error(err);
    notice('<strong>This browser could not make the video.</strong> Try Chrome on a computer, or save the carousel images instead.', 'err');
  }
  btn.disabled = false;
});

// ---------- brand controls ----------
function bindBrand() {
  $('#bSeries').addEventListener('input', e => {
    S.brand.series = e.target.value; saveBrand();
    const h = S.slides.find(s => s.role === 'hook');
    if (h) h.label = S.brand.series.trim() || (S.cfg.author ? (S.model.mode === 'review' ? 'Our new review' : 'Our new research') : (S.model.mode === 'review' ? 'Review' : 'New research'));
    scheduleRender(); commit();
  });
  $('#bAvatar').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      const im = new Image(); im.src = r.result;
      try { await im.decode(); } catch (err) { toast('That image could not be read.'); return; }
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const sc = Math.max(256 / im.width, 256 / im.height);
      c.getContext('2d').drawImage(im, (256 - im.width * sc) / 2, (256 - im.height * sc) / 2, im.width * sc, im.height * sc);
      await setAvatar(c.toDataURL('image/jpeg', 0.88)); saveBrand(); scheduleRender(); toast('Profile photo added');
    };
    r.readAsDataURL(f);
  });
  $('#bAvDel').addEventListener('click', async () => { await setAvatar(''); saveBrand(); scheduleRender(); });
  $('#bLogo').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      const im = new Image(); im.src = r.result;
      try { await im.decode(); } catch (err) { toast('That image could not be read.'); return; }
      const sc = Math.min(1, 600 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      await setLogo(c.toDataURL('image/png')); saveBrand(); scheduleRender(); toast('Logo added to the talk slides and the Story poster');
    };
    r.readAsDataURL(f);
  });
  $('#bLogoDel').addEventListener('click', async () => { await setLogo(''); saveBrand(); scheduleRender(); });
  $('#bColor').addEventListener('input', e => { S.brand.accent = e.target.value; saveBrand(); colorHint(); renderThemes(); scheduleRender(); });
  $('#bColorReset').addEventListener('click', () => { S.brand.accent = ''; saveBrand(); colorHint(); renderThemes(); scheduleRender(); });
  $('#cAud').addEventListener('change', e => { S.cfg.audience = e.target.value; saveBrand(); applyVoice(); toast('Headlines updated for this audience'); });
  document.querySelectorAll('input[name=voice]').forEach(r => r.addEventListener('change', () => { S.cfg.author = $('#vAuthor').checked; saveBrand(); applyVoice(); toast(S.cfg.author ? 'Wording changed to "we" and "our"' : 'Wording changed to credit the authors'); }));
}

// ---------- post kit (captions, alt text, LinkedIn, thread, summary, licence) ----------
const plain = t => String(t || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
function hashtags(n = 7) {
  const kw = (S.model.keywords || []).slice(0, 4).map(k => '#' + k.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')).filter(t => t.length > 3);
  const aud = { students: ['#StudyNotes', '#UniLife'], clinicians: ['#MedEd', '#FOAMed'], researchers: ['#AcademicTwitter', '#ResearchSummary'], public: ['#ScienceExplained'] }[S.cfg.audience] || [];
  return [...new Set([...kw, ...aud, '#Research'])].slice(0, n);
}
function creditLine() {
  const m = S.model, cite = P2P.shortCite(m);
  if (S.cfg.author) return `Our ${m.mode === 'review' ? 'review' : 'paper'}: "${m.title}"${m.journal ? `, ${m.journal}` : ''}${m.year ? ` (${m.year})` : ''}.`;
  return `Paper: "${m.title}" by ${cite || 'the authors'}${m.journal ? `, ${m.journal}` : ''}. All credit to the authors.`;
}
function keyPoints(max = 4) {
  return visibleSlides().filter(s => ['problem', 'finding1', 'finding2', 'why', 'topic', 'sample'].includes(s.role)).slice(0, max)
    .map(s => (s.role === 'topic' ? plain(s.heading) + ': ' : '') + plain(s.body)).filter(Boolean);
}
function kitCaption() {
  const m = S.model, hook = plain((visibleSlides().find(s => s.role === 'hook') || {}).heading || m.title);
  const pts = keyPoints(3);
  return [hook, '', ...pts.map(p => '• ' + p), '', creditLine(), m.doi ? `Full paper: doi.org/${m.doi}` : '', '', P2P.ctaFor(S.cfg), '', hashtags().join(' ')].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}
function kitAlt() {
  const vis = visibleSlides(), n = vis.length, m = S.model;
  return vis.map((s, i) => {
    let d = '';
    if (s.type === 'hook') d = plain(s.heading);
    else if (s.type === 'stat') d = `${plain(s.big)} ${plain(s.bigLabel)}. ${plain(s.body)}`;
    else if (s.type === 'list') d = `${plain(s.heading)}: ${(s.bullets || []).filter(Boolean).map(plain).join('; ')}.`;
    else if (s.type === 'cheat') d = `${plain(s.heading)}. ${(s.items || []).map(it => `${plain(it.title)}: ${plain(it.text)}`).join('. ')}.`;
    else if (s.type === 'cite') d = `Citation: ${m.title}, by ${(m.authors || []).join(', ')}${m.journal ? '. ' + m.journal : ''}${m.year ? ', ' + m.year : ''}.${m.doi ? ' DOI ' + m.doi + '.' : ''}`;
    else { d = `${plain(s.heading)}. ${plain(s.body)}`; const st = (s.steps || []).filter(Boolean); if (st.length) d += ` Steps: ${st.map(plain).join(', ')}.`; if (s.type === 'figure' && s.figureId) d += ' Includes a figure from the paper.'; }
    return `Slide ${i + 1} of ${n}. ${d.replace(/\s+/g, ' ').trim()}`;
  }).join('\n\n');
}
function kitLinkedIn() {
  const m = S.model, hook = plain((visibleSlides().find(s => s.role === 'hook') || {}).heading || m.title);
  return [hook, '', ...keyPoints(4).map(p => '→ ' + p), '', creditLine(), m.doi ? `doi.org/${m.doi}` : '', '', S.cfg.author ? 'I would love to hear how this applies to your work.' : 'What stood out to you?', '', hashtags(3).join(' ')].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}
function kitThread() {
  const vis = visibleSlides().filter(s => !['cheat'].includes(s.type));
  const posts = [];
  const hook = plain((vis.find(s => s.role === 'hook') || {}).heading || S.model.title);
  posts.push(`${hook} A thread:`);
  for (const s of vis) {
    if (s.type === 'hook' || s.type === 'cite') continue;
    let t = s.type === 'stat' ? `${plain(s.big)} ${plain(s.bigLabel)}: ${plain(s.body)}` : s.type === 'list' ? `${plain(s.heading)}: ${(s.bullets || []).filter(Boolean).map(plain).join('; ')}` : `${plain(s.heading)}: ${plain(s.body)}`;
    const st = (s.steps || []).filter(Boolean); if (st.length) t += ` (${st.map(plain).join(' → ')})`;
    posts.push(t);
  }
  posts.push(`${creditLine()}${S.model.doi ? ' doi.org/' + S.model.doi : ''}`);
  const n = posts.length;
  return posts.map((p, i) => { const tag = ` ${i + 1}/${n}`; return (p.length + tag.length > 280 ? p.slice(0, 276 - tag.length).replace(/\s+\S*$/, '') + '…' : p) + tag; }).join('\n\n');
}
function kitSummary() {
  const by = r => visibleSlides().find(s => s.role === r);
  const parts = [];
  if (S.model.mode === 'review') {
    const o = by('problem'); if (o) parts.push(plain(o.body));
    visibleSlides().filter(s => s.role === 'topic').slice(0, 3).forEach(s => parts.push(plain(s.body)));
    const w = by('why'); if (w) parts.push(plain(w.body));
  } else {
    ['problem', 'sample', 'finding1', 'finding2', 'why', 'limits'].forEach(r => { const s = by(r); if (s && s.body && !/^Add a limitation/.test(s.body)) parts.push(plain(s.body)); });
  }
  return [...new Set(parts)].join(' ');
}
function licenceInfo() {
  const lic = S.model.license || '';
  if (S.cfg.author) return { ok: true, title: 'You are an author', text: `You can share your own work. If you reuse published figures, check your publisher's reuse policy first.${lic ? ' Licence found in the PDF: ' + lic + '.' : ''}` };
  if (/CC BY/i.test(lic)) {
    const nd = /ND/i.test(lic), nc = /NC/i.test(lic);
    return { ok: !nd, title: `Licence found: ${lic}`, text: `You can share this paper${nd ? ', but not adapted versions, so keep figures unchanged and avoid edited excerpts' : ' and adapt it, including its figures'}, as long as you credit the authors and link the DOI.${nc ? ' Non-commercial use only: do not use it in paid or sponsored posts.' : ''}` };
  }
  return { ok: false, title: lic ? lic : 'No open licence found in the PDF', text: 'Credit the authors clearly and link the DOI. Summarising the findings in your own words is generally fine, but do not reuse their figures without permission. The app checks only the PDF text, so confirm the licence on the journal\'s website.' };
}
function copyText(text, ta) {
  const done = () => toast('Copied');
  const fail = () => { if (ta) { ta.focus(); ta.select(); toast('Press Ctrl+C to copy'); } else toast('Copying is blocked here. Copy the text from the Post kit tab instead.', 4200); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fail);
  else fail();
}
function prepubWarn() {
  if (!S.cfg.author || (S.model && S.model.doi)) return '';
  return `<div class="kitb lic warn"><h3>Unpublished findings? Check before you post</h3><p class="hint" style="margin:0">This paper has no DOI, so it may not be published yet. Some journals treat public posts of results as prior publication. Check your target journal's preprint and social media policy, and your supervisor's view, before posting.</p></div>`;
}
function renderKit() {
  const li = licenceInfo();
  const blocks = [
    ['caption', 'Instagram caption', kitCaption(), 12, 'Paste under your carousel or video.'],
    ['first', 'First comment', `${creditLine()}${S.model.doi ? '\nFull paper: https://doi.org/' + S.model.doi : ''}`, 3, 'Post this as the first comment so the link is easy to find.'],
    ['alt', 'Alt text for each slide', kitAlt(), 10, 'Instagram: Advanced settings, then Write alt text. This helps screen-reader users and search.'],
    ['li', 'LinkedIn post', kitLinkedIn(), 10, 'Pair it with the LinkedIn carousel PDF from the Export menu.'],
    ['thread', 'X or Bluesky thread', kitThread(), 10, 'Each post is under 280 characters.'],
    ['summary', 'Plain-language summary', kitSummary(), 6, 'Useful for journal submissions, funders and your website.'],
  ];
  let h = prepubWarn() + `<div class="kitb lic ${li.ok ? '' : 'warn'}"><h3>${esc(li.title)}</h3><p class="hint" style="margin:0">${esc(li.text)}</p></div>`;
  h += `<p class="hint" style="margin:0">Written from your current slides each time you open this tab. Edit freely before copying.</p>`;
  for (const [id, title, text, rows, hint] of blocks) {
    h += `<div class="kitb"><h3><span>${title}</span><span class="row">${id === 'summary' && AI.fn ? `<button class="btn sm" type="button" data-kai="summary">${SPARK}Rewrite with Claude</button>` : ''}<button class="btn sm primary" type="button" data-copy="${id}">Copy</button></span></h3><p class="hint" style="margin:0">${hint}</p><textarea id="kit-${id}" rows="${rows}">${esc(text)}</textarea><div class="ai-out" data-kout="${id}" hidden></div></div>`;
  }
  if (AI.fn) h += `<div class="kitb"><h3><span>${SPARK} Revision quiz</span><button class="btn sm" type="button" data-kai="quiz">Make 5 questions with Claude</button></h3><p class="hint" style="margin:0">Multiple-choice questions for a Story poll or a revision post.</p><div class="ai-out" data-kout="quiz" hidden></div></div>`;
  $('#kit').innerHTML = h;
  $('#kit').querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => { const ta = $('#kit-' + b.dataset.copy); copyText(ta.value, ta); }));
  $('#kit').querySelectorAll('[data-kai]').forEach(b => b.addEventListener('click', async () => {
    const kind = b.dataset.kai, out = $(`[data-kout="${kind}"]`);
    if (kind === 'summary') {
      const t = await ask(`${FACTS} ${PLAIN}\n\nWrite a plain-language summary of this paper in 80 to 120 words for the general public: what was studied, how, what was found, and why it matters. Reply with only the summary.\n\nPaper excerpt:\n${paperContext()}`, out, { tier: 'default' });
      if (t && !META.test(t)) { const a = out.querySelector('.ai-actions'); a.innerHTML = '<button class="btn sm primary" type="button">Use this</button>'; a.firstChild.onclick = () => { $('#kit-summary').value = t; out.hidden = true; }; }
    } else {
      const t = await ask(`${FACTS}\n\nWrite 5 multiple-choice revision questions about this paper for ${({ students: 'students', clinicians: 'junior doctors', researchers: 'researchers', public: 'the general public' })[S.cfg.audience]}. Each question has options A to D and then "Answer: X" on its own line. Base every question on facts in the excerpt. Plain text.\n\nPaper excerpt:\n${paperContext()}`, out, { tier: 'default', cache: false });
      if (t) offerCopy(out, t);
    }
  }));
}

// ---------- export menu ----------
let videoStory = false;
const menu = $('#exportMenu'), exBtn = $('#exportBtn');
function closeMenu() { menu.hidden = true; exBtn.setAttribute('aria-expanded', 'false'); }
exBtn.addEventListener('click', e => { e.stopPropagation(); const open = menu.hidden; menu.hidden = !open; exBtn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button').focus(); });
document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { closeMenu(); exBtn.focus(); } });
menu.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; closeMenu(); runExport(b.dataset.x); });
function runExport(x) {
  if (x === 'share') openShare();
  else if (x === 'rehearse') { renderTalk(); openRehearse(); }
  else if (x === 'zip') $('#exportCar').click();
  else if (x === 'video45') { videoStory = false; $('#exportVideo').click(); }
  else if (x === 'video916') { videoStory = true; $('#exportVideo').click(); }
  else if (x === 'poster') $('#exportPoster').click();
  else if (x === 'posterpng') $('#posterPng').click();
  else if (x === 'lipdf') exportLinkedIn();
  else if (x === 'ga') exportGA();
  else if (x === 'pptx') exportTalkPptx('office');
  else if (x === 'pptxtheme') exportTalkPptx('theme');
  else if (x === 'talkpdf') exportTalkPdf();
  else if (x === 'script') exportScript();
  else if (x === 'scriptmd') exportScriptText();
}
async function exportLinkedIn() {
  notice('<span class="busy"><span class="spin"></span> Building the LinkedIn PDF…</span>');
  try {
    await loadScript(LIBS.jspdf); renderCanvases();
    const { jsPDF } = window.jspdf, vis = visibleSlides();
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [810, 1012.5], compress: true });
    vis.forEach((s, i) => { if (i) pdf.addPage([810, 1012.5], 'portrait'); pdf.addImage(slideCanvases.get(s.id).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 810, 1012.5, undefined, 'FAST'); });
    defaultNotice();
    await saveFile(`${slug()}-linkedin-carousel.pdf`, pdf.output('blob'));
  } catch (err) { console.error(err); notice('<strong>The LinkedIn PDF could not be built.</strong> Check your connection and try again.', 'err'); }
}
async function exportGA() {
  const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
  const cheat = S.slides.find(s => s.type === 'cheat');
  const items = cheat && cheat.items && cheat.items.length ? cheat.items : P2P.cheatFrom(S.slides, S.model.mode === 'review');
  R.renderGA(cv.getContext('2d'), { meta: posterMeta(), items, flow: S.model.mode !== 'review', cite: P2P.shortCite(S.model) }, theme());
  await saveFile(`${slug()}-graphical-abstract.png`, await toBlob(cv));
}

// ---------- talk: presenter slides and speaker script ----------
const talkCanvases = new Map();
const TALK_KIND = { title: 'Title', text: 'Text', bullets: 'Bullet points', flow: 'Steps', prisma: 'Study selection', stat: 'Big number', table: 'Results table', list: 'Numbered points', statement: 'Big statement', end: 'Thank you', outline: 'Presentation outline', numbered: 'Numbered list', framework: 'Research framework', grid: 'Table', gantt: 'Timeline' };
function ensureTalk() {
  if (!S.talk || !Array.isArray(S.talk.slides)) S.talk = { ...P2P.buildTalk(S.model, talkCfg()), edited: false };
  const key = S.talk.slides.find(x => x.kind === 'stat' && /key result/i.test(x.title));
  if (key && key.figureId === undefined) key.figureId = S.figures[0] ? S.figures[0].id : null;
  if (S.sel.talk == null || S.sel.talk >= S.talk.slides.length) S.sel.talk = 0;
}
const TALK_MIN = { paper: 10, proposal: 20, thesis: 30 };
function talkCfg(minutes) { const type = S.cfg.talkType || 'paper'; return { ...S.cfg, type, author: type === 'paper' ? S.cfg.author : true, presenter: S.cfg.presenter || '', minutes: minutes || TALK_MIN[type] }; }
function rebuildTalk(minutes) {
  const ev = S.talk && S.talk.event, sty = S.talk && S.talk.style;
  S.talk = { ...P2P.buildTalk(S.model, talkCfg(minutes)), edited: false, event: ev || '', style: sty || 'classic' };
  S.sel.talk = 0; ensureTalk();
}
const visibleTalk = () => S.talk.slides.filter(s => !s.hidden);
const talkSec = s => P2P.talkSeconds(s, S.talk.wpm || 130);
const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
function talkCtx(s) { return { meta: posterMeta(), figure: figImg(s.figureId), presenter: (S.cfg.presenter || '').trim(), eyebrow: S.talk.event || '', logo: logoImg, style: S.talk.style || 'classic' }; }
const talkWarn = {};
function drawTalkSlide(cv, s, rec) {
  const vis = visibleTalk(); const idx = s.hidden ? vis.length - 1 : vis.indexOf(s);
  let sx = s;
  if (s.part) { const ol = S.talk.slides.find(x => x.kind === 'outline'), items = ol ? ol.items || [] : [], k = items.findIndex(x => x.trim().toLowerCase() === s.part.toLowerCase()); sx = { ...s, section: k >= 0 ? k + 1 : 0, sections: items.length }; }
  const w = R.renderTalkSlide(cv, sx, Math.max(0, idx), Math.max(1, vis.length), theme(), { ...talkCtx(s), rec });
  if (!rec) talkWarn[s.id] = w || [];
  return w;
}
function renderTalk() {
  ensureTalk();
  for (const s of S.talk.slides) { let cv = talkCanvases.get(s.id); if (!cv) { cv = document.createElement('canvas'); talkCanvases.set(s.id, cv); } drawTalkSlide(cv, s); }
  drawTalkStrip(); drawTalkBig(); talkTiming();
  $('#ctTalk').textContent = visibleTalk().length;
}
function drawTalkStrip() {
  const strip = $('#tStrip'), sl = S.talk.slides, vis = visibleTalk();
  if (strip.children.length !== sl.length) {
    strip.innerHTML = '';
    sl.forEach((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'thumb';
      b.innerHTML = '<canvas width="320" height="180"></canvas><span class="cap"></span>';
      b.addEventListener('click', () => { S.sel.talk = i; drawTalkStrip(); drawTalkBig(); talkTiming(); renderInspector(); });
      strip.append(b);
    });
  }
  [...strip.children].forEach((b, i) => {
    const s = sl[i], c = b.querySelector('canvas'); c.getContext('2d').drawImage(talkCanvases.get(s.id), 0, 0, 320, 180);
    b.classList.toggle('off', !!s.hidden); b.setAttribute('aria-current', i === S.sel.talk);
    const n = s.hidden ? '—' : String(vis.indexOf(s) + 1).padStart(2, '0');
    const cf = s.conf ? s.conf.how : '';
    b.querySelector('.cap').innerHTML = `${cf ? `<i class="conf ${cf}" title="${cf === 'heading' ? 'Found under a matching heading' : cf === 'guess' ? 'Guessed by the app: check it' : 'Not found: placeholder'}"></i>` : ''}<span class="n">${n}</span><span>${esc(s.title)}${s.optional && s.hidden ? ' (optional)' : ''}</span>${(talkWarn[s.id] || []).length ? '<i class="dotw" title="Needs attention"></i>' : ''}`;
    b.setAttribute('aria-label', `Talk slide ${n}: ${s.title}`);
  });
}
function drawTalkBig() {
  const s = S.talk.slides[S.sel.talk]; if (!s) return;
  $('#tBig').getContext('2d').drawImage(talkCanvases.get(s.id), 0, 0);
  const ta = $('#tNotes'); if (document.activeElement !== ta) ta.value = s.notes || '';
  $('#tPrev').disabled = S.sel.talk === 0; $('#tNext').disabled = S.sel.talk === S.talk.slides.length - 1;
}
function talkTiming() {
  const vis = visibleTalk(), tot = vis.reduce((a, s) => a + talkSec(s), 0), target = (S.talk.minutes || 10) * 60;
  const r = tot / target, cls = r < 0.7 || r > 1.12 ? 'warn' : 'good';
  $('#tEst').className = 'chip ' + cls; $('#tEst').textContent = `About ${mmss(tot)} of ${S.talk.minutes} min`;
  $('#tMin').value = String(S.talk.minutes || 10); $('#tType').value = S.talk.type || 'paper'; S.cfg.talkType = S.talk.type || 'paper'; $('#tStyle').value = S.talk.style || 'classic';
  const s = S.talk.slides[S.sel.talk];
  $('#tSlideTime').textContent = s ? `${P2P.wc ? P2P.wc(s.notes || '') : 0} words · about ${mmss(talkSec(s))}${s.hidden ? ' · hidden slide' : ''}` : '';
  $('#tTime').innerHTML = vis.map(x => `<span style="flex:${talkSec(x)}" class="${x === s ? 'on' : ''}" title="${esc(x.title)} · ${mmss(talkSec(x))}"></span>`).join('');
  let hint = '';
  if (r < 0.7) hint = `The script is short for a ${S.talk.minutes}-minute slot. Add examples or detail to the script${S.talk.edited ? '' : ', or the app can add more from the paper'}${AI.fn ? ', or let Claude expand it' : ''}.`;
  else if (r > 1.12) hint = `The script runs over ${S.talk.minutes} minutes. Hide a slide or shorten the script${AI.fn ? ', or let Claude tighten it' : ''}.`;
  $('#tHint').textContent = hint; $('#tHint').hidden = !hint;
  $('#tFill').hidden = !(r < 0.7 && !S.talk.edited && S.talk.minutes < 20);
}
$('#tMin').addEventListener('change', e => {
  const m = +e.target.value;
  if (!S.talk.edited) { rebuildTalk(m); S.talk.minutes = m; renderTalk(); renderInspector(); commit(true); return; }
  S.talk.minutes = m; talkTiming(); commit(true);
});
$('#tStyle').addEventListener('change', e => { S.talk.style = e.target.value; renderTalk(); commit(true); });
$('#tType').addEventListener('change', e => {
  commit(true); const was = S.talk.edited;
  S.cfg.talkType = e.target.value; saveBrand(); rebuildTalk(); $('#tStrip').innerHTML = ''; talkCanvases.clear();
  renderTalk(); renderInspector(); commit(true);
  toast(was ? 'Rebuilt for the new outline. Press Undo to get your edited version back.' : ({ paper: 'Talk outline', proposal: 'Proposal defence outline', thesis: 'Thesis defence outline' })[S.cfg.talkType] + ' ready', 4200);
});
$('#tFill').addEventListener('click', () => { const m = S.talk.minutes; rebuildTalk(S.talk.type === 'paper' ? 20 : 30); S.talk.minutes = m; renderTalk(); renderInspector(); commit(true); toast('Added more detail from the paper to the script'); });
$('#tNotes').addEventListener('input', e => { const s = S.talk.slides[S.sel.talk]; if (!s) return; s.notes = e.target.value; S.talk.edited = true; talkTiming(); commit(); });
$('#tPrev').addEventListener('click', () => { S.sel.talk = Math.max(0, S.sel.talk - 1); drawTalkStrip(); drawTalkBig(); talkTiming(); renderInspector(); });
$('#tNext').addEventListener('click', () => { S.sel.talk = Math.min(S.talk.slides.length - 1, S.sel.talk + 1); drawTalkStrip(); drawTalkBig(); talkTiming(); renderInspector(); });
$('#tPresenter').addEventListener('input', e => {
  const old = (S.cfg.presenter || '').trim(), nu = e.target.value.trim(); S.cfg.presenter = e.target.value;
  const t = S.talk.slides.find(x => x.kind === 'title');
  if (t) {
    if (old && t.notes.includes(old)) t.notes = nu ? t.notes.replace(old, nu) : t.notes.replace(`, I'm ${old}`, '').replace(`I'm ${old}`, "I'm [your name]");
    else if (nu && t.notes.includes('[your name]')) t.notes = t.notes.replace('[your name]', nu);
    else if (nu && /^Hello everyone\. /.test(t.notes)) t.notes = t.notes.replace(/^Hello everyone\. /, `Hello everyone, I'm ${nu}. `);
  }
  saveBrand(); renderTalk(); commit();
});
$('#tEvent').addEventListener('input', e => { S.talk.event = e.target.value; renderTalk(); commit(); });

// ---------- fact check ----------
const isNum = t => /\d/.test(t);
function talkClaims(list) {
  const out = [];
  list.forEach(s => {
    const where = s.title, push = (text, o = {}) => { if (text && String(text).trim()) out.push({ where, text: String(text), ...o }); };
    if (s.big) push(`${s.big} ${s.bigLabel || ''}`, { numbersOnly: true });
    push(s.body); (s.bullets || []).forEach(b => push(b)); (s.items || []).forEach(x => push(typeof x === 'string' ? x : x.text));
    (s.steps || []).forEach(x => x.text && push(x.text)); push(s.note);
    (s.rows || []).forEach(r => push(Array.isArray(r) ? r.join(' ') : `${r.label} ${r.value}`, { numbersOnly: !Array.isArray(r) }));
    if (s.notes && s.kind !== 'title' && s.kind !== 'end') push(s.notes.replace(/\bminus point (\d+)/g, '-.$1').replace(/\bpoint (\d+)/g, '.$1').replace(/(\d) percent\b/g, '$1%'), { numbersOnly: true, script: true });
  });
  return out.filter(x => x.numbersOnly ? isNum(x.text) : P2P.wc(x.text) >= 5 || isNum(x.text));
}
function carouselClaims() {
  const out = [];
  visibleSlides().forEach((s, i) => {
    const where = `Slide ${i + 1} · ${s.label}`, push = (t, o = {}) => { if (t && String(t).trim()) out.push({ where, text: String(t), ...o }); };
    if (s.big) push(`${s.big} ${s.bigLabel || ''}`, { numbersOnly: true });
    if (s.type !== 'hook' && s.type !== 'cite') push(s.body); (s.bullets || []).forEach(b => push(b));
    if (s.type === 'hook' && isNum(s.heading || '')) push(s.heading, { numbersOnly: true });
  });
  return out.filter(x => x.numbersOnly ? isNum(x.text) : P2P.wc(x.text) >= 5 || isNum(x.text));
}
function posterClaims() {
  const P = S.poster || {}, src = P.layout === 'story' ? P.story : P.layout === 'billboard' ? P.bb : { blocks: P.blocks };
  const skip = /^(id|layout|figureId|conference|posterNo|eyebrow|takeLabel|qTitle|methodTitle|resultTitle|fTitle|whyTitle|limLabel|tHead|cols|refs|caption|heading|title|tag|kind|label|effect|visual|hl)$/;
  const out = [];
  const walk = (o, path) => {
    if (o == null) return;
    if (typeof o === 'string') { if (P2P.wc(o) >= 5 || isNum(o)) out.push({ where: path, text: o, numbersOnly: P2P.wc(o) < 5 }); return; }
    if (Array.isArray(o)) { o.forEach(x => walk(x, path)); return; }
    if (typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!skip.test(k)) walk(v, ({ take: 'Take-home', question: 'Question', steps: 'Method', table: 'Results table', items: 'Findings', why: 'Why it matters', lim: 'Limitations', statement: 'Main finding', numbers: 'Key numbers', methodNote: 'Method', resultNote: 'Results', blocks: 'Poster' })[k] || path);
  };
  walk(src, 'Poster');
  return out;
}
const FC_ICON = { ok: '✓', number: '!', none: '?', loose: '~', placeholder: '[ ]' };
const FC_TEXT = { ok: 'Matches the paper', number: 'Number not found in the paper', none: 'No matching sentence: check this is supported', loose: 'Loosely matches: check the wording keeps the meaning', placeholder: 'Placeholder to fill in' };
function factRows(res) {
  return res.map(r => `<div class="it"><span class="ic ${r.status}" title="${esc(FC_TEXT[r.status])}">${FC_ICON[r.status]}</span><div><div class="wh">${esc(r.where)}${r.script ? ' · script' : ''} · ${esc(FC_TEXT[r.status])}${r.missingNums && r.missingNums.length ? ': ' + esc(r.missingNums.join(', ')) : ''}</div><div>${esc(P2P.shorten ? r.text.replace(/\*/g, '').slice(0, 260) : r.text)}</div>${r.source ? `<div class="src">${r.source.page ? `Page ${r.source.page} · ` : ''}${esc(r.source.where || '')}: “${esc(r.source.text.slice(0, 300))}”</div>` : ''}</div></div>`).join('');
}
function factBox(items) {
  if (!items.length || !S.model) return '';
  const res = P2P.factCheck(S.model, items), bad = res.filter(r => r.status !== 'ok');
  return `<details class="src fc"${bad.length ? ' open' : ''}><summary>Sources and fact check · ${res.length - bad.length} of ${res.length} match${bad.length ? `, ${bad.length} to check` : ''}</summary>${factRows(res)}</details>`;
}
function factCard() {
  const which = S.fcWhich || 'talk';
  if (which === 'talk') ensureTalk();
  const items = which === 'carousel' ? carouselClaims() : which === 'poster' ? posterClaims() : talkClaims(visibleTalk());
  const res = P2P.factCheck(S.model, items), cnt = k => res.filter(r => r.status === k).length;
  return `<div class="card fc"><h3><span class="k">Fact check</span>Every claim, traced back to the paper</h3><p class="hint" style="margin:0">Each statement is matched to the closest sentence in the paper, with its page. Every number must appear in the paper. Check anything marked ! or ? before you present or post.</p>
  <div class="row"><select id="fcWhich" style="width:auto"><option value="talk">Talk slides and script</option><option value="carousel">Carousel</option><option value="poster">Poster</option></select><span class="chip good">${cnt('ok')} match</span>${cnt('loose') ? `<span class="chip">${cnt('loose')} loose</span>` : ''}${cnt('number') + cnt('none') ? `<span class="chip warn">${cnt('number') + cnt('none')} to check</span>` : ''}${cnt('placeholder') ? `<span class="chip">${cnt('placeholder')} placeholders</span>` : ''}</div>
  ${factRows([...res].sort((a, b) => ['number', 'none', 'loose', 'placeholder', 'ok'].indexOf(a.status) - ['number', 'none', 'loose', 'placeholder', 'ok'].indexOf(b.status)))}</div>`;
}
function renderTalkInspector(el) {
  ensureTalk();
  const s = S.talk.slides[S.sel.talk]; if (!s) { el.innerHTML = ''; return; }
  const vis = visibleTalk(), pos = s.hidden ? 'Hidden' : `Slide ${vis.indexOf(s) + 1} of ${vis.length}`;
  let h = `<div class="insp-h"><span class="t">${esc(s.title)}</span><span class="s">${pos} · ${TALK_KIND[s.kind] || s.kind}</span></div><div class="sec">`;
  if (s.optional && s.hidden) h += `<p class="hint"><strong>Optional slide.</strong> Panels often ask about this. Tick "Include in the talk" to add it.</p>`;
  h += `<div class="row"><label class="toggle"><input type="checkbox" id="kShow" ${s.hidden ? '' : 'checked'}> Include in the talk</label></div>`;
  if (s.conf) h += `<p class="hint" style="display:flex;gap:6px;align-items:center"><i class="conf ${s.conf.how}"></i>${s.conf.how === 'heading' ? `Found under "${esc(s.conf.heading)}"${s.conf.page ? `, page ${s.conf.page}` : ''}.` : s.conf.how === 'guess' ? 'The app guessed this from the text. Check it against your document.' : 'Not found in the document. Replace the [placeholders].'}</p>`;
  if ((talkWarn[s.id] || []).length) h += `<div class="warns">${talkWarn[s.id].map(x => `<div class="warn">${esc(x)}</div>`).join('')}</div>`;
  { const wn = P2P.wc([s.body, ...(s.bullets || []), ...(s.items || []).map(x => typeof x === 'string' ? x : x.text), ...(s.steps || []).map(x => x.title + ' ' + (x.text || ''))].filter(Boolean).join(' ').replace(/\*/g, '')); if (!['title', 'end', 'outline', 'grid', 'gantt', 'table', 'framework', 'prisma'].includes(s.kind)) h += `<p class="hint">${wn} words on the slide${wn > 40 ? ' · aim for under 40 and say the rest' : ''}</p>`; }
  if (s.kind !== 'title') h += `<label class="f">${s.kind === 'statement' || s.kind === 'end' ? 'Small heading' : 'Slide title'}<input type="text" id="kTitle" value="${esc(s.title)}"></label>`;
  else h += `<p class="hint">The title, authors and affiliations come from the Paper panel on the left.</p>`;
  if (s.kind === 'stat') h += `<div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="f">Big number<input type="text" id="kBig" value="${esc(s.big || '')}"></label><label class="f">Under the number<input type="text" id="kBigLabel" value="${esc(s.bigLabel || '')}"></label></div>`;
  if (['text', 'stat', 'statement', 'end'].includes(s.kind)) h += `<label class="f">${s.kind === 'end' ? 'Line under the title' : 'Slide text'}<textarea id="kBody" rows="5">${esc(s.body || '')}</textarea></label>`;
  if (s.kind === 'bullets') h += `<label class="f">Points (one per line)<textarea id="kBullets" rows="6">${esc((s.bullets || []).join('\n'))}</textarea></label>`;
  if (s.kind === 'list') h += `<label class="f">Points (one per line)<textarea id="kItems" rows="6">${esc((s.items || []).map(x => x.text).join('\n'))}</textarea></label>`;
  if (s.kind === 'flow') h += `<label class="f">Steps (one per line: Title | detail)<textarea id="kSteps" rows="6">${esc((s.steps || []).map(x => x.text ? `${x.title} | ${x.text}` : x.title).join('\n'))}</textarea></label>`;
  if (s.kind === 'flow' || s.kind === 'prisma') h += `<label class="f">${s.kind === 'prisma' ? 'Text beside the diagram' : 'Note'}<textarea id="kNote" rows="4">${esc(s.note || '')}</textarea></label>`;
  if (s.kind === 'outline') h += `<label class="f">Parts (one per line)<textarea id="kOutline" rows="9">${esc((s.items || []).join('\n'))}</textarea></label><p class="hint">Each section slide shows "Part X of Y" from this list.</p>`;
  if (s.kind === 'numbered') h += `<label class="f">Items (one per line)<textarea id="kNum" rows="7">${esc((s.items || []).map(x => x.text).join('\n'))}</textarea></label>${s.made ? '<p class="hint">These questions were written by the app from your objectives, because the document has no research questions section. Check the wording.</p>' : ''}`;
  if (s.kind === 'framework') { const f = s.fw || {}; h += `<label class="f">Independent variable(s), one per line<textarea id="kIv" rows="2">${esc((f.iv || []).join('\n'))}</textarea></label><label class="f">Dependent variable(s), one per line<textarea id="kDv" rows="2">${esc((f.dv || []).join('\n'))}</textarea></label><div class="row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="f">Mediator<input type="text" id="kMed" value="${esc((f.med || [])[0] || '')}"></label><label class="f">Moderator<input type="text" id="kMod" value="${esc((f.mod || [])[0] || '')}"></label></div><label class="f">Controlled for<input type="text" id="kCov" value="${esc(f.cov || '')}"></label>${s.guess ? '<p class="hint">The app could not find the variables in the document, so these are a guess from the title. Please check them.</p>' : ''}`; }
  if (s.kind === 'grid') h += `<label class="f">Columns (separated by |)<input type="text" id="kGHead" value="${esc((s.head || []).join(' | '))}"></label><label class="f">Rows (one per line, cells separated by |)<textarea id="kGRows" rows="7">${esc((s.rows || []).map(r => r.join(' | ')).join('\n'))}</textarea></label>`;
  if (s.kind === 'gantt') h += `<label class="f">Total months<input type="text" id="kGMo" inputmode="numeric" value="${esc(s.months || 24)}"></label><label class="f">Tasks (one per line: task | start month | end month)<textarea id="kGTasks" rows="8">${esc((s.rows || []).map(r => `${r.task} | ${r.start} | ${r.end}`).join('\n'))}</textarea></label><p class="hint">The months were spread evenly by the app. Change them to your real plan.</p>`;
  if (s.kind === 'stat') h += `<label class="f">Study context line<input type="text" id="kCtx" value="${esc(s.ctx || '')}" placeholder="N = 120 · Cross-sectional survey"></label><p class="hint">Gives the number its context: sample size and design.</p>${s.chart ? `<label class="toggle"><input type="checkbox" id="kChart" ${s.showChart === false ? '' : 'checked'}> Show the chart (${({ compare: 'comparison bars', ratio: 'comparison bars', donut: 'proportion ring', effect: 'effect-size scale', people: 'people grid' })[s.chart.kind]})</label>` : ''}`;
  if (!['title', 'end', 'statement', 'outline'].includes(s.kind)) h += `<label class="f">Icon<select id="kIcon"><option value="">Automatic (by meaning)</option><option value="none">No icon</option>${Object.entries(R.ICON_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>`;
  if (s.kind === 'table') h += `<label class="f">Rows (one per line: label | value)<textarea id="kRows" rows="6">${esc((s.rows || []).map(r => `${r.label} | ${r.value}`).join('\n'))}</textarea></label><p class="hint">For reviews, use Benefit, Mixed, No clear effect or Risk as the value to get a coloured label.</p>`;
  if (['text', 'stat'].includes(s.kind)) h += `<label class="f">Figure<select id="kFig">${FIG_OPTS(s.figureId)}</select></label>${S.figures.length ? '' : '<p class="hint">Add a figure from the left panel to show it here.</p>'}`;
  const allTxt = [s.body, ...(s.bullets || []), ...(s.items || []).map(x => typeof x === 'string' ? x : x.text), ...(s.steps || []).map(x => x.title + ' ' + (x.text || '')), ...((s.fw && s.fw.iv) || []), ...((s.fw && s.fw.dv) || []), s.notes].filter(Boolean).join('\n');
  if (/\[[^\]\d]{3,}\]/.test(allTxt)) h += `<div class="warns"><div class="warn">Text in [square brackets] is a placeholder: the app could not find this part in the document. Replace it with your own words.</div></div>`;
  h += `<p class="hint">Wrap a word in *stars* to colour it. The script for this slide is under the slide preview.</p>`;
  if (AI.fn) h += `<div class="ai"><div class="ai-h">${SPARK}<span>Ask Claude</span><span class="hint">uses your Claude account</span></div><div class="row"><button class="btn sm" type="button" id="kAiSay">Make the script sound natural</button><button class="btn sm" type="button" id="kAiQ">Likely audience questions</button></div><div class="ai-out" id="kAiOut" hidden></div></div>`;
  h += factBox(talkClaims([s]));
  h += `<div class="row"><button class="btn sm ghost" id="kUp" ${S.sel.talk === 0 ? 'disabled' : ''}>Move earlier</button><button class="btn sm ghost" id="kDown" ${S.sel.talk === S.talk.slides.length - 1 ? 'disabled' : ''}>Move later</button><button class="btn sm ghost" id="kAdd">Add a slide after</button>${s.added ? '<button class="btn sm ghost" id="kDel">Delete</button>' : ''}</div></div>`;
  el.innerHTML = h;
  tuck(el, [...(s.optional && s.hidden ? [] : ['#kShow']), '#kIcon', '#kCtx', '#kChart', '#kFig', 'details.fc', '#kUp']);
  { const sec = el.querySelector('.sec'), d = el.querySelector('details.more'); if (sec && d) [...sec.children].filter(x => x.matches('p.hint') && /Gives the number its context|Add a figure from/.test(x.textContent)).forEach(x => d.querySelector('.more-b').append(x)); }
  const on = (id, ev, fn) => { const x = $('#' + id); if (x) x.addEventListener(ev, fn); };
  const changed = () => { S.talk.edited = true; renderTalk(); commit(); };
  const lines = v => v.split('\n').map(x => x.trim()).filter(Boolean);
  on('kShow', 'change', e => { s.hidden = !e.target.checked; renderTalk(); renderInspector(); commit(true); });
  on('kTitle', 'input', e => { s.title = e.target.value; changed(); });
  on('kBig', 'input', e => { s.big = e.target.value; changed(); });
  on('kBigLabel', 'input', e => { s.bigLabel = e.target.value; changed(); });
  on('kBody', 'input', e => { s.body = e.target.value; changed(); });
  on('kBullets', 'input', e => { s.bullets = lines(e.target.value); changed(); });
  on('kItems', 'input', e => { s.items = lines(e.target.value).map((t, i) => ({ tag: String(i + 1), text: t })); changed(); });
  on('kSteps', 'input', e => { const ls = lines(e.target.value); s.steps = ls.map((t, i) => { const [a, ...b] = t.split('|'); return { title: a.trim(), text: b.join('|').trim(), hl: i === ls.length - 1 }; }); changed(); });
  on('kNote', 'input', e => { s.note = e.target.value; changed(); });
  on('kRows', 'input', e => { s.rows = lines(e.target.value).map(t => { const [a, ...b] = t.split('|'); return { label: a.trim(), value: b.join('|').trim() }; }); changed(); });
  on('kOutline', 'input', e => { const old = s.items || [], nu = lines(e.target.value); if (nu.length === old.length) nu.forEach((t, i) => { if (t !== old[i]) S.talk.slides.forEach(x => { if (x.part === old[i]) x.part = t; }); }); s.items = nu; changed(); });
  on('kNum', 'input', e => { const pre = ((s.items || [])[0] && String(s.items[0].tag).replace(/\d+$/, '')) || ''; s.items = lines(e.target.value).map((t, i) => ({ tag: pre + (i + 1), text: t })); s.made = false; changed(); });
  const fwSet = (k, v) => { s.fw = { ...(s.fw || {}), [k]: v }; s.guess = false; changed(); };
  on('kIv', 'input', e => fwSet('iv', lines(e.target.value))); on('kDv', 'input', e => fwSet('dv', lines(e.target.value)));
  on('kMed', 'input', e => fwSet('med', e.target.value.trim() ? [e.target.value.trim()] : []));
  on('kMod', 'input', e => fwSet('mod', e.target.value.trim() ? [e.target.value.trim()] : []));
  on('kCov', 'input', e => fwSet('cov', e.target.value.trim()));
  on('kGHead', 'input', e => { s.head = e.target.value.split('|').map(x => x.trim()); changed(); });
  on('kGRows', 'input', e => { s.rows = lines(e.target.value).map(t => t.split('|').map(x => x.trim())); changed(); });
  on('kGMo', 'input', e => { s.months = Math.max(6, Math.min(48, parseInt(e.target.value) || 24)); changed(); });
  on('kGTasks', 'input', e => { s.rows = lines(e.target.value).map(t => { const [a, b, c] = t.split('|').map(x => x.trim()); return { task: a, start: parseInt(b) || 1, end: parseInt(c) || parseInt(b) || 1 }; }); s.guess = false; changed(); });
  on('kCtx', 'input', e => { s.ctx = e.target.value; changed(); });
  on('kChart', 'change', e => { s.showChart = e.target.checked; renderTalk(); commit(true); });
  const ki = $('#kIcon'); if (ki) { ki.value = s.icon || ''; ki.addEventListener('change', e => { s.icon = e.target.value || undefined; renderTalk(); commit(true); }); }
  on('kFig', 'change', e => { s.figureId = e.target.value || null; renderTalk(); commit(true); });
  const move = d => { const i = S.sel.talk, j = i + d, a = S.talk.slides; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; S.sel.talk = j; S.talk.edited = true; $('#tStrip').innerHTML = ''; renderTalk(); renderInspector(); commit(true); };
  on('kUp', 'click', () => move(-1)); on('kDown', 'click', () => move(1));
  on('kAdd', 'click', () => { S.talk.slides.splice(S.sel.talk + 1, 0, { id: 't' + Date.now().toString(36), kind: 'bullets', title: 'New slide', bullets: ['First point', 'Second point'], notes: '', added: true }); S.sel.talk++; S.talk.edited = true; $('#tStrip').innerHTML = ''; renderTalk(); renderInspector(); commit(true); });
  on('kDel', 'click', () => { S.talk.slides.splice(S.sel.talk, 1); S.sel.talk = Math.max(0, S.sel.talk - 1); $('#tStrip').innerHTML = ''; renderTalk(); renderInspector(); commit(true); });
  on('kAiSay', 'click', async () => {
    const out = $('#kAiOut'), words = Math.max(40, P2P.wc(s.notes || ''));
    const t = await ask(`${FACTS}\n\nYou are helping a researcher rehearse a conference talk. Rewrite the speaker script for one slide so it sounds natural when spoken aloud: short sentences, a friendly and confident tone, signposting such as "So" or "Here's the key point". Say numbers the way a speaker would. Keep every number exactly as in the paper. Keep it about ${words} words. Speak ${S.talk.type && S.talk.type !== 'paper' ? 'as the candidate presenting their own research to a panel of examiners (I, my study)' : S.cfg.author ? 'as an author of the paper (we, our)' : 'as someone presenting another team\'s paper (they, the authors)'}. Reply with only the script.\n\nSlide title: ${s.title}\nSlide content: ${[s.big, s.bigLabel, s.body, (s.bullets || []).join('; '), (s.items || []).map(x => x.text).join('; '), (s.steps || []).map(x => x.title).join(' → '), s.note].filter(Boolean).join('\n')}\n\nCurrent script:\n${s.notes}\n\nPaper excerpt:\n${paperContext(12000)}`, out, { tier: 'quick' });
    if (t) offerUse(out, t.replace(/^"|"$/g, ''), v => { s.notes = v; S.talk.edited = true; drawTalkBig(); talkTiming(); });
  });
  on('kAiQ', 'click', async () => {
    const out = $('#kAiOut');
    const t = await ask(`${FACTS}\n\nList 4 questions a conference audience is likely to ask after this talk, each followed on the next line by a short suggested answer that starts with "Answer:". Base the answers only on the paper; if the paper does not answer a question, the answer should say how to respond honestly (for example, that it is a direction for future work).\n\nPaper excerpt:\n${paperContext(16000)}`, out, { tier: 'quick' });
    if (t) offerCopy(out, t);
  });
}
// whole-script polish from the toolbar
$('#tAi').addEventListener('click', async () => {
  const out = $('#tAiOut'), vis = visibleTalk(), target = (S.talk.minutes || 10) * (S.talk.wpm || 130);
  const plan = vis.map((s, i) => `Slide ${i + 1} (${s.title}): ${s.notes}`).join('\n\n');
  const arr = await ask(`${FACTS}\n\nHere is the speaker script for a ${S.talk.minutes}-minute ${({ paper: 'conference talk', proposal: 'research proposal defence in front of a panel of examiners', thesis: 'thesis defence (viva) in front of a panel of examiners' })[S.talk.type || 'paper']} with ${vis.length} slides. Rewrite it so it flows as one talk and sounds natural when spoken: smooth transitions between slides, short sentences, numbers said the way a speaker would. The whole script should be about ${target} words in total (about ${S.talk.wpm || 130} words a minute), shared sensibly across slides; the title and thank-you slides stay short. Keep every number exactly as in the paper. Speak ${S.talk.type && S.talk.type !== 'paper' ? 'as the candidate presenting their own research (I, my study)' : S.cfg.author ? 'as an author (we, our)' : "as someone presenting another team's paper (they, the authors)"}. Keep any text in [square brackets] as it is${(S.cfg.presenter || '').trim() ? `; the presenter's name is ${S.cfg.presenter.trim()}` : ''}. Reply with only a JSON array of exactly ${vis.length} strings, one script per slide, in order.\n\nCurrent script:\n${plan}\n\nPaper excerpt:\n${paperContext(16000)}`, out, { json: true, tier: 'quick', cache: false });
  if (!Array.isArray(arr)) return;
  if (arr.length !== vis.length) { out.querySelector('.ai-text').textContent = 'Claude returned a script that did not match the slides. Try again.'; return; }
  const txt = arr.map(String), tot = txt.reduce((a, t) => a + P2P.wc(t), 0);
  out.querySelector('.ai-text').textContent = txt.map((t, i) => `${i + 1}. ${vis[i].title}\n${t}`).join('\n\n') + `\n\n(${tot} words, about ${mmss(tot / (S.talk.wpm || 130) * 60)})`;
  offerUse(out, txt.join('\n'), () => { vis.forEach((s, i) => { s.notes = txt[i]; }); S.talk.edited = true; drawTalkBig(); talkTiming(); });
});

// rehearse mode
const RH = { i: 0, t0: 0, slideT0: 0, tick: 0, list: [] };
function openRehearse() {
  RH.list = visibleTalk(); if (!RH.list.length) return;
  RH.i = Math.max(0, RH.list.indexOf(S.talk.slides[S.sel.talk])); RH.t0 = Date.now(); RH.slideT0 = Date.now();
  $('#rehearse').hidden = false; document.body.style.overflow = 'hidden';
  showRh(); clearInterval(RH.tick); RH.tick = setInterval(rhClock, 500); $('#rhNext').focus();
}
function closeRehearse() { $('#rehearse').hidden = true; document.body.style.overflow = ''; clearInterval(RH.tick); $('#tRehearse').focus(); }
function showRh() {
  const s = RH.list[RH.i], nx = RH.list[RH.i + 1];
  $('#rhCur').getContext('2d').drawImage(talkCanvases.get(s.id), 0, 0);
  const nc = $('#rhNextCv').getContext('2d'); nc.clearRect(0, 0, 960, 540); if (nx) nc.drawImage(talkCanvases.get(nx.id), 0, 0, 960, 540);
  $('#rhNextLbl').textContent = nx ? 'Next: ' + nx.title : 'Last slide';
  $('#rhNotes').textContent = s.notes || '(No script for this slide)';
  $('#rhPos').textContent = `${RH.i + 1} / ${RH.list.length}`;
  $('#rhPrev').disabled = RH.i === 0; $('#rhNext').textContent = nx ? 'Next' : 'Finish';
  rhClock();
}
function rhClock() {
  const tot = (Date.now() - RH.t0) / 1000, sl = (Date.now() - RH.slideT0) / 1000, s = RH.list[RH.i];
  const before = RH.list.slice(0, RH.i).reduce((a, x) => a + talkSec(x), 0), planned = before + Math.min(sl, talkSec(s));
  $('#rhTime').textContent = mmss(tot); $('#rhTarget').textContent = `of ${S.talk.minutes}:00`;
  $('#rhSlide').textContent = `This slide ${mmss(sl)} · planned ${mmss(talkSec(s))}`;
  const late = tot - planned;
  $('#rhPace').textContent = late > 20 ? `${mmss(late)} behind` : late < -30 ? 'Ahead of plan' : 'On time';
  $('#rhPace').className = 'pace ' + (late > 20 ? 'late' : 'ok');
  $('#rhTime').classList.toggle('over', tot > S.talk.minutes * 60);
}
function rhGo(d) { const j = RH.i + d; if (j < 0) return; if (j >= RH.list.length) { const tot = (Date.now() - RH.t0) / 1000; closeRehearse(); toast(`Run-through finished in ${mmss(tot)} (target ${S.talk.minutes}:00)`, 5000); return; } RH.i = j; RH.slideT0 = Date.now(); showRh(); }
$('#tRehearse').addEventListener('click', () => { renderTalk(); openRehearse(); });
$('#rhClose').addEventListener('click', closeRehearse);
$('#rhPrev').addEventListener('click', () => rhGo(-1)); $('#rhNext').addEventListener('click', () => rhGo(1));
$('#rhRestart').addEventListener('click', () => { RH.t0 = Date.now(); RH.slideT0 = Date.now(); rhClock(); });
$('#rhCur').addEventListener('click', () => rhGo(1));
document.addEventListener('keydown', e => {
  if ($('#rehearse').hidden) return;
  if (e.key === 'Escape') closeRehearse();
  else if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); rhGo(1); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); rhGo(-1); }
});

// talk exports
async function exportTalkPptx(fonts = 'office') {
  notice('<span class="busy"><span class="spin"></span> Building the PowerPoint…</span>');
  try {
    await loadScript(LIBS.pptx); renderTalk();
    const items = visibleTalk().map(s => {
      const cv = document.createElement('canvas'), rec = []; drawTalkSlide(cv, s, rec);
      return { rec, notes: s.notes || '', crop: (x, y, w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); c.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, c.width, c.height); return c.toDataURL('image/png'); } };
    });
    const p = R.buildTalkPptx(window.PptxGenJS, items, theme(), { fonts, title: S.model.title, author: (S.cfg.presenter || '').trim() || (S.model.authors || []).join(', ') });
    const blob = await p.write({ outputType: 'blob' });
    defaultNotice();
    const ok = await saveFile(`${slug()}-talk.pptx`, blob);
    if (ok && fonts === 'theme') { const T = theme(); notice(`PowerPoint uses <strong>${esc([...new Set([T.display.family, T.body.family])].join(' and '))}</strong>. Install them free from fonts.google.com before opening the file, or PowerPoint will substitute other fonts.`); }
  } catch (err) { console.error(err); notice('<strong>The PowerPoint could not be built.</strong> Check your connection and try again.', 'err'); }
}
async function exportTalkPdf() {
  notice('<span class="busy"><span class="spin"></span> Building the slides PDF…</span>');
  try {
    await loadScript(LIBS.jspdf); renderTalk();
    const { jsPDF } = window.jspdf, vis = visibleTalk();
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [960, 540], compress: true });
    vis.forEach((s, i) => { if (i) pdf.addPage([960, 540], 'landscape'); pdf.addImage(talkCanvases.get(s.id).toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 960, 540, undefined, 'FAST'); });
    defaultNotice();
    await saveFile(`${slug()}-talk-slides.pdf`, pdf.output('blob'));
  } catch (err) { console.error(err); notice('<strong>The slides PDF could not be built.</strong> Check your connection and try again.', 'err'); }
}
async function exportScript() {
  notice('<span class="busy"><span class="spin"></span> Building the speaker script…</span>');
  try {
    await loadScript(LIBS.jspdf); renderTalk();
    const { jsPDF } = window.jspdf, vis = visibleTalk(), wpm = S.talk.wpm || 130;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true }), PW = 210, PH = 297, M = 16;
    const plain = t => String(t || '').replace(/\*/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/−/g, '-').replace(/[^\x00-\xFF]/g, '');
    const tot = vis.reduce((a, s) => a + talkSec(s), 0);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16);
    let y = M + 4; const tl = pdf.splitTextToSize(plain(S.model.title), PW - 2 * M); pdf.text(tl, M, y); y += tl.length * 7 + 2;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(90);
    pdf.text(plain(`Speaker script · ${vis.length} slides · about ${mmss(tot)} at ${wpm} words a minute · target ${S.talk.minutes} min`), M, y); y += 9; pdf.setTextColor(0);
    let clock = 0;
    vis.forEach((s, i) => {
      const tw = 62, th = tw * 9 / 16, tx = PW - M - tw;
      pdf.setFontSize(11);
      const body = pdf.splitTextToSize(plain(s.notes || ''), tx - M - 6), need = Math.max(th, 7 + body.length * 5.2) + 8;
      if (y + Math.min(need, 60) > PH - M) { pdf.addPage(); y = M; }
      const sm = document.createElement('canvas'); sm.width = 640; sm.height = 360; sm.getContext('2d').drawImage(talkCanvases.get(s.id), 0, 0, 640, 360);
      pdf.addImage(sm.toDataURL('image/jpeg', 0.85), 'JPEG', tx, y, tw, th, undefined, 'FAST');
      pdf.setDrawColor(200); pdf.rect(tx, y, tw, th);
      pdf.setFont('helvetica', 'bold'); pdf.text(pdf.splitTextToSize(plain(`${i + 1}. ${s.title}`), tx - M - 6)[0], M, y + 4);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110);
      pdf.text(`${mmss(clock)} - ${mmss(clock + talkSec(s))}  (${mmss(talkSec(s))})`, M, y + 9); pdf.setTextColor(0); pdf.setFontSize(11);
      let ly = y + 15;
      for (const ln of body) { if (ly > PH - M) { pdf.addPage(); ly = M + 4; } pdf.text(ln, M, ly); ly += 5.2; }
      clock += talkSec(s);
      y = Math.max(ly, y + th) + 8;
      if (i < vis.length - 1 && y < PH - M) { pdf.setDrawColor(225); pdf.line(M, y - 4, PW - M, y - 4); }
    });
    defaultNotice();
    await saveFile(`${slug()}-speaker-script.pdf`, pdf.output('blob'));
  } catch (err) { console.error(err); notice('<strong>The script PDF could not be built.</strong> Check your connection and try again.', 'err'); }
}
async function exportScriptText() {
  const vis = visibleTalk(); let clock = 0;
  const md = `# ${S.model.title}\n\nSpeaker script · ${vis.length} slides · about ${mmss(vis.reduce((a, s) => a + talkSec(s), 0))}\n\n` + vis.map((s, i) => { const a = clock; clock += talkSec(s); return `## ${i + 1}. ${s.title.replace(/\*/g, '')}  (${mmss(a)}–${mmss(clock)})\n\n${s.notes || ''}\n`; }).join('\n');
  await saveFile(`${slug()}-speaker-script.md`, md);
}
$('#tPptx').addEventListener('click', () => exportTalkPptx('office'));
$('#tPdf').addEventListener('click', exportTalkPdf);
$('#tScript').addEventListener('click', exportScript);

// ---------- mobile sheets and swipe ----------
function openSheet(which) { document.body.classList.remove('sheet-insp', 'sheet-left'); if (which) document.body.classList.add('sheet-' + which); }
$('#fabEdit').addEventListener('click', () => openSheet('insp'));
$('#fabLook').addEventListener('click', () => openSheet('left'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => openSheet(null)));
(() => {
  const big = $('#bigSlide'); let x0 = null, y0 = 0;
  big.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  big.addEventListener('touchend', e => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
    S.sel.slide = Math.max(0, Math.min(S.slides.length - 1, S.sel.slide + (dx < 0 ? 1 : -1)));
    drawStrip(); drawBig(); renderInspector();
    const cur = document.querySelector('.thumb[aria-current=true]'); if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
})();

// ---------- share to social media ----------
const enc = encodeURIComponent;
function shortMsg() {
  const m = S.model, hook = plain((visibleSlides().find(s => s.role === 'hook') || {}).heading || m.title);
  return `${hook}\n\n${creditLine()}${m.doi ? '\nhttps://doi.org/' + m.doi : ''}`;
}
function firstPost(limit = 280) {
  const m = S.model, hook = plain((visibleSlides().find(s => s.role === 'hook') || {}).heading || m.title);
  const tail = (m.doi ? ` https://doi.org/${m.doi}` : '') + ' ' + hashtags(2).join(' ');
  const pts = keyPoints(1)[0] || '';
  let t = `${hook}\n\n${pts}`;
  if (t.length + tail.length > limit) t = t.slice(0, limit - tail.length - 1).replace(/\s+\S*$/, '') + '…';
  return t + tail;
}
const SHARE = [
  { name: 'Instagram', kind: 'Carousel or Reel', text: () => kitCaption(), file: 'video45', fileLabel: 'video', alt: 'zip', altLabel: 'Save slide images', url: () => 'https://www.instagram.com/',
    steps: ['Tap the button: the caption is copied and the 4:5 video is saved.', 'Open Instagram, tap +, choose Post or Reel and pick the video. For a swipe carousel, save the slide images instead and select them all.', 'Paste the caption. Add alt text from the Post kit tab.'] },
  { name: 'TikTok', kind: 'Video', text: () => kitCaption(), file: 'video916', fileLabel: '9:16 video', url: () => 'https://www.tiktok.com/upload',
    steps: ['Tap the button: the caption is copied and the 9:16 video is saved.', 'Open TikTok, upload the video, add a sound if you like.', 'Paste the caption.'] },
  { name: 'LinkedIn', kind: 'Document post', text: () => kitLinkedIn(), file: 'lipdf', fileLabel: 'PDF carousel', url: () => 'https://www.linkedin.com/feed/?shareActive=true&text=' + enc(kitLinkedIn().slice(0, 2800)),
    steps: ['Tap the button: the post text is copied and the PDF carousel is saved.', 'Open LinkedIn, start a post, choose Add a document and upload the PDF. Give it a title.', 'Paste the text if it is not already filled in.'] },
  { name: 'Facebook', kind: 'Video post', text: () => kitCaption(), file: 'video45', fileLabel: 'video', url: () => 'https://www.facebook.com/',
    steps: ['Tap the button: the caption is copied and the video is saved.', 'Open Facebook, create a post and add the video.', 'Paste the caption.'] },
  { name: 'X', kind: 'Thread', text: () => kitThread(), file: 'cover', fileLabel: 'cover image', url: () => 'https://twitter.com/intent/tweet?text=' + enc(firstPost(280)),
    steps: ['Open X: the first post is already filled in.', 'Attach the cover image (save it with the button).', 'Reply with the rest of the thread, which the button also copies.'] },
  { name: 'Bluesky', kind: 'Post', text: () => kitThread(), file: 'cover', fileLabel: 'cover image', url: () => 'https://bsky.app/intent/compose?text=' + enc(firstPost(300)),
    steps: ['Open Bluesky: the post is already filled in.', 'Attach the cover image if you like.', 'Add the rest of the thread from your clipboard.'] },
  { name: 'Threads', kind: 'Post', text: () => kitCaption(), file: 'cover', fileLabel: 'cover image', url: () => 'https://www.threads.net/intent/post?text=' + enc(firstPost(480)),
    steps: ['Open Threads: the post is already filled in.', 'Attach the cover image or slides.', 'Post.'] },
  { name: 'WhatsApp', kind: 'Message', text: () => shortMsg(), file: 'cover', fileLabel: 'cover image', url: () => 'https://wa.me/?text=' + enc(shortMsg()),
    steps: ['Open WhatsApp: the message with the paper link is filled in.', 'Choose a chat or group, or your Status.', 'Send.'] },
];
function doSave(kind) {
  if (kind === 'video45') { videoStory = false; $('#exportVideo').click(); }
  else if (kind === 'video916') { videoStory = true; $('#exportVideo').click(); }
  else if (kind === 'zip') $('#exportCar').click();
  else if (kind === 'lipdf') exportLinkedIn();
  else if (kind === 'cover') { const c = visibleSlides()[0]; if (c) saveSlidePng(c); }
}
function renderShare() {
  $('#shareGrid').innerHTML = prepubWarn() + SHARE.map((p, i) => `<div class="shc"><h3>${p.name}<span>${p.kind}</span></h3><ol>${p.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol><div class="acts"><button class="btn sm primary" type="button" data-sh="${i}">Copy text and save ${esc(p.fileLabel)}</button>${p.alt ? `<button class="btn sm" type="button" data-alt="${i}">${esc(p.altLabel)}</button>` : ''}<a class="btn sm" href="${esc(p.url())}" target="_blank" rel="noopener noreferrer">Open ${p.name} ↗</a></div></div>`).join('');
  $('#shareGrid').querySelectorAll('[data-sh]').forEach(b => b.addEventListener('click', () => {
    const p = SHARE[+b.dataset.sh];
    copyText(p.text(), null);
    closeShare();
    doSave(p.file);
  }));
  $('#shareGrid').querySelectorAll('[data-alt]').forEach(b => b.addEventListener('click', () => { const p = SHARE[+b.dataset.alt]; copyText(p.text(), null); closeShare(); doSave(p.alt); }));
}
function openShare() { renderCanvases(); renderShare(); $('#shareModal').hidden = false; $('#shareClose').focus(); }
function closeShare() { $('#shareModal').hidden = true; }
$('#shareBtn').addEventListener('click', openShare);
$('#shareClose').addEventListener('click', closeShare);
$('#shareModal').addEventListener('click', e => { if (e.target.id === 'shareModal') closeShare(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#shareModal').hidden) closeShare(); });

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (!typing && S.sel.tab === 'carousel' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && $('#cropModal').hidden) {
    S.sel.slide = Math.max(0, Math.min(S.slides.length - 1, S.sel.slide + (e.key === 'ArrowRight' ? 1 : -1))); drawStrip(); drawBig(); renderInspector();
  }
  if (!typing && S.sel.tab === 'talk' && $('#rehearse').hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) $(e.key === 'ArrowRight' ? '#tNext' : '#tPrev').click();
});
$('#undoBtn').addEventListener('click', undo); $('#redoBtn').addEventListener('click', redo);

// ---------- boot ----------
(async () => {
  renderThemes(); bindMeta();
  await loadBrand(); fillBrand(); bindBrand();
  const saved = await loadProject();
  if (saved && saved.model && saved.slides) {
    Object.assign(S, { model: saved.model, slides: saved.slides, talk: saved.talk || null, poster: saved.poster, theme: saved.theme || 'academic', posterSize: saved.posterSize || 'a0', handle: saved.handle || '', source: saved.source || S.source, figures: saved.figures || [] });
    if (!R.THEMES[S.theme]) S.theme = 'academic';
    for (const f of S.figures) { const im = new Image(); im.src = f.src; try { await im.decode(); imgs[f.id] = im; } catch (e) {} }
    fillMeta(); renderThemes();
    $('#pSize').value = S.posterSize;
    notice(S.source.example ? '<strong>Example paper.</strong> This is a fictional study so you can see how the app works. Upload your own PDF to start.' : `Restored your last project, <strong>${esc(S.source.name)}</strong>. Upload the PDF again if you want to crop figures from it.`);
    renderAll(true); commit(true);
  } else {
    await loadExample();
  }
  if (ui.mode && !(S.source && S.source.example)) setMode(ui.mode, 1); else showHome();
  await fontsReady(theme());
  scheduleRender();
  document.fonts && document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => scheduleRender());
  // warm the other themes' fonts so switching is instant
  Object.values(R.THEMES).forEach(T => fontsReady(T));
})();
})();
