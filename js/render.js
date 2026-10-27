/*
 * Canvas renderer for the infographic (one tall image) and carousel slides
 * (one image per block). Everything is drawn on <canvas> so slides can be
 * exported as PNG and recorded into a video without extra libraries.
 */
(function (root) {
  'use strict';

  const W = 1080;
  const HEAD = '"Poppins", "Helvetica Neue", Arial, sans-serif';
  const BODY = '"Inter", "Helvetica Neue", Arial, sans-serif';

  const THEMES = {
    midnight: { name: 'Midnight', bg: ['#0f172a', '#1e1b4b'], text: '#f8fafc', muted: '#cbd5e1', accent: '#fbbf24', accent2: '#38bdf8', card: 'rgba(255,255,255,0.06)', onAccent: '#0f172a' },
    paper:    { name: 'Paper',    bg: ['#fbf8f3', '#f1e9dd'], text: '#1f2937', muted: '#4b5563', accent: '#d9480f', accent2: '#0f766e', card: 'rgba(31,41,55,0.05)', onAccent: '#ffffff' },
    ocean:    { name: 'Ocean',    bg: ['#03256c', '#0b6e99'], text: '#ffffff', muted: '#d6ecf7', accent: '#ffd166', accent2: '#90e0ef', card: 'rgba(255,255,255,0.08)', onAccent: '#03256c' },
    mint:     { name: 'Mint',     bg: ['#f0fdf4', '#ccfbf1'], text: '#064e3b', muted: '#335c4f', accent: '#047857', accent2: '#ea580c', card: 'rgba(6,78,59,0.06)', onAccent: '#ffffff' },
    sunset:   { name: 'Sunset',   bg: ['#ffedd5', '#fecdd3'], text: '#3b0d1f', muted: '#6b3a4a', accent: '#be123c', accent2: '#7c3aed', card: 'rgba(59,13,31,0.06)', onAccent: '#ffffff' },
    mono:     { name: 'Neon Mono', bg: ['#0a0a0a', '#1c1c1c'], text: '#ffffff', muted: '#d4d4d4', accent: '#d9f99d', accent2: '#f0abfc', card: 'rgba(255,255,255,0.07)', onAccent: '#0a0a0a' }
  };

  const MOOD_THEME = { inspiring: 'sunset', corporate: 'paper', tech: 'midnight', calm: 'mint', energetic: 'mono', serious: 'ocean', playful: 'sunset' };

  function resolveTheme(key, mood) {
    return THEMES[key === 'auto' ? (MOOD_THEME[mood] || 'midnight') : key] || THEMES.midnight;
  }

  // ---------- text helpers ----------

  function wrap(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Paints (optionally) wrapped text and returns the height it occupies. */
  function textBlock(ctx, paint, text, x, y, maxWidth, { font, color, lineHeight, align = 'left', maxLines = 99 }) {
    ctx.font = font;
    let lines = wrap(ctx, text, maxWidth);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    }
    if (paint) {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'top';
      const ax = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
      lines.forEach((l, i) => ctx.fillText(l, ax, y + i * lineHeight));
      ctx.textAlign = 'left';
    }
    return lines.length * lineHeight;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function parseStat(line) {
    const [value, ...rest] = String(line).split('|');
    return { value: value.trim(), label: rest.join('|').trim() };
  }

  function percentOf(value) {
    const m = value.match(/^(\d+(?:\.\d+)?)\s?%$/);
    return m ? Math.min(100, parseFloat(m[1])) : null;
  }

  // ---------- block painters ----------
  // Each painter has signature (ctx, paint, block, x, y, w, t, s, ctx2) and returns
  // the height used. `s` scales every size so a block can shrink to fit a slide.

  const P = {
    cover(ctx, paint, b, x, y, w, t, s, extra) {
      let h = 0;
      const kicker = (extra.kicker || 'Infographic').toUpperCase();
      ctx.font = `700 ${26 * s}px ${BODY}`;
      const kw = ctx.measureText(kicker).width + 44 * s;
      if (paint) {
        ctx.fillStyle = t.accent;
        roundRect(ctx, x, y, kw, 52 * s, 26 * s);
        ctx.fill();
        ctx.fillStyle = t.onAccent;
        ctx.textBaseline = 'middle';
        ctx.fillText(kicker, x + 22 * s, y + 27 * s);
      }
      h += 52 * s + 40 * s;
      h += textBlock(ctx, paint, b.heading, x, y + h, w, { font: `800 ${92 * s}px ${HEAD}`, color: t.text, lineHeight: 104 * s, maxLines: 5 });
      h += 30 * s;
      if (paint) { ctx.fillStyle = t.accent2; ctx.fillRect(x, y + h, 140 * s, 12 * s); }
      h += 12 * s + 40 * s;
      if (b.items[0]) h += textBlock(ctx, paint, b.items[0], x, y + h, w * 0.92, { font: `400 ${38 * s}px ${BODY}`, color: t.muted, lineHeight: 54 * s, maxLines: 4 });
      if (extra.keywords && extra.keywords.length) {
        h += 44 * s;
        ctx.font = `600 ${26 * s}px ${BODY}`;
        let cx = x;
        for (const k of extra.keywords.slice(0, 4)) {
          const label = '#' + k;
          const cw = ctx.measureText(label).width + 36 * s;
          if (cx + cw > x + w) break;
          if (paint) {
            ctx.strokeStyle = t.muted; ctx.lineWidth = 2 * s;
            roundRect(ctx, cx, y + h, cw, 50 * s, 25 * s); ctx.stroke();
            ctx.fillStyle = t.muted; ctx.textBaseline = 'middle';
            ctx.fillText(label, cx + 18 * s, y + h + 26 * s);
          }
          cx += cw + 14 * s;
        }
        h += 50 * s;
      }
      return h;
    },

    summary(ctx, paint, b, x, y, w, t, s) {
      let h = heading(ctx, paint, b.heading, x, y, w, t, s);
      b.items.forEach((item, i) => {
        const r = 30 * s;
        if (paint) {
          ctx.fillStyle = t.accent;
          ctx.beginPath(); ctx.arc(x + r, y + h + r + 2 * s, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = t.onAccent; ctx.font = `800 ${30 * s}px ${HEAD}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), x + r, y + h + r + 4 * s);
          ctx.textAlign = 'left';
        }
        const th = textBlock(ctx, paint, item, x + 2 * r + 28 * s, y + h + 6 * s, w - 2 * r - 28 * s, { font: `500 ${36 * s}px ${BODY}`, color: t.text, lineHeight: 50 * s, maxLines: 4 });
        h += Math.max(2 * r, th) + 40 * s;
      });
      return h - 40 * s;
    },

    stats(ctx, paint, b, x, y, w, t, s, extra) {
      let h = heading(ctx, paint, b.heading, x, y, w, t, s);
      const stats = b.items.map(parseStat);
      const cols = extra.wide && stats.length > 1 ? Math.min(stats.length, 3) : 1;
      const gap = 28 * s;
      const cw = (w - gap * (cols - 1)) / cols;
      for (let row = 0; row < Math.ceil(stats.length / cols); row++) {
        const rowStats = stats.slice(row * cols, row * cols + cols);
        const heights = rowStats.map(st => statCard(ctx, false, st, 0, 0, cw, t, s, cols));
        const rh = Math.max(...heights);
        if (paint) rowStats.forEach((st, i) => statCard(ctx, true, st, x + i * (cw + gap), y + h, cw, t, s, cols, rh));
        h += rh + gap;
      }
      return h - gap;
    },

    section(ctx, paint, b, x, y, w, t, s, extra) {
      let h = 0;
      if (extra.index != null) {
        const num = String(extra.index).padStart(2, '0');
        if (paint) {
          ctx.font = `800 ${120 * s}px ${HEAD}`;
          ctx.lineWidth = 3 * s; ctx.strokeStyle = t.accent; ctx.textBaseline = 'top';
          ctx.strokeText(num, x, y);
        }
        h += 140 * s;
      }
      h += heading(ctx, paint, b.heading, x, y + h, w, t, s);
      for (const item of b.items) {
        if (paint) {
          ctx.fillStyle = t.accent2;
          roundRect(ctx, x, y + h + 14 * s, 18 * s, 18 * s, 4 * s); ctx.fill();
        }
        h += textBlock(ctx, paint, item, x + 46 * s, y + h, w - 46 * s, { font: `400 ${36 * s}px ${BODY}`, color: t.text, lineHeight: 50 * s, maxLines: 5 }) + 32 * s;
      }
      return h - 32 * s;
    },

    quote(ctx, paint, b, x, y, w, t, s) {
      let h = 0;
      if (paint) {
        ctx.font = `800 ${240 * s}px Georgia, serif`;
        ctx.fillStyle = t.accent; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
        ctx.fillText('“', x + w / 2, y - 20 * s);
        ctx.textAlign = 'left';
      }
      h += 170 * s;
      h += textBlock(ctx, paint, b.items[0] || '', x + 20 * s, y + h, w - 40 * s, { font: `600 ${54 * s}px ${HEAD}`, color: t.text, lineHeight: 74 * s, align: 'center', maxLines: 7 });
      h += 40 * s;
      if (paint) { ctx.fillStyle = t.accent2; ctx.fillRect(x + w / 2 - 60 * s, y + h, 120 * s, 8 * s); }
      return h + 8 * s;
    },

    cta(ctx, paint, b, x, y, w, t, s, extra) {
      let h = heading(ctx, paint, b.heading, x, y, w, t, s);
      if (b.items[0]) {
        const pad = 44 * s;
        const th = textBlock(ctx, false, b.items[0], 0, 0, w - pad * 2, { font: `600 ${44 * s}px ${HEAD}`, lineHeight: 62 * s, maxLines: 6 });
        if (paint) {
          ctx.fillStyle = t.card; roundRect(ctx, x, y + h, w, th + pad * 2, 28 * s); ctx.fill();
          ctx.fillStyle = t.accent; ctx.fillRect(x, y + h + pad, 10 * s, th);
          textBlock(ctx, true, b.items[0], x + pad, y + h + pad, w - pad * 2, { font: `600 ${44 * s}px ${HEAD}`, color: t.text, lineHeight: 62 * s, maxLines: 6 });
        }
        h += th + pad * 2 + 56 * s;
      }
      const cta = b.items[1];
      if (cta) {
        ctx.font = `700 ${32 * s}px ${BODY}`;
        const lines = wrap(ctx, cta, w - 96 * s);
        const bh = lines.length * 44 * s + 52 * s;
        if (paint) {
          ctx.fillStyle = t.accent; roundRect(ctx, x, y + h, w, bh, bh / 2 > 60 * s ? 40 * s : bh / 2); ctx.fill();
          textBlock(ctx, true, cta, x + 48 * s, y + h + 26 * s, w - 96 * s, { font: `700 ${32 * s}px ${BODY}`, color: t.onAccent, lineHeight: 44 * s, align: 'center' });
        }
        h += bh;
      }
      if (extra.handle) {
        h += 36 * s;
        h += textBlock(ctx, paint, `Follow ${extra.handle} for more`, x, y + h, w, { font: `500 ${30 * s}px ${BODY}`, color: t.muted, lineHeight: 40 * s, align: 'center' });
      }
      return h;
    }
  };

  function heading(ctx, paint, text, x, y, w, t, s) {
    if (!text) return 0;
    return textBlock(ctx, paint, text, x, y, w, { font: `800 ${60 * s}px ${HEAD}`, color: t.text, lineHeight: 70 * s, maxLines: 3 }) + 44 * s;
  }

  function statCard(ctx, paint, st, x, y, w, t, s, cols, fixedH) {
    const pad = 36 * s;
    const valueSize = (cols > 2 ? 76 : cols === 2 ? 92 : 104) * s;
    let h = pad;
    ctx.font = `800 ${valueSize}px ${HEAD}`;
    // Shrink long values (e.g. "$11,000") so they fit the card.
    let vs = valueSize;
    while (ctx.measureText(st.value).width > w - pad * 2 && vs > 30) { vs -= 4; ctx.font = `800 ${vs}px ${HEAD}`; }
    if (paint) {
      ctx.fillStyle = t.card; roundRect(ctx, x, y, w, fixedH, 28 * s); ctx.fill();
      ctx.fillStyle = t.accent; ctx.textBaseline = 'top'; ctx.fillText(st.value, x + pad, y + h);
    }
    h += vs * 1.08 + 16 * s;
    const pct = percentOf(st.value);
    if (pct != null) {
      if (paint) {
        ctx.fillStyle = t.card; roundRect(ctx, x + pad, y + h, w - pad * 2, 14 * s, 7 * s); ctx.fill();
        ctx.fillStyle = t.accent2; roundRect(ctx, x + pad, y + h, Math.max(14 * s, (w - pad * 2) * pct / 100), 14 * s, 7 * s); ctx.fill();
      }
      h += 14 * s + 24 * s;
    }
    const fs = (cols > 2 ? 26 : 32) * s;
    h += textBlock(ctx, paint, st.label, x + pad, y + h, w - pad * 2, { font: `400 ${fs}px ${BODY}`, color: t.muted, lineHeight: fs * 1.4, maxLines: 5 });
    return h + pad;
  }

  // ---------- backgrounds & chrome ----------

  function paintBackground(ctx, w, h, t, seed) {
    const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
    g.addColorStop(0, t.bg[0]); g.addColorStop(1, t.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Decorative soft circles, positioned deterministically per slide.
    const rnd = mulberry32(seed + 7);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.07 + rnd() * 0.05;
      ctx.fillStyle = i % 2 ? t.accent2 : t.accent;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * Math.min(h, 1400), 160 + rnd() * 260, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function sectionIndexes(blocks) {
    let n = 0;
    return blocks.map(b => (b.type === 'section' ? ++n : null));
  }

  // ---------- public renderers ----------

  /** Draws carousel slide `i` of `blocks` onto `canvas`. */
  function renderSlide(canvas, blocks, i, opts) {
    const H = opts.format === 'square' ? 1080 : 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const t = opts.theme;
    const b = blocks[i];
    paintBackground(ctx, W, H, t, i * 31 + 3);

    const pad = 96;
    const top = 150, bottom = 150;
    const avail = H - top - bottom;
    const extra = { ...opts, index: sectionIndexes(blocks)[i], wide: false };
    const painter = P[b.type] || P.section;

    let s = 1, h = painter(ctx, false, b, pad, 0, W - pad * 2, t, s, extra);
    while (h > avail && s > 0.55) { s -= 0.05; h = painter(ctx, false, b, pad, 0, W - pad * 2, t, s, extra); }
    const y = b.type === 'cover' || b.type === 'quote' || b.type === 'cta' ? top + (avail - h) / 2 : top + Math.max(0, (avail - h) * 0.35);
    painter(ctx, true, b, pad, y, W - pad * 2, t, s, extra);

    // Chrome: handle, counter, progress dots, swipe hint.
    ctx.textBaseline = 'middle';
    ctx.font = `600 28px ${BODY}`;
    ctx.fillStyle = t.muted;
    if (opts.handle) ctx.fillText(opts.handle, pad, 80);
    ctx.textAlign = 'right';
    ctx.fillText(`${i + 1}/${blocks.length}`, W - pad, 80);
    ctx.textAlign = 'left';

    const n = blocks.length, dot = 12, gap = 14;
    const dotsW = n * dot + (n - 1) * gap + 24;
    let dx = W / 2 - dotsW / 2;
    for (let k = 0; k < n; k++) {
      const active = k === i;
      ctx.fillStyle = active ? t.accent : t.muted;
      ctx.globalAlpha = active ? 1 : 0.4;
      roundRect(ctx, dx, H - 80 - dot / 2, active ? dot + 24 : dot, dot, dot / 2); ctx.fill();
      dx += (active ? dot + 24 : dot) + gap;
    }
    ctx.globalAlpha = 1;
    if (i < n - 1) {
      ctx.font = `700 28px ${BODY}`; ctx.fillStyle = t.text; ctx.textAlign = 'right';
      ctx.fillText('Swipe →', W - pad, H - 80);
      ctx.textAlign = 'left';
    }
  }

  /** Draws all blocks stacked into a single tall infographic. */
  function renderInfographic(canvas, blocks, opts) {
    const t = opts.theme;
    const pad = 90, gap = 70;
    const sectionIdx = sectionIndexes(blocks);
    const scratch = document.createElement('canvas').getContext('2d');

    const layout = blocks.map((b, i) => {
      const extra = { ...opts, index: sectionIdx[i], wide: true };
      const s = b.type === 'cover' ? 0.95 : 0.85;
      const painter = P[b.type] || P.section;
      return { b, extra, s, painter, h: painter(scratch, false, b, pad, 0, W - pad * 2, t, s, extra) };
    });
    const footerH = 120;
    const total = 110 + layout.reduce((sum, l) => sum + l.h + gap * 2, 0) + footerH;

    canvas.width = W; canvas.height = Math.ceil(total);
    const ctx = canvas.getContext('2d');
    paintBackground(ctx, W, total, t, 11);

    let y = 110;
    layout.forEach((l, i) => {
      if (i > 0 && l.b.type !== 'cover') {
        // Section card behind each block.
        ctx.fillStyle = t.card;
        roundRect(ctx, pad / 2, y - gap / 2, W - pad, l.h + gap, 36); ctx.fill();
      }
      l.painter(ctx, true, l.b, pad, y, W - pad * 2, t, l.s, l.extra);
      y += l.h + gap * 2;
    });

    ctx.fillStyle = t.accent; ctx.fillRect(0, total - footerH, W, 6);
    ctx.font = `600 28px ${BODY}`; ctx.fillStyle = t.muted; ctx.textBaseline = 'middle';
    ctx.fillText(opts.source ? `Source: ${opts.source}` : 'Made with Carousel Info', pad, total - footerH / 2);
    if (opts.handle) { ctx.textAlign = 'right'; ctx.fillText(opts.handle, W - pad, total - footerH / 2); ctx.textAlign = 'left'; }
  }

  root.Renderer = { THEMES, MOOD_THEME, resolveTheme, renderSlide, renderInfographic, W };
})(window);
