/* ===== Paper2Poster renderers: canvas drawing for slides and posters ===== */
const R = (() => {
  const THEMES = {
    academic: { name: 'Clean Academic', bg: '#F4F6F8', surface: '#FFFFFF', ink: '#13233A', muted: '#4B5A6E', accent: '#0A6A94', soft: '#DCEAF2', onAccent: '#FFFFFF', line: '#C9D3DD',
      banner: '#13233A', bannerInk: '#FFFFFF', bannerSub: '#B9CADB',
      display: { family: 'Source Serif 4', weight: 700, fb: 'Georgia, serif' }, body: { family: 'IBM Plex Sans', weight: 400, bold: 600, fb: 'Helvetica, Arial, sans-serif' }, mono: { family: 'IBM Plex Mono', weight: 600, fb: 'Menlo, monospace' }, radius: 14, deco: 'academic' },
    editorial: { name: 'Bold Editorial', bg: '#FFE04A', surface: '#FFF3B8', ink: '#111111', muted: '#3B3622', accent: '#B5122B', soft: '#FFF3B8', onAccent: '#FFFFFF', line: '#111111',
      banner: '#111111', bannerInk: '#FFE04A', bannerSub: '#F2EBC7',
      display: { family: 'Fraunces', weight: 900, fb: 'Georgia, serif' }, body: { family: 'Work Sans', weight: 400, bold: 600, fb: 'Helvetica, Arial, sans-serif' }, mono: { family: 'Work Sans', weight: 600, fb: 'Helvetica, sans-serif' }, radius: 0, deco: 'editorial' },
    pastel: { name: 'Soft Pastel', bg: '#F4EFFC', surface: '#FFFFFF', ink: '#2A2546', muted: '#5A5480', accent: '#6544C9', soft: '#E9E1FB', onAccent: '#FFFFFF', line: '#DCD3F2', blobA: '#FBC9D6', blobB: '#C6EBDC',
      banner: '#6544C9', bannerInk: '#FFFFFF', bannerSub: '#E4DBFF',
      display: { family: 'DM Serif Display', weight: 400, fb: 'Georgia, serif' }, body: { family: 'Nunito Sans', weight: 400, bold: 700, fb: 'Helvetica, Arial, sans-serif' }, mono: { family: 'Nunito Sans', weight: 700, fb: 'Helvetica, sans-serif' }, radius: 36, deco: 'pastel' },
    sheet: { name: 'Study Sheet', bg: '#FFFFFF', surface: '#EEF4F5', ink: '#17262B', muted: '#4F646B', accent: '#0B5566', soft: '#E3EFF1', onAccent: '#FFFFFF', line: '#D3E0E3', blobA: '#E3EFF1', blobB: '#FCE8E6',
      head: '#0B3B4A', warn: '#B42318', warnSoft: '#FCE8E6', dark: '#0B3B4A', darkInk: '#FFFFFF', darkSub: '#B7D2D8',
      banner: '#0B3B4A', bannerInk: '#FFFFFF', bannerSub: '#B7D2D8',
      display: { family: 'Source Serif 4', weight: 700, fb: 'Georgia, "Times New Roman", serif' }, body: { family: 'Inter', weight: 400, bold: 600, fb: 'Helvetica, Arial, sans-serif' }, mono: { family: 'Inter', weight: 600, fb: 'Helvetica, Arial, sans-serif' }, radius: 12, deco: 'sheet' },
    tech: { name: 'Dark Tech', bg: '#0D1117', surface: '#161C26', ink: '#E8EEF5', muted: '#A3B1C2', accent: '#5CC8FF', soft: '#13283A', onAccent: '#0D1117', line: '#2A3445', accent2: '#FFB454',
      banner: '#161C26', bannerInk: '#E8EEF5', bannerSub: '#A3B1C2',
      display: { family: 'Sora', weight: 700, fb: 'Helvetica, Arial, sans-serif' }, body: { family: 'Manrope', weight: 400, bold: 600, fb: 'Helvetica, Arial, sans-serif' }, mono: { family: 'JetBrains Mono', weight: 500, fb: 'Menlo, monospace' }, radius: 10, deco: 'tech' },
  };

  const fontStr = (f, size, weight) => `${weight || f.weight} ${Math.round(size * 10) / 10}px "${f.family}", ${f.fb}`;
  function fontSpecs(T) { return [fontStr(T.display, 40), fontStr(T.body, 40), fontStr(T.body, 40, T.body.bold), fontStr(T.mono, 40)]; }

  // ---- contrast ----
  function lum(hex) { const c = hex.replace('#', '').match(/../g).map(h => parseInt(h, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
  function themeContrast(T) {
    const checks = [
      { what: 'Text', r: contrast(T.ink, T.bg), need: 4.5 }, { what: 'Secondary text', r: contrast(T.muted, T.bg), need: 4.5 },
      { what: 'Accent (large text)', r: contrast(T.accent, T.bg), need: 3 }, { what: 'Banner title', r: contrast(T.bannerInk, T.banner), need: 3 },
      { what: 'Text on cards', r: contrast(T.ink, T.surface), need: 4.5 },
    ];
    return { pass: checks.every(c => c.r >= c.need), checks };
  }

  // ---- text layout ----
  function tokens(text) {
    // *word* marks emphasis (drawn in the accent colour); the asterisks themselves are not drawn
    // **word** is bold, *word* is emphasis colour
    const ranges = [], bolds = []; let clean = '';
    String(text || '').split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).forEach(part => {
      if (/^\*\*[^*\n]+\*\*$/.test(part)) { bolds.push([clean.length, clean.length + part.length - 4]); clean += part.slice(2, -2); }
      else if (/^\*[^*\n]+\*$/.test(part)) { ranges.push([clean.length, clean.length + part.length - 2]); clean += part.slice(1, -1); } else clean += part;
    });
    text = clean;
    if (typeof P2P !== 'undefined') { P2P.STAT_RE.lastIndex = 0; let m; while ((m = P2P.STAT_RE.exec(text))) ranges.push([m.index, m.index + m[0].length]); }
    const out = []; const re = /\n|[^\s]+/g; let m;
    while ((m = re.exec(text))) {
      if (m[0] === '\n') { out.push({ br: true }); continue; }
      const a = m.index, b = a + m[0].length;
      out.push({ t: m[0], hl: ranges.some(([x, y]) => a < y && b > x), b: bolds.some(([x, y]) => a < y && b > x) });
    }
    return out;
  }
  function wrap(ctx, toks, maxW, boldFont) {
    const lines = []; let line = [], w = 0, widest = 0;
    const sp = ctx.measureText(' ').width, reg = ctx.font;
    for (const tk of toks) {
      if (tk.br) { lines.push({ words: line, w }); line = []; w = 0; continue; }
      let tw;
      if (tk.b && boldFont) { ctx.font = boldFont; tw = ctx.measureText(tk.t).width; ctx.font = reg; } else tw = ctx.measureText(tk.t).width;
      if (line.length && w + sp + tw > maxW) { lines.push({ words: line, w }); line = []; w = 0; }
      line.push({ ...tk, w: tw }); w += (line.length > 1 ? sp : 0) + tw; widest = Math.max(widest, w);
    }
    if (line.length) lines.push({ words: line, w });
    return { lines, widest, sp };
  }
  // fit text into box by stepping the size down
  function fit(ctx, text, font, box, o) {
    const toks = tokens(text || '');
    const step = o.step || Math.max(1, Math.round((o.max - o.min) / 24));
    let res;
    for (let s = o.max; s >= o.min; s -= step) {
      ctx.font = fontStr(font, s, o.weight);
      const r = wrap(ctx, toks, box.w, fontStr(font, s, font.bold || 700));
      const h = r.lines.length * s * o.lh;
      res = { size: s, ...r, h, ok: h <= box.h + 0.5 && r.widest <= box.w + 1 && (!o.maxLines || r.lines.length <= o.maxLines) };
      if (res.ok) return res;
    }
    return res;
  }
  function measureAt(ctx, text, font, w, s, lh, weight) { ctx.font = fontStr(font, s, weight); const r = wrap(ctx, tokens(text || ''), w, fontStr(font, s, font.bold || 700)); return { size: s, ...r, h: r.lines.length * s * lh }; }
  function drawText(ctx, res, font, x, y, o) {
    const regF = fontStr(font, res.size, o.weight), boldF = fontStr(font, res.size, font.bold || 700);
    ctx.font = regF;
    ctx.textBaseline = 'alphabetic';
    const lh = res.size * o.lh;
    res.lines.forEach((ln, i) => {
      const a = o.reveal ? o.reveal(i) : 1;
      if (a <= 0) return;
      ctx.save();
      if (a < 1) { ctx.globalAlpha *= a; ctx.translate(0, (1 - a) * 26); }
      let cx = o.align === 'center' ? x + (o.w - ln.w) / 2 : o.align === 'right' ? x + o.w - ln.w : x;
      const by = y + i * lh + res.size * 0.86 + (lh - res.size) * 0.35;
      for (const wd of ln.words) {
        ctx.fillStyle = wd.hl && o.hl ? o.hl : wd.b && o.bc ? o.bc : o.color;
        ctx.font = wd.b ? boldF : regF;
        ctx.fillText(wd.t, cx, by);
        cx += wd.w + res.sp;
      }
      ctx.restore();
    });
    return res.lines.length * lh;
  }

  // ---- shapes ----
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const ICONS = {
    people: ['M9 11.5a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7z', 'M2.5 20.5c0-3.9 2.9-6.5 6.5-6.5s6.5 2.6 6.5 6.5', 'M16.5 11.8a2.8 2.8 0 1 0 0-5.6', 'M17 14.2c2.9.3 4.5 2.6 4.5 5.8'],
    chat: ['M6 4h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-4.5 4v-4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M8 10h.01', 'M12 10h.01', 'M16 10h.01'],
    heart: ['M12 20.5C5.5 16.2 2.5 12.6 3.4 8.6 4.3 4.6 9.6 3.7 12 7.6c2.4-3.9 7.7-3 8.6 1 .9 4-2.1 7.6-8.6 11.9z'],
    clipboard: ['M7 4.5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-1', 'M9 3h6v3H9z', 'M8 11h8', 'M8 15h8', 'M8 19h5'],
    flask: ['M9 3h6', 'M10 3v6L4.6 18.6A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4L14 9V3', 'M7.2 15h9.6'],
    bars: ['M3 21h18', 'M5.5 21v-7', 'M10.5 21V9', 'M15.5 21V5', 'M20 21v-4'],
    bulb: ['M9 17.5h6', 'M10 21h4', 'M12 2.8a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.2 1 2V17h6v-.6c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.8z'],
    alert: ['M12 3.2 22 20.5H2z', 'M12 9.5v5', 'M12 17.6h.01'],
    search: ['M10.5 17a6.5 6.5 0 1 0 0-13a6.5 6.5 0 1 0 0 13z', 'M15.3 15.3 21 21'],
    book: ['M3 5.5c3.2-1.3 6.2-.9 9 1.2v13.6c-2.8-2.1-5.8-2.5-9-1.2z', 'M21 5.5c-3.2-1.3-6.2-.9-9 1.2v13.6c2.8-2.1 5.8-2.5 9-1.2z'],
    spark: ['M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z'],
    bookmark: ['M6.5 3.5h11v17l-5.5-4-5.5 4z'],
    target: ['M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18z', 'M12 16.5a4.5 4.5 0 1 0 0-9a4.5 4.5 0 1 0 0 9z', 'M12 12.6a.6.6 0 1 0 0-1.2'],
  };
  const ICON_NAMES = { people: 'People', chat: 'Conversation', heart: 'Well-being', clipboard: 'Survey', flask: 'Experiment', bars: 'Chart', bulb: 'Idea', alert: 'Caution', search: 'Question', book: 'Paper', spark: 'Spark', target: 'Target', bookmark: 'Bookmark' };
  function icon(ctx, name, x, y, size, color) {
    const paths = ICONS[name]; if (!paths) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const p of paths) ctx.stroke(new Path2D(p));
    ctx.restore();
  }
  function iconBadge(ctx, T, name, x, y, d) {
    ctx.save();
    if (T.deco === 'editorial') { ctx.fillStyle = T.ink; ctx.fillRect(x, y, d, d); icon(ctx, name, x + d * 0.2, y + d * 0.2, d * 0.6, T.bg); }
    else if (T.deco === 'tech') { ctx.strokeStyle = T.accent; ctx.lineWidth = 3; rr(ctx, x + 1.5, y + 1.5, d - 3, d - 3, 12); ctx.stroke(); icon(ctx, name, x + d * 0.22, y + d * 0.22, d * 0.56, T.accent); }
    else { ctx.fillStyle = T.soft; ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.fill(); icon(ctx, name, x + d * 0.24, y + d * 0.24, d * 0.52, T.accent); }
    ctx.restore();
  }
  function qr(ctx, text, x, y, size, dark, light) {
    if (typeof qrcode === 'undefined' || !text) return false;
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = size / (n + 4);
    ctx.fillStyle = light; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = dark;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(Math.floor(x + (c + 2) * cell), Math.floor(y + (r + 2) * cell), Math.ceil(cell), Math.ceil(cell));
    return true;
  }
  function drawImageContain(ctx, img, x, y, w, h) {
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return { w: dw, h: dh };
  }

  // ---- slide decorations ----
  function slideBg(ctx, T, W, H, idx) {
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    if (T.deco === 'academic') {
      ctx.fillStyle = T.accent; ctx.fillRect(0, 0, W, 14);
      ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(88, H - 118); ctx.lineTo(W - 88, H - 118); ctx.stroke();
    } else if (T.deco === 'editorial') {
      ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = T.ink; ctx.font = fontStr(T.display, 640); ctx.textAlign = 'right';
      ctx.fillText(String(idx + 1), W - 40, H - 120); ctx.restore();
      ctx.fillStyle = T.ink; ctx.fillRect(0, 0, W, 22);
    } else if (T.deco === 'pastel') {
      ctx.save(); ctx.globalAlpha = 0.85;
      ctx.fillStyle = T.blobA; ctx.beginPath(); ctx.ellipse(W + 30, 90, 330, 280, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = T.blobB; ctx.beginPath(); ctx.ellipse(-40, H - 210, 250, 220, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (T.deco === 'tech') {
      ctx.fillStyle = T.line;
      for (let y = 30; y < H; y += 40) for (let x = 30; x < W; x += 40) ctx.fillRect(x, y, 2.2, 2.2);
      ctx.strokeStyle = T.accent; ctx.lineWidth = 4; const L = 44, m = 34;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke(); });
    }
  }

  // ---- bold (inverted) slide palettes ----
  const BOLD = {
    academic: { bg: '#13233A', ink: '#FFFFFF', muted: '#C3D2E2', accent: '#7FD0F2', line: 'rgba(255,255,255,0.22)', soft: 'rgba(255,255,255,0.12)', onAccent: '#13233A', surface: '#1D3150' },
    editorial: { bg: '#111111', ink: '#FFE04A', muted: '#E9E2B8', accent: '#FFFFFF', line: 'rgba(255,224,74,0.35)', soft: 'rgba(255,255,255,0.1)', onAccent: '#111111', surface: '#222222' },
    pastel: { bg: '#6544C9', ink: '#FFFFFF', muted: '#E6DDFF', accent: '#FFD3DF', line: 'rgba(255,255,255,0.28)', soft: 'rgba(255,255,255,0.16)', onAccent: '#6544C9', blobA: 'rgba(255,255,255,0.09)', blobB: 'rgba(255,255,255,0.06)', surface: '#7458D2' },
    tech: { bg: '#5CC8FF', ink: '#06121C', muted: '#123247', accent: '#06121C', line: 'rgba(6,18,28,0.25)', soft: 'rgba(6,18,28,0.1)', onAccent: '#5CC8FF', surface: '#86D8FF' },
  };
  const boldTheme = T => ({ ...T, ...(BOLD[T.deco] || {}) });
  function imageCover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function avatar(ctx, img, x, y, d, ring) {
    ctx.save(); ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); imageCover(ctx, img, x, y, d, d); ctx.restore();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.stroke(); }
  }

  // ---- automatic graphics ----
  function visualFor(s) {
    if (!s || s.visual === 'none') return null;
    if (s.type === 'stat') {
      const b = String(s.big || '');
      let m = b.match(/^\s*(\d+(?:\.\d+)?)\s?%\s*$/);
      if (m && +m[1] > 0 && +m[1] <= 100) return { kind: 'donut', v: +m[1] / 100 };
      m = b.match(/(\d+(?:\.\d+)?)\s?(×|x\b|times|-?fold)/i);
      if (m && +m[1] > 0 && +m[1] <= 20 && +m[1] !== 1) return { kind: 'bars', v: +m[1], label: b.trim() };
      m = b.replace(/,/g, '').match(/^\s*(\d{2,7})\s*$/);
      if (m && (s.role === 'sample' || s.bigLabel)) return { kind: 'people', n: +m[1] };
    }
    const st = (s.steps || []).map(x => String(x).trim()).filter(Boolean);
    if (st.length >= 2 && (s.type === 'text' || s.type === 'figure')) return { kind: 'steps', steps: st.slice(0, 4) };
    return null;
  }
  const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  function countUp(str, p) {
    if (p >= 1) return str;
    const m = str.match(/\d[\d,]*(?:\.\d+)?|\.\d+/); if (!m) return str;
    const tok = m[0], val = parseFloat(tok.replace(/,/g, '')); if (!isFinite(val)) return str;
    const dec = tok.includes('.') ? tok.split('.')[1].length : 0;
    let f = (val * p).toFixed(dec);
    if (tok.includes(',')) f = Number(f).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (tok.startsWith('.')) f = f.replace(/^0(?=\.)/, '');
    return str.replace(tok, f);
  }
  // how long a slide's entrance animation lasts, in seconds
  function animEnd(s) {
    const v = visualFor(s);
    let e = 2.2;
    if (s.type === 'list') e = Math.max(e, 0.9 + (s.bullets || []).filter(Boolean).length * 0.28);
    if (v && v.kind === 'steps') e = Math.max(e, 1.1 + v.steps.length * 0.3 + 0.4);
    if (v && v.kind === 'people') e = 2.6;
    if (s.type === 'cheat') e = Math.max(e, 1.2 + (s.items || []).length * 0.15);
    if (s.layout === 'quote') e = Math.max(e, 1.4);
    return e;
  }
  function person(ctx, x, y, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y + h * 0.18, h * 0.17, 0, Math.PI * 2); ctx.fill();
    rr(ctx, x - h * 0.26, y + h * 0.42, h * 0.52, h * 0.58, h * 0.2); ctx.fill();
  }

  // ---- slide ----
  // tt = seconds since the slide appeared (undefined = finished, static image)
  function renderSlide(cv, s, i, n, T, ctxData, tt) {
    if (T.deco === 'sheet') return renderSheetSlide(cv, s, i, n, T, ctxData);
    const W = 1080, H = 1350, P = 92;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    const warn = [];
    if (s.type === 'text' && s.layout === 'bold') T = boldTheme(T);
    const brand = ctxData.brand || {};
    const A = (start, dur = 0.45) => tt === undefined ? 1 : ease((tt - start) / dur);
    const layer = (a, dy, fn) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; if (a < 1) ctx.translate(0, (1 - a) * dy); fn(); ctx.restore(); };
    const lines = (start, step = 0.07) => tt === undefined ? null : k => A(start + k * step, 0.4);
    slideBg(ctx, T, W, H, i);
    // header
    const headY = P + 18;
    ctx.font = fontStr(T.mono, 26); ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.textBaseline = 'alphabetic';
    const kick = `${String(i + 1).padStart(2, '0')}  ${(s.label || '').toUpperCase()}`;
    ctx.save(); if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; ctx.fillText(kick, P, headY + 26);
    ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.fillText(`${i + 1}/${n}`, W - P, headY + 26); ctx.restore();
    // footer
    const footY = H - 74;
    const segW = (W - 2 * P - (n - 1) * 8) / n;
    const fillC = T.deco === 'editorial' ? T.ink : T.accent;
    for (let k = 0; k < n; k++) {
      const x = P + k * (segW + 8);
      ctx.fillStyle = T.line; ctx.globalAlpha = T.deco === 'editorial' ? 0.25 : 1; ctx.fillRect(x, footY + 36, segW, 6); ctx.globalAlpha = 1;
      if (k <= i) { ctx.fillStyle = fillC; ctx.fillRect(x, footY + 36, segW * (k === i ? A(0, 0.9) : 1), 6); }
    }
    ctx.font = fontStr(T.mono, 24); ctx.fillStyle = T.muted; ctx.textAlign = 'left';
    ctx.fillText(ctxData.footer || '', P, footY);
    if (i < n - 1) layer(A(1.6, 0.5), 0, () => {
      const cx = W - P - 32, cy = footY - 10;
      ctx.fillStyle = fillC; ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = T.deco === 'editorial' ? T.bg : T.onAccent; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 12, cy); ctx.moveTo(cx + 2, cy - 10); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx + 2, cy + 10); ctx.stroke();
    });
    const top = P + 110, bottom = H - 150, cw = W - 2 * P;
    const hl = T.accent;
    const lhB = 1.34;
    const words = P2P.wc(s.body || '') + (s.bullets ? s.bullets.reduce((a, b) => a + P2P.wc(b), 0) : 0) + P2P.wc(s.heading || '') + (s.steps ? s.steps.reduce((a, b) => a + P2P.wc(b), 0) : 0);
    const vis = visualFor(s);
    const badge = (name, d) => layer(A(0, 0.4), 0, () => iconBadge(ctx, T, name, P, top + 10, d));

    if (s.type === 'hook') {
      badge(s.icon || 'spark', 132);
      const hBox = { w: cw, h: 560 };
      const r = fit(ctx, s.heading, T.display, hBox, { max: 124, min: 60, lh: 1.08 });
      if (!r.ok) warn.push('Headline is too long to fit. Shorten it.');
      const hy = top + 210 + (hBox.h - r.h) / 2 * 0.4;
      drawText(ctx, r, T.display, P, hy, { lh: 1.08, color: T.ink, hl: T.accent, reveal: lines(0.25, 0.14) });
      let cx = P, cy = bottom - 200;
      ctx.font = fontStr(T.body, 28, T.body.bold);
      (ctxData.keywords || []).slice(0, 3).forEach((k, j) => {
        ctx.font = fontStr(T.body, 28, T.body.bold);
        const tw = ctx.measureText(k).width + 48; if (cx + tw > W - P) return;
        const x0 = cx;
        layer(A(0.9 + j * 0.12, 0.4), 20, () => {
          ctx.strokeStyle = fillC; ctx.lineWidth = 3; rr(ctx, x0, cy, tw, 62, T.deco === 'editorial' ? 0 : 31); ctx.stroke();
          ctx.fillStyle = fillC; ctx.fillText(k, x0 + 24, cy + 41);
        });
        cx += tw + 16;
      });
      layer(A(1.3), 0, () => {
        let tx = P;
        if (brand.avatar) { avatar(ctx, brand.avatar, P, bottom - 82, 72, fillC); tx = P + 90; }
        if (brand.handle) { ctx.font = fontStr(T.body, 32, T.body.bold); ctx.fillStyle = T.ink; ctx.fillText(brand.handle, tx, bottom - 50); tx += ctx.measureText(brand.handle).width + 22; ctx.fillStyle = T.muted; ctx.font = fontStr(T.body, 32); ctx.fillText('·', tx - 12, bottom - 50); tx += 10; }
        ctx.font = fontStr(T.body, 32); ctx.fillStyle = T.muted; ctx.fillText(s.body || '', tx, bottom - 50);
      });
    } else if (s.type === 'text' && s.layout === 'quote') {
      layer(A(0, 0.5), 0, () => { ctx.font = fontStr(T.display, 320); ctx.fillStyle = fillC; ctx.fillText('\u201C', P - 14, top + 260); });
      const b = fit(ctx, s.body, T.display, { w: cw, h: bottom - top - 380 }, { max: 78, min: 42, lh: 1.18 });
      if (!b.ok) warn.push('Text overflows the slide. Shorten it or swap the sentence.');
      let y = top + 270; y += drawText(ctx, b, T.display, P, y, { lh: 1.18, color: T.ink, hl: T.accent, reveal: lines(0.3, 0.1) }) + 46;
      const qy = y;
      layer(A(0.9), 0, () => { ctx.fillStyle = fillC; ctx.fillRect(P, qy, 64, 6); ctx.font = fontStr(T.mono, 28); ctx.fillStyle = T.muted; ctx.save(); if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'; ctx.fillText((s.heading || '').toUpperCase(), P + 88, qy + 12); ctx.restore(); });
    } else if (s.type === 'cheat') {
      const h = fit(ctx, s.heading, T.display, { w: cw, h: 170 }, { max: 80, min: 50, lh: 1.08 });
      let y = top + 20; y += drawText(ctx, h, T.display, P, y, { lh: 1.08, color: T.ink, hl: T.accent, reveal: lines(0.1, 0.1) }) + 40;
      const items = (s.items || []).filter(it => it && (it.title || it.text)).slice(0, 6);
      if (!items.length) warn.push('Add items to the cheat sheet.');
      const cols = items.length > 3 ? 2 : 1, rows = Math.max(1, Math.ceil(items.length / cols)), gap = 24;
      const cwid = (cw - gap * (cols - 1)) / cols, ch = Math.min(310, (bottom - y - gap * (rows - 1)) / rows);
      let over = false;
      items.forEach((it, k) => {
        const x = P + (k % cols) * (cwid + gap), yy = y + Math.floor(k / cols) * (ch + gap);
        layer(A(0.4 + k * 0.15, 0.45), 24, () => {
          ctx.fillStyle = T.surface; rr(ctx, x, yy, cwid, ch, Math.min(T.radius, 28)); ctx.fill();
          if (T.deco === 'editorial' || T.deco === 'tech') { ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.line; ctx.lineWidth = T.deco === 'editorial' ? 4 : 2; rr(ctx, x, yy, cwid, ch, Math.min(T.radius, 28)); ctx.stroke(); }
          ctx.fillStyle = fillC; ctx.fillRect(x + 28, yy + 26, 44, 6);
          const tr = fit(ctx, it.title || '', T.body, { w: cwid - 56, h: 92 }, { max: cols === 2 ? 34 : 40, min: 24, lh: 1.15, weight: T.body.bold, maxLines: 2 });
          let iy = yy + 50; iy += drawText(ctx, tr, T.body, x + 28, iy, { lh: 1.15, color: T.ink, weight: T.body.bold }) + 10;
          const txt = (it.big ? `*${it.big}* ` : '') + (it.text || '');
          const xr = fit(ctx, txt, T.body, { w: cwid - 56, h: yy + ch - iy - 20 }, { max: cols === 2 ? 30 : 36, min: 20, lh: 1.25 });
          if (!xr.ok) over = true;
          drawText(ctx, xr, T.body, x + 28, iy, { lh: 1.25, color: T.muted, hl: T.accent });
        });
      });
      if (over) warn.push('Some cheat-sheet text is too long. Shorten it.');
    } else if (s.type === 'text' || (s.type === 'figure' && !ctxData.figure)) {
      badge(s.icon || 'bulb', 112);
      const h = fit(ctx, s.heading, T.display, { w: cw, h: 200 }, { max: 82, min: 52, lh: 1.08 });
      let y = top + 170; y += drawText(ctx, h, T.display, P, y, { lh: 1.08, color: T.ink, reveal: lines(0.12, 0.1) }) + 44;
      if (T.deco !== 'tech') { const ry = y - 14; layer(1, 0, () => { ctx.fillStyle = fillC; ctx.fillRect(P, ry, 120 * A(0.35, 0.5), 8); }); y += 30; }
      const stepsH = vis && vis.kind === 'steps' ? vis.steps.length * 100 + 24 : 0;
      const b = fit(ctx, s.body, T.body, { w: cw, h: bottom - y - 20 - stepsH }, { max: stepsH ? 50 : (s.layout === 'bold' ? 66 : 62), min: 32, lh: lhB });
      if (!b.ok) warn.push('Text overflows the slide. Shorten it or swap the sentence.');
      y += drawText(ctx, b, T.body, P, y, { lh: lhB, color: T.ink, hl, reveal: lines(0.45) });
      if (stepsH) {
        let sy = y + 40;
        const d = 66, n2 = vis.steps.length;
        vis.steps.forEach((st, k) => {
          const a = A(1.1 + k * 0.3, 0.4);
          const cy = sy + k * 100;
          if (k < n2 - 1) layer(1, 0, () => { ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.line; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(P + d / 2, cy + d); ctx.lineTo(P + d / 2, cy + d + (100 - d) * A(1.3 + k * 0.3, 0.3)); ctx.stroke(); });
          layer(a, 16, () => {
            ctx.fillStyle = fillC; ctx.beginPath(); ctx.arc(P + d / 2, cy + d / 2, d / 2, 0, Math.PI * 2); ctx.fill();
            ctx.font = fontStr(T.body, 32, T.body.bold); ctx.fillStyle = T.deco === 'editorial' ? T.bg : T.onAccent; ctx.textAlign = 'center'; ctx.fillText(String(k + 1), P + d / 2, cy + d / 2 + 11); ctx.textAlign = 'left';
            const r = fit(ctx, st, T.body, { w: cw - d - 30, h: 60 }, { max: 40, min: 26, lh: 1.15, maxLines: 1, weight: T.body.bold });
            drawText(ctx, r, T.body, P + d + 28, cy + (d - r.size * 1.15) / 2, { lh: 1.15, color: T.ink, weight: T.body.bold });
          });
        });
      }
    } else if (s.type === 'list') {
      badge(s.icon || 'clipboard', 112);
      const h = fit(ctx, s.heading, T.display, { w: cw, h: 200 }, { max: 82, min: 52, lh: 1.08 });
      let y = top + 170; y += drawText(ctx, h, T.display, P, y, { lh: 1.08, color: T.ink, reveal: lines(0.12, 0.1) }) + 56;
      const bl = (s.bullets || []).filter(Boolean);
      const avail = bottom - y - 10, ind = 64, gap = 40;
      let size = 48, res;
      for (size = 48; size >= 30; size -= 2) { res = bl.map(t => measureAt(ctx, t, T.body, cw - ind, size, 1.3)); const tot = res.reduce((a, r) => a + r.h, 0) + gap * (bl.length - 1); if (tot <= avail) break; }
      if (size < 30) { size = 30; warn.push('Bullets overflow the slide. Remove one or shorten them.'); }
      bl.forEach((t, k) => {
        const r = res[k], y0 = y;
        layer(A(0.55 + k * 0.28, 0.45), 24, () => {
          ctx.fillStyle = fillC;
          if (T.deco === 'tech') { ctx.font = fontStr(T.mono, size * 0.8); ctx.fillText('>', P, y0 + size * 0.95); }
          else if (T.deco === 'editorial') ctx.fillRect(P, y0 + size * 0.42, 26, 26);
          else { ctx.beginPath(); ctx.arc(P + 14, y0 + size * 0.62, 12, 0, Math.PI * 2); ctx.fill(); }
          drawText(ctx, r, T.body, P + ind, y0, { lh: 1.3, color: T.ink, hl });
        });
        y += r.h + gap;
      });
    } else if (s.type === 'stat') {
      badge(s.icon || 'bars', 112);
      let y = top + 190;
      const big = (s.big || '').trim() || '—';
      if (!s.big) warn.push('Add the big number for this slide.');
      const side = vis && (vis.kind === 'donut' || vis.kind === 'bars');
      const numW = side ? cw * 0.56 : cw;
      ctx.font = fontStr(T.display, 100); const w100 = ctx.measureText(big).width;
      const bs = Math.max(100, Math.min(side ? 290 : 330, 100 * numW / Math.max(1, w100)));
      const shown = countUp(big, A(0.25, 1.1));
      layer(A(0.15, 0.35), 0, () => { ctx.font = fontStr(T.display, bs); ctx.fillStyle = T.accent; ctx.fillText(shown, P - bs * 0.03, y + bs * 0.82); });
      let numBottom = y + bs * 0.98;
      if (side) {
        const vx = P + cw * 0.6, vw = cw * 0.4, vh = 340, vy = y - 40;
        if (vis.kind === 'donut') {
          const cx = vx + vw / 2, cy = vy + vh / 2, r = Math.min(vw, vh) / 2 - 34;
          ctx.save(); ctx.lineWidth = 54; ctx.lineCap = T.deco === 'editorial' ? 'butt' : 'round';
          ctx.strokeStyle = T.deco === 'editorial' ? 'rgba(17,17,17,0.14)' : T.deco === 'tech' ? T.line : T.soft;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          const sweep = Math.PI * 2 * vis.v * A(0.35, 1.2);
          if (sweep > 0.01) { ctx.strokeStyle = T.accent; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + sweep); ctx.stroke(); }
          ctx.restore();
        } else {
          const base = vy + vh - 50, maxH = vh - 70, bw = 104, gap2 = 60;
          const v = vis.v, hMain = v >= 1 ? maxH : maxH * v, hRef = v >= 1 ? maxH / v : maxH;
          const g = A(0.45, 1.0);
          const x1 = vx + (vw - (bw * 2 + gap2)) / 2, x2 = x1 + bw + gap2;
          ctx.fillStyle = T.deco === 'editorial' ? 'rgba(17,17,17,0.22)' : T.line; ctx.fillRect(x1, base - hRef * g, bw, hRef * g);
          ctx.fillStyle = T.accent; ctx.fillRect(x2, base - hMain * g, bw, hMain * g);
          ctx.fillStyle = T.ink; ctx.fillRect(vx, base, vw, 3);
          layer(A(1.1), 0, () => {
            ctx.font = fontStr(T.body, 30, T.body.bold); ctx.textAlign = 'center';
            ctx.fillStyle = T.muted; ctx.fillText('1×', x1 + bw / 2, base + 40);
            ctx.fillStyle = T.accent; ctx.fillText(`${v}×`, x2 + bw / 2, base + 40); ctx.textAlign = 'left';
          });
        }
        numBottom = Math.max(numBottom, vy + vh);
      }
      y = numBottom;
      if (s.bigLabel) { const ly = y; layer(A(0.6), 16, () => { ctx.font = fontStr(T.body, 46, T.body.bold); ctx.fillStyle = T.ink; ctx.fillText(s.bigLabel, P, ly + 30); }); y += 70; }
      if (vis && vis.kind === 'people') {
        const cols = 15, rows = 2, total = cols * rows, gx = cw / cols, ph = 70, py = y + 20;
        for (let k = 0; k < total; k++) {
          const a = A(0.5 + k * 0.045, 0.3); if (a <= 0) continue;
          ctx.save(); ctx.globalAlpha = a; person(ctx, P + gx * (k % cols) + gx / 2, py + Math.floor(k / cols) * (ph + 16), ph, fillC); ctx.restore();
        }
        y = py + rows * (ph + 16);
        layer(A(1.9), 0, () => { ctx.font = fontStr(T.mono, 22); ctx.fillStyle = T.muted; ctx.fillText(`1 ICON ≈ ${Math.max(1, Math.round(vis.n / total)).toLocaleString('en-US')} PEOPLE`, P, y + 18); });
        y += 34;
      }
      if (s.ctx) { const cy2 = y; layer(A(0.8), 0, () => { ctx.font = fontStr(T.mono, 26); ctx.fillStyle = T.muted; ctx.fillText(String(s.ctx).toUpperCase(), P, cy2 + 26); }); y += 44; }
      y += 30;
      const ry = y; layer(1, 0, () => { ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.line; ctx.fillRect(P, ry, cw * A(0.7, 0.6), T.deco === 'editorial' ? 6 : 3); });
      y += 44;
      const b = fit(ctx, s.body, T.body, { w: cw, h: bottom - y }, { max: 50, min: 30, lh: lhB });
      if (!b.ok) warn.push('Caption overflows. Shorten it.');
      drawText(ctx, b, T.body, P, y, { lh: lhB, color: T.ink, hl, reveal: lines(0.9) });
    } else if (s.type === 'figure') {
      const h = fit(ctx, s.heading, T.display, { w: cw, h: 170 }, { max: 72, min: 48, lh: 1.08 });
      let y = top + 10; y += drawText(ctx, h, T.display, P, y, { lh: 1.08, color: T.ink, reveal: lines(0.1, 0.1) }) + 30;
      const b = fit(ctx, s.body, T.body, { w: cw, h: 300 }, { max: 44, min: 30, lh: 1.3 });
      if (!b.ok) warn.push('Text above the figure is too long. Shorten it.');
      y += drawText(ctx, b, T.body, P, y, { lh: 1.3, color: T.ink, hl, reveal: lines(0.35) }) + 36;
      const fh = bottom - y - 10, fy = y;
      layer(A(0.75, 0.6), 40, () => {
        ctx.fillStyle = '#FFFFFF'; rr(ctx, P, fy, cw, fh, Math.min(T.radius, 24)); ctx.fill();
        if (T.deco !== 'pastel') { ctx.strokeStyle = T.line; ctx.lineWidth = 2; rr(ctx, P, fy, cw, fh, Math.min(T.radius, 24)); ctx.stroke(); }
        drawImageContain(ctx, ctxData.figure, P + 24, fy + 24, cw - 48, fh - 48);
      });
    } else if (s.type === 'cite') {
      const h = fit(ctx, s.heading, T.display, { w: cw, h: 180 }, { max: 82, min: 52, lh: 1.08 });
      let y = top + 10; y += drawText(ctx, h, T.display, P, y, { lh: 1.08, color: T.ink, hl: T.accent, reveal: lines(0.1, 0.1) }) + 36;
      const m = ctxData.meta, pad = 44, iw = cw - 2 * pad;
      const t = fit(ctx, m.title, T.display, { w: iw, h: 220 }, { max: 52, min: 30, lh: 1.12 });
      const au = fit(ctx, (m.authors || []).join(', '), T.body, { w: iw, h: 84 }, { max: 30, min: 22, lh: 1.3 });
      const src = [m.journal, m.year].filter(Boolean).join(' · ');
      const cardH = pad * 2 + t.h + 18 + au.h + (src ? 48 : 0) + (m.doi ? 44 : 0);
      const cy0 = y;
      layer(A(0.35, 0.5), 30, () => {
        ctx.fillStyle = T.surface; rr(ctx, P, cy0, cw, cardH, T.radius); ctx.fill();
        if (T.deco === 'editorial' || T.deco === 'tech') { ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.line; ctx.lineWidth = T.deco === 'editorial' ? 5 : 2; rr(ctx, P, cy0, cw, cardH, T.radius); ctx.stroke(); }
        let iy = cy0 + pad;
        iy += drawText(ctx, t, T.display, P + pad, iy, { lh: 1.12, color: T.ink }) + 18;
        iy += drawText(ctx, au, T.body, P + pad, iy, { lh: 1.3, color: T.muted });
        ctx.font = fontStr(T.body, 28, T.body.bold); ctx.fillStyle = T.ink; if (src) { ctx.fillText(src, P + pad, iy + 36); iy += 48; }
        if (m.doi) { const d = fit(ctx, 'doi.org/' + m.doi, T.mono, { w: iw, h: 40 }, { max: 26, min: 18, lh: 1.2, maxLines: 1 }); drawText(ctx, d, T.mono, P + pad, iy + 8, { lh: 1.2, color: T.accent }); }
      });
      y += cardH + 44;
      // QR code + call to action
      let tx = P, tw = cw;
      const rowH = m.doi ? 230 : 160;
      if (m.doi) {
        const qs = 200, qy = y;
        layer(A(0.8, 0.4), 0, () => {
          qr(ctx, 'https://doi.org/' + m.doi, P, qy, qs, '#111111', '#FFFFFF');
          ctx.font = fontStr(T.mono, 20); ctx.fillStyle = T.muted; ctx.fillText('SCAN FOR THE PAPER', P, qy + qs + 28);
        });
        tx = P + qs + 44; tw = cw - qs - 44;
      }
      const c = fit(ctx, s.body, T.body, { w: tw, h: rowH }, { max: 40, min: 26, lh: 1.3 });
      drawText(ctx, c, T.body, tx, y, { lh: 1.3, color: T.ink, hl: T.accent, reveal: lines(1.0) });
      y += rowH + 30;
      // follow row
      if (brand.handle && y + 90 <= bottom) {
        const fy = Math.max(y, bottom - 96);
        layer(A(1.3, 0.5), 20, () => {
          ctx.fillStyle = fillC; rr(ctx, P, fy, cw, 96, T.deco === 'editorial' ? 0 : 48); ctx.fill();
          let fx = P + 24;
          if (brand.avatar) { avatar(ctx, brand.avatar, P + 12, fy + 12, 72, null); fx = P + 104; }
          ctx.font = fontStr(T.body, 34, T.body.bold); ctx.fillStyle = T.deco === 'editorial' ? T.bg : T.onAccent;
          ctx.fillText(`Follow ${brand.handle}`, fx, fy + 60);
          if (brand.series) { ctx.font = fontStr(T.body, 26); ctx.textAlign = 'right'; ctx.fillText(brand.series, P + cw - 34, fy + 58); ctx.textAlign = 'left'; }
        });
      }
    }
    const lim = s.type === 'list' ? 40 : 35;
    if (words > lim && s.type !== 'cite' && s.type !== 'hook') warn.push(`${words} words on this slide. Aim for ${lim - 5} or fewer.`);
    return warn;
  }

  // ---- 9:16 story / reel frame around a 4:5 slide ----
  function renderStory(ctx, slideCv, T, brand, meta) {
    const W = 1080, H = 1920;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(slideCv, 0, 285, W, 1350);
    ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.fillRect(0, 280, W, 5); ctx.fillRect(0, 1635, W, 5);
    ctx.textBaseline = 'alphabetic';
    let x = 92;
    if (brand && brand.avatar) { avatar(ctx, brand.avatar, 92, 150, 84, T.deco === 'editorial' ? T.ink : T.accent); x = 196; }
    ctx.font = fontStr(T.body, 38, T.body.bold); ctx.fillStyle = T.ink; ctx.fillText((brand && brand.handle) || (meta.title || '').slice(0, 34), x, 192);
    ctx.font = fontStr(T.mono, 26); ctx.fillStyle = T.muted; ctx.fillText(((brand && brand.series) || 'Research, explained').toUpperCase(), x, 232);
    if (meta.doi) { ctx.font = fontStr(T.mono, 30); ctx.fillStyle = T.muted; ctx.fillText('FULL PAPER', 92, 1730); ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.font = fontStr(T.mono, 32); ctx.fillText('doi.org/' + meta.doi, 92, 1780); }
  }

  // ---- graphical abstract (1600 x 900) ----
  function renderGA(ctx, d, T) {
    const W = 1600, H = 900, M = 64;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = T.banner; ctx.fillRect(0, 0, W, 230);
    const t = fit(ctx, d.meta.title, T.display, { w: W - 2 * M, h: 128 }, { max: 54, min: 30, lh: 1.1, maxLines: 2 });
    drawText(ctx, t, T.display, M, 36 + (128 - t.h) / 2, { lh: 1.1, color: T.bannerInk });
    const au = fit(ctx, (d.meta.authors || []).join(', '), T.body, { w: W - 2 * M, h: 34 }, { max: 24, min: 18, lh: 1.2, maxLines: 1 });
    drawText(ctx, au, T.body, M, 178, { lh: 1.2, color: T.bannerSub });
    const items = (d.items || []).slice(0, 4), n = Math.max(1, items.length);
    const gap = d.flow ? 64 : 32, pw = (W - 2 * M - gap * (n - 1)) / n, py = 280, ph = 470;
    items.forEach((it, k) => {
      const x = M + k * (pw + gap);
      ctx.fillStyle = T.surface; rr(ctx, x, py, pw, ph, Math.min(T.radius, 24)); ctx.fill();
      if (T.deco === 'editorial' || T.deco === 'tech') { ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.line; ctx.lineWidth = 3; rr(ctx, x, py, pw, ph, Math.min(T.radius, 24)); ctx.stroke(); }
      ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.fillRect(x + 28, py + 30, 48, 7);
      const tr = fit(ctx, it.title || '', T.body, { w: pw - 56, h: 84 }, { max: 32, min: 22, lh: 1.15, weight: T.body.bold, maxLines: 2 });
      let iy = py + 58; iy += drawText(ctx, tr, T.body, x + 28, iy, { lh: 1.15, color: T.ink, weight: T.body.bold }) + 14;
      let big = it.big, body = it.text || '';
      const lead = !big && body.match(/^\*([^*]+)\*\s*(.*)$/);
      if (lead) { big = lead[1]; body = lead[2]; }
      if (big) {
        ctx.font = fontStr(T.display, 100); const w100 = ctx.measureText(big).width;
        const bs = Math.min(110, 100 * (pw - 56) / Math.max(1, w100));
        ctx.font = fontStr(T.display, bs); ctx.fillStyle = T.accent; ctx.fillText(big, x + 26, iy + bs * 0.86); iy += bs + 14;
      }
      const xr = fit(ctx, body, T.body, { w: pw - 56, h: py + ph - iy - 24 }, { max: 30, min: 18, lh: 1.3 });
      drawText(ctx, xr, T.body, x + 28, iy, { lh: 1.3, color: T.muted, hl: T.accent });
      if (d.flow && k < n - 1) {
        const ax = x + pw + 14, ay = py + ph / 2;
        ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 34, ay); ctx.moveTo(ax + 22, ay - 12); ctx.lineTo(ax + 34, ay); ctx.lineTo(ax + 22, ay + 12); ctx.stroke();
      }
    });
    const cite = [d.cite, d.meta.journal].filter(Boolean).join(' · ');
    ctx.font = fontStr(T.body, 26, T.body.bold); ctx.fillStyle = T.ink; ctx.fillText(cite, M, 812);
    if (d.meta.doi) { ctx.font = fontStr(T.mono, 24); ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.fillText('doi.org/' + d.meta.doi, M, 852); qr(ctx, 'https://doi.org/' + d.meta.doi, W - M - 112, 770, 112, '#111111', '#FFFFFF'); }
  }

  // ---- poster ----
  const POSTER_SIZES = {
    a0l: { label: 'A0 landscape (1189 × 841 mm)', w: 3370, h: 2384, cols: 3 },
    a0: { label: 'A0 portrait (841 × 1189 mm)', w: 2384, h: 3370, cols: 3 },
    us48: { label: '48 × 36 in landscape', w: 3456, h: 2592, cols: 3 },
  };

  function posterLayout(ctx, P, meta, T, size, figs) {
    const W = size.w, H = size.h, M = 96;
    // banner
    const bw = W - 2 * M;
    const qrS = meta.doi ? 0 : 0;
    const title = fit(ctx, meta.title, T.display, { w: bw, h: 380 }, { max: 132, min: 72, lh: 1.08, maxLines: 3 });
    const au = measureAt(ctx, meta.authors.join(', '), T.body, bw, 46, 1.3, T.body.bold);
    const af = measureAt(ctx, meta.affiliations.join('   ·   '), T.body, bw, 32, 1.3);
    const bannerH = M + title.h + 34 + au.h + (meta.affiliations.length ? 14 + af.h : 0) + 70;
    const footH = 330;
    const colTop = bannerH + 70, colBot = H - footH - 60;
    const gut = 64, cols = size.cols;
    const cw = (W - 2 * M - gut * (cols - 1)) / cols;
    const pad = 46, inner = cw - 2 * pad, headH = 58 * 1.15 + 22, gap = 40;
    const blocks = P.blocks.filter(b => {
      if (b.kind === 'figure') return b.figureId && figs[b.figureId];
      if (b.kind === 'bullets') return (b.bullets || []).some(Boolean);
      if (b.kind === 'stats') return (b.stats || []).some(x => x.big);
      return (b.text || '').trim();
    });
    function measureBlock(b, s) {
      const hr = b.kind === 'callout' ? null : fit(ctx, b.heading || '', T.display, { w: inner, h: 58 * 1.15 * 2 }, { max: 58, min: 44, lh: 1.15, maxLines: 2 });
      let h = pad * 2 + (hr ? hr.lines.length * hr.size * 1.15 + 22 : 0);
      if (b.kind === 'text') h += measureAt(ctx, b.text, T.body, inner, s, 1.38).h;
      else if (b.kind === 'callout') h += 40 + 22 + measureAt(ctx, b.text, T.display, inner, s * 1.3, 1.22).h;
      else if (b.kind === 'bullets') h += b.bullets.filter(Boolean).reduce((a, t) => a + measureAt(ctx, t, T.body, inner - 44, s, 1.36).h + s * 0.55, 0);
      else if (b.kind === 'stats') h += b.stats.filter(x => x.big).reduce((a, x) => a + 128 + 12 + measureAt(ctx, x.label, T.body, inner, s, 1.32).h + 40, -40);
      else if (b.kind === 'figure') { const img = figs[b.figureId]; const ar = img && img.width > 0 && img.height > 0 ? img.height / img.width : 0.66; h += Math.min(1200, inner * ar) + (b.caption ? 18 + measureAt(ctx, b.caption, T.body, inner, s * 0.85, 1.32).h : 0); }
      return h;
    }
    const colH = colBot - colTop;
    const byCol = Array.from({ length: cols }, (_, c) => blocks.filter(b => Math.min(b.col, cols - 1) === c));
    let s = 42, overflow = false;
    for (s = 42; s >= 24; s--) {
      const ok = byCol.every(list => list.reduce((a, b) => a + measureBlock(b, s), 0) + gap * Math.max(0, list.length - 1) <= colH);
      if (ok) break;
    }
    if (s < 24) { s = 24; overflow = true; }
    const colOver = byCol.map(list => list.reduce((a, b) => a + measureBlock(b, s), 0) + gap * Math.max(0, list.length - 1) > colH);
    return { W, H, M, title, au, af, bannerH, footH, colTop, colBot, gut, cols, cw, pad, inner, headH, gap, byCol, s, overflow, colOver, measureBlock };
  }

  // ---- billboard poster: one big message, key numbers, one visual, short side notes ----
  const BAND = {
    academic: { bg: '#13233A', ink: '#FFFFFF', emph: '#7FD0F2', label: '#B9CADB' },
    editorial: { bg: '#111111', ink: '#FFE04A', emph: '#FFFFFF', label: '#F2EBC7' },
    pastel: { bg: '#6544C9', ink: '#FFFFFF', emph: '#FFD3DF', label: '#E4DBFF' },
    tech: { bg: '#161C26', ink: '#E8EEF5', emph: '#5CC8FF', label: '#A3B1C2' },
  };
  const EFFECT = { benefit: ['Benefit', '#2E7D4F'], mixed: ['Mixed', '#A35F00'], none: ['No clear effect', '#56616B'], risk: ['Risk', '#B3261E'] };
  const bbWords = bb => [bb.statement, ...(bb.numbers || []).map(n => n.big + ' ' + n.label), bb.background, ...(bb.method || []), ...(bb.meaning || []), ...(bb.limits || []), ...(bb.grid || []).map(r => r.outcome), ...(bb.items || []).map(i => i.title + ' ' + i.text)].filter(Boolean).join(' ').replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
  function visualsFor(bb, figs) {
    const have = { prisma: bb.prisma && ['identified', 'screened', 'fulltext', 'included'].filter(k => bb.prisma[k] != null).length >= 2, grid: (bb.grid || []).filter(r => r.outcome).length >= 2, figure: !!(bb.figureId && figs[bb.figureId]), items: (bb.items || []).length >= 2 };
    if (bb.visual && bb.visual !== 'auto') return bb.visual === 'none' || !have[bb.visual] ? [] : [bb.visual];
    return ['prisma', 'figure', 'grid', 'items'].filter(k => have[k]).slice(0, 2);
  }
  function card(ctx, T, x, y, w, h, r) {
    ctx.fillStyle = T.surface; rr(ctx, x, y, w, h, r ?? T.radius * 1.4); ctx.fill();
    if (T.deco === 'editorial') { ctx.fillStyle = T.ink; ctx.fillRect(x, y, w, 10); }
    else if (T.deco === 'tech') { ctx.strokeStyle = T.line; ctx.lineWidth = 2; rr(ctx, x, y, w, h, r ?? T.radius * 1.4); ctx.stroke(); }
  }
  function cardHead(ctx, T, text, x, y, w) {
    const hr = fit(ctx, text, T.display, { w, h: 58 * 1.15 * 2 }, { max: 56, min: 42, lh: 1.15, maxLines: 2 });
    drawText(ctx, hr, T.display, x, y, { lh: 1.15, color: T.deco === 'editorial' ? T.ink : T.accent });
    return hr.lines.length * hr.size * 1.15 + 20;
  }
  function drawPrisma(ctx, T, p, x, y, w, h) {
    const pad = 44; card(ctx, T, x, y, w, h);
    let cy = y + pad; cy += cardHead(ctx, T, 'How studies were selected', x + pad, cy, w - 2 * pad) + 6;
    const screenedN = p.screened != null ? p.screened : (p.identified != null && p.duplicates != null ? p.identified - p.duplicates : null);
    const stages = [['Records identified', p.identified], [p.screened != null ? 'Records screened' : 'After duplicates removed', screenedN], ['Full texts assessed', p.fulltext], ['Studies included', p.included]].filter(s => s[1] != null);
    const exLabels = { 0: p.duplicates != null && p.screened != null && p.identified - p.screened === p.duplicates ? 'Duplicates removed' : 'Removed or excluded', 1: 'Excluded at title and abstract', 2: 'Excluded after full-text review' };
    const n = stages.length, avail = y + h - pad - cy; let gap = 54, bh = Math.min(170, (avail - gap * (n - 1)) / n);
    if (bh < 120) { gap = 34; bh = Math.min(170, (avail - gap * (n - 1)) / n); }
    const mw = (w - 2 * pad) * 0.56, ex = x + pad + mw + 70, ew = x + w - pad - ex;
    const fmt = v => Number(v).toLocaleString('en-US');
    stages.forEach(([label, v], k) => {
      const by = cy + k * (bh + gap), last = k === n - 1;
      ctx.fillStyle = last ? (T.deco === 'editorial' ? T.ink : T.accent) : T.bg; rr(ctx, x + pad, by, mw, bh, 16); ctx.fill();
      if (!last) { ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.lineWidth = 4; rr(ctx, x + pad, by, mw, bh, 16); ctx.stroke(); }
      const onC = last ? (T.deco === 'editorial' ? T.bg : T.onAccent) : T.ink;
      ctx.font = fontStr(T.body, 30, T.body.bold); ctx.fillStyle = onC; ctx.fillText(label, x + pad + 28, by + bh * 0.4);
      ctx.font = fontStr(T.display, Math.min(60, bh * 0.38)); ctx.fillText(`n = ${fmt(v)}`, x + pad + 28, by + bh * 0.82);
      if (k < n - 1) {
        const ax = x + pad + mw / 2, a1 = by + bh, a2 = by + bh + gap;
        ctx.strokeStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ax, a1 + 6); ctx.lineTo(ax, a2 - 8); ctx.moveTo(ax - 12, a2 - 20); ctx.lineTo(ax, a2 - 8); ctx.lineTo(ax + 12, a2 - 20); ctx.stroke();
        const diff = v - stages[k + 1][1];
        if (diff > 0 && ew > 160) {
          const ey = a1 + gap / 2 - bh * 0.42, eh = bh * 0.84;
          ctx.beginPath(); ctx.moveTo(ax, a1 + gap / 2); ctx.lineTo(ex - 6, a1 + gap / 2); ctx.stroke();
          ctx.fillStyle = T.bg; rr(ctx, ex, ey, ew, eh, 14); ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 3; rr(ctx, ex, ey, ew, eh, 14); ctx.stroke();
          const lr = fit(ctx, exLabels[k] || 'Excluded', T.body, { w: ew - 40, h: eh * 0.5 }, { max: 26, min: 18, lh: 1.15, maxLines: 2 });
          drawText(ctx, lr, T.body, ex + 20, ey + 14, { lh: 1.15, color: T.muted });
          ctx.font = fontStr(T.body, 34, T.body.bold); ctx.fillStyle = T.ink; ctx.fillText(`n = ${fmt(diff)}`, ex + 20, ey + eh - 22);
        }
      }
    });
  }
  function drawGrid(ctx, T, rows, x, y, w, h) {
    const pad = 44; card(ctx, T, x, y, w, h);
    let cy = y + pad; cy += cardHead(ctx, T, 'What the studies found', x + pad, cy, w - 2 * pad);
    const list = rows.filter(r => r.outcome).slice(0, 6), rh = Math.min(96, (y + h - pad - cy) / Math.max(1, list.length));
    list.forEach((r, k) => {
      const ry = cy + k * rh, [lab, col] = EFFECT[r.effect] || EFFECT.mixed;
      if (k) { ctx.fillStyle = T.line; ctx.fillRect(x + pad, ry, w - 2 * pad, 2); }
      const pw = 270, ph = Math.min(60, rh - 22);
      const tr = fit(ctx, r.outcome, T.body, { w: w - 2 * pad - pw - 30, h: rh - 10 }, { max: 36, min: 24, lh: 1.15, maxLines: 2, weight: T.body.bold });
      drawText(ctx, tr, T.body, x + pad, ry + (rh - tr.lines.length * tr.size * 1.15) / 2, { lh: 1.15, color: T.ink, weight: T.body.bold });
      ctx.fillStyle = col; rr(ctx, x + w - pad - pw, ry + (rh - ph) / 2, pw, ph, ph / 2); ctx.fill();
      ctx.font = fontStr(T.body, 27, T.body.bold); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(lab, x + w - pad - pw / 2, ry + rh / 2 + 10); ctx.textAlign = 'left';
    });
  }
  function drawItems(ctx, T, items, x, y, w, h) {
    const pad = 44; card(ctx, T, x, y, w, h);
    let cy = y + pad; cy += cardHead(ctx, T, 'At a glance', x + pad, cy, w - 2 * pad);
    const list = items.slice(0, 6), cols = list.length > 3 ? 2 : 1, rows = Math.ceil(list.length / cols), g = 24;
    const cwid = (w - 2 * pad - g * (cols - 1)) / cols, chh = (y + h - pad - cy - g * (rows - 1)) / rows;
    list.forEach((it, k) => {
      const ix = x + pad + (k % cols) * (cwid + g), iy = cy + Math.floor(k / cols) * (chh + g);
      ctx.fillStyle = T.bg; rr(ctx, ix, iy, cwid, chh, 14); ctx.fill();
      ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; ctx.fillRect(ix + 24, iy + 22, 48, 7);
      const tr = fit(ctx, it.title, T.body, { w: cwid - 48, h: cols === 1 ? 110 : 90 }, { max: cols === 1 ? 50 : 38, min: 26, lh: 1.15, maxLines: 2, weight: T.body.bold });
      let ty = iy + 46; ty += drawText(ctx, tr, T.body, ix + 24, ty, { lh: 1.15, color: T.ink, weight: T.body.bold }) + 8;
      const xr = fit(ctx, it.text, T.body, { w: cwid - 48, h: iy + chh - ty - 16 }, { max: cols === 1 ? 42 : 32, min: 22, lh: 1.25 });
      drawText(ctx, xr, T.body, ix + 24, ty, { lh: 1.25, color: T.muted, hl: T.accent });
    });
  }
  function drawFigure(ctx, T, img, caption, x, y, w, h) {
    const pad = 44; card(ctx, T, x, y, w, h);
    const ch = caption ? 80 : 0;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + pad, y + pad, w - 2 * pad, h - 2 * pad - ch);
    drawImageContain(ctx, img, x + pad, y + pad, w - 2 * pad, h - 2 * pad - ch);
    if (caption) { const cr = fit(ctx, caption, T.body, { w: w - 2 * pad, h: 70 }, { max: 28, min: 20, lh: 1.25, maxLines: 2 }); drawText(ctx, cr, T.body, x + pad, y + h - pad - ch + 14, { lh: 1.25, color: T.muted }); }
  }
  // side notes: cards sharing one text size
  function sideCards(bb) {
    return [['background', 'Background', bb.background ? [bb.background] : [], false], ['method', 'Method', (bb.method || []).filter(Boolean), true], ['meaning', 'What it means', (bb.meaning || []).filter(Boolean), true], ['limits', 'Limitations', (bb.limits || []).filter(Boolean), true]].filter(c => c[2].length);
  }
  function fitSide(ctx, T, cards, w, h, gap) {
    let list = cards.slice(), hidden = [];
    for (;;) {
      const L = layoutSide(ctx, T, list, w, h, gap);
      if (L.ok || list.length <= 1) return { list, L, hidden };
      const dropIdx = ['meaning', 'background', 'limits', 'method'].map(id => list.findIndex(c => c[0] === id)).find(i => i >= 0);
      hidden.push(list[dropIdx][1]); list.splice(dropIdx, 1);
    }
  }
  function layoutSide(ctx, T, cards, w, h, gap) {
    const pad = 40, inner = w - 2 * pad;
    const hOf = (c, s) => { let t = pad * 2 + 58 * 1.15 + 20; for (const line of c[2]) t += measureAt(ctx, line, T.body, c[3] ? inner - 40 : inner, s, 1.36).h + (c[3] ? s * 0.5 : 0); return t; };
    for (let s = 36; s >= 24; s--) { const tot = cards.reduce((a, c) => a + hOf(c, s), 0) + gap * Math.max(0, cards.length - 1); if (tot <= h) return { s, hOf, ok: true }; }
    return { s: 24, hOf, ok: false };
  }
  function drawSide(ctx, T, cards, x, y, w, L, gap, rects) {
    const pad = 40, inner = w - 2 * pad; let cy = y;
    for (const c of cards) {
      const h = L.hOf(c, L.s); card(ctx, T, x, cy, w, h);
      let iy = cy + pad; iy += cardHead(ctx, T, c[1], x + pad, iy, inner);
      for (const line of c[2]) {
        if (c[3]) { ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; if (T.deco === 'editorial') ctx.fillRect(x + pad, iy + L.s * 0.45, L.s * 0.5, L.s * 0.5); else { ctx.beginPath(); ctx.arc(x + pad + 10, iy + L.s * 0.68, L.s * 0.22, 0, Math.PI * 2); ctx.fill(); } }
        iy += drawText(ctx, measureAt(ctx, line, T.body, c[3] ? inner - 40 : inner, L.s, 1.36), T.body, c[3] ? x + pad + 40 : x + pad, iy, { lh: 1.36, color: T.ink, hl: T.accent }) + (c[3] ? L.s * 0.5 : 0);
      }
      rects.push({ id: c[0], x, y: cy, w, h }); cy += h + gap;
    }
  }
  function drawNumbers(ctx, T, nums, x, y, w, h) {
    const list = nums.filter(n => n && n.big).slice(0, 3); if (!list.length) return;
    const cw = w / list.length;
    ctx.font = fontStr(T.display, 100);
    const bs = Math.min(220, h * 0.62, ...list.map(n => 100 * (cw - 100) / Math.max(1, ctx.measureText(n.big).width)));
    list.forEach((n, k) => {
      const cx = x + k * cw;
      if (k) { ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.line; ctx.fillRect(cx, y + 20, T.deco === 'editorial' ? 6 : 3, h - 40); }
      ctx.font = fontStr(T.display, bs); ctx.fillStyle = T.accent; ctx.fillText(n.big, cx + (k ? 60 : 0), y + bs * 0.9);
      const lr = fit(ctx, n.label || '', T.body, { w: cw - 80, h: h - bs - 20 }, { max: 40, min: 26, lh: 1.2, maxLines: 2, weight: T.body.bold });
      drawText(ctx, lr, T.body, cx + (k ? 60 : 0), y + bs + 16, { lh: 1.2, color: T.ink, weight: T.body.bold });
    });
  }
  function drawBand(ctx, T, bb, meta, x, y, w, h, M, round) {
    const B = BAND[T.deco] || BAND.academic;
    ctx.fillStyle = B.bg; if (round) { rr(ctx, x, y, w, h, T.radius * 1.6); ctx.fill(); } else ctx.fillRect(x, y, w, h);
    if (T.deco === 'tech') { ctx.fillStyle = T.accent; ctx.fillRect(x, y, w, 8); ctx.fillRect(x, y + h - 8, w, 8); }
    if (T.deco === 'editorial') { ctx.fillStyle = T.accent; ctx.fillRect(x, y + h - 20, w, 20); }
    const ix = x + M, iw = w - 2 * M;
    let cy = y + M * 0.9;
    ctx.save(); ctx.font = fontStr(T.mono, 40); ctx.fillStyle = B.label; if ('letterSpacing' in ctx) ctx.letterSpacing = '6px'; ctx.fillText((bb.label || 'Main finding').toUpperCase(), ix, cy + 36); ctx.restore();
    cy += 90;
    const side = meta.doi && iw > 1300, qs = side ? 300 : 0, qw = side ? qs + 90 : 0;
    const bottomRow = meta.doi && !side ? 230 : 0;
    const sh = y + h - M * 0.75 - cy - bottomRow;
    const sr = fit(ctx, bb.statement || '', T.display, { w: iw - qw, h: sh }, { max: 176, min: 80, lh: 1.12 });
    drawText(ctx, sr, T.display, ix, cy + Math.max(0, (sh - sr.h) / 2), { lh: 1.12, color: B.ink, hl: B.emph });
    if (meta.doi) {
      const size = side ? qs : 200, qx = ix + iw - size, qy = side ? y + h - M * 0.75 - qs - 90 : y + h - M * 0.75 - size;
      qr(ctx, 'https://doi.org/' + meta.doi, qx, qy, size, '#111111', '#FFFFFF');
      ctx.textAlign = 'right';
      const tx = side ? qx + size : qx - 40;
      ctx.font = fontStr(T.body, side ? 34 : 46, T.body.bold); ctx.fillStyle = B.ink; ctx.fillText('Scan for the full paper', tx, side ? qy + qs + 52 : qy + size / 2);
      const d = fit(ctx, 'doi.org/' + meta.doi, T.mono, { w: side ? qw - 20 : iw - size - 80, h: 40 }, { max: 30, min: 16, lh: 1.2, maxLines: 1 });
      ctx.font = fontStr(T.mono, d.size); ctx.fillStyle = B.label; ctx.fillText('doi.org/' + meta.doi, tx, side ? qy + qs + 90 : qy + size / 2 + 50);
      ctx.textAlign = 'left';
    }
    return sr;
  }
  function renderBillboard(ctx, P, meta, T, size, figs) {
    const W = size.w, H = size.h, M = 110, bb = P.bb, rects = [], warn = [];
    const land = W > H;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    if (T.deco === 'tech') { ctx.fillStyle = T.line; for (let y = 40; y < H; y += 56) for (let x = 40; x < W; x += 56) ctx.fillRect(x, y, 3, 3); }
    if (T.deco === 'pastel') { ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = T.blobB; ctx.beginPath(); ctx.ellipse(-120, H * 0.78, 520, 460, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.blobA; ctx.beginPath(); ctx.ellipse(W + 140, 260, 560, 420, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    // header
    let y = M;
    const title = fit(ctx, meta.title, T.display, { w: W - 2 * M, h: land ? 260 : 380 }, { max: land ? 100 : 108, min: 72, lh: 1.08, maxLines: 3 });
    if (!title.ok) warn.push('Title is too long for three lines at 72 pt. Shorten it.');
    y += drawText(ctx, title, T.display, M, y, { lh: 1.08, color: T.ink }) + 26;
    const au = fit(ctx, (meta.authors || []).join(', '), T.body, { w: W - 2 * M, h: 110 }, { max: 44, min: 30, lh: 1.25, maxLines: 2, weight: T.body.bold });
    y += drawText(ctx, au, T.body, M, y, { lh: 1.25, color: T.ink, weight: T.body.bold }) + 8;
    if ((meta.affiliations || []).length) { const af = fit(ctx, meta.affiliations.join('   ·   '), T.body, { w: W - 2 * M, h: 80 }, { max: 30, min: 24, lh: 1.25, maxLines: 2 }); y += drawText(ctx, af, T.body, M, y, { lh: 1.25, color: T.muted }); }
    y += 70;
    // footer
    const footH = 230, fy = H - footH;
    const fInk = T.deco === 'editorial' ? T.bg : T.ink, fMuted = T.deco === 'editorial' ? '#E8DFB0' : T.muted;
    ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.surface; ctx.fillRect(0, fy, W, footH);
    const cite = [meta.authors && meta.authors.length > 2 ? meta.authors[0] + ' et al.' : (meta.authors || []).join(' & '), meta.year ? `(${meta.year})` : '', meta.journal].filter(Boolean).join(' ');
    const cr = fit(ctx, cite || meta.title, T.body, { w: W * 0.55, h: 90 }, { max: 34, min: 24, lh: 1.25, weight: T.body.bold, maxLines: 2 });
    drawText(ctx, cr, T.body, M, fy + 70, { lh: 1.25, color: fInk, weight: T.body.bold });
    if (meta.keywords && meta.keywords.length) {
      ctx.font = fontStr(T.body, 28);
      const room = W - 2 * M - cr.widest - 80; let kw = meta.keywords.slice(0, 4);
      while (kw.length && ctx.measureText(kw.join('  ·  ')).width > room) kw = kw.slice(0, -1);
      if (kw.length) { ctx.fillStyle = fMuted; ctx.textAlign = 'right'; ctx.fillText(kw.join('  ·  '), W - M, fy + 100); ctx.textAlign = 'left'; }
    }
    const bottom = fy - 70, gap = 40;
    const vis = visualsFor(bb, figs), side = sideCards(bb);
    const drawVis = (kinds, x, vy, w, h) => {
      if (!kinds.length) return;
      const hs = kinds.length === 2 ? [h * 0.58 - gap / 2, h * 0.42 - gap / 2] : [h];
      let cy = vy;
      kinds.forEach((k, i) => {
        if (k === 'prisma') drawPrisma(ctx, T, bb.prisma, x, cy, w, hs[i]);
        else if (k === 'grid') drawGrid(ctx, T, bb.grid, x, cy, w, hs[i]);
        else if (k === 'figure') drawFigure(ctx, T, figs[bb.figureId], bb.caption, x, cy, w, hs[i]);
        else if (k === 'items') drawItems(ctx, T, bb.items, x, cy, w, hs[i]);
        cy += hs[i] + gap;
      });
      rects.push({ id: 'visual', x, y: vy, w, h });
    };
    let sideOk = true, bodyPt = 0, statementPt = 0;
    if (!land) {
      // portrait: full-width band, numbers strip, then visual + side notes
      const nums0 = (bb.numbers || []).filter(n => n && n.big);
      const bandH = Math.round(Math.max(700, Math.min(1100, bottom - y - (nums0.length ? 400 : 0) - 70 - 1150)));
      const sr = drawBand(ctx, T, bb, meta, 0, y, W, bandH, M, false); statementPt = sr.size;
      if (!sr.ok) warn.push('The main finding is too long to fit in large type. Shorten it to one sentence.');
      rects.push({ id: 'statement', x: 0, y, w: W, h: bandH });
      y += bandH + 70;
      const nums = (bb.numbers || []).filter(n => n && n.big);
      if (nums.length) { drawNumbers(ctx, T, nums, M, y, W - 2 * M, 330); rects.push({ id: 'numbers', x: M, y, w: W - 2 * M, h: 330 }); y += 330 + 60; }
      const lowerH = bottom - y;
      if (vis.length && side.length === 1) {
        // one short note: full width on top, the visual full width below
        const L = layoutSide(ctx, T, side, W - 2 * M, lowerH * 0.4, gap); sideOk = L.ok; bodyPt = L.s;
        const sh = L.hOf(side[0], L.s);
        drawSide(ctx, T, side, M, y, W - 2 * M, L, gap, rects);
        drawVis(vis, M, y + sh + gap, W - 2 * M, lowerH - sh - gap);
      } else if (vis.length && side.length) {
        const vw = (W - 2 * M - gap) * 0.56, sw = W - 2 * M - gap - vw;
        drawVis(vis, M, y, vw, lowerH);
        const F = fitSide(ctx, T, side, sw, lowerH, gap); sideOk = F.L.ok; bodyPt = F.L.s;
        if (F.hidden.length) warn.push(`Hidden to make space: ${F.hidden.join(', ')}. Shorten the other notes to bring ${F.hidden.length > 1 ? 'them' : 'it'} back.`);
        drawSide(ctx, T, F.list, M + vw + gap, y, sw, F.L, gap, rects);
      } else if (vis.length) drawVis(vis, M, y, W - 2 * M, lowerH);
      else if (side.length) {
        const half = Math.ceil(side.length / 2), sw = (W - 2 * M - gap) / 2;
        const A = side.slice(0, half), Bs = side.slice(half);
        const LA = layoutSide(ctx, T, A, sw, lowerH, gap), LB = Bs.length ? layoutSide(ctx, T, Bs, sw, lowerH, gap) : LA;
        const s = Math.min(LA.s, LB.s); sideOk = LA.ok && LB.ok; bodyPt = s;
        drawSide(ctx, T, A, M, y, sw, { ...LA, s }, gap, rects); if (Bs.length) drawSide(ctx, T, Bs, M + sw + gap, y, sw, { ...LB, s }, gap, rects);
      }
    } else {
      // landscape: notes | big message + numbers | visual + notes
      const colH = bottom - y, lw = (W - 2 * M - 2 * gap) * 0.25, cw = (W - 2 * M - 2 * gap) - 2 * lw;
      const cx = M + lw + gap, rx = cx + cw + gap;
      const nums = (bb.numbers || []).filter(n => n && n.big);
      const bandH = nums.length ? colH - 330 - 50 : colH;
      const sr = drawBand(ctx, T, bb, meta, cx, y, cw, bandH, 90, true); statementPt = sr.size;
      if (!sr.ok) warn.push('The main finding is too long to fit in large type. Shorten it to one sentence.');
      rects.push({ id: 'statement', x: cx, y, w: cw, h: bandH });
      if (nums.length) { drawNumbers(ctx, T, nums, cx, y + bandH + 50, cw, 330); rects.push({ id: 'numbers', x: cx, y: y + bandH + 50, w: cw, h: 330 }); }
      const A = side.filter(c => c[0] === 'background' || c[0] === 'method'), Bs = side.filter(c => c[0] === 'meaning' || c[0] === 'limits');
      const vH = vis.length ? (Bs.length ? colH * 0.55 : colH) : 0;
      const LA = layoutSide(ctx, T, A.length ? A : Bs, lw, colH, gap);
      const LB = Bs.length && vis.length ? layoutSide(ctx, T, Bs, lw, colH - vH - gap, gap) : LA;
      const s = Math.min(LA.s, LB.s); sideOk = LA.ok && LB.ok; bodyPt = s;
      if (A.length) drawSide(ctx, T, A, M, y, lw, { ...LA, s }, gap, rects);
      if (vis.length) drawVis(vis.slice(0, 1), rx, y, lw, vH);
      if (Bs.length) drawSide(ctx, T, Bs, rx, vis.length ? y + vH + gap : y, lw, { ...(vis.length ? LB : LA), s }, gap, rects);
      if (!A.length && Bs.length && !vis.length) { /* everything already placed on the right */ }
    }
    if (!sideOk) warn.push('The side notes do not fit even at 24 pt. Shorten Background, Method or Limitations.');
    const words = bbWords(bb);
    if (words > 320) warn.push(`About ${words} words. Billboard posters work best under 300: trim the side notes.`);
    return { rects, bodyPt: bodyPt || 0, titlePt: title.size, statementPt, words, warn };
  }

  // ---- story poster: header, take-home strip, numbered sections in columns ----
  const STORY_COLS_LAND = { question: 0, method: 0, result: 1, findings: 2, why: 2 };
  const STORY_COLS_PORT = { question: 0, method: 0, findings: 0, result: 1, why: 1 };
  function renderStoryPoster(ctx, P, meta, T, size, figs) {
    const st = P.story, W = size.w, H = size.h, land = W > H;
    const u = land ? W / 2000 : W / 1500;
    const M = 68 * u, warn = [], rects = [];
    const B = BAND[T.deco] || BAND.academic;
    const ink = T.ink, muted = T.muted, acc = T.deco === 'editorial' ? T.accent : T.accent;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    // ---------- header ----------
    const lgo = meta.logo && meta.logo.width > 0 ? meta.logo : null;
    const rightW = (st.conference || st.posterNo || lgo) ? 560 * u : 0;
    let y = 50 * u;
    const eyebrow = st.eyebrow || '';
    const titleBox = { w: W - 2 * M - rightW - (rightW ? 40 * u : 0), h: 200 * u };
    const tr = fit(ctx, meta.title, T.display, titleBox, { max: 78 * u, min: Math.max(72, 50 * u), lh: 1.1, maxLines: 3 });
    if (!tr.ok) warn.push('The title is long for the header. Shorten it or use a shorter running title.');
    const au = fit(ctx, (meta.authors || []).join(', ') + ((meta.affiliations || [])[0] ? '  ·  ' + meta.affiliations[0] : ''), T.body, { w: titleBox.w, h: 70 * u }, { max: 26 * u, min: 20 * u, lh: 1.25, maxLines: 2 });
    const headH = 50 * u + (eyebrow ? 46 * u : 0) + tr.h + 18 * u + au.h + 44 * u;
    ctx.fillStyle = B.bg; ctx.fillRect(0, 0, W, headH);
    if (T.deco === 'editorial') { ctx.fillStyle = T.accent; ctx.fillRect(0, headH - 14 * u, W, 14 * u); }
    if (eyebrow) { ctx.save(); ctx.font = fontStr(T.body, 22 * u, T.body.bold); ctx.fillStyle = B.emph; if ('letterSpacing' in ctx) ctx.letterSpacing = `${3 * u}px`; ctx.fillText(eyebrow, M, y + 22 * u); ctx.restore(); y += 46 * u; }
    y += drawText(ctx, tr, T.display, M, y, { lh: 1.1, color: B.ink }) + 18 * u;
    drawText(ctx, au, T.body, M, y, { lh: 1.25, color: B.label });
    if (lgo) { const sc = Math.min(400 * u / lgo.width, 110 * u / lgo.height), lw = lgo.width * sc, lh = lgo.height * sc; ctx.fillStyle = '#FFFFFF'; rr(ctx, W - M - lw - 24 * u, 36 * u, lw + 24 * u, lh + 24 * u, 10 * u); ctx.fill(); ctx.drawImage(lgo, W - M - lw - 12 * u, 48 * u, lw, lh); }
    if (rightW) {
      ctx.textAlign = 'right';
      if (st.conference) { ctx.font = fontStr(T.body, 24 * u, T.body.bold); ctx.fillStyle = B.ink; ctx.fillText(st.conference, W - M, headH - 92 * u); }
      if (st.posterNo) { ctx.font = fontStr(T.body, 20 * u); ctx.fillStyle = B.label; ctx.fillText(st.posterNo, W - M, headH - 54 * u); }
      ctx.textAlign = 'left';
    }
    rects.push({ id: 'header', x: 0, y: 0, w: W, h: headH });
    // ---------- take-home strip ----------
    y = headH;
    ctx.font = fontStr(T.body, 22 * u, T.body.bold);
    const lab = (st.takeLabel || 'Take-home').toUpperCase(), labW = 180 * u;
    const tk = fit(ctx, st.take || '', T.body, { w: W - 2 * M - labW - 30 * u, h: 120 * u }, { max: 32 * u, min: 24 * u, lh: 1.32, maxLines: 3 });
    const takeH = tk.h + 64 * u;
    ctx.fillStyle = T.deco === 'tech' ? T.surface : T.deco === 'editorial' ? T.surface : '#FFFFFF'; ctx.fillRect(0, y, W, takeH);
    ctx.fillStyle = T.line; ctx.fillRect(0, y + takeH - 2 * u, W, 2 * u);
    ctx.save(); ctx.font = fontStr(T.body, 22 * u, T.body.bold); ctx.fillStyle = acc; if ('letterSpacing' in ctx) ctx.letterSpacing = `${2.5 * u}px`; ctx.fillText(lab, M, y + takeH / 2 + 8 * u); ctx.restore();
    drawText(ctx, tk, T.body, M + labW + 30 * u, y + 32 * u, { lh: 1.32, color: ink, hl: acc });
    rects.push({ id: 'take', x: 0, y, w: W, h: takeH });
    // ---------- columns ----------
    const top = y + takeH + 56 * u, bottom = H - 40 * u;
    const n = land ? 3 : 2, gut = 54 * u, cw = (W - 2 * M - gut * (n - 1)) / n;
    const defCols = land ? STORY_COLS_LAND : STORY_COLS_PORT;
    const colOf = id => Math.min(n - 1, st.cols && st.cols[id] != null ? +st.cols[id] : defCols[id]);
    // numbering follows the order sections appear
    const secs = [];
    if (st.question) secs.push({ id: 'question', title: st.qTitle || 'The question' });
    if ((st.steps || []).filter(s => s.title || s.text).length || st.methodNote) secs.push({ id: 'method', title: st.methodTitle || 'What we did' });
    if (st.resultTitle || (st.table || []).length || st.figureId) secs.push({ id: 'result', title: st.resultSec || 'The key result' });
    if ((st.items || []).length || st.lim) secs.push({ id: 'findings', title: st.fTitle || 'What we found' });
    if (st.why) secs.push({ id: 'why', title: st.whyTitle || 'Why it matters', dark: true });
    let num = 0; secs.forEach(s => { if (!s.dark) s.num = ++num; });
    const img = st.figureId && figs[st.figureId];
    // component painters: return height; draw only when d === true
    function heading(s, x, yy, w, k, d) {
      const r = fit(ctx, `${s.num} · ${s.title}`, T.display, { w, h: 38 * u * k * 1.2 * 2 }, { max: 38 * u * k, min: 26 * u * k, lh: 1.18, maxLines: 2 });
      if (d) drawText(ctx, r, T.display, x, yy, { lh: 1.18, color: T.deco === 'editorial' ? ink : ink });
      return r.h + 18 * u * k;
    }
    function para(text, x, yy, w, k, d, o = {}) {
      const r = measureAt(ctx, text, T.body, w, (o.size || 21) * u * k, o.lh || 1.5, o.weight);
      if (d) drawText(ctx, r, T.body, x, yy, { lh: o.lh || 1.5, color: o.color || ink, hl: acc, weight: o.weight });
      return r.h;
    }
    function flow(x, yy, w, k, d) {
      const steps = (st.steps || []).filter(s => s.title || s.text);
      let h = 0; const pad = 18 * u * k, arrow = 46 * u * k;
      steps.forEach((s, i) => {
        const t = measureAt(ctx, s.title || '', T.body, w - 2 * pad, 20 * u * k, 1.3, T.body.bold);
        const b = s.text ? measureAt(ctx, s.text, T.body, w - 2 * pad, 19 * u * k, 1.4) : { h: 0 };
        const bh = pad * 2 + t.h + (s.text ? 4 * u * k + b.h : 0);
        if (d) {
          ctx.fillStyle = s.hl ? T.soft : T.surface; rr(ctx, x, yy + h, w, bh, 12 * u); ctx.fill();
          ctx.strokeStyle = s.hl ? acc : T.line; ctx.lineWidth = (s.hl ? 3 : 2) * u; rr(ctx, x, yy + h, w, bh, 12 * u); ctx.stroke();
          drawText(ctx, t, T.body, x + pad, yy + h + pad, { lh: 1.3, color: ink, weight: T.body.bold });
          if (s.text) drawText(ctx, b, T.body, x + pad, yy + h + pad + t.h + 4 * u * k, { lh: 1.4, color: ink, hl: acc });
        }
        h += bh;
        if (i < steps.length - 1) {
          if (d) { const ax = x + w / 2, a1 = yy + h + 10 * u * k, a2 = yy + h + arrow - 10 * u * k; ctx.strokeStyle = muted; ctx.lineWidth = 2.5 * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, a1); ctx.lineTo(ax, a2); ctx.moveTo(ax - 8 * u, a2 - 9 * u); ctx.lineTo(ax, a2); ctx.lineTo(ax + 8 * u, a2 - 9 * u); ctx.stroke(); }
          h += arrow;
        }
      });
      if (st.methodNote) { h += 22 * u * k; h += para(st.methodNote, x, yy + h, w, k, d, { size: 18, color: muted, lh: 1.45 }); }
      return h;
    }
    function result(x, yy, w, k, d) {
      let h = 0; const pad = 26 * u * k;
      const nums = !img ? (P.bb && P.bb.numbers || []).filter(nm => nm && nm.big).slice(0, 3) : [];
      const hasCard = st.resultTitle || img || nums.length || st.caption;
      if (hasCard) {
        const t = st.resultTitle ? measureAt(ctx, st.resultTitle, T.body, w - 2 * pad, 23 * u * k, 1.35, T.body.bold) : { h: 0 };
        let inner = t.h + (st.resultTitle ? 18 * u * k : 0);
        const ih = img ? Math.min((w - 2 * pad) * img.height / Math.max(1, img.width), 560 * u * k) : 0;
        inner += ih ? ih + 14 * u * k : 0;
        const nh = nums.length ? 150 * u * k : 0; inner += nh;
        const c = st.caption ? measureAt(ctx, st.caption, T.body, w - 2 * pad, 16 * u * k, 1.35) : { h: 0 }; inner += c.h;
        const ch = inner + 2 * pad;
        if (d) {
          ctx.fillStyle = T.deco === 'tech' || T.deco === 'editorial' ? T.surface : '#FFFFFF'; rr(ctx, x, yy, w, ch, 16 * u); ctx.fill();
          ctx.strokeStyle = T.line; ctx.lineWidth = 2 * u; rr(ctx, x, yy, w, ch, 16 * u); ctx.stroke();
          let iy = yy + pad;
          if (st.resultTitle) { drawText(ctx, t, T.body, x + pad, iy, { lh: 1.35, color: ink, weight: T.body.bold, hl: acc }); iy += t.h + 18 * u * k; }
          if (ih) { drawImageContain(ctx, img, x + pad, iy, w - 2 * pad, ih); iy += ih + 14 * u * k; }
          if (nh) {
            const nw = (w - 2 * pad) / nums.length;
            ctx.font = fontStr(T.display, 100); const bs = Math.min(76 * u * k, ...nums.map(nm => 100 * (nw - 30 * u) / Math.max(1, ctx.measureText(nm.big).width)));
            nums.forEach((nm, i) => {
              ctx.font = fontStr(T.display, bs); ctx.fillStyle = acc; ctx.fillText(nm.big, x + pad + i * nw, iy + bs * 0.9);
              const lr = fit(ctx, nm.label || '', T.body, { w: nw - 24 * u, h: nh - bs - 14 * u }, { max: 17 * u * k, min: 13 * u * k, lh: 1.25, maxLines: 2 });
              drawText(ctx, lr, T.body, x + pad + i * nw, iy + bs + 10 * u * k, { lh: 1.25, color: muted });
            });
            iy += nh;
          }
          if (st.caption) drawText(ctx, c, T.body, x + pad, iy, { lh: 1.35, color: muted });
        }
        h += ch + 34 * u * k;
      }
      const rows = (st.table || []).filter(r => r.label || r.value);
      if (rows.length) {
        const hh = measureAt(ctx, st.tableTitle || 'Key results', T.body, w, 24 * u * k, 1.3, T.body.bold);
        if (d) drawText(ctx, hh, T.body, x, yy + h, { lh: 1.3, color: ink, weight: T.body.bold });
        h += hh.h + 12 * u * k;
        const fs = 19 * u * k, rh0 = 44 * u * k, vw = Math.min(w * 0.46, Math.max(...rows.map(r => { ctx.font = fontStr(T.body, fs); return ctx.measureText(r.value || '').width; }), 120 * u) + 24 * u);
        const lw = w - vw - 24 * u;
        // header row
        if (d) { ctx.font = fontStr(T.body, fs, T.body.bold); ctx.fillStyle = ink; ctx.fillText((st.tHead || ['Result', 'Value'])[0], x + 10 * u, yy + h + rh0 * 0.68); ctx.textAlign = 'right'; ctx.fillText((st.tHead || ['Result', 'Value'])[1], x + w - 10 * u, yy + h + rh0 * 0.68); ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.fillRect(x, yy + h + rh0 - 2 * u, w, 2.5 * u); }
        h += rh0;
        rows.forEach((r, i) => {
          const lr = measureAt(ctx, r.label || '', T.body, lw - 10 * u, fs, 1.3);
          const vr = measureAt(ctx, r.value || '', T.body, vw - 10 * u, fs, 1.3);
          const rh = Math.max(rh0, Math.max(lr.h, vr.h) + 18 * u * k);
          if (d) {
            if (i % 2 === 0) { ctx.fillStyle = T.soft; ctx.fillRect(x, yy + h, w, rh); }
            ctx.fillStyle = T.line; ctx.fillRect(x, yy + h + rh - 1.5 * u, w, 1.5 * u);
            drawText(ctx, lr, T.body, x + 10 * u, yy + h + (rh - lr.h) / 2, { lh: 1.3, color: ink });
            const pillC = { Benefit: '#2E7D4F', Mixed: '#A35F00', 'No clear effect': '#56616B', Risk: '#B3261E' }[r.value];
            if (pillC) { ctx.font = fontStr(T.body, fs * 0.92, T.body.bold); const pw = ctx.measureText(r.value).width + 28 * u, ph = fs * 1.6; ctx.fillStyle = pillC; rr(ctx, x + w - 10 * u - pw, yy + h + (rh - ph) / 2, pw, ph, ph / 2); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.fillText(r.value, x + w - 10 * u - pw + 14 * u, yy + h + rh / 2 + fs * 0.33); }
            else drawText(ctx, vr, T.body, x + w - 10 * u - vr.widest, yy + h + (rh - vr.h) / 2, { lh: 1.3, color: ink });
          }
          h += rh;
        });
        h += 26 * u * k;
      }
      if (st.resultNote) h += para(st.resultNote, x, yy + h, w, k, d, { size: 20, lh: 1.45 });
      return h;
    }
    function findings(x, yy, w, k, d) {
      let h = 0; const dia = 44 * u * k, g = 18 * u * k;
      for (const it of (st.items || []).filter(i => i.text)) {
        const r = measureAt(ctx, it.text, T.body, w - dia - g, 20 * u * k, 1.42);
        if (d) {
          ctx.fillStyle = T.deco === 'editorial' ? T.ink : B.bg; ctx.beginPath(); ctx.arc(x + dia / 2, yy + h + dia / 2, dia / 2, 0, Math.PI * 2); ctx.fill();
          ctx.font = fontStr(T.body, 17 * u * k, T.body.bold); ctx.fillStyle = T.deco === 'editorial' ? T.bg : B.ink; ctx.textAlign = 'center'; ctx.fillText(it.tag || '', x + dia / 2, yy + h + dia / 2 + 6 * u * k); ctx.textAlign = 'left';
          drawText(ctx, r, T.body, x + dia + g, yy + h + 2 * u, { lh: 1.42, color: ink, hl: acc });
        }
        h += Math.max(dia, r.h) + 20 * u * k;
      }
      if (st.lim) {
        h += 6 * u * k;
        const lb = measureAt(ctx, (st.limLabel || 'Limitations'), T.body, w, 19 * u * k, 1.35, T.body.bold);
        const r = measureAt(ctx, st.lim, T.body, w, 19 * u * k, 1.45);
        if (d) { drawText(ctx, lb, T.body, x, yy + h, { lh: 1.35, color: ink, weight: T.body.bold }); drawText(ctx, r, T.body, x, yy + h + lb.h, { lh: 1.45, color: muted }); }
        h += lb.h + r.h;
      }
      return h;
    }
    function dark(s, x, yy, w, k, d) {
      const pad = 30 * u * k;
      const t = measureAt(ctx, s.title, T.display, w - 2 * pad, 32 * u * k, 1.2);
      const b = measureAt(ctx, st.why || '', T.body, w - 2 * pad, 20 * u * k, 1.48);
      const ch = pad * 2 + t.h + 14 * u * k + b.h;
      if (d) {
        ctx.fillStyle = T.deco === 'editorial' ? T.ink : B.bg; rr(ctx, x, yy, w, ch, 16 * u); ctx.fill();
        drawText(ctx, t, T.display, x + pad, yy + pad, { lh: 1.2, color: B.ink });
        drawText(ctx, b, T.body, x + pad, yy + pad + t.h + 14 * u * k, { lh: 1.48, color: B.ink, hl: B.emph });
      }
      return ch;
    }
    const secH = (s, x, yy, k, d) => {
      if (s.dark) return dark(s, x, yy, cw, k, d);
      let h = heading(s, x, yy, cw, k, d);
      if (s.id === 'question') h += para(st.question, x, yy + h, cw, k, d);
      else if (s.id === 'method') h += flow(x, yy + h, cw, k, d);
      else if (s.id === 'result') h += result(x, yy + h, cw, k, d);
      else if (s.id === 'findings') h += findings(x, yy + h, cw, k, d);
      return h;
    };
    // references + QR, anchored to the bottom of the last column
    const refs = (st.refs || []).filter(Boolean);
    const qrS = meta.doi ? 150 * u : 0;
    const refsBlock = (x, yb, k, d) => {
      if (!refs.length && !qrS) return 0;
      const tw = cw - (qrS ? qrS + 30 * u : 0);
      const t1 = refs.length ? measureAt(ctx, 'Key references', T.body, tw, 17 * u * k, 1.3, T.body.bold) : { h: 0 };
      const t2 = refs.length ? measureAt(ctx, refs.join(' · '), T.body, tw, 15 * u * k, 1.45) : { h: 0 };
      const t3 = meta.doi ? measureAt(ctx, 'Full paper: doi.org/' + meta.doi, T.body, tw, 14 * u * k, 1.4) : { h: 0 };
      const h = Math.max(qrS, t1.h + 6 * u + t2.h + 10 * u + t3.h);
      if (d) {
        const y0 = yb - h;
        let ty = y0 + (h - (t1.h + 6 * u + t2.h + 10 * u + t3.h));
        if (refs.length) { drawText(ctx, t1, T.body, x, ty, { lh: 1.3, color: ink, weight: T.body.bold }); ty += t1.h + 6 * u; drawText(ctx, t2, T.body, x, ty, { lh: 1.45, color: muted }); ty += t2.h + 10 * u; }
        if (meta.doi) drawText(ctx, t3, T.body, x, ty, { lh: 1.4, color: muted });
        if (qrS) { ctx.strokeStyle = T.line; ctx.lineWidth = 2 * u; ctx.setLineDash([8 * u, 6 * u]); rr(ctx, x + cw - qrS - 14 * u, y0 - 14 * u, qrS + 28 * u, qrS + 28 * u, 12 * u); ctx.stroke(); ctx.setLineDash([]); qr(ctx, 'https://doi.org/' + meta.doi, x + cw - qrS, y0, qrS, '#111111', '#FFFFFF'); }
        rects.push({ id: 'refs', x, y: y0, w: cw, h });
      }
      return h;
    };
    // pick the column arrangement (sections stay in reading order) that allows the largest text
    const avail = bottom - top, sgap = 46 * u;
    const kMin = Math.max(0.62, 24 / (21 * u)), kMax = 1.2;
    const hCache = new Map();
    const secHk = (s, k) => { const key = s.id + '|' + k.toFixed(3); if (!hCache.has(key)) hCache.set(key, secH(s, 0, 0, k, false)); return hCache.get(key); };
    const fits = (assign, k) => {
      const hs = Array(n).fill(0), cnt = Array(n).fill(0);
      secs.forEach((s, i) => { const c = assign[i]; hs[c] += secHk(s, k) + (cnt[c]++ ? sgap * k : 0); });
      const rb = refsBlock(0, 0, k, false); hs[n - 1] += rb ? rb + sgap * k : 0;
      return hs.every(h => h <= avail);
    };
    const bestK = assign => {
      if (!fits(assign, kMin)) return -1;
      let lo = kMin, hi = kMax;
      if (fits(assign, hi)) return hi;
      for (let it = 0; it < 7; it++) { const mid = (lo + hi) / 2; if (fits(assign, mid)) lo = mid; else hi = mid; }
      return lo;
    };
    const explicit = st.cols && Object.keys(st.cols).some(k2 => st.cols[k2] !== '' && st.cols[k2] != null);
    let options = [];
    if (explicit) options = [secs.map(s2 => colOf(s2.id))];
    else {
      const rec = (i, c, arr) => {
        if (i === secs.length) { if (c === n - 1 || secs.length < n) options.push(arr.slice()); return; }
        arr.push(c); rec(i + 1, c, arr); arr.pop();
        if (i > 0 && c < n - 1) { arr.push(c + 1); rec(i + 1, c + 1, arr); arr.pop(); }
      };
      rec(0, 0, []);
      const def = secs.map(s2 => colOf(s2.id));
      options.sort((a2, b2) => (a2.join() === def.join() ? -1 : 0) - (b2.join() === def.join() ? -1 : 0));
    }
    let assign = options[0] || [], k = -1;
    for (const o of options) { const kk = bestK(o); if (kk > k + 0.005) { k = kk; assign = o; } }
    if (k < 0) { k = kMin; warn.push('Some columns run past the bottom even at the smallest text size. Shorten the longest section or move it to another column.'); }
    secs.forEach((s2, i) => { s2.col = assign[i]; });
    const ys = Array(n).fill(top);
    for (const s of secs) {
      const c = s.col ?? colOf(s.id), x = M + c * (cw + gut);
      const h = secH(s, x, ys[c], k, true);
      rects.push({ id: s.id, x, y: ys[c], w: cw, h });
      ys[c] += h + sgap * k;
    }
    refsBlock(M + (n - 1) * (cw + gut), bottom, k, true);
    return { rects, warn, bodyPt: Math.round(21 * u * k), titlePt: Math.round(tr.size), statementPt: Math.round(tk.size), words: 0, cols: Object.fromEntries(secs.map(s2 => [s2.id, s2.col])) };
  }

  // charts for talk slides, built from a detected statistic
  function talkChart(ctx, T, c, x, y, w, h, acc) {
    const muted = T.deco === 'tech' ? T.line : T.deco === 'editorial' ? 'rgba(17,17,17,0.22)' : T.soft === T.surface ? T.line : T.soft;
    const lab = (t, cx, ly, mw) => { const r = fit(ctx, t, T.body, { w: mw, h: 100 }, { max: 36, min: 30, lh: 1.15, maxLines: 2 }); drawText(ctx, r, T.body, cx - mw / 2, ly, { lh: 1.15, color: T.ink, align: 'center', w: mw }); };
    ctx.save();
    if (c.kind === 'compare' || c.kind === 'ratio') {
      const A = c.kind === 'ratio' ? 1 : c.a.v, B = c.kind === 'ratio' ? c.v : c.b.v, mx = Math.max(Math.abs(A), Math.abs(B)) || 1;
      const base = y + h - 150, maxH = h - 260, bwid = Math.min(220, w / 4), x1 = x + w / 2 - bwid - 50, x2 = x + w / 2 + 50;
      const hA = maxH * Math.abs(A) / mx, hB = maxH * Math.abs(B) / mx;
      ctx.fillStyle = muted; rr(ctx, x1, base - hA, bwid, hA, 10); ctx.fill();
      ctx.fillStyle = acc; rr(ctx, x2, base - hB, bwid, hB, 10); ctx.fill();
      ctx.fillStyle = T.ink; ctx.fillRect(x + 40, base, w - 80, 4);
      ctx.font = fontStr(T.display, 56); ctx.textAlign = 'center';
      const fmt = v => c.kind === 'ratio' ? v + '×' : c.pct ? '' : String(v);
      ctx.fillStyle = T.muted; ctx.fillText(fmt(A), x1 + bwid / 2, base - hA - 20); ctx.fillStyle = acc; ctx.fillText(fmt(B), x2 + bwid / 2, base - hB - 20); ctx.textAlign = 'left';
      lab((c.a && c.a.label) || 'Comparison', x1 + bwid / 2, base + 22, bwid + 90); lab((c.b && c.b.label) || 'Group', x2 + bwid / 2, base + 22, bwid + 90);
      if (c.note) { ctx.font = fontStr(T.body, 40, T.body.bold); ctx.fillStyle = acc; ctx.textAlign = 'center'; ctx.fillText(c.note, x2 + bwid / 2, base - hB - 84); ctx.textAlign = 'left'; }
    } else if (c.kind === 'donut') {
      const r = Math.min(w, h) / 2 - 60, cx = x + w / 2, cy = y + h / 2;
      ctx.lineWidth = 70; ctx.lineCap = T.deco === 'editorial' ? 'butt' : 'round';
      ctx.strokeStyle = muted; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.v); ctx.stroke();
      ctx.font = fontStr(T.display, 96); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.fillText(Math.round(c.v * 1000) / 10 + '%', cx, cy + 32); ctx.textAlign = 'left';
    } else if (c.kind === 'effect') {
      const v = Math.max(-1, Math.min(1, c.v)), a = Math.abs(v), lx = x + 60, lw = w - 120, cy = y + h / 2;
      const size = a < 0.1 ? 'negligible' : a < 0.3 ? 'small' : a < 0.5 ? 'medium' : 'large';
      [[0, 0.1], [0.1, 0.3], [0.3, 0.5], [0.5, 1]].forEach(([p, q], k) => { ctx.fillStyle = k % 2 ? T.soft : muted; ctx.fillRect(lx + p * lw, cy - 30, (q - p) * lw, 60); });
      ['0', '.1', '.3', '.5', '1'].forEach((t0, k) => { const p = [0, 0.1, 0.3, 0.5, 1][k]; ctx.font = fontStr(T.mono, 26); ctx.fillStyle = T.muted; ctx.textAlign = 'center'; ctx.fillText(t0, lx + p * lw, cy + 74); });
      ['small', 'medium', 'large'].forEach((t0, k) => { const p = [0.2, 0.4, 0.75][k]; ctx.font = fontStr(T.body, 30); ctx.fillStyle = T.muted; ctx.fillText(t0, lx + p * lw, cy - 52); });
      const mx = lx + a * lw; ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(mx, cy + 34); ctx.lineTo(mx - 22, cy + 70 - 2); ctx.lineTo(mx + 22, cy + 70 - 2); ctx.closePath(); ctx.fill(); ctx.fillRect(mx - 5, cy - 46, 10, 92);
      ctx.font = fontStr(T.display, 64); ctx.fillStyle = acc; ctx.fillText(`${c.stat} = ${v < 0 ? '−' : ''}${String(a).replace(/^0/, '')}`, x + w / 2, cy - 130);
      ctx.font = fontStr(T.body, 38, T.body.bold); ctx.fillStyle = T.ink; ctx.fillText(`${size.charAt(0).toUpperCase() + size.slice(1)} ${v < 0 ? 'negative' : 'positive'} ${c.stat === 'r' ? 'correlation' : 'effect'}`, x + w / 2, cy + 160);
      ctx.font = fontStr(T.body, 26); ctx.fillStyle = T.muted; ctx.fillText('Size guide: Cohen (1988)', x + w / 2, cy + 206); ctx.textAlign = 'left';
    } else if (c.kind === 'people') {
      const cols = 10, rows = 5, total = cols * rows, gxw = (w - 40) / cols, ph = Math.min(110, (h - 120) / rows - 14);
      for (let k = 0; k < total; k++) person(ctx, x + 20 + gxw * (k % cols) + gxw / 2, y + 20 + Math.floor(k / cols) * (ph + 14), ph, k % 7 === 3 ? acc : (T.deco === 'tech' ? T.accent : T.muted));
      ctx.font = fontStr(T.mono, 26); ctx.fillStyle = T.muted; ctx.textAlign = 'center'; ctx.fillText(`1 ICON = ABOUT ${Math.max(1, Math.round(c.n / total)).toLocaleString('en-US')} PEOPLE`, x + w / 2, y + 20 + rows * (ph + 14) + 40); ctx.textAlign = 'left';
    }
    ctx.restore();
  }
  // ---- talk slides: 1920 × 1080 presenter deck ----
  // d.rec (optional array) receives a list of the boxes, text and picture areas drawn, so the deck can be rebuilt as editable PowerPoint.
  function renderTalkSlide(cv, s, i, n, T, d = {}) {
    const W = 1920, H = 1080, M = 110; cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), meta = d.meta || {}, rec = d.rec || null;
    const warn = [], style = d.style || 'classic', done = () => [...new Set(warn)];
    const TOO_LONG = 'Some text only fits below 24 pt, which is hard to read from the back of a room. Shorten it, or move the detail into the script.';
    const showIcon = style !== 'minimal' && s.icon !== 'none';
    const logo = d.logo && d.logo.width > 0 ? d.logo : null;
    const acc = T.deco === 'editorial' ? T.ink : T.accent, onAcc = T.deco === 'editorial' ? T.bg : T.onAccent;
    const dark = s.kind === 'title' || s.kind === 'end', loud = s.kind === 'statement';
    const bgc = dark ? T.banner : loud ? acc : T.bg;
    const ink = dark ? T.bannerInk : loud ? onAcc : T.ink;
    const sub = dark ? T.bannerSub : loud ? onAcc : T.muted;
    const qAcc = contrast(T.accent, T.banner) >= 3 ? T.accent : T.bannerInk;
    if (rec) rec.bg = bgc;
    // drawing helpers that also record
    const box = (x, y, w, h, fill, r = 0, line, lw) => { if (fill) { ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill(); } if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; rr(ctx, x + lw / 2, y + lw / 2, w - lw, h - lw, r); ctx.stroke(); } if (rec) rec.push({ t: 'box', x, y, w, h, fill, r, line, lw }); };
    const dot = (cx, cy, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); if (rec) rec.push({ t: 'oval', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill }); };
    const snap = (x, y, w, h) => { if (rec) rec.push({ t: 'pic', x, y, w, h }); };
    const DT = (res, text, font, x, y, o) => { if (res.ok === false && !o.nowarn) warn.push(TOO_LONG); if (rec) rec.push({ t: 'text', x, y, w: o.w || res.widest, h: res.lines.length * res.size * o.lh, text, font: font === T.display ? 'display' : font === T.mono ? 'mono' : 'body', size: res.size, color: o.color, hl: o.hl, bold: !!o.weight, align: o.align || 'left', lh: o.lh }); return drawText(ctx, res, font, x, y, o); };
    const line1 = (text, font, size, color, x, base, o = {}) => {
      ctx.font = fontStr(font, size, o.weight); ctx.fillStyle = color; ctx.textAlign = o.align || 'left'; ctx.fillText(text, x, base); ctx.textAlign = 'left';
      if (rec) { const w = o.w || ctx.measureText(text).width + 4; const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x; rec.push({ t: 'text', x: x0, y: base - size * 0.92, w, h: size * 1.2, text, font: font === T.display ? 'display' : font === T.mono ? 'mono' : 'body', size, color, bold: !!o.weight, align: o.align || 'left', lh: 1 }); }
    };
    const cardBox = (x, y, w, h) => {
      const r = T.radius * 1.4;
      if (T.deco === 'editorial') { box(x, y, w, h, T.surface, 0); box(x, y, w, 10, T.ink, 0); }
      else if (T.deco === 'tech') box(x, y, w, h, T.surface, r, T.line, 2);
      else box(x, y, w, h, T.surface, r);
    };
    ctx.fillStyle = bgc; ctx.fillRect(0, 0, W, H);
    if (T.deco === 'tech' && !loud) { ctx.fillStyle = T.line; for (let y = 30; y < H; y += 48) for (let x = 30; x < W; x += 48) ctx.fillRect(x, y, 2, 2); }
    if (T.deco === 'pastel' && !dark && !loud) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = T.blobA; ctx.beginPath(); ctx.ellipse(W + 60, -40, 380, 300, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.blobB; ctx.beginPath(); ctx.ellipse(-80, H + 40, 360, 260, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    const au = meta.authors || [], last = a => String(a).trim().split(/\s+/).slice(-1)[0];
    const cite = [au.length ? (au.length > 2 ? last(au[0]) + ' et al.' : au.map(last).join(' & ')) : '', meta.year].filter(Boolean).join(', ');
    const imgOk = img => img && img.width > 0 && img.height > 0;
    const foot = () => {
      ctx.save(); ctx.globalAlpha = 0.85;
      line1(cite + (meta.doi ? '  ·  doi.org/' + meta.doi : ''), T.mono, 24, sub, M, H - 52);
      line1(`${i + 1} / ${n}`, T.mono, 24, sub, W - M, H - 52, { align: 'right' });
      ctx.restore();
    };
    if (s.kind === 'title') {
      box(M, 170, 140, 12, T.accent);
      line1((d.eyebrow || meta.journal || 'Research talk').toUpperCase().slice(0, 70), T.mono, 30, sub, M, 250);
      const qrS = meta.doi ? 260 : 0, tw = W - 2 * M - (qrS ? qrS + 80 : 0);
      const tr = fit(ctx, s.title, T.display, { w: tw, h: 420 }, { max: 104, min: 54, lh: 1.08, maxLines: 4 });
      let y = 300; y += DT(tr, s.title, T.display, M, y, { lh: 1.08, color: ink, w: tw }) + 50;
      const aus = au.join(', ');
      if (aus) { const ar = fit(ctx, aus, T.body, { w: tw, h: 110 }, { max: 40, min: 26, lh: 1.3, maxLines: 2, weight: T.body.bold }); y += DT(ar, aus, T.body, M, y, { lh: 1.3, color: ink, weight: T.body.bold, w: tw }) + 16; }
      const af = (meta.affiliations || []).slice(0, 2).join(' · ');
      if (af) { const fr = fit(ctx, af, T.body, { w: tw, h: 90 }, { max: 30, min: 22, lh: 1.3, maxLines: 2 }); DT(fr, af, T.body, M, y, { lh: 1.3, color: sub, w: tw }); }
      if (d.presenter) line1('Presented by ' + d.presenter, T.body, 30, sub, M, H - 110, { weight: T.body.bold });
      if (qrS) { const qx = W - M - qrS, qy = H - M - qrS - 40; qr(ctx, 'https://doi.org/' + meta.doi, qx, qy, qrS, '#111111', '#FFFFFF'); snap(qx, qy, qrS, qrS); line1('FULL PAPER', T.mono, 22, sub, W - M - qrS / 2, H - M + 10, { align: 'center', w: qrS }); }
      if (logo) { const sc = Math.min(360 / logo.width, 130 / logo.height), lw = logo.width * sc, lh = logo.height * sc; ctx.fillStyle = '#FFFFFF'; rr(ctx, W - M - lw - 24, 120, lw + 24, lh + 24, 10); ctx.fill(); ctx.drawImage(logo, W - M - lw - 12, 132, lw, lh); snap(W - M - lw - 24, 120, lw + 24, lh + 24); }
      return done();
    }
    if (s.kind === 'end') {
      const q = !!meta.doi;
      line1(s.title || 'Thank you', T.display, 150, ink, W / 2, q ? 360 : 470, { align: 'center', w: W - 2 * M });
      line1(s.body || 'Questions?', T.body, 54, qAcc, W / 2, q ? 460 : 580, { align: 'center', w: W - 2 * M, weight: T.body.bold });
      if (d.presenter) line1(d.presenter, T.body, 34, sub, W / 2, q ? 530 : 660, { align: 'center', w: W - 2 * M });
      if (q) { const qs = 300; qr(ctx, 'https://doi.org/' + meta.doi, (W - qs) / 2, 600, qs, '#111111', '#FFFFFF'); snap((W - qs) / 2, 600, qs, qs); line1('doi.org/' + meta.doi, T.mono, 26, sub, W / 2, 960, { align: 'center', w: W - 2 * M }); }
      return done();
    }
    if (loud) {
      line1((s.title || 'Take-home message').toUpperCase(), T.mono, 32, sub, M, 190);
      if (s.section) line1(`PART ${String(s.section).padStart(2, '0')} OF ${String(s.sections).padStart(2, '0')}`, T.mono, 24, sub, W - M, 104, { align: 'right' });
      const br = fit(ctx, s.body, T.display, { w: W - 2 * M, h: 620 }, { max: 104, min: 50, lh: 1.15 });
      DT(br, s.body, T.display, M, 260 + (620 - br.lines.length * br.size * 1.15) / 2, { lh: 1.15, color: ink, w: W - 2 * M });
      foot(); return done();
    }
    // heading
    const lgW = logo ? Math.min(240, logo.width * 64 / logo.height) : 0;
    const hr = fit(ctx, s.title, T.display, { w: W - 2 * M - (lgW ? lgW + 40 : 0), h: 150 }, { max: 72, min: 46, lh: 1.08, maxLines: 2 });
    const band = style === 'bold', headInk = band ? onAcc : T.ink;
    if (band) box(0, 0, W, 124 + hr.lines.length * hr.size * 1.08 + 40, acc);
    else if (style !== 'minimal') box(M, 92, 90, 10, acc);
    if (logo) { const lh = 64, lw = lgW; if (band) { ctx.fillStyle = '#FFFFFF'; rr(ctx, W - M - lw - 16, 54, lw + 16, lh + 16, 8); ctx.fill(); } ctx.drawImage(logo, W - M - lw - 8, 62, lw, lh); snap(W - M - lw - 16, 54, lw + 16, lh + 16); }
    if (s.section) line1(`PART ${String(s.section).padStart(2, '0')} OF ${String(s.sections).padStart(2, '0')}`, T.mono, 24, band ? onAcc : T.muted, W - M - (lgW ? lgW + 36 : 0), 104, { align: 'right' });
    DT(hr, s.title, T.display, M, 124, { lh: 1.08, color: headInk, w: W - 2 * M - (lgW ? lgW + 40 : 0) });
    const top = 124 + hr.lines.length * hr.size * 1.08 + 56, bot = H - 110, bh = bot - top, bw = W - 2 * M;
    const fig = imgOk(d.figure) ? d.figure : null;
    const figAt = (x, y, w, h) => { box(x, y, w, h, '#FFFFFF', 12); drawImageContain(ctx, fig, x + 16, y + 16, w - 32, h - 32); snap(x + 16, y + 16, w - 32, h - 32); };
    const meaning = () => {
      const t0 = String(s.title || '').toLowerCase();
      const pairs = [[/sample|participant|who took part|respondent|population/, 'people'], [/question|problem|gap/, 'search'], [/objective|aim|goal|hypothes/, 'target'], [/background|introduction|literature|theory|why this matters/, 'book'], [/method|approach|stage|design|what (we|they) did|instrument|scope/, 'flask'], [/analysis|result|finding|evidence/, 'bars'], [/ethic/, 'heart'], [/limit|risk|quality/, 'alert'], [/mean|significance|implication|contribution|conclusion/, 'bulb'], [/recommend|future|next step|suggestion/, 'spark']];
      for (const [re, ic] of pairs) if (re.test(t0)) return ic;
      return 'clipboard';
    };
    const badge = (name, x, y, dd) => { if (!showIcon) return; iconBadge(ctx, T, s.icon || meaning(), x, y, dd); snap(x, y, dd, dd); };
    if (s.kind === 'text') {
      const side = fig ? 760 : showIcon ? 380 : 0, tw = bw - side - (side ? 80 : 0);
      const br = fit(ctx, s.body, T.body, { w: tw, h: bh }, { max: side ? 54 : 64, min: 48, lh: 1.32 });
      DT(br, s.body, T.body, M, top + Math.max(0, (bh - br.lines.length * br.size * 1.32) / 2.4), { lh: 1.32, color: T.ink, hl: T.accent, w: tw });
      if (fig) figAt(W - M - side, top, side, bh);
      else badge('', W - M - 320, top + (bh - 320) / 2, 320);
    } else if (s.kind === 'bullets') {
      const bl = (s.bullets || []).filter(Boolean).slice(0, 6), many = bl.length > 3;
      const tw = bw - (many || !showIcon ? 0 : 420);
      let size = many ? 50 : 54, hs;
      for (; size >= 48; size -= 2) { hs = bl.map(b => measureAt(ctx, b, T.body, tw - 70, size, 1.28)); if (hs.reduce((a, r) => a + r.h, 0) + (bl.length - 1) * size * 0.9 <= bh) break; }
      if (size < 48) { size = 48; hs = bl.map(b => measureAt(ctx, b, T.body, tw - 70, size, 1.28)); warn.push(TOO_LONG); }
      let y = top + Math.max(0, (bh - hs.reduce((a, r) => a + r.h, 0) - (bl.length - 1) * size * 0.9) / 2.6);
      bl.forEach((b, k) => {
        if (T.deco === 'editorial') box(M, y + size * 0.35, size * 0.55, size * 0.55, acc); else dot(M + 14, y + size * 0.65, size * 0.24, acc);
        y += DT(hs[k], b, T.body, M + 70, y, { lh: 1.28, color: T.ink, hl: T.accent, w: tw - 70 }) + size * 0.9;
      });
      if (!many) badge('', W - M - 300, top + (bh - 300) / 2, 300);
    } else if (s.kind === 'flow') {
      const st = (s.steps || []).slice(0, 5), k = st.length || 1, g = 70, bare = st.every(x => !x.text), detail = k <= 3;
      let cy0 = top, ch, noteH = 0;
      if (s.note && bare) {
        const nr = fit(ctx, s.note, T.body, { w: bw, h: bh * 0.42 }, { max: 50, min: 44, lh: 1.3 });
        cy0 += DT(nr, s.note, T.body, M, top, { lh: 1.3, color: T.ink, hl: T.accent, w: bw }) + 60;
        ch = Math.min(340, bot - cy0);
      } else { noteH = s.note ? 150 : 0; ch = bh - noteH - (s.note ? 40 : 0); if (!detail) { const c2 = Math.min(ch, 330); cy0 = top + (ch - c2) / 2; ch = c2; } }
      const cw = (bw - g * (k - 1)) / k, dd = 84;
      const ttl = x => String(x.title || '').replace(/^(phase|stage|fasa|peringkat|study)\s*\w+\s*[:.\-–]\s*/i, '');
      // one shared size for every card title, so the row reads evenly
      const tSize = Math.min(...st.map(x => fit(ctx, ttl(x), T.body, { w: cw - 80, h: bare || !detail ? ch - dd - 110 : 170 }, { max: 50, min: 40, lh: 1.15, maxLines: 4, weight: T.body.bold }).size));
      st.forEach((x, j) => {
        const cx = M + j * (cw + g);
        cardBox(cx, cy0, cw, ch);
        if (x.hl) box(cx, cy0, cw, ch, null, T.radius * 1.4, acc, 6);
        dot(cx + 40 + dd / 2, cy0 + 40 + dd / 2, dd / 2, acc);
        line1(String(j + 1), T.display, 46, onAcc, cx + 40 + dd / 2, cy0 + 40 + dd / 2 + 16, { align: 'center', w: dd });
        let y = cy0 + 40 + dd + 30;
        const tr = fit(ctx, ttl(x), T.body, { w: cw - 80, h: bare || !detail ? ch - dd - 110 : 170 }, { max: tSize, min: Math.min(40, tSize), lh: 1.15, maxLines: 4, weight: T.body.bold });
        y += DT(tr, ttl(x), T.body, cx + 40, y, { lh: 1.15, color: T.ink, weight: T.body.bold, w: cw - 80 }) + 16;
        if (x.text && detail) { const xr = fit(ctx, x.text, T.body, { w: cw - 80, h: cy0 + ch - 36 - y }, { max: 44, min: 40, lh: 1.3 }); DT(xr, x.text, T.body, cx + 40, y, { lh: 1.3, color: T.muted, hl: T.accent, w: cw - 80 }); }
        if (j < k - 1) { const ax = cx + cw + 14, ay = cy0 + ch / 2; ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + g - 28, ay); ctx.moveTo(ax + g - 44, ay - 16); ctx.lineTo(ax + g - 28, ay); ctx.lineTo(ax + g - 44, ay + 16); ctx.stroke(); snap(ax - 4, ay - 22, g - 16, 44); }
      });
      if (s.note && !bare) { const nr = fit(ctx, s.note, T.body, { w: bw, h: noteH }, { max: 44, min: 40, lh: 1.3 }); DT(nr, s.note, T.body, M, bot - noteH, { lh: 1.3, color: T.muted, hl: T.accent, w: bw }); }
    } else if (s.kind === 'prisma') {
      const pw = 1000; drawPrisma(ctx, T, s.prisma || {}, W - M - pw, top - 40, pw, bh + 40); snap(W - M - pw, top - 40, pw, bh + 40);
      const nr = fit(ctx, s.note || '', T.body, { w: bw - pw - 80, h: bh }, { max: 46, min: 40, lh: 1.32 });
      DT(nr, s.note || '', T.body, M, top, { lh: 1.32, color: T.ink, hl: T.accent, w: bw - pw - 80 });
    } else if (s.kind === 'stat') {
      const chart = !fig && s.chart && s.showChart !== false ? s.chart : null, right = fig ? 'fig' : chart ? 'chart' : 'body';
      const lw = right === 'body' ? 820 : 760;
      let ly = top;
      if (s.big) {
        let bs = 260; ctx.font = fontStr(T.display, bs); const wb = ctx.measureText(s.big).width; if (wb > lw) bs = bs * lw / wb;
        line1(s.big, T.display, bs, acc, M, top + bs * 0.86, { w: lw });
        ly = top + bs + 30;
        const lr = fit(ctx, s.bigLabel || '', T.body, { w: lw, h: 160 }, { max: 50, min: 40, lh: 1.2, maxLines: 3, weight: T.body.bold });
        ly += DT(lr, s.bigLabel || '', T.body, M, ly, { lh: 1.2, color: T.ink, weight: T.body.bold, w: lw }) + 14;
      }
      if (s.ctx) { line1(String(s.ctx).toUpperCase(), T.mono, 30, T.muted, M, ly + 30, { w: lw }); ly += 64; }
      const rx = s.big || right !== 'body' ? M + lw + 100 : M, rw = W - M - rx;
      if (right !== 'body' && s.body) {
        const br = fit(ctx, s.body, T.body, { w: lw, h: bot - ly - 20 }, { max: 44, min: 40, lh: 1.28 });
        DT(br, s.body, T.body, M, ly + 20, { lh: 1.28, color: T.muted, hl: T.accent, w: lw });
      }
      if (right === 'fig') figAt(rx, top, rw, bh);
      else if (right === 'chart') { talkChart(ctx, T, chart, rx, top, rw, bh, acc); snap(rx, top, rw, bh); }
      else if (s.body) {
        if (s.big) box(rx - 52, top, 4, bh, T.line);
        const F = s.big ? T.body : T.display, br = fit(ctx, s.body, F, { w: rw, h: bh }, { max: s.big ? 54 : 80, min: 44, lh: 1.3 });
        DT(br, s.body, F, rx, top + Math.max(0, (bh - br.lines.length * br.size * 1.3) / 2.4), { lh: 1.3, color: T.ink, hl: T.accent, w: rw });
      }
    } else if (s.kind === 'table') {
      const rows = (s.rows || []).slice(0, 7), effect = Object.values(EFFECT);
      const headH = s.head ? 70 : 0, rh = Math.min(130, (bh - headH) / Math.max(1, rows.length)), vw = 520;
      cardBox(M, top - 20, bw, headH + rh * rows.length + 40);
      if (s.head) { line1(String(s.head[0] || '').toUpperCase(), T.mono, 26, T.muted, M + 50, top + 34); line1(String(s.head[1] || '').toUpperCase(), T.mono, 26, T.muted, W - M - 50, top + 34, { align: 'right' }); }
      rows.forEach((r, k) => {
        const ry = top + headH + k * rh;
        if (k || headH) box(M + 50, ry, bw - 100, 2, T.line);
        const lr = fit(ctx, r.label, T.body, { w: bw - vw - 150, h: rh - 16 }, { max: 44, min: 36, lh: 1.15, maxLines: 2, weight: T.body.bold });
        DT(lr, r.label, T.body, M + 50, ry + (rh - lr.lines.length * lr.size * 1.15) / 2, { lh: 1.15, color: T.ink, weight: T.body.bold, w: bw - vw - 150 });
        const ef = effect.find(e => e[0] === r.value);
        if (ef) { const pw = 340, ph = Math.min(70, rh - 24), px = W - M - 50 - pw; box(px, ry + (rh - ph) / 2, pw, ph, ef[1], ph / 2); line1(ef[0], T.body, 32, '#FFFFFF', px + pw / 2, ry + rh / 2 + 11, { align: 'center', w: pw, weight: T.body.bold }); }
        else { let vs = 64; ctx.font = fontStr(T.display, vs); const vwid = ctx.measureText(r.value).width; if (vwid > vw) vs = 64 * vw / vwid; line1(r.value, T.display, vs, acc, W - M - 50, ry + rh / 2 + vs * 0.33, { align: 'right', w: vw }); }
      });
    } else if (s.kind === 'list') {
      const it = (s.items || []).slice(0, 4), k = it.length || 1, cols = k === 4 ? 2 : k, rows = k === 4 ? 2 : 1, g = 50;
      const cw = (bw - g * (cols - 1)) / cols, ch = (bh - g * (rows - 1)) / rows, dd = rows > 1 ? 70 : 96;
      it.forEach((x, j) => {
        const cx = M + (j % cols) * (cw + g), cy = top + Math.floor(j / cols) * (ch + g);
        cardBox(cx, cy, cw, ch);
        dot(cx + 40 + dd / 2, cy + 40 + dd / 2, dd / 2, acc);
        line1(String(x.tag || j + 1), T.display, String(x.tag || j + 1).length > 2 ? dd * 0.32 : dd * 0.5, onAcc, cx + 40 + dd / 2, cy + 40 + dd * 0.68, { align: 'center', w: dd });
        const ty = cy + 40 + dd + 30, xr = fit(ctx, x.text, T.body, { w: cw - 80, h: cy + ch - 36 - ty }, { max: 48, min: 40, lh: 1.3 });
        DT(xr, x.text, T.body, cx + 40, ty, { lh: 1.3, color: T.ink, hl: T.accent, w: cw - 80 });
      });
    } else if (s.kind === 'outline') {
      const it = (s.items || []).slice(0, 14), two = it.length > 7, cols = two ? 2 : 1, rows = Math.ceil(it.length / cols), g = 70;
      const cw = (bw - g * (cols - 1)) / cols, rh = Math.min(130, (bh + 20) / rows), dd = Math.min(96, rh - 20);
      it.forEach((t, j) => {
        const cx = M + Math.floor(j / rows) * (cw + g), cy = top - 20 + (j % rows) * rh, mid = cy + rh / 2;
        box(cx + dd * 0.55, mid - dd * 0.36, cw - dd * 0.55, dd * 0.72, j % 3 === 1 ? T.surface : T.soft, dd * 0.36);
        // numbered diamond
        ctx.save(); ctx.translate(cx + dd / 2, mid); ctx.rotate(Math.PI / 4); ctx.fillStyle = acc; ctx.fillRect(-dd * 0.36, -dd * 0.36, dd * 0.72, dd * 0.72); ctx.restore(); if (rec) { const D = dd * 0.72 * Math.SQRT2; rec.push({ t: 'diamond', x: cx + dd / 2 - D / 2, y: mid - D / 2, w: D, h: D, fill: acc }); }
        line1(String(j + 1), T.display, dd * 0.42, onAcc, cx + dd / 2, mid + dd * 0.15, { align: 'center', w: dd });
        const tr = fit(ctx, t, T.body, { w: cw - dd * 1.6 - 30, h: dd * 0.7 }, { max: two ? 40 : 46, min: 30, lh: 1.1, maxLines: 1, weight: T.body.bold });
        DT(tr, t, T.body, cx + dd * 1.25, mid - tr.size * 0.58, { lh: 1.1, color: T.ink, weight: T.body.bold, w: cw - dd * 1.6 - 30 });
      });
    } else if (s.kind === 'numbered') {
      const it = (s.items || []).slice(0, 6), k = it.length || 1, tagW = 150, g = 34;
      let size = 52, hs;
      for (; size >= 44; size -= 2) { hs = it.map(x => measureAt(ctx, x.text, T.body, bw - tagW - 40, size, 1.28)); if (hs.reduce((a, r) => a + Math.max(r.h, 74), 0) + g * (k - 1) <= bh) break; }
      if (size < 44) { size = 44; hs = it.map(x => measureAt(ctx, x.text, T.body, bw - tagW - 40, size, 1.28)); warn.push(TOO_LONG); }
      let y = top + Math.max(0, (bh - hs.reduce((a, r) => a + Math.max(r.h, 74), 0) - g * (k - 1)) / 2.6);
      it.forEach((x, j) => {
        const h = Math.max(hs[j].h, 74);
        box(M, y + (Math.min(h, size * 1.28) - 64) / 2 + 4, tagW - 20, 64, acc, 32);
        line1(String(x.tag || j + 1), T.mono, 30, onAcc, M + (tagW - 20) / 2, y + (Math.min(h, size * 1.28) - 64) / 2 + 47, { align: 'center', w: tagW - 20 });
        DT(hs[j], x.text, T.body, M + tagW + 10, y, { lh: 1.28, color: T.ink, hl: T.accent, w: bw - tagW - 40 });
        y += h + g;
        if (j < k - 1) box(M + tagW + 10, y - g / 2, bw - tagW - 10, 2, T.line);
      });
    } else if (s.kind === 'framework') {
      const fw = s.fw || { iv: [], dv: [] }, bwid = 500, bhgt = 150, gap = 30;
      const ivs = (fw.iv || []).slice(0, 3), dvs = (fw.dv || []).slice(0, 3), med = (fw.med || [])[0], mod = (fw.mod || [])[0];
      const covH = fw.cov ? 60 : 0, area = bh - covH;
      const stackH = n => n * bhgt + (n - 1) * gap;
      const rowC = top + (med && mod ? area * 0.5 : med ? area * 0.66 : mod ? area * 0.36 : area * 0.45);
      const ivY = rowC - stackH(ivs.length) / 2, dvY = rowC - stackH(dvs.length) / 2;
      const lx = M, rx = W - M - bwid, mx = (W - bwid) / 2;
      const medY = top + 30, modY = top + area - bhgt;
      const arrow = (x1, y1, x2, y2) => {
        ctx.strokeStyle = acc; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const a = Math.atan2(y2 - y1, x2 - x1), hl = 26; ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(a - 0.45), y2 - hl * Math.sin(a - 0.45)); ctx.moveTo(x2, y2); ctx.lineTo(x2 - hl * Math.cos(a + 0.45), y2 - hl * Math.sin(a + 0.45)); ctx.stroke();
        snap(Math.min(x1, x2) - 30, Math.min(y1, y2) - 30, Math.abs(x2 - x1) + 60, Math.abs(y2 - y1) + 60);
      };
      // arrows first, boxes on top
      ivs.forEach((_, a) => dvs.forEach((__, b) => arrow(lx + bwid, ivY + a * (bhgt + gap) + bhgt / 2, rx - 8, dvY + b * (bhgt + gap) + bhgt / 2)));
      if (med) { arrow(lx + bwid * 0.6, ivY, mx + 20, medY + bhgt / 2 + 20); arrow(mx + bwid - 20, medY + bhgt / 2 + 20, rx + bwid * 0.4, dvY - 8); }
      if (mod) arrow(W / 2, modY, W / 2, rowC + 14);
      const fbox = (x, y, label, text, strong, above) => {
        if (label) line1(label, T.mono, 22, T.muted, x + bwid / 2, above ? y - 14 : y + bhgt + 34, { align: 'center', w: bwid });
        box(x, y, bwid, bhgt, strong ? acc : T.surface, T.radius * 1.2 + 6, strong ? null : acc, strong ? 0 : 4);
        const tr = fit(ctx, text, T.body, { w: bwid - 50, h: bhgt - 30 }, { max: 44, min: 34, lh: 1.15, maxLines: 3, weight: T.body.bold });
        DT(tr, text, T.body, x + 25, y + (bhgt - tr.lines.length * tr.size * 1.15) / 2, { lh: 1.15, color: strong ? onAcc : T.ink, weight: T.body.bold, align: 'center', w: bwid - 50 });
      };
      ivs.forEach((t, a) => fbox(lx, ivY + a * (bhgt + gap), a < ivs.length - 1 ? '' : (ivs.length > 1 ? 'INDEPENDENT VARIABLES' : 'INDEPENDENT VARIABLE'), t, false));
      dvs.forEach((t, b) => fbox(rx, dvY + b * (bhgt + gap), b < dvs.length - 1 ? '' : (dvs.length > 1 ? 'DEPENDENT VARIABLES' : 'DEPENDENT VARIABLE'), t, true));
      if (med) fbox(mx, medY, 'MEDIATOR', med, false, true);
      if (mod) { ctx.save(); ctx.setLineDash([12, 10]); fbox(mx, modY, 'MODERATOR', mod, false); ctx.restore(); }
      if (fw.cov) { const cr = fit(ctx, 'Controlled for: ' + fw.cov, T.body, { w: bw, h: covH }, { max: 30, min: 20, lh: 1.2, maxLines: 2 }); DT(cr, 'Controlled for: ' + fw.cov, T.body, M, bot - covH + 10, { lh: 1.2, color: T.muted, w: bw }); }
    } else if (s.kind === 'grid') {
      const head = s.head || [], rows = (s.rows || []).slice(0, 7), nc = Math.max(head.length, ...rows.map(r => r.length), 1);
      const lens = Array.from({ length: nc }, (_, c) => Math.max(String(head[c] || '').length, ...rows.map(r => String(r[c] || '').length), 4));
      const tot = lens.reduce((a, b) => a + Math.min(b, 60), 0), cws = lens.map(l => (bw - 60) * Math.min(l, 60) / tot);
      const headH = 76, rh = Math.min(140, (bh - headH - 20) / Math.max(1, rows.length));
      cardBox(M, top - 20, bw, headH + rh * rows.length + 40);
      box(M + 30, top, bw - 60, headH - 10, T.soft, 10);
      let cx = M + 30; head.forEach((h, c) => { line1(String(h).toUpperCase(), T.mono, 24, T.ink, cx + 18, top + 44, { w: cws[c] - 20 }); cx += cws[c]; });
      rows.forEach((r, k) => {
        const ry = top + headH + k * rh; if (k) box(M + 30, ry, bw - 60, 2, T.line);
        let x = M + 30;
        r.forEach((cell, c) => {
          const tx = String(cell || ''), cr = fit(ctx, tx, T.body, { w: cws[c] - 36, h: rh - 18 }, { max: 40, min: 32, lh: 1.15, maxLines: 3, weight: c ? undefined : T.body.bold });
          DT(cr, tx, T.body, x + 18, ry + (rh - cr.lines.length * cr.size * 1.15) / 2, { lh: 1.15, color: /^\[/.test(tx) ? T.muted : T.ink, weight: c ? undefined : T.body.bold, w: cws[c] - 36 });
          x += cws[c];
        });
      });
    } else if (s.kind === 'gantt') {
      const rows = (s.rows || []).slice(0, 9), mo = Math.max(6, Math.min(48, s.months || 24)), labW = 520;
      const gx = M + labW, gw = bw - labW, mw = gw / mo, headH = 80, rh = Math.min(96, (bh - headH) / Math.max(1, rows.length));
      for (let y0 = 0; y0 < Math.ceil(mo / 12); y0++) { const x0 = gx + y0 * 12 * mw, w0 = Math.min(12, mo - y0 * 12) * mw; box(x0 + 2, top, w0 - 4, 34, y0 % 2 ? T.soft : T.surface, 6); line1('YEAR ' + (y0 + 1), T.mono, 22, T.muted, x0 + w0 / 2, top + 25, { align: 'center', w: w0 }); }
      for (let mth = 1; mth <= mo; mth++) if (mth === 1 || mth % 3 === 0) line1(String(mth), T.mono, 20, T.muted, gx + (mth - 0.5) * mw, top + 66, { align: 'center', w: mw * 2 });
      rows.forEach((r, k) => {
        const ry = top + headH + k * rh;
        box(M, ry + rh - 2, bw, 2, T.line);
        const lr = fit(ctx, r.task, T.body, { w: labW - 30, h: rh - 10 }, { max: 40, min: 32, lh: 1.1, maxLines: 2, weight: T.body.bold });
        DT(lr, r.task, T.body, M, ry + (rh - lr.lines.length * lr.size * 1.1) / 2, { lh: 1.1, color: T.ink, weight: T.body.bold, w: labW - 30 });
        const a = Math.max(1, Math.min(mo, +r.start || 1)), e = Math.max(a, Math.min(mo, +r.end || a));
        box(gx + (a - 1) * mw + 3, ry + rh * 0.25, (e - a + 1) * mw - 6, rh * 0.5, acc, Math.min(rh * 0.25, 14));
      });
    }
    foot();
    return done();
  }

  // ---- study sheet: cards in the style of a clinical revision sheet ----
  // works with any theme; the Study Sheet theme gives the teal, serif-and-Inter look
  function sheetColors(T) {
    const dark = T.dark || (T.deco === 'tech' ? T.accent : T.banner);
    return {
      head: T.head || (T.deco === 'editorial' ? T.ink : T.deco === 'tech' ? T.accent : T.banner === T.bg ? T.accent : T.banner),
      warn: T.warn || '#B42318', warnSoft: T.warnSoft || (T.deco === 'tech' ? '#3A1C1C' : '#FCE8E6'),
      dark, darkInk: T.darkInk || (T.deco === 'tech' ? T.onAccent : T.bannerInk), darkSub: T.darkSub || (T.deco === 'tech' ? T.onAccent : T.bannerSub),
      card: T.surface === T.bg ? T.soft : T.surface, chip: T.soft, keyBg: T.soft,
    };
  }
  // draws (or, with draw=false, only measures) one card; returns its height
  function sheetCard(ctx, T, c, x, y, w, base, draw, opts = {}) {
    const C = sheetColors(T), pad = base * 0.95, iw = w - 2 * pad, small = base * 0.84, lh = 1.42;
    const tone = c.tone || 'light';
    const ink = tone === 'dark' ? C.darkInk : T.ink, sub = tone === 'dark' ? C.darkSub : T.muted;
    const headC = tone === 'dark' ? C.darkInk : tone === 'warn' ? C.warn : C.head;
    const bold = tone === 'dark' ? C.darkInk : (T.deco === 'tech' ? T.ink : C.head);
    let h = pad;
    const items = [];
    // heading "3 · Risk factors"
    const ht = (c.n ? `${c.n} · ` : '') + (c.title || '');
    if (ht.trim()) { const r = measureAt(ctx, ht, T.display, iw, base * 1.42, 1.15); items.push(() => drawText(ctx, r, T.display, x + pad, y + h0(0), { lh: 1.15, color: headC })); var hY = h; h += r.h + base * 0.55; }
    const offs = [hY || 0];
    function h0(k) { return offs[k]; }
    const drawers = [];
    for (const b of c.blocks || []) {
      const at = h;
      if (b.k === 'p') {
        const sz = b.small ? small : base, r = measureAt(ctx, b.text, T.body, iw, sz, lh);
        drawers.push(() => drawText(ctx, r, T.body, x + pad, y + at, { lh, color: b.small ? sub : ink, bc: bold, hl: tone === 'dark' ? C.darkInk : T.accent }));
        h += r.h + base * 0.5;
      } else if (b.k === 'ul') {
        const ind = base * 1.15;
        for (const t of b.items) {
          const r = measureAt(ctx, t, T.body, iw - ind, base, lh), yy = h;
          drawers.push(() => { ctx.fillStyle = tone === 'dark' ? C.darkInk : tone === 'warn' ? C.warn : C.head; ctx.beginPath(); ctx.arc(x + pad + base * 0.3, y + yy + base * 0.78, base * 0.16, 0, Math.PI * 2); ctx.fill(); drawText(ctx, r, T.body, x + pad + ind, y + yy, { lh, color: ink, bc: bold, hl: tone === 'dark' ? C.darkInk : T.accent }); });
          h += r.h + base * 0.32;
        }
        h += base * 0.2;
      } else if (b.k === 'big') {
        ctx.font = fontStr(T.display, base * 3.2); const bw = ctx.measureText(b.big).width, bs = Math.min(base * 3.2, base * 3.2 * iw * 0.6 / Math.max(1, bw));
        const lr = measureAt(ctx, b.label || '', T.body, iw - bw - base, base, 1.2, T.body.bold);
        drawers.push(() => { ctx.font = fontStr(T.display, bs); ctx.fillStyle = tone === 'dark' ? C.darkInk : C.head; ctx.fillText(b.big, x + pad, y + at + bs * 0.86); const lw2 = ctx.measureText(b.big).width; drawText(ctx, lr, T.body, x + pad + lw2 + base * 0.6, y + at + bs * 0.86 - lr.h + base * 0.25, { lh: 1.2, color: ink, weight: T.body.bold }); });
        h += bs * 1.02 + base * 0.45;
      } else if (b.k === 'flow') {
        const st = b.steps || [], k = st.length || 1, vertical = b.vertical || iw / k < base * 6.5;
        if (vertical) {
          for (let j = 0; j < st.length; j++) {
            const s0 = st[j], txt = s0.title ? (s0.text ? `**${s0.title}** · ${s0.text}` : `**${s0.title}**`) : s0.text, r = measureAt(ctx, txt, T.body, iw - base * 2.2, base * 0.92, 1.3), ch = r.h + base * 0.7, yy = h;
            drawers.push(() => { const acc = s0.tone === 'accent'; ctx.fillStyle = acc ? C.head : C.chip; rr(ctx, x + pad, y + yy, iw, ch, base * 0.4); ctx.fill(); ctx.font = fontStr(T.body, base * 0.8, T.body.bold); ctx.fillStyle = acc ? C.darkInk : C.head; ctx.fillText(String(j + 1), x + pad + base * 0.6, y + yy + ch / 2 + base * 0.28); drawText(ctx, r, T.body, x + pad + base * 1.7, y + yy + base * 0.35, { lh: 1.3, color: acc ? C.darkInk : T.ink, bc: acc ? C.darkInk : C.head }); });
            h += ch + base * 0.3;
          }
        } else {
          const ar = base * 1.4, cw2 = (iw - ar * (k - 1)) / k, ip = base * 0.55;
          const ms = st.map(s0 => ({ t: measureAt(ctx, s0.title, T.body, cw2 - 2 * ip, base * 0.9, 1.25, T.body.bold), x: s0.text ? measureAt(ctx, s0.text, T.body, cw2 - 2 * ip, base * 0.84, 1.32) : null }));
          const ch = Math.max(...ms.map(q => q.t.h + (q.x ? q.x.h + base * 0.3 : 0))) + 2 * ip;
          drawers.push(() => st.forEach((s0, j) => {
            const cx = x + pad + j * (cw2 + ar), acc = s0.tone === 'accent', warnT = s0.tone === 'warn';
            ctx.fillStyle = acc ? C.head : warnT ? C.warnSoft : C.chip; rr(ctx, cx, y + at, cw2, ch, base * 0.4); ctx.fill();
            drawText(ctx, ms[j].t, T.body, cx + ip, y + at + ip, { lh: 1.25, color: acc ? C.darkInk : warnT ? C.warn : C.head, weight: T.body.bold });
            if (ms[j].x) drawText(ctx, ms[j].x, T.body, cx + ip, y + at + ip + ms[j].t.h + base * 0.3, { lh: 1.32, color: acc ? C.darkInk : T.ink });
            if (j < k - 1) { const ax = cx + cw2 + ar * 0.22, ay = y + at + ch / 2; ctx.strokeStyle = C.head; ctx.lineWidth = Math.max(2, base * 0.09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + ar * 0.56, ay); ctx.moveTo(ax + ar * 0.36, ay - ar * 0.2); ctx.lineTo(ax + ar * 0.56, ay); ctx.lineTo(ax + ar * 0.36, ay + ar * 0.2); ctx.stroke(); }
          }));
          h += ch + base * 0.55;
        }
      } else if (b.k === 'table') {
        const head = b.head || [], rows = (b.rows || []).slice(0, 8), nc = Math.max(head.length, ...rows.map(r => r.length), 1);
        const lens = Array.from({ length: nc }, (_, q) => Math.min(48, Math.max(String(head[q] || '').length, ...rows.map(r => String(r[q] || '').length), 6)));
        const tot = lens.reduce((a2, b2) => a2 + b2, 0), cws = lens.map(l => iw * l / tot), cp = base * 0.45, eff = { 'Benefit': '#2E7D4F', 'Mixed': '#A35F00', 'No clear effect': '#56616B', 'Risk': '#B3261E' };
        const hh = base * 1.9;
        const rm = rows.map(r => r.map((cell, q) => measureAt(ctx, String(cell || ''), T.body, cws[q] - 2 * cp, base * 0.92, 1.3, q ? undefined : T.body.bold)));
        const rhs = rm.map(r => Math.max(...r.map(q => q.h)) + 2 * cp);
        drawers.push(() => {
          ctx.fillStyle = C.head; rr(ctx, x + pad, y + at, iw, hh, base * 0.3); ctx.fill();
          let cx = x + pad; head.forEach((t, q) => { ctx.font = fontStr(T.body, base * 0.82, T.body.bold); ctx.fillStyle = C.darkInk; ctx.fillText(String(t), cx + cp, y + at + hh * 0.64); cx += cws[q]; });
          let ry = y + at + hh;
          rows.forEach((r, k2) => {
            if (k2) { ctx.fillStyle = T.line; ctx.fillRect(x + pad, ry, iw, Math.max(1.5, base * 0.05)); }
            let cx2 = x + pad;
            r.forEach((cell, q) => {
              const e = eff[cell];
              if (e && q) { ctx.font = fontStr(T.body, base * 0.8, T.body.bold); const tw = ctx.measureText(cell).width + base, ph = base * 1.35; ctx.fillStyle = e; rr(ctx, cx2 + cp, ry + (rhs[k2] - ph) / 2, tw, ph, ph / 2); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.fillText(cell, cx2 + cp + base * 0.5, ry + rhs[k2] / 2 + base * 0.28); }
              else drawText(ctx, rm[k2][q], T.body, cx2 + cp, ry + cp, { lh: 1.3, color: q ? (isNaN(parseFloat(String(cell).replace(/[^\d.−-]/g, ''))) ? T.ink : C.head) : T.ink, weight: q ? undefined : T.body.bold });
              cx2 += cws[q];
            });
            ry += rhs[k2];
          });
        });
        h += hh + rhs.reduce((a2, b2) => a2 + b2, 0) + base * 0.5;
      } else if (b.k === 'stages') {
        const it = b.items || [], k = it.length || 1, gap = base * 0.9, sw = (iw - gap * (k - 1)) / k, ip = base * 0.8, d = base * 2.6;
        const ms = it.map(s0 => ({ tag: s0.tag, title: s0.title ? measureAt(ctx, s0.title, T.body, sw - 2 * ip, base, 1.25, T.body.bold) : null, text: measureAt(ctx, s0.text, T.body, sw - 2 * ip, base * 0.9, 1.36) }));
        const sh = Math.max(...ms.map(q => d + base * 0.8 + base * 1.2 + (q.title ? q.title.h + base * 0.3 : 0) + q.text.h)) + 2 * ip;
        drawers.push(() => it.forEach((s0, j) => {
          const sx = x + pad + j * (sw + gap), hl = s0.tone === 'warn';
          ctx.fillStyle = hl ? C.warnSoft : T.bg === '#FFFFFF' || T.deco === 'sheet' ? '#FFFFFF' : T.surface; rr(ctx, sx, y + at, sw, sh, base * 0.5); ctx.fill();
          ctx.strokeStyle = hl ? C.warn : T.line; ctx.lineWidth = Math.max(1.5, base * 0.06); rr(ctx, sx, y + at, sw, sh, base * 0.5); ctx.stroke();
          ctx.fillStyle = C.chip; ctx.beginPath(); ctx.arc(sx + ip + d / 2, y + at + ip + d / 2, d / 2, 0, Math.PI * 2); ctx.fill();
          icon(ctx, s0.icon || 'bulb', sx + ip + d * 0.22, y + at + ip + d * 0.22, d * 0.56, C.head);
          let yy = y + at + ip + d + base * 0.8;
          ctx.save(); ctx.font = fontStr(T.body, base * 0.7, T.body.bold); if ('letterSpacing' in ctx) ctx.letterSpacing = `${base * 0.08}px`; ctx.fillStyle = hl ? C.warn : C.head; ctx.fillText(String(s0.tag || '').toUpperCase(), sx + ip, yy); ctx.restore();
          yy += base * 0.55;
          if (ms[j].title) yy += drawText(ctx, ms[j].title, T.body, sx + ip, yy, { lh: 1.25, color: T.ink, weight: T.body.bold }) + base * 0.3;
          drawText(ctx, ms[j].text, T.body, sx + ip, yy, { lh: 1.36, color: T.ink, bc: C.head, hl: T.accent });
        }));
        h += sh + base * 0.5;
      } else if (b.k === 'fig' && b.img && b.img.width > 0) {
        const fh = Math.min(iw * b.img.height / b.img.width, base * 14);
        drawers.push(() => { ctx.fillStyle = '#FFFFFF'; rr(ctx, x + pad, y + at, iw, fh, base * 0.3); ctx.fill(); drawImageContain(ctx, b.img, x + pad, y + at, iw, fh); });
        h += fh + base * 0.5;
      }
    }
    h += pad - base * 0.45;
    const H = Math.max(h, opts.minH || 0);
    if (draw) {
      ctx.save();
      const r = base * 0.55;
      if (tone === 'light') { ctx.fillStyle = C.card; rr(ctx, x, y, w, H, r); ctx.fill(); }
      else if (tone === 'outline') { ctx.fillStyle = T.bg; rr(ctx, x, y, w, H, r); ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = Math.max(2, base * 0.08); rr(ctx, x, y, w, H, r); ctx.stroke(); }
      else if (tone === 'dark') { ctx.fillStyle = C.dark; rr(ctx, x, y, w, H, r); ctx.fill(); }
      else if (tone === 'warn') { ctx.fillStyle = C.warnSoft; rr(ctx, x, y, w, H, r); ctx.fill(); }
      else if (tone === 'key') { ctx.fillStyle = C.keyBg; rr(ctx, x, y, w, H, r); ctx.fill(); ctx.fillStyle = C.head; rr(ctx, x, y, base * 0.35, H, base * 0.17); ctx.fill(); }
      ctx.restore();
      items.forEach(f => f()); drawers.forEach(f => f());
    }
    return H;
  }
  function sheetStat(ctx, T, st, x, y, w, h, base) {
    const C = sheetColors(T);
    ctx.fillStyle = C.card; rr(ctx, x, y, w, h, base * 0.55); ctx.fill();
    const pad = base * 0.75; let bs = base * 1.9; ctx.font = fontStr(T.body, bs, 700); const bw = ctx.measureText(st.big).width; if (bw > w - 2 * pad) bs *= (w - 2 * pad) / bw;
    ctx.font = fontStr(T.body, bs, 700); ctx.fillStyle = C.head; ctx.fillText(st.big, x + pad, y + pad + bs * 0.85);
    const lr = fit(ctx, st.label || '', T.body, { w: w - 2 * pad, h: h - pad * 2 - bs * 1.1 }, { max: base * 0.78, min: base * 0.6, lh: 1.3, maxLines: 3 });
    drawText(ctx, lr, T.body, x + pad, y + pad + bs * 1.1, { lh: 1.3, color: T.muted });
  }
  function eyebrowText(ctx, T, text, x, y, size, color) { ctx.save(); ctx.font = fontStr(T.body, size, 700); if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.14}px`; ctx.fillStyle = color; ctx.fillText(String(text || '').toUpperCase(), x, y); ctx.restore(); }
  // pack cards into rows of `cols` columns, keeping their order
  function sheetRows(cards, cols) {
    const rows = []; let row = [], used = 0;
    for (const c of cards) {
      const sp = Math.min(c.span || 1, cols);
      if (used + sp > cols && row.length) { rows.push(row); row = []; used = 0; }
      row.push({ c, sp }); used += sp;
      if (used >= cols) { rows.push(row); row = []; used = 0; }
    }
    if (row.length) rows.push(row);
    rows.forEach(r => { const u = r.reduce((a, b) => a + b.sp, 0); if (u < cols) r[r.length - 1].sp += cols - u; });
    return rows;
  }
  function renderSheetPoster(ctx, P, meta, T, size, figs) {
    const sh = P.sheet, W = size.w, H = size.h, land = W > H, C = sheetColors(T);
    const M = W * 0.04, cols = land ? 3 : 2, warn = [], rects = [];
    const cards = (sh.cards || []).filter(c => !c.hidden).map((c, i) => ({ ...c, n: i + 1, blocks: c.id === sh.figCard && figs[sh.figureId] ? [...c.blocks, { k: 'fig', img: figs[sh.figureId] }] : c.blocks }));
    if (sh.figureId && figs[sh.figureId] && !sh.figCard) { const fc = cards.find(c => /found|finding|result/i.test(c.title)); if (fc) fc.blocks = [...fc.blocks, { k: 'fig', img: figs[sh.figureId] }]; }
    const rows = sheetRows(cards, cols);
    const titleSize = land ? W * 0.029 : W * 0.04;
    let gapK = 0.9;
    const layout = base => {
      const G = base * gapK, colW = (W - 2 * M - G * (cols - 1)) / cols;
      const hs = rows.map(r => Math.max(...r.map(({ c, sp }) => sheetCard(ctx, T, c, 0, 0, sp * colW + (sp - 1) * G, base, false))));
      return { G, colW, hs, total: hs.reduce((a, b) => a + b, 0) + G * (rows.length - 1) };
    };
    // header
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const stats = (sh.stats || []).slice(0, 3), chipW = stats.length ? (land ? W * 0.115 : W * 0.15) : 0, chipG = W * 0.008, chipsW = stats.length ? stats.length * chipW + (stats.length - 1) * chipG : 0;
    const tw = W - 2 * M - (chipsW ? chipsW + W * 0.03 : 0);
    const eb = Math.max(22, titleSize * 0.2);
    const tr = fit(ctx, meta.title, T.display, { w: tw, h: titleSize * 1.12 * 3 }, { max: titleSize, min: Math.max(72, titleSize * 0.6), lh: 1.08, maxLines: 3 });
    if (!tr.ok) warn.push('The title is long for the header. Shorten it.');
    const sub = fit(ctx, sh.subtitle || '', T.body, { w: tw, h: titleSize * 0.7 }, { max: titleSize * 0.27, min: 24, lh: 1.3, maxLines: 2 });
    let y = M * 0.9;
    if (sh.eyebrow) { eyebrowText(ctx, T, sh.eyebrow, M, y + eb, eb, C.head); y += eb * 2.1; }
    y += drawText(ctx, tr, T.display, M, y, { lh: 1.08, color: C.head }) + titleSize * 0.18;
    y += drawText(ctx, sub, T.body, M, y, { lh: 1.3, color: T.muted });
    const chipH = Math.max(titleSize * 1.45, W * 0.05);
    stats.forEach((st, i) => sheetStat(ctx, T, st, W - M - chipsW + i * (chipW + chipG), M * 0.9 + eb * 2.1, chipW, chipH, Math.max(24, titleSize * 0.3)));
    y = Math.max(y, M * 0.9 + eb * 2.1 + chipH) + titleSize * 0.3;
    ctx.fillStyle = C.head; ctx.fillRect(M, y, W - 2 * M, Math.max(3, W * 0.0012)); y += titleSize * 0.42;
    const headH = y;
    // footer
    const footH = W * 0.055, avail = H - headH - footH - M * 0.6;
    let lo = 24, hi = land ? W * 0.016 : W * 0.022, L = layout(lo);
    if (L.total > avail) { gapK = 0.55; L = layout(lo); }
    if (L.total > avail) warn.push('There is more content than fits at a readable size (24 pt). Hide a card or shorten text in the editor.');
    else { for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2, t = layout(mid); if (t.total <= avail) { lo = mid; L = t; } else hi = mid; } }
    const base = lo;
    rows.forEach((r, ri) => {
      let x = M;
      const rh = L.hs[ri];
      r.forEach(({ c, sp }) => { const w = sp * L.colW + (sp - 1) * L.G; sheetCard(ctx, T, c, x, y, w, base, true, { minH: rh }); rects.push({ id: c.id, x, y, w, h: rh }); x += w + L.G; });
      y += rh + L.G;
    });
    // footer
    const fy = H - footH - M * 0.35;
    ctx.fillStyle = T.line; ctx.fillRect(M, fy, W - 2 * M, Math.max(2, W * 0.0007));
    const qs = meta.doi ? footH * 0.86 : 0;
    if (meta.doi) qr(ctx, 'https://doi.org/' + meta.doi, W - M - qs, fy + footH * 0.1, qs, '#111111', '#FFFFFF');
    const cite = [meta.authors && meta.authors.length ? (meta.authors.length > 2 ? meta.authors[0] + ' et al.' : meta.authors.join(' & ')) : '', meta.year ? `(${meta.year})` : '', meta.journal].filter(Boolean).join(' ');
    const fl = fit(ctx, `${cite}${meta.doi ? ' · doi.org/' + meta.doi : ''}`, T.body, { w: W - 2 * M - qs - W * 0.02, h: footH * 0.4 }, { max: Math.max(24, base * 0.8), min: 20, lh: 1.25, maxLines: 2 });
    drawText(ctx, fl, T.body, M, fy + footH * 0.22, { lh: 1.25, color: T.muted });
    const refs = (sh.refs || []).slice(0, 3).join('   ');
    if (refs) { const rf = fit(ctx, 'Key references: ' + refs, T.body, { w: W - 2 * M - qs - W * 0.02, h: footH * 0.4 }, { max: Math.max(20, base * 0.66), min: 18, lh: 1.25, maxLines: 2 }); drawText(ctx, rf, T.body, M, fy + footH * 0.22 + fl.lines.length * fl.size * 1.25 + footH * 0.06, { lh: 1.25, color: T.muted }); }
    const words = cards.reduce((a, c) => a + c.blocks.reduce((b2, bl) => b2 + String(bl.text || (bl.items || []).join(' ') || '').split(/\s+/).length, 0), 0);
    return { rects, warn, bodyPt: Math.round(base), titlePt: Math.round(tr.size), statementPt: 0, words };
  }
  // carousel slide in the study-sheet style
  function renderSheetSlide(cv, s, i, n, T, ctxData) {
    const W = 1080, H = 1350, P = 84, ctx = cv.getContext('2d'), C = sheetColors(T), warn = [], base = 34;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    const meta = ctxData.meta || {}, kws = ctxData.keywords || [], brand = ctxData.brand || {};
    const B = t => (typeof P2P !== 'undefined' && P2P.boldKey) ? P2P.boldKey(t, kws) : t;
    // top line and footer
    eyebrowText(ctx, T, brand.series || (s.type === 'hook' ? [meta.journal, meta.year].filter(Boolean).join(' · ') || 'New research' : 'Paper summary'), P, P + 18, 22, C.head);
    ctx.font = fontStr(T.body, 22, 600); ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.fillText(`${i + 1} / ${n}`, W - P, P + 18); ctx.textAlign = 'left';
    ctx.fillStyle = C.head; ctx.fillRect(P, P + 42, W - 2 * P, 3);
    const footY = H - 70;
    ctx.fillStyle = T.line; ctx.fillRect(P, footY - 44, W - 2 * P, 2);
    ctx.font = fontStr(T.body, 22); ctx.fillStyle = T.muted; ctx.fillText(ctxData.footer || '', P, footY);
    if (i < n - 1) { ctx.font = fontStr(T.body, 24, 700); ctx.fillStyle = C.head; ctx.textAlign = 'right'; ctx.fillText('Swipe  →', W - P, footY); ctx.textAlign = 'left'; }
    const top = P + 90, bottom = H - 140, cw = W - 2 * P;
    const heading = (num, text, y) => { const r = fit(ctx, (num ? num + ' · ' : '') + (text || ''), T.display, { w: cw, h: 200 }, { max: 66, min: 44, lh: 1.1, maxLines: 3 }); drawText(ctx, r, T.display, P, y, { lh: 1.1, color: C.head }); return r.lines.length * r.size * 1.1; };
    // the card grows to fill the slide (up to 50 px text) and shrinks no lower than 30 px
    const placeCard = (c, y, room = bottom - y, maxB = 50) => {
      let lo = 30, hi = maxB;
      if (sheetCard(ctx, T, c, P, y, cw, hi, false) <= room) lo = hi;
      else if (sheetCard(ctx, T, c, P, y, cw, lo, false) > room) warn.push('This slide has a lot of text. Shorten it.');
      else for (let k = 0; k < 12; k++) { const mid = (lo + hi) / 2; if (sheetCard(ctx, T, c, P, y, cw, mid, false) <= room) lo = mid; else hi = mid; }
      return sheetCard(ctx, T, c, P, y, cw, lo, true);
    };
    const label = s.label || '';
    if (s.type === 'hook') {
      let y = top + 40;
      const hr = fit(ctx, s.heading, T.display, { w: cw, h: 520 }, { max: 112, min: 60, lh: 1.06 });
      if (!hr.ok) warn.push('Headline is too long to fit. Shorten it.');
      y += drawText(ctx, hr, T.display, P, y, { lh: 1.06, color: C.head, hl: T.accent }) + 34;
      const tr = fit(ctx, meta.title || '', T.body, { w: cw, h: 120 }, { max: 32, min: 24, lh: 1.3, maxLines: 3 });
      y += drawText(ctx, tr, T.body, P, y, { lh: 1.3, color: T.muted }) + 40;
      const stats = (ctxData.stats || []).slice(0, 3);
      if (stats.length) { const g = 18, w = (cw - g * (stats.length - 1)) / stats.length; stats.forEach((st, k) => sheetStat(ctx, T, st, P + k * (w + g), y, w, 190, 40)); y += 190 + 36; }
      let tx = P;
      if (brand.avatar) { avatar(ctx, brand.avatar, P, bottom - 74, 64, C.head); tx = P + 80; }
      if (brand.handle) { ctx.font = fontStr(T.body, 28, 700); ctx.fillStyle = T.ink; ctx.fillText(brand.handle, tx, bottom - 32); }
      else if (s.body) { ctx.font = fontStr(T.body, 28); ctx.fillStyle = T.muted; ctx.fillText(s.body, tx, bottom - 32); }
      return warn;
    }
    if (s.type === 'cite') {
      let y = top + 10; y += heading('', s.heading || 'Read the full paper', y) + 30;
      const c = { tone: 'dark', title: '', blocks: [{ k: 'p', text: `**${meta.title || ''}**` }, { k: 'p', text: (meta.authors || []).join(', '), small: true }, { k: 'p', text: [meta.journal, meta.year, meta.doi ? 'doi.org/' + meta.doi : ''].filter(Boolean).join(' · '), small: true }] };
      y += placeCard(c, y) + 30;
      if (meta.doi && y + 220 < bottom) { qr(ctx, 'https://doi.org/' + meta.doi, P, y, 200, '#111111', '#FFFFFF'); const cr = fit(ctx, s.body || '', T.body, { w: cw - 240, h: 200 }, { max: 36, min: 26, lh: 1.3 }); drawText(ctx, cr, T.body, P + 240, y + 10, { lh: 1.3, color: T.ink, bc: C.head, hl: T.accent }); }
      else if (s.body) { const cr = fit(ctx, s.body, T.body, { w: cw, h: bottom - y }, { max: 36, min: 26, lh: 1.3 }); drawText(ctx, cr, T.body, P, y, { lh: 1.3, color: T.ink }); }
      return warn;
    }
    let y = top; ctxData = { ...ctxData, used: null };
    const num = i;
    y += heading(num, s.heading || label, y) + 30;
    const tone = /limit|keep in mind|caution|risk/i.test(label + ' ' + (s.heading || '')) ? 'warn' : /why|matter|mean|take/i.test(label + ' ' + (s.heading || '')) ? 'dark' : 'light';
    if (s.type === 'stat') {
      const c = { tone: 'light', blocks: [s.big ? { k: 'big', big: s.big, label: s.bigLabel || '' } : null, s.ctx ? { k: 'p', text: String(s.ctx).toUpperCase(), small: true } : null, s.body ? { k: 'p', text: B(s.body) } : null].filter(Boolean) };
      const ch = typeof P2P !== 'undefined' && P2P.chartFor && s.visual !== 'none' ? P2P.chartFor(s.body || '', s.big || '', s.bigLabel || '') : null;
      y += placeCard(c, y, (bottom - y) - (ch ? 470 : 0), 46) + 30;
      if (ch && bottom - y > 300) talkChart(ctx, T, ch, P, y, cw, Math.min(500, bottom - y), C.head);
    } else if (s.type === 'list') {
      const bl = (s.bullets || []).filter(Boolean);
      const flowy = /method|what (we|they) did|how/i.test(label + ' ' + (s.heading || '')) && bl.length >= 2 && bl.length <= 5;
      ctxData.used = y + placeCard({ tone: flowy ? 'outline' : tone, blocks: flowy ? [{ k: 'flow', vertical: true, steps: bl.map((t, k) => ({ title: '', text: B(t), tone: k === bl.length - 1 ? 'accent' : '' })) }] : [{ k: 'ul', items: bl.map(B) }] }, y, bottom - y - 300, 54);
    } else if (s.type === 'cheat') {
      const it = (s.items || []).slice(0, 6);
      const g = 18, w2 = (cw - g) / 2;
      let yy = y, colH = [y, y];
      it.forEach((x, k) => { const col = colH[0] <= colH[1] ? 0 : 1; const c = { tone: k === 0 ? 'dark' : 'light', title: x.title, blocks: [x.big ? { k: 'p', text: `**${x.big}**` } : null, { k: 'p', text: B(x.text || '') }].filter(Boolean) }; const hh = sheetCard(ctx, T, c, 0, 0, w2, 32, false); if (colH[col] + hh > bottom) return; sheetCard(ctx, T, c, P + col * (w2 + g), colH[col], w2, 32, true); colH[col] += hh + g; });
      void yy;
    } else if (s.type === 'figure' && ctxData.figure) {
      placeCard({ tone: 'light', blocks: [s.body ? { k: 'p', text: B(s.body) } : null, { k: 'fig', img: ctxData.figure }].filter(Boolean) }, y);
    } else {
      const st = (s.steps || []).map(x => String(x).trim()).filter(Boolean);
      const quote = s.layout === 'quote';
      ctxData.used = y + placeCard({ tone: quote ? 'dark' : tone, blocks: [{ k: 'p', text: quote ? `**“${String(s.body || '').replace(/\*/g, '')}”**` : B(s.body || '') }, st.length >= 2 ? { k: 'flow', steps: st.slice(0, 4).map((t, k) => ({ title: t, text: '', tone: k === st.length - 1 ? 'accent' : '' })), vertical: true } : null].filter(Boolean) }, y, bottom - y - 300, 58);
    }
    // a "From the paper" note fills spare room and shows where the slide came from
    const src = (s.srcs || [])[s.type === 'list' ? 0 : (s.optIndex || 0) % Math.max(1, (s.srcs || []).length)];
    if (src && src.text && !['cheat', 'figure'].includes(s.type) && ctxData.used != null) {
      const yy = ctxData.used + 30, room = bottom - yy;
      const note = { tone: 'outline', title: '', blocks: [{ k: 'p', text: `**From the paper${src.where ? ' · ' + src.where : ''}**`, small: true }, { k: 'p', text: '“' + (P2P.shorten ? P2P.shorten(src.text, 34) : src.text) + '”', small: true }] };
      if (room > 200 && sheetCard(ctx, T, note, P, yy, cw, 30, false) <= room) sheetCard(ctx, T, note, P, yy, cw, 30, true);
    }
    const words = P2P.wc(s.body || '') + (s.bullets ? s.bullets.reduce((a, b) => a + P2P.wc(b), 0) : 0);
    if (words > 45) warn.push(`${words} words on this slide. Aim for 40 or fewer.`);
    return warn;
  }

  // ---- editable PowerPoint from recorded talk slides ----
  // items: [{ rec, notes, crop(x, y, w, h) -> PNG data URL }]
  function buildTalkPptx(Pptx, items, T, info = {}) {
    const p = new Pptx(); p.layout = 'LAYOUT_WIDE';
    if (info.title) p.title = info.title; if (info.author) p.author = info.author;
    const IN = v => Math.round(v / 144 * 1000) / 1000, hex = c => String(c || '#000000').replace('#', '').toUpperCase().slice(0, 6);
    const serif = f => /serif/i.test(f.fb) && !/sans/i.test(f.fb);
    const face = info.fonts === 'theme' ? { display: T.display.family, body: T.body.family, mono: T.mono.family } : { display: serif(T.display) ? 'Georgia' : 'Arial', body: 'Arial', mono: /mono/i.test(T.mono.fb) ? 'Consolas' : 'Arial' };
    for (const it of items) {
      const sl = p.addSlide(); sl.background = { color: hex(it.rec.bg) };
      for (const r of it.rec) {
        if (r.t === 'box') {
          const rad = r.r > 0 ? Math.min(1, r.r / (Math.min(r.w, r.h) / 2)) : 0;
          sl.addShape(rad ? 'roundRect' : 'rect', { x: IN(r.x), y: IN(r.y), w: IN(r.w), h: IN(r.h), rectRadius: rad || undefined, fill: r.fill ? { color: hex(r.fill) } : { type: 'none' }, line: r.line ? { color: hex(r.line), width: r.lw * 0.5 } : { type: 'none' } });
        } else if (r.t === 'oval' || r.t === 'diamond') {
          sl.addShape(r.t === 'oval' ? 'ellipse' : 'diamond', { x: IN(r.x), y: IN(r.y), w: IN(r.w), h: IN(r.h), fill: { color: hex(r.fill) }, line: { type: 'none' } });
        } else if (r.t === 'pic') {
          sl.addImage({ data: it.crop(r.x, r.y, r.w, r.h), x: IN(r.x), y: IN(r.y), w: IN(r.w), h: IN(r.h) });
        } else if (r.t === 'text' && String(r.text || '').trim()) {
          const runs = []; let cur = null;
          tokens(r.text).forEach((tk, k, a) => {
            if (tk.br) { if (cur) cur.options.breakLine = true; cur = null; return; }
            const color = hex(tk.hl && r.hl ? r.hl : tk.b && r.bc ? r.bc : r.color), sp = k < a.length - 1 && !a[k + 1].br ? ' ' : '', bold = !!tk.b || undefined;
            if (cur && cur.options.color === color && cur.options.bold === bold && !cur.options.breakLine) cur.text += tk.t + sp;
            else { cur = { text: tk.t + sp, options: { color, bold } }; runs.push(cur); }
          });
          sl.addText(runs, { x: IN(r.x), y: IN(r.y), w: IN(r.w + 6), h: IN(r.h * 1.08 + 4), margin: 0, valign: 'top', align: r.align, fontFace: face[r.font], fontSize: Math.max(8, Math.round(r.size * 0.5 * 0.97 * 2) / 2), bold: r.bold || (r.font === 'display' && T.display.weight >= 600), lineSpacingMultiple: Math.max(0.8, Math.round(r.lh / 1.2 * 100) / 100), fit: 'shrink', wrap: true });
        }
      }
      if (it.notes) sl.addNotes(it.notes);
    }
    return p;
  }

  function renderPoster(ctx, P, meta, T, size, figs, opts = {}) {
    if (P.layout === 'sheet' && P.sheet) return renderSheetPoster(ctx, P, meta, T, size, figs);
    if (P.layout === 'story' && P.story) return renderStoryPoster(ctx, P, meta, T, size, figs);
    if (P.layout === 'billboard' && P.bb) return renderBillboard(ctx, P, meta, T, size, figs);
    const L = posterLayout(ctx, P, meta, T, size, figs);
    const { W, H, M } = L;
    ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
    if (T.deco === 'tech') { ctx.fillStyle = T.line; for (let y = 40; y < H; y += 56) for (let x = 40; x < W; x += 56) ctx.fillRect(x, y, 3, 3); }
    if (T.deco === 'pastel') { ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = T.blobB; ctx.beginPath(); ctx.ellipse(-100, H * 0.62, 520, 460, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = T.blobA; ctx.beginPath(); ctx.ellipse(W + 120, H * 0.4, 560, 480, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    // banner
    ctx.fillStyle = T.banner; ctx.fillRect(0, 0, W, L.bannerH);
    if (T.deco === 'academic') { ctx.fillStyle = T.accent; ctx.fillRect(0, L.bannerH - 16, W, 16); }
    if (T.deco === 'tech') { ctx.fillStyle = T.accent; ctx.fillRect(M, L.bannerH - 6, 360, 6); }
    if (T.deco === 'editorial') { ctx.fillStyle = T.accent; ctx.fillRect(0, L.bannerH, W, 22); }
    let y = M;
    y += drawText(ctx, L.title, T.display, M, y, { lh: 1.08, color: T.bannerInk }) + 34;
    y += drawText(ctx, L.au, T.body, M, y, { lh: 1.3, color: T.bannerInk, weight: T.body.bold }) + 14;
    if (meta.affiliations.length) drawText(ctx, L.af, T.body, M, y, { lh: 1.3, color: T.bannerSub });
    // columns
    const rects = [];
    L.byCol.forEach((list, c) => {
      const x = M + c * (L.cw + L.gut);
      let cy = L.colTop;
      for (const b of list) {
        const h = L.measureBlock(b, L.s);
        const callout = b.kind === 'callout';
        ctx.save();
        if (callout) { ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent; rr(ctx, x, cy, L.cw, h, T.radius * 1.4); ctx.fill(); }
        else if (T.deco === 'editorial') { ctx.fillStyle = T.surface; ctx.fillRect(x, cy, L.cw, h); ctx.fillStyle = T.ink; ctx.fillRect(x, cy, L.cw, 10); }
        else { ctx.fillStyle = T.surface; rr(ctx, x, cy, L.cw, h, T.radius * 1.4); ctx.fill(); if (T.deco === 'tech') { ctx.strokeStyle = T.line; ctx.lineWidth = 2; rr(ctx, x, cy, L.cw, h, T.radius * 1.4); ctx.stroke(); } }
        ctx.restore();
        const ix = x + L.pad; let iy = cy + L.pad;
        const onC = callout ? (T.deco === 'editorial' ? T.bg : T.onAccent) : T.ink;
        if (callout) {
          ctx.font = fontStr(T.mono, 30); ctx.fillStyle = onC; ctx.fillText((b.heading || 'Key takeaway').toUpperCase(), ix, iy + 30); iy += 62;
          drawText(ctx, measureAt(ctx, b.text, T.display, L.inner, L.s * 1.3, 1.22), T.display, ix, iy, { lh: 1.22, color: onC });
        } else {
          const hr = fit(ctx, b.heading || '', T.display, { w: L.inner, h: 58 * 1.15 * 2 }, { max: 58, min: 44, lh: 1.15, maxLines: 2 });
          drawText(ctx, hr, T.display, ix, iy, { lh: 1.15, color: T.deco === 'editorial' ? T.ink : T.accent }); iy += hr.lines.length * hr.size * 1.15 + 22;
          if (b.kind === 'text') drawText(ctx, measureAt(ctx, b.text, T.body, L.inner, L.s, 1.38), T.body, ix, iy, { lh: 1.38, color: T.ink, hl: T.accent });
          else if (b.kind === 'bullets') {
            for (const t of b.bullets.filter(Boolean)) {
              ctx.fillStyle = T.deco === 'editorial' ? T.ink : T.accent;
              if (T.deco === 'editorial') ctx.fillRect(ix, iy + L.s * 0.45, L.s * 0.5, L.s * 0.5); else { ctx.beginPath(); ctx.arc(ix + 10, iy + L.s * 0.68, L.s * 0.24, 0, Math.PI * 2); ctx.fill(); }
              iy += drawText(ctx, measureAt(ctx, t, T.body, L.inner - 44, L.s, 1.36), T.body, ix + 44, iy, { lh: 1.36, color: T.ink, hl: T.accent }) + L.s * 0.55;
            }
          } else if (b.kind === 'stats') {
            for (const st of b.stats.filter(x => x.big)) {
              ctx.font = fontStr(T.display, 100); const w100 = ctx.measureText(st.big).width;
              const bs = Math.min(128, 100 * L.inner / Math.max(1, w100));
              ctx.font = fontStr(T.display, bs); ctx.fillStyle = T.accent; ctx.fillText(st.big, ix, iy + bs * 0.86 + (128 - bs));
              iy += 128 + 12;
              const lr = measureAt(ctx, st.label, T.body, L.inner, L.s, 1.32);
              iy += drawText(ctx, lr, T.body, ix, iy, { lh: 1.32, color: T.ink }) + 40;
            }
          } else if (b.kind === 'figure') {
            const img = figs[b.figureId]; const fh = Math.min(1200, L.inner * (img.width > 0 && img.height > 0 ? img.height / img.width : 0.66));
            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ix, iy, L.inner, fh);
            drawImageContain(ctx, img, ix, iy, L.inner, fh); iy += fh + 18;
            if (b.caption) drawText(ctx, measureAt(ctx, b.caption, T.body, L.inner, L.s * 0.85, 1.32), T.body, ix, iy, { lh: 1.32, color: T.muted });
          }
        }
        rects.push({ id: b.id, x, y: cy, w: L.cw, h });
        cy += h + L.gap;
      }
    });
    // footer
    const fy = H - L.footH;
    ctx.fillStyle = T.deco === 'tech' ? T.surface : T.deco === 'editorial' ? T.ink : T.surface; ctx.fillRect(0, fy, W, L.footH);
    const fInk = T.deco === 'editorial' ? T.bg : T.ink, fMuted = T.deco === 'editorial' ? '#E8DFB0' : T.muted;
    let fx = M;
    if (meta.doi) { qr(ctx, 'https://doi.org/' + meta.doi, M, fy + 55, 220, '#111111', '#FFFFFF'); fx = M + 270; }
    ctx.font = fontStr(T.mono, 28); ctx.fillStyle = fMuted; ctx.fillText(meta.doi ? 'SCAN FOR THE FULL PAPER' : 'FULL PAPER', fx, fy + 92);
    const cite = [meta.authors.length > 2 ? meta.authors[0] + ' et al.' : meta.authors.join(' & '), meta.year ? `(${meta.year})` : '', meta.journal].filter(Boolean).join(' ');
    const cr = fit(ctx, cite || meta.title, T.body, { w: W * 0.55, h: 90 }, { max: 36, min: 26, lh: 1.3, weight: T.body.bold });
    drawText(ctx, cr, T.body, fx, fy + 112, { lh: 1.3, color: fInk, weight: T.body.bold });
    if (meta.doi) { ctx.font = fontStr(T.mono, 30); ctx.fillStyle = T.deco === 'editorial' ? T.bg : T.accent; ctx.fillText('doi.org/' + meta.doi, fx, fy + 245); }
    // keywords right
    if (meta.keywords && meta.keywords.length) {
      ctx.font = fontStr(T.body, 28, T.body.bold);
      let kx = W - M, ky = fy + 200;
      ctx.font = fontStr(T.mono, 26); ctx.fillStyle = fMuted; ctx.textAlign = 'right'; ctx.fillText('KEYWORDS', W - M, fy + 92); ctx.textAlign = 'left';
      ctx.font = fontStr(T.body, 28, T.body.bold);
      for (const k of meta.keywords.slice(0, 4).reverse()) {
        const tw = ctx.measureText(k).width + 44; if (kx - tw < W * 0.62) break; kx -= tw;
        ctx.strokeStyle = T.deco === 'editorial' ? T.bg : T.accent; ctx.lineWidth = 3; rr(ctx, kx, ky - 44, tw, 60, T.deco === 'editorial' ? 0 : 30); ctx.stroke();
        ctx.fillStyle = T.deco === 'editorial' ? T.bg : T.accent; ctx.fillText(k, kx + 22, ky - 4); kx -= 14;
      }
    }
    const warn = [];
    if (L.overflow) { const cs = L.colOver.map((o, i) => o ? i + 1 : 0).filter(Boolean); warn.push(`${cs.length ? `Column${cs.length > 1 ? 's' : ''} ${cs.join(' and ')}` : 'The poster text'} does not fit even at the 24 pt minimum. Shorten text or move a block to another column.`); }
    if (!L.title.ok) warn.push('Title is too long for three lines at 72 pt. Shorten it.');
    return { rects, bodyPt: L.s, titlePt: L.title.size, warn };
  }

  // swap in a brand colour, nudged until it keeps WCAG contrast on the theme background
  function hexMix(a, b, t) { const p = h => h.replace('#', '').match(/../g).map(x => parseInt(x, 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  function withAccent(T, hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return T;
    let a = hex, k = 0; const dir = lum(T.bg) > 0.4 ? '#000000' : '#FFFFFF';
    while (contrast(a, T.bg) < 3 && k < 12) { a = hexMix(a, dir, 0.12); k++; }
    const onAccent = contrast(a, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#111111';
    return { ...T, accent: a, soft: hexMix(a, T.bg, 0.86), onAccent, adjusted: a.toLowerCase() !== hex.toLowerCase() };
  }
  return { sheetCard, withAccent, renderTalkSlide, buildTalkPptx, tokens, THEMES, ICON_NAMES, fontSpecs, themeContrast, renderSlide, visualFor, animEnd, renderStory, renderGA, bbWords, visualsFor, EFFECT, renderPoster, POSTER_SIZES, contrast };
})();
