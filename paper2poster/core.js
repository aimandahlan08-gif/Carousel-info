/* ===== Paper2Poster core: rule-based extraction (no AI) ===== */
const P2P = (() => {

  // ---------- 1. PDF -> positioned lines ----------
  async function extractLines(pdf, opts = {}) {
    const maxPages = Math.min(pdf.numPages, opts.maxPages || 40);
    const pages = [];
    let twoColPages = 0;
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const [x0, y0, x1, y1] = page.view;
      const W = x1 - x0, H = y1 - y0;
      const tc = await page.getTextContent();
      let fontNames = {};
      try {
        await page.getOperatorList();
        for (const it of tc.items) {
          if (it.fontName && !(it.fontName in fontNames)) {
            let name = '';
            try { const f = page.commonObjs.get(it.fontName); name = (f && (f.name || f.loadedName)) || ''; } catch (e) {}
            fontNames[it.fontName] = name;
          }
        }
      } catch (e) {}
      const items = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const t = it.transform;
        const size = Math.hypot(t[2], t[3]) || it.height || 10;
        const fam = (tc.styles[it.fontName] && tc.styles[it.fontName].fontFamily) || '';
        const fname = fontNames[it.fontName] || '';
        items.push({
          str: it.str, x: t[4] - x0, y: t[5] - y0, w: it.width || it.str.length * size * 0.5,
          size: Math.round(size * 10) / 10,
          bold: /bold|black|heavy|semibold|demi|medi/i.test(fname + ' ' + fam),
        });
      }
      if (opts.onProgress) { opts.onProgress(p, maxPages); if (p % 4 === 0) await new Promise(r => setTimeout(r, 0)); }
      const res = orderPage(items, W, H, p);
      if (res.twoCol) twoColPages++;
      pages.push(...res.lines);
    }
    return { lines: pages, pageCount: pdf.numPages, pagesRead: maxPages, twoColPages };
  }

  // table rows: 3+ short cells on one line separated by wide gaps. Dropped so tables never leak into sentences.
  function dropTables(items) {
    const rows = [];
    for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const r = rows[rows.length - 1];
      if (r && Math.abs(r.y - it.y) <= Math.max(2, 0.4 * it.size)) r.items.push(it); else rows.push({ y: it.y, items: [it] });
    }
    const drop = new Set();
    for (const r of rows) {
      if (r.items.length < 3) continue;
      r.items.sort((a, b) => a.x - b.x);
      let big = 0;
      for (let k = 1; k < r.items.length; k++) { const gap = r.items[k].x - (r.items[k - 1].x + r.items[k - 1].w); if (gap > Math.max(10, 1.6 * r.items[k].size)) big++; }
      const avgLen = r.items.reduce((a, i) => a + i.str.trim().length, 0) / r.items.length;
      if (big >= 2 && avgLen < 28) r.items.forEach(i => drop.add(i));
    }
    // also drop a lone first-column cell sitting on the same baseline as a dropped row
    return { items: items.filter(i => !drop.has(i)), dropped: drop.size };
  }
  function orderPage(items, W, H, pageNo) {
    items = dropTables(items).items;
    // find a gutter between 38% and 62% of page width
    const bins = 50, cov = new Array(bins).fill(0);
    let narrow = items.filter(i => i.w < W * 0.6);
    for (const it of narrow) {
      const a = Math.max(0, Math.floor(it.x / W * bins)), b = Math.min(bins - 1, Math.floor((it.x + it.w) / W * bins));
      for (let k = a; k <= b; k++) cov[k] += it.str.length;
    }
    const maxCov = Math.max(1, ...cov);
    let gBin = -1, gVal = Infinity;
    for (let k = Math.floor(bins * 0.38); k <= Math.ceil(bins * 0.62); k++) if (cov[k] < gVal) { gVal = cov[k]; gBin = k; }
    const g = (gBin + 0.5) / bins * W;
    let leftChars = 0, rightChars = 0;
    for (const it of items) {
      if (it.x + it.w < g) leftChars += it.str.length; else if (it.x > g) rightChars += it.str.length;
    }
    const total = leftChars + rightChars || 1;
    const twoCol = gVal < maxCov * 0.08 && leftChars / total > 0.12 && rightChars / total > 0.12 && items.length >= 10;
    let groups;
    if (twoCol) {
      groups = { L: [], R: [], S: [] };
      for (const it of items) {
        if (it.x < g - 3 && it.x + it.w > g + 3) groups.S.push(it);
        else if (it.x + it.w / 2 < g) groups.L.push(it); else groups.R.push(it);
      }
    } else groups = { L: items, R: [], S: [] };
    const L = toLines(groups.L, pageNo, 1), R = toLines(groups.R, pageNo, 2), S = toLines(groups.S, pageNo, 3);
    const spanYs = S.map(l => l.y).sort((a, b) => b - a);
    const band = y => spanYs.filter(sy => sy > y + 0.5).length;
    const all = [...L, ...R, ...S].map(l => ({ ...l, band: band(l.y) }));
    all.sort((a, b) => a.band - b.band || a.rank - b.rank || b.y - a.y);
    return { lines: all.map(({ band, rank, ...l }) => ({ ...l, pageH: H, pageW: W })), twoCol };
  }

  function toLines(items, page, rank) {
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of sorted) {
      const ln = lines[lines.length - 1];
      if (ln && Math.abs(ln.y - it.y) <= Math.max(2, 0.45 * Math.max(ln.size, it.size))) ln.items.push(it);
      else lines.push({ y: it.y, size: it.size, items: [it] });
    }
    return lines.map(ln => {
      ln.items.sort((a, b) => a.x - b.x);
      let text = '', prevEnd = null, chars = 0, boldChars = 0;
      const sizes = {};
      for (const it of ln.items) {
        if (prevEnd !== null) {
          const gap = it.x - prevEnd;
          if (gap > it.size * 0.15 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
        }
        text += it.str;
        prevEnd = it.x + it.w;
        const n = it.str.trim().length; chars += n; if (it.bold) boldChars += n;
        sizes[it.size] = (sizes[it.size] || 0) + n;
      }
      const size = +Object.entries(sizes).sort((a, b) => b[1] - a[1])[0][0];
      return { text: text.replace(/\s+/g, ' ').trim(), size, bold: boldChars > chars * 0.6, page, y: ln.y, x: ln.items[0].x, rank };
    }).filter(l => l.text);
  }

  // ---------- 2. lines -> content model ----------
  const SECTION_RULES = [
    ['abstract', /^(abstract|summary|a b s t r a c t)$/],
    ['introduction', /^(introduction|background( of (the )?(study|research))?|problem statement|statement of (the )?problem|research (problem|objectives?|gap)|significance of (the )?(study|research)|scope (of (the )?(study|research))?|(conceptual|research|theoretical) framework|literature review|review of (the )?literature|theoretical (background|framework)|the (present|current) study|rationale|aims?( and hypotheses)?|objectives?|hypotheses|research questions?)$/],
    ['participants', /^(participants|sample|subjects|respondents|participants and (procedure|recruitment)|sample and procedure)$/],
    ['method', /^(methods?|methodology|materials and methods|methods and materials|research (design|methodology)|design|procedure|procedures|measures|instruments?|materials|data analysis|statistical analys[ie]s|analytic strategy|study design|data collection|analysis|setting)$/],
    ['results', /^(results?|findings|results and discussion|outcomes|main results)$/],
    ['discussion', /^(discussion|general discussion|implications|practical implications|theoretical implications|interpretation)$/],
    ['limitations', /^(limitations?|strengths and limitations|limitations and future (research|directions|work)|future (research|directions|work))$/],
    ['conclusion', /^(conclusions?|concluding remarks|summary and conclusions?|conclusion and implications)$/],
    ['references', /^(references|bibliography|works cited|literature cited|reference list|notes)$/],
    ['backmatter', /^(abstrak|table of contents|contents|list of (tables|figures|abbreviations|symbols|appendices)|dedication|declaration|acknowledge?ments?|funding|declarations?|declaration of (competing )?interests?|conflicts? of interest|author contributions?|data availability( statement)?|ethics|ethical (approval|statement)|competing interests|supplementary (material|data)|appendix|credit authorship)/],
  ];
  const ORDER = ['abstract', 'introduction', 'method', 'participants', 'results', 'discussion', 'limitations', 'conclusion'];
  const LABELS = { abstract: 'Abstract', introduction: 'Introduction', method: 'Method', participants: 'Participants', results: 'Results', discussion: 'Discussion', limitations: 'Limitations', conclusion: 'Conclusion' };

  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'via', 'with', 'from', 'into']);
  function titleCase(t) {
    if (!t || t !== t.toUpperCase() || !/[A-Z]{4}/.test(t)) return t;
    return t.toLowerCase().split(/(\s+|-)/).map((w, i) => {
      const up = w.toUpperCase();
      if (/^\s+$|^-$/.test(w)) return w;
      if (i > 0 && SMALL.has(w)) return w;
      if (w.length <= 3 && !SMALL.has(w) && /^[a-z]+$/.test(w) && !/^(new|use|can|how|why|its|who|all|one|two|key|day|ear|eye|leg|arm|age|sex|men|low|end|out|not|old|big|top|few|due|may|has|was|are|our|you|any|bad|non|pre|sea|air|oil|gut|jaw|lip|hip|toe|rib|fat|red|dry|hot|wet)$/.test(w)) return up; // acronyms like ENT, ICU
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('');
  }
  function normHeading(t) {
    return t.toLowerCase().replace(/^chapter\s+(\d+|[ivx]+|one|two|three|four|five|six|seven)\s*[:.\-–—]?\s*/i, '').replace(/^((\d+(\.\d+)*\.?)|([ivx]+\.)|([a-h][.)]))\s*/i, '').replace(/[:.\s]+$/, '').replace(/\s+/g, ' ').trim();
  }
  function classifyExact(t) { const n = normHeading(t); for (const [k, re] of SECTION_RULES) if (re.test(n)) return k; return null; }
  function classify(t) {
    const n = normHeading(t);
    if (n.length > 60) return null;
    for (const [k, re] of SECTION_RULES) if (re.test(n)) return k;
    for (const [k, re] of SECTION_RULES) {
      const src = re.source.replace(/^\^\(/, '^(').replace(/\)\$$/, ')\\b');
      if (n.length < 45 && new RegExp(src).test(n)) return k;
    }
    return null;
  }

  function mode(arr) { const m = {}; let best = null, bc = -1; for (const [v, w] of arr) { m[v] = (m[v] || 0) + w; if (m[v] > bc) { bc = m[v]; best = v; } } return +best; }

  function buildModel(input, meta = {}) {
    let lines = input.lines.map(l => ({ ...l }));
    const pages = Math.max(1, ...lines.map(l => l.page));
    // remove repeated headers/footers and page numbers
    const key = t => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
    const freq = {};
    for (const l of lines) { const k = key(l.text); (freq[k] = freq[k] || new Set()).add(l.page); }
    lines = lines.filter(l => {
      if (/^\s*(page\s*)?\d{1,4}(\s*(of|\/)\s*\d+)?\s*$/i.test(l.text)) return false;
      if (pages >= 3 && freq[key(l.text)].size >= Math.max(3, pages * 0.4) && l.text.length < 140) return false;
      if (/^(downloaded from|this article is protected|all rights reserved|copyright ©|© \d{4})/i.test(l.text) && l.page > 1) return false;
      return true;
    });
    const body = mode(lines.map(l => [l.size, l.text.length])) || 10;

    // title
    const p1 = lines.filter(l => l.page === 1);
    const junk = /(journal|vol\.|volume|issn|doi|https?:|www\.|©|copyright|received|accepted|published|citation|licen[sc]e|open access|research article|original (article|research)|elsevier|springer|wiley|taylor|sage|frontiers|plos|mdpi)/i;
    const cands = p1.filter(l => l.y > (l.pageH || 800) * 0.4 && l.text.length > 3 && !junk.test(l.text) && /[a-z]/i.test(l.text));
    let title = '', titleIdx = [];
    if (cands.length) {
      const maxSize = Math.max(...cands.map(l => l.size));
      if (maxSize > body * 1.15) {
        const idx = p1.findIndex(l => l.size === maxSize && cands.includes(l));
        let i = idx;
        while (i < p1.length && Math.abs(p1[i].size - maxSize) < 0.6 && titleIdx.length < 5) { titleIdx.push(i); i++; }
        title = titleIdx.map(i => p1[i].text).join(' ').replace(/\s+/g, ' ').replace(/[*†‡¹²³⁴]+$/, '').trim();
      }
    }
    if ((!title || title.length < 8) && meta.title && meta.title.length > 10 && !/^(microsoft word|untitled)/i.test(meta.title)) title = meta.title;
    if (!title) title = (p1.find(l => l.text.length > 25 && !junk.test(l.text)) || { text: 'Untitled paper' }).text;

    // authors & affiliations
    const authors = [], affiliations = [];
    const affRe = /(universit|department|dept\.|institute|school|faculty|college|cent(re|er)|hospital|laborator|@|campus|ministry|polytechnic|academy|\b\d{5}\b)/i;
    const nameRe = /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’.-]+(\s+(bin|binti|van|de|der|von|al|el|da|dos)?\s*[A-ZÀ-Ý][A-Za-zÀ-ÿ'’.-]*\.?){1,4}$/;
    if (titleIdx.length) {
      let i = titleIdx[titleIdx.length - 1] + 1, seen = 0;
      while (i < p1.length && seen < 10) {
        const l = p1[i]; seen++;
        if (classify(l.text) || /^abstract/i.test(l.text) || l.text.length > 220) break;
        if (/^(received|accepted|published|keywords?|corresponding|e-?mail|orcid|article history|cite)/i.test(l.text)) { i++; continue; }
        if (affRe.test(l.text)) { if (affiliations.length < 4) affiliations.push(l.text.replace(/^[\d*a-z†‡]\s*/, '').trim()); }
        else {
          const parts = l.text.replace(/[\d*†‡§¶¹²³⁴⁵⁶,]+(?=\s|,|$)/g, m => m.includes(',') ? ',' : '').split(/\s*(?:,|;|\band\b|&)\s*/).map(s => s.replace(/[*†‡§¶\d]+$/g, '').trim()).filter(Boolean);
          const good = parts.filter(s => nameRe.test(s) && s.split(' ').length <= 5);
          if (good.length && good.length >= parts.length * 0.5) authors.push(...good);
        }
        i++;
      }
    }
    if (!authors.length && meta.author) authors.push(...meta.author.split(/\s*(?:,|;|\band\b|&)\s*/).filter(s => s.length > 2).slice(0, 8));

    const allText = lines.map(l => l.text).join(' ');
    const doiM = allText.match(/\b(10\.\d{4,9}\/[^\s"<>,;]+)/);
    const doi = doiM ? doiM[1].replace(/[.)\]]+$/, '') : '';
    const p1Text = p1.map(l => l.text).join(' ');
    const years = (p1Text.match(/\b(19[6-9]\d|20[0-4]\d)\b/g) || []).map(Number).filter(y => y <= new Date().getFullYear() + 1);
    const year = years.length ? Math.max(...years) : '';
    let journal = '';
    const jl = p1.find(l => /journal|proceedings|conference|frontiers|plos one|bmc /i.test(l.text) && l.text.length < 120 && !affRe.test(l.text) && !titleIdx.includes(p1.indexOf(l)));
    if (jl) journal = jl.text.replace(/\s+\(?\d+.*$/, '').replace(/\s*[,|·]\s*$/, '').trim();

    // keywords
    let keywords = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].text.match(/^key\s?words?\s*[:—–-]?\s*(.*)$/i);
      if (m) {
        let s = m[1];
        if (!/\.\s*$/.test(s) && lines[i + 1] && lines[i + 1].text.length < 90 && !classify(lines[i + 1].text)) s += ' ' + lines[i + 1].text;
        keywords = s.split(/\s*[,;·•|]\s*/).map(k => k.replace(/\.$/, '').trim()).filter(k => k && k.length < 50).slice(0, 8);
        break;
      }
    }

    // sections
    const sections = {};
    const figurePages = new Set();
    let cur = null, ended = false, skipKw = false, topic = null;
    const topics = [], front = [], parts = [];
    const part = (heading, ref) => { parts.push({ heading, ref, raw: [], page: pageNow }); };
    let pageNow = 1, lastHead = null;
    const start = (k, heading) => { cur = k; lastHead = null; if (!sections[k]) sections[k] = { key: k, heading, raw: [], page: pageNow }; else sections[k].heading += ' · ' + heading; };
    for (let i = 0; i < lines.length && !ended; i++) {
      const l = lines[i];
      if (titleIdx.includes(i) && l.page === 1) continue;
      const t = l.text;
      pageNow = l.page;
      if (/^(fig(ure)?\.?|table|tab\.)\s*\d+[a-z]?\s*[.:|—–-]/i.test(t) || /^(fig(ure)?\.?|table)\s*\d+[a-z]?$/i.test(t)) { figurePages.add(l.page); continue; }
      const letters = (t.match(/[A-Za-z]/g) || []).length;
      if (t.length > 12 && letters / t.length < 0.45) continue;
      const abs = t.match(/^(abstract|a b s t r a c t|summary)\s*[:.—–-]\s*(.+)$/i);
      if (abs && !sections.abstract) { start('abstract', 'Abstract'); part('Abstract'); parts[parts.length - 1].raw.push(abs[2]); sections.abstract.raw.push(abs[2]); continue; }
      // table-of-contents lines: "1.1 Background of the Study ........ 3"
      if (/(\.\s?){4,}\s*[ivx\d]+\s*$/i.test(t) || /^\d+(\.\d+)+\s+\S.{2,80}\s\d{1,3}$/.test(t)) continue;
      const short = t.length < 70 && t.split(' ').length <= 10;
      const typo = l.size > body * 1.05 || l.bold || (t === t.toUpperCase() && /[A-Z]{3}/.test(t));
      const styled = typo || /^(\d{1,2}(\.\d{1,2})*\.?|[IVX]{1,4}\.)\s+[A-Z][a-z]/.test(t);
      const k = short ? classify(t) : null;
      if (k && (styled || (t.length < 40 && classifyExact(t))) && !/[,;.]$/.test(t.replace(/^\d+(\.\d+)*\.\s/, ''))) {
        if (k === 'references') { ended = true; break; }
        if (k === 'backmatter') { cur = 'skip'; continue; }
        start(k, t.replace(/^((\d+(\.\d+)*\.?)|([IVX]+\.))\s*/, '').replace(/[:.]$/, ''));
        part(t.replace(/^((\d+(\.\d+)*\.?)|([IVX]+\.))\s*/, '').replace(/[:.]$/, ''));
        topic = null;
        continue;
      }
      if (cur === 'skip') continue;
      if (/^key\s?words?\s*[:—–-]/i.test(t)) { skipKw = !/\.$/.test(t); continue; }
      if (skipKw) { skipKw = false; if (t.length < 90 && !/\.\s/.test(t)) continue; }
      // inline heading such as "Introduction: Ear, nose and throat emergencies are..."
      const inl = t.match(/^([A-Za-z][A-Za-z &]{2,40}?)\s*[:.—–]\s+(\S.{15,})$/);
      if (inl) {
        const k2 = classify(inl[1]);
        if (k2 === 'references') { ended = true; break; }
        if (k2 && k2 !== 'backmatter') { start(k2, inl[1]); part(inl[1]); parts[parts.length - 1].raw.push(inl[2]); topic = null; sections[k2].raw.push(inl[2]); continue; }
      }
      // any other heading starts a topic (review articles are organised by topic, not by IMRaD)
      if (short && typo && !/[.,;]$/.test(t) && /[A-Za-z]{3}/.test(t) && !junk.test(t) && !affRe.test(t) && !authors.some(x => t.includes(x))) {
        // "A. Initial stabilisation", "B. Medical treatment": sub-steps stay inside the topic above them
        const lettered = /^([A-Ha-h]|[ivx]{1,4})[.)]\s+/.test(t);
        const caps = t === t.toUpperCase() && /[A-Z]{3}/.test(t);
        const sig = Math.round(l.size * 2) * 5 + (caps ? 3 : 0) + (l.bold ? 1 : 0);
        // a heading that wraps onto a second line: "Acute Epiglottitis" + "(supraglottitis)"
        if (lastHead && !lettered && lastHead.sig === sig && !lastHead.raw.length && (/^[(a-z&]/.test(t) || !/:$/.test(lastHead.heading)) && (lastHead.heading + ' ' + t).length < 90) {
          lastHead.heading = (lastHead.heading + ' ' + t).replace(/[:.]$/, ''); continue;
        }
        // "A. Initial stabilisation", "B. Medical treatment": sub-steps stay inside the topic above them
        if (topic && !topic.sub && lettered) { (topic.steps = topic.steps || []).push(titleCase(t.replace(/^([A-Ha-h]|[ivx]{1,4})[.)]\s+/, '').replace(/[:.]$/, ''))); topic.raw.push('\u0000' + t); if (cur) sections[cur].raw.push('\u0000' + t); if (parts.length) parts[parts.length - 1].raw.push('\u0000' + t, t.replace(/^([A-Ha-h]|[ivx]{1,4})[.)]\s+/, '') + '.'); lastHead = null; continue; }
        topic = { sub: lettered, sig, heading: t.replace(/^((\d+(\.\d+)*\.?)|([IVX]+\.)|([a-h][.)]))\s*/, '').replace(/[:.]$/, ''), raw: [], page: l.page };
        topics.push(topic); lastHead = topic; part(null, topic);
        if (cur) sections[cur].raw.push('\u0000' + t);
        continue;
      }
      lastHead = null;
      if (parts.length) parts[parts.length - 1].raw.push(t);
      if (topic) topic.raw.push(t);
      if (!cur) { if (!topic) front.push(t); continue; }
      sections[cur].raw.push(t);
    }
    const joinRaw = raw => {
      let text = '';
      for (let r of raw) {
        if (r.startsWith('\u0000')) { text += '\n'; continue; }
        // bullet points in the paper: each item starts a new sentence, and the symbol is dropped
        r = r.replace(/\s+[•▪◦●■‣]\s+/g, '\n');
        if (/^\s*[•▪◦●■‣]\s*/.test(r)) { text += '\n'; r = r.replace(/^\s*[•▪◦●■‣]\s*/, ''); }
        if (!r) continue;
        if (/[A-Za-z]-$/.test(text) && /^[a-z]/.test(r)) text = text.slice(0, -1) + r;
        else text += (text && !text.endsWith('\n') ? ' ' : '') + r;
      }
      return text.replace(/[ \t]+/g, ' ').trim();
    };
    for (const k in sections) { const s = sections[k]; s.text = joinRaw(s.raw); s.words = s.text ? s.text.split(/\s+/).length : 0; }
    // text before the first heading becomes the introduction when the paper has none
    const firstLong = front.findIndex(t => t.length > 60);
    const frontText = firstLong >= 0 ? joinRaw(front.slice(firstLong).filter(t => !affRe.test(t) && !junk.test(t))) : '';
    if (!sections.introduction && !sections.abstract && frontText.split(/\s+/).length > 30) sections.introduction = { key: 'introduction', heading: 'Introduction', raw: [], text: frontText, words: frontText.split(/\s+/).length };
    const titleWords = new Set(tokenize(title));
    // heading levels: when the paper uses bigger/caps headings for topics and smaller ones inside them,
    // the smaller ones ("Causes and Risk Factors", "Prevention") stay inside their topic
    const topSig = Math.max(-1, ...topics.filter(t => !t.sub).map(t => t.sig));
    if (topics.filter(t => t.sig === topSig).length >= 2 && topics.some(t => t.sig < topSig)) {
      const merged = []; let parent = null;
      for (const tp of topics) {
        if (tp.sig === topSig || !parent) { merged.push(tp); parent = tp.sig === topSig ? tp : parent; continue; }
        parent.raw.push('\u0000' + tp.heading, ...tp.raw);
        if (tp.steps) parent.steps = (parent.steps || []).concat(tp.steps);
        (parent.subs = parent.subs || []).push(titleCase(tp.heading));
      }
      topics.length = 0; topics.push(...merged);
    }
    const goodTopics = topics.map(tp => ({ key: 'topic', heading: titleCase(tp.heading), page: tp.page, steps: tp.steps || [], subs: tp.subs || [], text: joinRaw(tp.raw) }))
      .map(tp => ({ ...tp, words: tp.text ? tp.text.split(/\s+/).length : 0 }))
      .filter(tp => tp.words >= 25 && !classify(tp.heading) && !authors.some(x => tp.heading.includes(x)) && !/^(article|original|review article|research article|case report|abstract)/i.test(tp.heading) && normHeading(tp.heading) !== normHeading(title).slice(0, normHeading(tp.heading).length));
    for (const tp of goodTopics) rankSection(tp, titleWords);
    // nothing recognised at all: rank the whole text so slides still get real sentences
    if (!Object.keys(sections).length && !goodTopics.length) {
      const all = joinRaw(lines.filter(l => !(l.page === 1 && titleIdx.includes(lines.indexOf(l)))).map(l => l.text));
      sections.introduction = { key: 'introduction', heading: 'Main text', raw: [], text: all, words: all.split(/\s+/).length };
    }
    for (const k in sections) rankSection(sections[k], titleWords);
    const wds = k => (sections[k] && sections[k].words) || 0;
    const research = wds('results') >= 40 || wds('participants') >= 15 || wds('method') >= 60;
    const paperMode = !research && goodTopics.filter(t => t.sentences.length).length >= 2 ? 'review' : 'research';
    title = titleCase(title);
    // in a review, the introduction ends where the first topic heading starts
    if (paperMode === 'review') for (const k of ['introduction', 'abstract']) {
      const sec = sections[k]; if (!sec || !sec.text.includes('\n')) continue;
      const first = sec.text.split('\n')[0].trim();
      if (first.split(/\s+/).length >= 15) { sec.text = first; sec.words = first.split(/\s+/).length; rankSection(sec, titleWords); }
    }

    let license = '';
    const cc = allText.match(/\bCC[ -]BY(?:[ -](?:NC|ND|SA))*(?:[ -]\d\.\d)?/i);
    if (cc) license = cc[0].toUpperCase().replace(/-/g, ' ');
    else if (/creative\s+commons/i.test(allText)) license = 'Creative Commons';
    else if (/\bopen access\b/i.test(allText)) license = 'Open access (licence not stated)';
    const head = (title + ' ' + ((sections.abstract && sections.abstract.text) || '')).toLowerCase();
    const reviewKind = /systematic review|meta-analy|scoping review|umbrella review|rapid review|prisma/.test(head) ? 'systematic' : '';
    const prisma = reviewKind ? detectPrisma(Object.values(sections).map(x => x.text).join(' ')) : null;
    return {
      license, reviewKind, prisma,
      title, authors: authors.slice(0, 10), affiliations, doi, year, journal, keywords: keywords.length ? keywords : topKeywords(sections, title),
      pageText: (() => { const pt = []; for (const l of lines) { const k = l.page - 1; pt[k] = (pt[k] || '') + ' ' + l.text; } return Array.from(pt, x => (x || '').replace(/\s+/g, ' ').trim()); })(),
      parts: parts.map(p => ({ page: p.page, heading: titleCase(String(p.ref ? p.ref.heading : p.heading).replace(/^((\d+(\.\d+)*\.?)|([IVX]+\.)|([a-h][.)]))\s*/, '').replace(/[:.]$/, '').trim()), text: joinRaw(p.raw) })).filter(p => p.text.split(/\s+/).length >= 6),
      sections, topics: goodTopics.filter(t => t.sentences.length).slice(0, 12), mode: paperMode, bodySize: body, figurePages: [...figurePages], pages,
    };
  }

  // ---------- 3. sentences, TextRank, stats ----------
  const STOP = new Set('the of and a an to in on for with by at from as is are was were be been being this that these those it its we our us their they them he she his her or not no but than then so such also can could may might will would should which who whom whose what when where how there here into over under between among about after before during within without both each either more most less least other some any all one two three per via using used use based study studies paper results result data however therefore thus while whereas although though because since did does do has have had i e g et al vs'.split(' '));
  function stem(w) { return w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s|ly)$/, '') : w; }
  function tokenize(s) { return s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)).map(stem); }

  const ABBR = ['e.g.', 'i.e.', 'et al.', 'Fig.', 'Figs.', 'fig.', 'vs.', 'cf.', 'pp.', 'p.', 'No.', 'no.', 'Vol.', 'Eq.', 'approx.', 'ca.', 'Dr.', 'Prof.', 'Mr.', 'Ms.', 'Mrs.', 'St.', 'Inc.', 'Ltd.', 'U.S.', 'U.K.', 'resp.', 'etc.)'];
  function splitSentences(text) {
    let t = text.replace(/\n+/g, ' \u0001 ');
    // abbreviations only count at the start of a word, so "sleep." is not mistaken for "p."
    ABBR.forEach(a => { t = t.replace(new RegExp('(?<![A-Za-z])' + a.replace(/[.()]/g, m => '\\' + m), 'g'), a.replace(/\./g, '\u0002')); });
    t = t.replace(/(\d)\.(\d)/g, '$1\u0002$2').replace(/\b([A-Z])\.(?=\s*[A-Z][a-z]?\.)/g, '$1\u0002');
    const parts = t.split(/(?<=[.!?])\s+(?=[A-Z(“"‘'[])|\s\u0001\s/);
    return parts.map(s => s.replace(/\u0002/g, '.').replace(/\u0001/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  const STAT_RE = /(?<![A-Za-z])(?:[Nn]\s?=\s?\d[\d,]*|\d+(?:\.\d+)?\s?%|p\s?[<=>≤≥]\s?0?\.\d+|(?:r|rs|ρ|β|b|B|OR|HR|RR|AOR|d|g|F|t|z|χ2|χ²|R2|R²|ΔR2|ΔR²|η2|η²|ηp2|ηp²|CFI|RMSEA|α)\s?(?:\([^)]{0,14}\))?\s?=\s?[−–-]?\d*\.?\d+|\d+(?:\.\d+)?[- ](?:fold|times)\b|M\s?=\s?\d+(?:\.\d+)?|SD\s?=\s?\d+(?:\.\d+)?)/g;
  function findStats(s) { STAT_RE.lastIndex = 0; const out = []; let m; while ((m = STAT_RE.exec(s))) out.push({ text: m[0], index: m.index }); return out; }

  const CUES = {
    abstract: /(we (found|show|examined|investigated)|results (show|indicate|suggest)|this study|findings)/i,
    introduction: /(little is known|remains unclear|gap|however|limited research|few studies|aim(ed|s)? (of|to)|purpose|objective|this study|we (examine|investigate|test|hypothes)|growing|increasing(ly)?|concern)/i,
    method: /(participants|recruited|survey|questionnaire|interview|measured|assessed|design|sample|randomi[sz]ed|cross-sectional|longitudinal|experiment|scale|regression|model|collected|procedure)/i,
    participants: /(participants|recruited|aged|age|sample|respondents|students|female|male|mean age)/i,
    results: /(found|showed|revealed|significant|associated|predicted|increase|decrease|higher|lower|greater|reduced|effect|correlat|more likely|less likely)/i,
    discussion: /(suggest|implication|indicate|highlight|support|practice|policy|consistent with|contribut|important|should|demonstrat)/i,
    limitations: /(limitation|future|caution|generali[sz]|self-report|cross-sectional|small sample|should be)/i,
    conclusion: /(conclu|overall|in sum|taken together|suggest|highlight|important)/i,
  };

  function cleanSentence(s) {
    return s
      .replace(/\s?\((?:[^()]*?(?:19|20)\d{2}[a-z]?(?:[;,][^()]*?)?)\)/g, '')
      .replace(/\s?\[(?:\d+(?:[–-]\d+)?(?:,\s?)?)+\]/g, '')
      .replace(/\s?\(see [^)]*\)/gi, '').replace(/[•▪◦●■‣]/g, '')
      .replace(/^(however|moreover|furthermore|additionally|in addition|importantly|specifically|notably|in this study|in the present study|in sum|overall|thus|therefore|finally),\s+/i, '')
      .replace(/\s+([,;:]|\.(?!\d))/g, '$1').replace(/\s{2,}/g, ' ').trim()
      .replace(/^[a-z]/, c => c.toUpperCase());
  }

  function rankSection(sec, titleWords) {
    const raw = splitSentences(sec.text).filter(s => {
      const ws = s.split(' '), w = ws.length; const letters = (s.match(/[A-Za-z]/g) || []).length;
      if (!(w >= 6 && w <= 75 && letters / s.length > 0.55)) return false;
      // table-like: mostly Capitalised words, many bare numbers, or "Study 2:" labels, and few function words
      const caps = ws.slice(1).filter(x => /^[A-Z][a-z]/.test(x)).length / Math.max(1, w - 1);
      const nums = ws.filter(x => /^\(?\d[\d,.]*\)?[,;]?$/.test(x)).length;
      const fn = ws.filter(x => /^(the|a|an|of|to|and|was|were|is|are|in|with|that|for|by|as|on|from|this|these|than|be|been|has|have|had|not|or)$/i.test(x)).length / w;
      if ((caps > 0.45 && fn < 0.12) || (nums >= 4 && fn < 0.15) || /\bStudy \d+\s*:/.test(s)) return false;
      return true;
    });
    if (raw.length > 600) raw.length = 600;
    const toks = raw.map(tokenize);
    const n = raw.length;
    const tr = new Array(n).fill(1);
    if (n > 1) {
      const W = [];
      for (let i = 0; i < n; i++) {
        W[i] = new Array(n).fill(0);
        const A = new Set(toks[i]);
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          let ov = 0; for (const w of new Set(toks[j])) if (A.has(w)) ov++;
          const den = Math.log(A.size + 1) + Math.log(toks[j].length + 1);
          W[i][j] = den > 0 ? ov / den : 0;
        }
      }
      const out = W.map(r => r.reduce((a, b) => a + b, 0) || 1);
      for (let it = 0; it < 25; it++) {
        const nx = new Array(n).fill(0.15);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (W[i][j]) nx[j] += 0.85 * W[i][j] / out[i] * tr[i];
        for (let k = 0; k < n; k++) tr[k] = nx[k];
      }
    }
    const maxTr = Math.max(...tr, 1e-9);
    const cue = CUES[sec.key];
    sec.sentences = raw.map((s, i) => {
      const stats = findStats(s);
      let score = tr[i] / maxTr;
      if (stats.length) score += 0.25 + Math.min(0.15, stats.length * 0.05);
      if (cue && cue.test(s)) score += 0.3;
      if (i === 0) score += 0.1;
      if (sec.key === 'conclusion' && i === n - 1) score += 0.1;
      const tw = tokenize(s).filter(w => titleWords.has(w)).length; score += Math.min(0.3, tw * 0.08);
      const words = s.split(' ').length;
      if (words > 40) score -= 0.2;
      const cites = (s.match(/\d{4}[a-z]?\)|\[\d+/g) || []).length; score -= Math.min(0.3, cites * 0.08);
      return { text: s, clean: cleanSentence(s), score: Math.round(score * 100) / 100, stats: stats.map(x => x.text), order: i };
    });
    sec.ranked = [...sec.sentences].sort((a, b) => b.score - a.score);
  }

  function topKeywords(sections, title) {
    const tf = {};
    const add = (s, w) => { for (let n = 1; n <= 2; n++) { const t = s.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean); for (let i = 0; i + n <= t.length; i++) { const g = t.slice(i, i + n); if (g.some(x => STOP.has(x) || x.length < 4)) continue; const k = g.join(' '); tf[k] = (tf[k] || 0) + w * (n === 2 ? 1.6 : 1); } } };
    add(title, 4);
    for (const k of ['abstract', 'introduction', 'conclusion']) if (sections[k]) add(sections[k].text, 1);
    const generic = /^(research|participants|analysis|significant|results?|study|studies|findings|effects?|levels?|associated|however|present|current|model|table|figure|several|previous|related|among|using)$/;
    return Object.entries(tf).filter(([k]) => !generic.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([k]) => k).filter((k, i, a) => !a.slice(0, i).some(p => p.includes(k) || k.includes(p))).slice(0, 5)
      .map(k => k.replace(/^\w/, c => c.toUpperCase()));
  }

  // ---------- 4. helpers for slides ----------
  function wc(s) { return s ? s.trim().split(/\s+/).length : 0; }
  function cut(s, max) {
    const words = s.split(/\s+/);
    // a little slack reads better than a chopped sentence
    if (words.length <= Math.round(max * 1.25) + 1) return s;
    const head = words.slice(0, max + 3).join(' ');
    const depth = i => (head.slice(0, i).match(/\(/g) || []).length - (head.slice(0, i).match(/\)/g) || []).length;
    const m = [...head.matchAll(/[,;:]\s|\s(which|while|whereas|but|because|although|so that)\s/g)];
    const last = m.filter(x => x.index > head.length * 0.4 && depth(x.index) === 0).pop();
    if (last) return head.slice(0, last.index).replace(/[,;:\s]+$/, '') + '.';
    let ws = words.slice(0, max);
    while (ws.length > 3 && /^(and|or|but|the|a|an|of|to|than|with|that|is|are|was|were|for|in|on|by|as|at|from|which|who|their|its|more|less|most)$/i.test(ws[ws.length - 1].replace(/[^A-Za-z]/g, ''))) ws.pop();
    let h = ws.join(' ').replace(/[,;:\s]+$/, '');
    if ((h.match(/\(/g) || []).length > (h.match(/\)/g) || []).length) h = h.replace(/\s?\([^)]*$/, '');
    return h + '…';
  }
  function shorten(s, max = 40) {
    let t = cleanSentence(s)
      .replace(/\s?\([^()]{0,80}\)/g, m => (max && max <= 20) || !findStats(m).length ? '' : m)
      .replace(/\b(it is (important|worth) (to note )?that|it was found that|the results of this study (show|showed|indicate) that|the findings (show|showed|suggest) that)\s*/gi, '')
      .replace(/\b(in order to)\b/gi, 'to').replace(/\b(a (large|great) number of)\b/gi, 'many').replace(/\b(due to the fact that)\b/gi, 'because')
      .replace(/\s{2,}/g, ' ').trim().replace(/^[a-z]/, c => c.toUpperCase());
    return max ? cut(t, max) : t;
  }

  function pool(m, keys, opts = {}) {
    const seen = new Set(), out = [];
    const list = [];
    keys.forEach((k, ki) => { const s = m.sections[k]; if (s) s.ranked.forEach(x => list.push({ ...x, sec: k, w: x.score - ki * (opts.decay ?? 0.05) })); });
    list.sort((a, b) => b.w - a.w);
    for (const x of list) {
      if (opts.filter && !opts.filter(x)) continue;
      const k = x.clean.slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(x);
    }
    return out;
  }

  function heroFrom(sentence) {
    const s = sentence;
    let m = s.match(/\d+(?:\.\d+)?\s?%/g);
    if (m) { const v = m.find(x => !/^100\s?%$/.test(x)) || m[0]; return v.replace(/\s/, ''); }
    m = s.match(/\d+(?:\.\d+)?[- ](?:fold|times)/i); if (m) return m[0].replace(/[- ](times|fold)/i, '×');
    m = s.match(/(?<![A-Za-z])(OR|AOR|HR|RR)\s?=\s?\d*\.?\d+/); if (m) return m[0].replace(/\s/g, ' ');
    m = s.match(/(?<![A-Za-z])(r|β|d|R²|R2|ΔR²)\s?(\([^)]{0,14}\))?\s?=\s?[−–-]?\d*\.?\d+/); if (m) return m[0].replace(/\([^)]*\)/, '').replace(/\s?=\s?/, ' = ').replace(/R2/, 'R²');
    return '';
  }

  function sampleFrom(m) {
    const cands = pool(m, ['participants', 'method', 'abstract', 'results'], { decay: 0.1 }).filter(c => !/\bpilot|pre-?test|expert|reviewer|panel of\b/i.test(c.text));
    for (const c of cands) {
      let x = c.text.match(/(?<![A-Za-z])[Nn]\s?=\s?(\d[\d,]*)/);
      if (x && +x[1].replace(/,/g, '') >= 5) return { n: x[1], unit: 'participants', sentence: c };
      x = c.text.match(/\b(\d{1,3}(?:,\d{3})+|\d{2,6})\s+(?:[a-z-]+\s){0,3}?(participants|respondents|students|undergraduates|adults|adolescents|patients|users|children|teachers|employees|workers|individuals|people|older adults|nurses|parents|women|men|cases|households|schools|articles|studies)\b/i);
      if (x && !/^(19|20)\d{2}$/.test(x[1])) return { n: x[1], unit: x[2].toLowerCase(), sentence: c };
    }
    return null;
  }

  function shortCite(m) {
    const a = m.authors || [];
    const last = s => s.trim().split(/\s+/).pop().replace(/[^A-Za-zÀ-ÿ'’-]/g, '');
    let s = a.length ? (a.length === 1 ? last(a[0]) : a.length === 2 ? `${last(a[0])} & ${last(a[1])}` : `${last(a[0])} et al.`) : '';
    if (m.year) s += (s ? ', ' : '') + m.year;
    return s;
  }

  function iconFor(text, fallback) {
    const t = (text || '').toLowerCase();
    if (/chatbot|\bai\b|conversational|artificial intelligence|machine|algorithm|robot|digital/.test(t)) return 'chat';
    if (/well-?being|mental|loneliness|health|stress|anxiety|depress|happiness|emotion/.test(t)) return 'heart';
    if (/survey|questionnaire|scale|measure/.test(t)) return 'clipboard';
    if (/experiment|trial|randomi|lab/.test(t)) return 'flask';
    return fallback;
  }

  let uid = 0; const id = p => p + (++uid);

  // ---- systematic reviews: PRISMA flow, totals, evidence grid ----
  const NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  const toNum = x => { if (!x) return null; const w = NUMW[String(x).toLowerCase()]; return w || +String(x).replace(/,/g, ''); };
  const NN = '(\\d[\\d,]*|' + Object.keys(NUMW).join('|') + ')';
  const UNIT = '(?:records|articles|citations|studies|papers|references|hits|reports|publications)';
  function firstNum(text, pats) {
    for (const p of pats) { const m = text.match(new RegExp(p, 'i')); if (m) { const v = toNum(m[1]); if (v) return v; } }
    return null;
  }
  function detectPrisma(text) {
    const t = text.replace(/\s+/g, ' ');
    const p = {
      identified: firstNum(t, [`${NN}\\s+${UNIT}\\s+(?:were\\s+)?(?:initially\\s+)?(?:identified|retrieved|found|yielded|returned)`, `(?:identified|retrieved|yielded|returned|produced)\\s+(?:a\\s+total\\s+of\\s+)?${NN}\\s+${UNIT}`, `${UNIT}\\s+identified[^.]{0,40}?\\(n\\s*=\\s*${NN}\\)`]),
      duplicates: firstNum(t, [`${NN}\\s+duplicates?`, `duplicates?[^.]{0,20}?\\(n\\s*=\\s*${NN}\\)`]),
      screened: firstNum(t, [`${NN}\\s+(?:unique\\s+|remaining\\s+)?(?:records|titles(?:\\s+and\\s+abstracts)?|articles|studies|citations|papers|reports)\\s+(?:were\\s+)?screened`, `screened\\s+(?:the\\s+)?(?:titles\\s+and\\s+abstracts\\s+of\\s+)?${NN}\\s+${UNIT}`, `(?:records|titles and abstracts)\\s+screened[^.]{0,20}?\\(n\\s*=\\s*${NN}\\)`]),
      fulltext: firstNum(t, [`${NN}\\s+full[- ]?text(?:s|\\s+(?:articles|reports|papers|studies|records))?\\s+(?:were\\s+)?(?:assessed|reviewed|retrieved|examined|screened|evaluated)`, `full[- ]?texts?[^.]{0,40}?\\(n\\s*=\\s*${NN}\\)`, `(?:assessed|reviewed|retrieved)\\s+${NN}\\s+full[- ]?text`, `${NN}\\s+full[- ]text`]),
      included: firstNum(t, [`${NN}\\s+(?:studies|articles|papers|reports|trials|publications)\\s+(?:were\\s+|met[^.]{0,50}?(?:and\\s+were\\s+)?)?(?:finally\\s+)?(?:included|selected|eligible|retained)`, `(?:included|selected|retained)\\s+${NN}\\s+(?:studies|articles|papers|trials|reports)`, `(?:studies|articles)\\s+included[^.]{0,20}?\\(n\\s*=\\s*${NN}\\)`]),
    };
    // keep the flow consistent: each stage is no larger than the one before
    const order = ['identified', 'screened', 'fulltext', 'included'];
    let prev = Infinity;
    for (const k of order) { if (p[k] != null) { if (p[k] > prev) p[k] = null; else prev = p[k]; } }
    if (p.duplicates != null && p.identified != null && p.duplicates >= p.identified) p.duplicates = null;
    const n = order.filter(k => p[k] != null).length;
    return p.included != null && n >= 2 ? p : (p.included != null ? { included: p.included } : null);
  }
  const OUTCOMES = [[/lonel/i, 'Loneliness'], [/emotional comfort|\bcomfort\b/i, 'Emotional comfort'], [/social support/i, 'Social support'], [/life satisfaction/i, 'Life satisfaction'], [/depress/i, 'Depression'], [/anxiety/i, 'Anxiety'], [/\bstress/i, 'Stress'], [/well-?being/i, 'Well-being'], [/dependen|addict|problematic use|overuse/i, 'Dependence'], [/self-disclosure/i, 'Self-disclosure'], [/happiness|\bmood\b/i, 'Mood'], [/\bsleep/i, 'Sleep'], [/isolation/i, 'Social isolation'], [/empathy/i, 'Perceived empathy'], [/quality of life/i, 'Quality of life'], [/self-esteem/i, 'Self-esteem']];
  function effectOf(s, outcome) {
    if (/\b(no (significant |clear |meaningful )?(change|changes|difference|differences|association|associations|effect|effects|relationship|improvement)|not (significantly )?(associated|related|linked)|did not|were not)\b/i.test(s)) return 'none';
    if (/\b(mixed|inconsistent|heterogeneous|varied|conflicting|equivocal|contradictory)\b/i.test(s)) return 'mixed';
    if (outcome === 'Dependence' || /\b(risk|harm|worse|worsen|negative (effect|impact|association)|increased (loneliness|anxiety|depress|stress)|higher (loneliness|anxiety|depress|stress))/i.test(s)) return 'risk';
    if (/\b(relief|reliev|improv|reduc|lower (loneliness|anxiety|depress|stress)|higher|greater|increase|comfort|benefit|positive|support(ed|ive)?|enhanc)/i.test(s)) return 'benefit';
    return null;
  }
  function evidenceGrid(m) {
    const rows = [], seen = new Set();
    for (const k of ['results', 'abstract', 'discussion', 'conclusion']) {
      const sec = m.sections[k]; if (!sec) continue;
      for (const x of sec.sentences) {
        for (const [re, label] of OUTCOMES) {
          if (seen.has(label) || !re.test(x.text)) continue;
          const e = effectOf(x.text, label); if (!e) continue;
          seen.add(label); rows.push({ outcome: label, effect: e, src: x.text });
          if (rows.length >= 6) return rows;
        }
      }
    }
    return rows;
  }
  function keyNumbers(m) {
    const out = [];
    const all = Object.values(m.sections).map(s => s.text).join(' ');
    if (m.prisma && m.prisma.included) out.push({ big: String(m.prisma.included), label: /\btrials?\b/i.test(all) && !/\bstudies\b/i.test(all) ? 'trials included' : 'studies included' });
    const tot = all.match(/(?:combined|total|overall|pooled|altogether)[^.]{0,40}?(\d{1,3}(?:,\d{3})+|\d{3,})\s+(?:participants|users|respondents|people|patients|adults|students|individuals|children|adolescents)/i)
      || all.match(/(\d{1,3}(?:,\d{3})+|\d{3,})\s+(?:participants|users|respondents|people|patients|individuals)\s+(?:in total|overall|altogether|combined)/i);
    if (tot) out.push({ big: tot[1], label: 'participants in total' });
    const ctry = all.match(new RegExp(`(?:from|across|in)\\s+${NN}\\s+countries`, 'i'));
    if (ctry) out.push({ big: String(toNum(ctry[1])), label: 'countries' });
    const dbs = ['Scopus', 'Web of Science', 'PubMed', 'PsycINFO', 'MEDLINE', 'Embase', 'CINAHL', 'Cochrane', 'Google Scholar', 'IEEE Xplore', 'ACM Digital Library', 'ERIC', 'ScienceDirect', 'ProQuest'].filter(d => all.includes(d));
    if (dbs.length >= 2 && out.length < 3) out.push({ big: String(dbs.length), label: 'databases searched' });
    if (m.prisma && m.prisma.identified && out.length < 3) out.push({ big: m.prisma.identified.toLocaleString('en-US'), label: 'records screened from' });
    if (!m.reviewKind) {
      const sample = sampleFrom(m);
      if (sample) out.push({ big: Number(sample.n.replace(/,/g, '')).toLocaleString('en-US'), label: sample.unit, src: sample.sentence.text });
      for (const x of pool(m, ['results', 'abstract'], { decay: 0.15 })) {
        const h = heroFrom(x.text); if (!h || out.some(o => o.big === h)) continue;
        // label = the words right after the number: "41% more nights of poor sleep" -> "more nights of poor sleep"
        const raw = (x.text.match(/\d+(?:\.\d+)?\s?(?:%|[- ](?:times|fold))/i) || [h])[0];
        const after = x.text.slice(x.text.indexOf(raw) + raw.length).split(/[,;.(](?:\s|$)|\s(?:than|compared|versus|vs\.?)\s/)[0].trim().split(/\s+/).slice(0, 7);
        while (after.length > 1 && /^(and|or|the|a|an|of|to|than|with|that|for|in|on|by|as|at|from)$/i.test(after[after.length - 1])) after.pop();
        out.push({ big: h, src: x.text, label: after.length >= 2 ? after.join(' ') : shorten(x.text, 9).replace(/…$/, '') });
        if (out.length >= 3) break;
      }
    }
    return out.slice(0, 3);
  }
  function emphasize(text, m) {
    let t = text, n = 0;
    const kws = [...(m.keywords || [])].sort((a, b) => b.length - a.length);
    for (const k of kws) {
      if (n >= 2 || k.length < 4) continue;
      const i = t.toLowerCase().indexOf(k.toLowerCase());
      if (i < 0 || t.slice(0, i).split('*').length % 2 === 0) continue;
      t = t.slice(0, i) + '*' + t.slice(i, i + k.length) + '*' + t.slice(i + k.length); n++;
    }
    if (n < 2) { const st = findStats(t.replace(/\*/g, ''))[0]; if (st && !t.includes('*' + st.text)) { t = t.replace(st.text, '*' + st.text + '*'); n++; } }
    t = t.replace(/\*(\s+)\*/g, '$1');
    if (n === 0) { // fall back to the last 3 words before the full stop
      t = t.replace(/(\s)(\S+\s+\S+\s+\S+?)([.]?)$/, '$1*$2*$3');
    }
    return t;
  }
  function buildBillboard(m) {
    const concl = pool(m, ['conclusion', 'discussion', 'abstract'], { decay: 0.3 });
    const statementSrc = concl[0];
    const statement = statementSrc ? emphasize(shorten(statementSrc.text, 26), m) : m.title;
    const intro = pool(m, ['introduction', 'abstract'], { decay: 0.3, filter: x => !findStats(x.text).length });
    const meth = pool(m, ['method', 'participants'], { decay: 0.05, filter: x => !(m.prisma && /\b(identified|screened|duplicates?|full[- ]?texts?|were included)\b/i.test(x.text)) });
    const mean = pool(m, ['discussion', 'conclusion'], { decay: 0.1, filter: x => x !== statementSrc && !/limitation/i.test(x.text) && (!statementSrc || x.clean !== statementSrc.clean) });
    const lim = pool(m, ['limitations', 'discussion'], { decay: 0.2, filter: x => x.sec === 'limitations' || /(limitation|caution|generali[sz]|self-report|cross-sectional)/i.test(x.text) });
    const items = m.mode === 'review' ? m.topics.slice(0, 6).map(tp => {
      const h = tp.heading.includes(':') ? tp.heading.split(':').slice(1).join(':').trim() : tp.heading;
      const st = (tp.steps || []).slice(0, 3);
      return { title: cut(h.replace(/\s*\([^)]*\)\s*$/, ''), 5).replace(/[.…]$/, ''), text: st.length ? st.map(x => cut(x, 4).replace(/[.…]$/, '')).join(' → ') : shorten(tp.ranked[0] ? tp.ranked[0].text : '', 12) };
    }) : [];
    return {
      label: m.reviewKind ? 'What the evidence shows' : m.mode === 'review' ? 'The key message' : 'Main finding',
      statement,
      numbers: keyNumbers(m),
      visual: 'auto',
      prisma: m.prisma && Object.keys(m.prisma).filter(k => m.prisma[k] != null).length >= 2 ? { ...m.prisma } : null,
      grid: m.reviewKind ? evidenceGrid(m) : [],
      gridAuto: true,
      items,
      figureId: null, caption: '',
      background: intro.slice(0, 2).sort((a, b) => a.order - b.order).map(x => shorten(x.text, 22)).join(' '),
      method: meth.slice(0, 3).map(x => shorten(x.text, 13)),
      meaning: mean.slice(0, 2).map(x => shorten(x.text, 16)),
      limits: lim.slice(0, 2).map(x => shorten(x.text, 15)),
    };
  }

  // ---- story poster (numbered sections, like a classic academic conference poster) ----
  function citesFrom(m) {
    const all = Object.values(m.sections).map(s => s.text).join(' ') + ' ' + (m.topics || []).map(t => t.text).join(' ');
    const counts = new Map(), add = k => counts.set(k, (counts.get(k) || 0) + 1);
    const NAME = "[A-Z][A-Za-zÀ-ÿ'’-]+";
    for (const g of all.matchAll(/\(([^()]{4,200}?(?:19|20)\d{2}[a-z]?[^()]{0,80})\)/g)) {
      for (const part of g[1].split(/;/)) {
        const mm = part.trim().match(new RegExp(`^(?:e\\.g\\.,?\\s*|see\\s+|cf\\.\\s*)?(${NAME}(?:\\s(?:et al\\.?|(?:&|and)\\s${NAME}))?),?\\s+((?:19|20)\\d{2}[a-z]?)`));
        if (mm) add(`${mm[1].replace(/et al$/, 'et al.')} (${mm[2]})`);
      }
    }
    for (const mm of all.matchAll(new RegExp(`\\b(${NAME}(?:\\set al\\.|\\s(?:&|and)\\s${NAME}))\\s\\(((?:19|20)\\d{2}[a-z]?)\\)`, 'g'))) add(`${mm[1]} (${mm[2]})`);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  }
  // detection order (most specific first) differs from display order
  const STEP_TITLES = [[/search(ed)? (of )?|database/i, 'Search'], [/regression|analys[ie]s|anova|t-test|correlation|structural equation|thematic|mixed[- ]effects? model/i, 'Analysis'], [/apprais|risk of bias|quality (was |were )?(assess|apprais|rated)/i, 'Quality check'], [/participant|recruit|respondent|aged \d|sample of/i, 'Participants'], [/cross-sectional|longitudinal|experiment|randomi|trial\b|design/i, 'Design'], [/survey|questionnaire|scale|measur|instrument|interview/i, 'Measures'], [/procedure|session|task|condition/i, 'Procedure'], [/synthes/i, 'Synthesis']];
  const STEP_ORDER = ['Search', 'Participants', 'Design', 'Measures', 'Procedure', 'Quality check', 'Analysis', 'Synthesis'];
  function statRows(m, limit = 5) {
    const rows = [], seen = new Set();
    const sample = sampleFrom(m);
    if (sample) { rows.push({ label: sample.unit.replace(/^\w/, c => c.toUpperCase()), value: Number(sample.n.replace(/,/g, '')).toLocaleString('en-US') }); seen.add(sample.n); }
    for (const x of pool(m, ['results', 'abstract'], { decay: 0.15 })) {
      for (const st of findStats(x.text)) {
        const v = st.text.replace(/\s+/g, ' ').trim();
        if (seen.has(v) || /^(M|SD)\s?=/.test(v) || /^[Nn]\s?=/.test(v) || /^p\s?[<=>]/.test(v)) continue;
        // label: the words just before the statistic, e.g. "Cycling days and loneliness"
        const before = x.text.slice(0, x.text.indexOf(st.text)).replace(/\($/, '').split(/[,;:(]|\bwhile\b|\bwhereas\b/).pop().trim().split(/\s+/).slice(-7);
        let after = x.text.slice(x.text.indexOf(st.text) + st.text.length).split(/[,;.(](?:\s|$)|\s(?:than|compared|versus)\s/)[0].trim().split(/\s+/).slice(0, 9);
        while (after.length > 2 && /^(and|or|the|a|an|of|to|that|they|had|have|with|for|on|at|by|their)$/i.test(after[after.length - 1])) after.pop();
        const lab = (/%|times|fold/.test(v) && after.join(' ').length > 6 ? after : before).join(' ').replace(/^((and|or|but|with|was|were|the|a|of|for|in|on|at|to|predictor of|significant predictor of)\s)+/i, '').replace(/\s(was|were|is|are|of|by|with|and)$/i, '');
        if (lab.length < 4) continue;
        seen.add(v); rows.push({ label: lab.replace(/^\w/, c => c.toUpperCase()), value: v });
        if (rows.length >= limit) return rows;
      }
    }
    return rows;
  }
  function buildStory(m) {
    const review = m.mode === 'review', sys = !!m.reviewKind;
    const concl = pool(m, ['conclusion', 'discussion', 'abstract'], { decay: 0.3 });
    const take = concl[0] ? emphasize(shorten(concl[0].text, 30), m) : m.title;
    const intro = pool(m, ['introduction', 'abstract'], { decay: 0.3, filter: x => !findStats(x.text).length });
    const toks = t => new Set(t.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));
    const similar = (a, b) => { const A = toks(a), B = toks(b); let o = 0; for (const w of A) if (B.has(w)) o++; return o / Math.max(1, Math.min(A.size, B.size)) > 0.5; };
    const qSents = [];
    for (const x of intro.filter(x => /(little is known|unclear|gap|however|limited|few|aim|purpose|this (study|review)|we (examine|investigate|test))/i.test(x.text)).concat(intro)) { if (!qSents.includes(x) && !qSents.some(q => similar(q.text, x.text))) qSents.push(x); if (qSents.length >= 2) break; }
    qSents.sort((a, b) => (a.sec === b.sec ? a.order - b.order : a.sec === 'introduction' ? 1 : -1));
    let question = qSents.map(x => shorten(x.text, 24)).join(' ');
    if (wc(question) > 55) question = shorten(qSents[0].text, 30);
    // method flow
    let steps = [], methodTitle = 'What we did', methodNote = '';
    if (sys && m.prisma && Object.keys(m.prisma).filter(k => m.prisma[k] != null).length >= 2) {
      methodTitle = 'How studies were selected';
      const p = m.prisma, f = v => Number(v).toLocaleString('en-US');
      if (p.identified != null) steps.push({ title: 'Records identified', text: `n = ${f(p.identified)}${p.duplicates ? ` (${f(p.duplicates)} duplicates removed)` : ''}` });
      if (p.screened != null) steps.push({ title: 'Titles and abstracts screened', text: `n = ${f(p.screened)}` });
      if (p.fulltext != null) steps.push({ title: 'Full texts assessed', text: `n = ${f(p.fulltext)}` });
      steps.push({ title: 'Studies included', text: `n = ${f(p.included)}`, hl: true });
      const mn = pool(m, ['method'], { filter: x => !/\b(identified|screened|duplicates?|full[- ]?texts?|were included)\b/i.test(x.text) });
      methodNote = mn.slice(0, 2).sort((a, b) => a.order - b.order).map(x => shorten(x.text, 22)).join(' ');
    } else if (review) {
      methodTitle = 'What it covers';
      steps = m.topics.slice(0, 4).map(tp => { const h = tp.heading.includes(':') ? tp.heading.split(':').slice(1).join(':').trim() : tp.heading; const second = tp.ranked[1] || tp.ranked[0]; return { title: cut(h.replace(/\s*\([^)]*\)\s*$/, ''), 6).replace(/[.…]$/, ''), text: shorten(second ? second.text : '', 14) }; });
    } else {
      const used = new Set();
      for (const x of pool(m, ['method', 'participants'], { decay: 0.05 })) {
        const t = (STEP_TITLES.find(([re]) => re.test(x.text)) || [null, null])[1];
        if (!t || used.has(t)) continue;
        used.add(t); steps.push({ title: t, text: shorten(x.text, 11), order: STEP_ORDER.indexOf(t) });
        if (steps.length >= 4) break;
      }
      steps.sort((a, b) => a.order - b.order); steps.forEach(s => delete s.order);
      if (steps.length) steps[steps.length - 1].hl = true;
      const des = pool(m, ['method', 'participants']).find(x => !steps.some(s => x.text.startsWith(s.text.slice(0, 20))));
      methodNote = des ? shorten(des.text, 20) : '';
    }
    // result card + table
    const res = pool(m, ['results', 'abstract'], { decay: 0.15 });
    const f1 = res.find(x => heroFrom(x.text)) || res[0];
    let resultTitle = f1 ? shorten(f1.text, 18) : '', tHead = ['Result', 'Value'], table = statRows(m);
    if (sys) { tHead = ['Outcome', 'Evidence']; table = evidenceGrid(m).map(r => ({ label: r.outcome, value: ({ benefit: 'Benefit', mixed: 'Mixed', none: 'No clear effect', risk: 'Risk' })[r.effect] })); }
    if (review) { resultTitle = 'Key steps at a glance'; tHead = ['Topic', 'Key steps']; table = m.topics.slice(0, 6).filter(t => (t.steps || []).length).map(t => { const h = t.heading.includes(':') ? t.heading.split(':').slice(1).join(':').trim() : t.heading; return { label: cut(h.replace(/\s*\([^)]*\)\s*$/, ''), 4).replace(/[.…]$/, ''), value: t.steps.slice(0, 3).map(x => cut(x, 3).replace(/[.…]$/, '')).join(' → ') }; }); }
    const rest = []; for (const x of res) { if (x !== f1 && !(f1 && similar(f1.text, x.text)) && !rest.some(r => similar(r.text, x.text))) rest.push(x); }
    const resultNote = rest[0] ? shorten(rest[0].text, 24) : '';
    // numbered findings: stated hypotheses first, else the strongest results
    const hyp = pool(m, ['introduction', 'method'], { filter: x => /\b(H\d|hypothes[ie]s|we (predicted|expected|hypothesi[sz]ed))\b/i.test(x.text) });
    let fTitle = sys ? 'What the evidence shows' : review ? 'Key points' : 'What we found', items;
    if (!review && !sys && hyp.length >= 2) { fTitle = 'What we tested'; items = hyp.slice(0, 3).sort((a, b) => a.order - b.order).map((x, i) => ({ tag: 'H' + (i + 1), text: shorten(x.text, 20) })); }
    else items = (review ? pool(m, ['discussion', 'conclusion', 'abstract'], { decay: 0.1, filter: x => !concl[0] || x.clean !== concl[0].clean }) : (() => { const isRes = x => findStats(x.text).length || /\b(found|show(ed|s)?|reveal|significant|associat|predict|higher|lower|more likely|less likely|reduc|increas|correlat|reported)\b/i.test(x.text); const r2 = rest.slice(1).concat(rest.slice(0, 1)); return r2.filter(isRes).concat(r2.filter(x => !isRes(x))); })()).slice(0, 3).map((x, i) => ({ tag: String(i + 1), text: shorten(x.text, 18) }));
    if (review && items.length < 2) items = m.topics.slice(0, 3).map((tp, i) => ({ tag: String(i + 1), text: shorten(tp.ranked[0] ? tp.ranked[0].text : tp.heading, 20) }));
    const lim = pool(m, ['limitations', 'discussion'], { decay: 0.2, filter: x => x.sec === 'limitations' || /(limitation|caution|generali[sz]|self-report|cross-sectional)/i.test(x.text) });
    const whyP = pool(m, ['discussion', 'conclusion'], { decay: 0.1, filter: x => (!concl[0] || x.clean !== concl[0].clean) && !/limitation/i.test(x.text) });
    const why = (whyP.filter(x => /(implication|suggest|highlight|should|practice|policy|matter|important|need)/i.test(x.text))[0] || whyP[0]);
    return {
      eyebrow: (m.keywords || []).slice(0, 3).join(' · ').toUpperCase(),
      conference: '', posterNo: '',
      takeLabel: 'Take-home', take,
      question, qTitle: review ? 'Background' : 'The question',
      methodTitle, steps, methodNote,
      resultSec: review ? 'At a glance' : sys ? 'The key result' : 'The key result',
      resultTitle, figureId: null, caption: '', tHead, table, resultNote,
      fTitle, items, limLabel: 'Limitations', lim: lim[0] ? shorten(lim[0].text, 24) : '',
      whyTitle: 'Why it matters', why: why ? shorten(why.text, 40) : '',
      refs: citesFrom(m), cols: {},
    };
  }

  // ---- talk: 16:9 slides with a spoken script for each ----
  function speak(t) {
    return String(t || '').replace(/\*/g, '').replace(/…/g, '.')
      .replace(/\s?\(\s*[Nn]\s?=\s?[\d,]+\s*\)/g, '').replace(/\b[Nn]\s?=\s?([\d,]+)/g, '$1')
      .replace(/(\d)\s?%/g, '$1 percent')
      .replace(/(\d)\s?×/g, '$1 times')
      .replace(/\bp\s?<\s?\.?0?\.(\d+)/g, 'p less than point $1')
      .replace(/\bp\s?=\s?\.?0?\.(\d+)/g, 'p equals point $1')
      .replace(/(?<![A-Za-z])(r|β|d|OR|HR)\s?=\s?([−–-])?\.(\d+)/g, (m, s, neg, d) => `${s === 'β' ? 'beta' : s === 'r' ? 'a correlation' : s} of ${neg ? 'minus ' : ''}point ${d}`)
      .replace(/\s?\((?:[^()]*\d[^()]*)\)/g, '')
      .replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').replace(/\.{2,}/g, '.').trim();
  }
  // whole sentences up to n words; only cut a sentence when the first one alone is too long
  function sentencesUpTo(text, n) {
    const ss = splitSentences(String(text || '')); let out = [], w = 0;
    for (const x of ss) { const k = wc(x); if (w + k > n) break; out.push(x); w += k; }
    return out.length ? out.join(' ') : shorten(text, n);
  }
  const wcount = t => (String(t || '').trim().match(/\S+/g) || []).length;
  const listJoin = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  // ---- study context, charts and fact checking ----
  const DESIGN_RE = /\b(cross-sectional|longitudinal|randomi[sz]ed controlled trial|quasi-experimental|experimental|qualitative|mixed[- ]methods?|systematic review|meta-analysis|scoping review|case study|cohort|case-control|survey|interviews?)\b/i;
  function studyContext(m) {
    const parts = [];
    if (m.reviewKind && m.prisma && m.prisma.included) parts.push(`${m.prisma.included} studies`);
    else { const s = sampleFrom(m); if (s) parts.push(`N = ${Number(s.n.replace(/,/g, '')).toLocaleString('en-US')}`); }
    const txt = ['method', 'abstract', 'participants'].map(k => m.sections[k] && m.sections[k].text).filter(Boolean).join(' ');
    const d = txt.match(DESIGN_RE) || (m.title || '').match(DESIGN_RE);
    if (d) { let w = d[1].toLowerCase().replace(/^randomi[sz]ed controlled trial$/, 'randomised controlled trial'); if (w === 'survey' && /online/i.test(txt)) w = 'online survey'; if (/^interviews?$/.test(w)) w = 'interview study'; parts.push(w.charAt(0).toUpperCase() + w.slice(1)); }
    return parts.join(' · ');
  }
  // a simple chart that a detected statistic can support
  function chartFor(text, big, label) {
    const t = String(text || ''), b = String(big || '');
    let mm;
    const lab = x => cut(String(x || '').replace(/^(the|those|people|participants|students)\s+who\s+/i, m0 => m0).trim(), 5).replace(/[.…]$/, '');
    if ((mm = t.match(/from\s+(-?\d+(?:\.\d+)?)\s+(?:among|in|for|with)\s+([^,.;]+?)\s+to\s+(-?\d+(?:\.\d+)?)\s+(?:among|in|for|with)\s+([^,.;]+)/i)))
      return { kind: 'compare', a: { v: +mm[1], label: lab(mm[2]) }, b: { v: +mm[3], label: lab(mm[4]) } };
    if ((mm = (b + ' ' + t).match(/(\d+(?:\.\d+)?)\s?(?:×|times|-fold|\sfold)/i)) && +mm[1] > 1 && +mm[1] <= 20) {
      const than = t.match(/\bthan\s+([^,.;]+)/i), subj = t.split(/\s+(?:were|was|are|had|reported|showed)\s+/i)[0];
      return { kind: 'ratio', v: +mm[1], a: { label: than ? lab(than[1]) : 'Comparison group' }, b: { label: subj && subj !== t ? lab(subj) : 'Group' } };
    }
    if ((mm = t.match(/(\d+(?:\.\d+)?)\s?%\s+(lower|higher|more|less|fewer|greater|smaller|larger)/i)) && +mm[1] < 100) {
      const up = /higher|more|greater|larger/i.test(mm[2]), p = +mm[1];
      const than = t.match(/\bthan\s+([^,.;]+)/i), subj = t.split(/\s+(?:were|was|are|had|reported|showed)\s+/i)[0];
      return { kind: 'compare', pct: true, a: { v: 100, label: than ? lab(than[1]) : 'Comparison group' }, b: { v: up ? 100 + p : 100 - p, label: subj && subj !== t ? lab(subj) : 'Group' }, note: `${p}% ${mm[2].toLowerCase()}` };
    }
    if ((mm = b.match(/^\s*(\d+(?:\.\d+)?)\s?%\s*$/)) && +mm[1] > 0 && +mm[1] <= 100) return { kind: 'donut', v: +mm[1] / 100, label: label || '' };
    if ((mm = (b + ' ' + t).match(/(?<![A-Za-z])(r|β|beta)\s?=\s?([−–-]?)\s?(0?\.\d+)/i))) return { kind: 'effect', stat: mm[1].toLowerCase() === 'r' ? 'r' : 'β', v: (mm[2] ? -1 : 1) * parseFloat(mm[3]) };
    if ((mm = b.replace(/,/g, '').match(/^\s*(\d{2,7})\s*$/)) && /people|participants|respondents|students|patients|adults|users|undergraduates|children|employees|teachers/i.test(label || '')) return { kind: 'people', n: +mm[1] };
    return null;
  }
  // fact check: find the best source sentence (and page) for each claim, and check its numbers appear in the paper
  const fcCache = new WeakMap();
  function fcIndex(m) {
    if (fcCache.has(m)) return fcCache.get(m);
    const sents = [];
    const addS = (list, where) => (list || []).forEach(x => sents.push({ text: x.text || x, where }));
    for (const k in m.sections) addS(m.sections[k].sentences, LABELS[k] || k);
    (m.topics || []).forEach(t => addS(t.sentences, t.heading));
    (m.parts || []).forEach(p => splitSentences(p.text).forEach(x => sents.push({ text: x, where: p.heading, page: p.page })));
    const seen = new Set(), uniq = sents.filter(x => { const k = x.text.slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.forEach(x => { x.tok = new Set(tokenize(x.text)); });
    const pages = (m.pageText || []).map(p => p.toLowerCase().replace(/[^a-z0-9.%]+/g, ' '));
    const full = pages.join(' ') || Object.values(m.sections).map(s => s.text).join(' ').toLowerCase().replace(/[^a-z0-9.%]+/g, ' ');
    const r = { sents: uniq, pages, full };
    fcCache.set(m, r); return r;
  }
  const numTokens = t => (String(t || '').replace(/\*/g, '').match(/[−–-]?\d[\d,]*(?:\.\d+)?%?|[−–-]?\.\d+/g) || [])
    .map(x => x.replace(/[−–]/g, '-').replace(/,/g, '').replace(/%$/, '')).filter(x => !/^-?\d$/.test(x) && !/^(19|20)\d{2}$/.test(x));
  function hasNumber(full, n) {
    const v = n.replace(/^-/, ''), alts = new Set([v, v.replace(/^0\./, '.'), v.startsWith('.') ? '0' + v : v, Number(v).toLocaleString('en-US').replace(/,/g, '')]);
    return [...alts].some(a => new RegExp(`(^|[^0-9.])${a.replace(/\./g, '\\.')}(?![0-9])`).test(full));
  }
  function pageOf(ix, text) {
    const key = String(text).toLowerCase().replace(/[^a-z0-9.%]+/g, ' ').trim().split(' ').slice(0, 9).join(' ');
    if (key.length < 12) return null;
    const p = ix.pages.findIndex(pg => pg.includes(key)); return p >= 0 ? p + 1 : null;
  }
  function factCheck(m, items) {
    const ix = fcIndex(m);
    return items.filter(it => it.text && String(it.text).trim() && !/^\[[^\]]+\]$/.test(String(it.text).trim())).map(it => {
      const text = String(it.text).replace(/\*/g, ''), tok = tokenize(text);
      const missingNums = numTokens(text).filter(n => !hasNumber(ix.full, n));
      let best = null, bs = 0;
      if (!it.numbersOnly && tok.length >= 3) for (const s of ix.sents) { let h = 0; for (const w of tok) if (s.tok.has(w)) h++; const sc = h / tok.length; if (sc > bs) { bs = sc; best = s; } }
      const status = /\[[^\]]{3,}\]/.test(text) ? 'placeholder' : missingNums.length ? 'number' : it.numbersOnly ? 'ok' : bs >= 0.5 ? 'ok' : bs >= 0.3 ? 'loose' : 'none';
      return { ...it, status, missingNums, score: Math.round(bs * 100) / 100, source: best && bs >= 0.3 ? { text: best.text, where: best.where, page: best.page || pageOf(ix, best.text) } : null };
    });
  }

  // ---- proposal and thesis defence decks (fixed university outline) ----
  const OUTLINES = {
    proposal: ['Introduction', 'Background of the Study', 'Research Questions', 'Research Objectives', 'Research Problem', 'Research Framework', 'Scope of the Study', 'Research Methodology', 'Significance of the Study'],
    thesis: ['Background of the Study', 'Research Objectives', 'Research Questions', 'Research Problem', 'Research Framework', 'Scope of the Study', 'Research Approach by Stages', 'Findings of the Study', 'Conclusion', 'Recommendations', 'Implications of the Study', 'Suggestions for Future Research'],
  };
  const OBJ_VERB = 'examine|investigate|determine|explore|assess|identify|test|evaluate|analy[sz]e|measure|compare|understand|establish|describe|develop|validate|propose|synthesi[sz]e|map|review|investigate|study|predict';
  function goodSents(text) {
    const seen = new Set();
    return splitSentences(text || '').filter(x => { const k = x.trim().slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; }).map(x => x.replace(/^\s*(\(?[ivx\d]+[.)]|[a-e][.)]|[•▪◦●■‣-])\s+/i, '').trim()).filter(x => { const w = wc(x), letters = (x.match(/[A-Za-z]/g) || []).length; return w >= 5 && w <= 70 && letters / x.length > 0.55; });
  }
  function toQuestion(obj) {
    let r = String(obj || '').replace(/[.;:]+$/, '').trim().replace(new RegExp(`^to\\s+(${OBJ_VERB})\\s+`, 'i'), '');
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    const base = v => /ies$/.test(v) ? v.slice(0, -3) + 'y' : /(ss|sh|ch|x|o)es$/.test(v) ? v.slice(0, -2) : v.replace(/s$/, '');
    const VERBS = 'predicts|relates|differs|affects|influences|moderates|mediates|reduces|increases|improves|varies|depends|contributes|shapes|explains|impacts|leads|correlates|changes|helps|supports|determines|enhances';
    let m;
    if ((m = r.match(/^(?:whether|if)\s+(.+?)\s+(is|are|was|were|can|could|will|would|has|have)\s+(.+)$/i))) return cap(`${m[2].toLowerCase()} ${m[1]} ${m[3]}?`);
    if ((m = r.match(new RegExp(`^(?:whether|if)\\s+(.+?)\\s+(${VERBS})\\s+(.+)$`, 'i')))) return `Does ${m[1]} ${base(m[2].toLowerCase())} ${m[3]}?`;
    if ((m = r.match(new RegExp(`^how\\s+(.+?)\\s+(${VERBS})\\s+(.+)$`, 'i')))) return `How does ${m[1]} ${base(m[2].toLowerCase())} ${m[3]}?`;
    const PLAIN = 'perceive|use|experience|view|describe|understand|interact|engage|disclose|cope|respond|feel|think|evaluate|adopt|rate|choose|make|seek|differ|relate|vary|affect|influence|change|develop|form|build|manage|learn|trust|talk|communicate';
    if ((m = r.match(new RegExp(`^(how|why|when|where)\\s+(.+?)\\s+(${PLAIN})\\s+(.+)$`, 'i')))) return cap(`${m[1].toLowerCase()} do ${m[2]} ${m[3].toLowerCase()} ${m[4]}?`);
    if ((m = r.match(/^(how|what|which|why|when|where|who)\b\s*(.+)$/i))) return cap(`${m[1].toLowerCase()} ${m[2]}?`);
    if ((m = r.match(/^(?:the\s+)?(relationships?|associations?|correlations?|links?)\s+between\s+(.+)$/i))) return `What is the relationship between ${m[2]}?`;
    if ((m = r.match(/^(?:the\s+)?(effects?|impacts?|influences?|roles?|contributions?)\s+of\s+(.+)$/i))) return `What is the ${m[1].toLowerCase().replace(/s$/, '')} of ${m[2]}?`;
    if ((m = r.match(/^(?:the\s+)?(differences?)\s+(in|between)\s+(.+)$/i))) return `Are there differences ${m[2]} ${m[3]}?`;
    if ((m = r.match(/^the\s+(\w+)(.*)$/i))) return `What ${/s$/.test(m[1]) && !/ss$/.test(m[1]) ? 'are' : 'is'} the ${m[1]}${m[2]}?`;
    return '';
  }
  // split "to identify X; to examine Y and to determine Z" into separate objectives
  function objectivesIn(text) {
    const re = new RegExp(`\\bto\\s+(${OBJ_VERB})\\b|\\b(mengenal pasti|mengkaji|menentukan|meneroka|menilai|menganalisis|membandingkan|mengukur|meneliti|membangunkan)\\b`, 'gi'), idx = []; let mm;
    while ((mm = re.exec(text))) idx.push(mm.index);
    return idx.map((a, i) => text.slice(a, idx[i + 1] ?? text.length))
      .map(x => x.replace(/\s*(;|,)?\s*(and|as well as)?\s*(\(?[ivx\d]+[.)]|[a-e][.)])?\s*$/i, '').replace(/[.;,]\s*(the|this|these|in|it)\b.*$/i, '').replace(/[.;,:\s]+$/, '').trim())
      .filter(x => wc(x) >= 4 && wc(x) <= 45).map(x => x.charAt(0).toUpperCase() + x.slice(1));
  }
  function frameworkFrom(m, texts) {
    const stop = '(?=\\s(?:among|amongst|in|for|within|across|at|during|after|before|using|through|via|by|controlling|while)\\b|[,.;:?]|$)';
    const clean = t => {
      t = String(t || '').replace(/^[\s.,;:]+/, '').replace(/^(and|while|whereas)\s+/i, '').replace(/^(the|a|an)\s+/i, '').replace(/\s+/g, ' ').trim(); t = cut(t, 7).replace(/[.…]$/, '');
      const ws = t.split(' '); if (ws.filter(w => /^[A-Z][a-z]/.test(w)).length >= Math.max(2, ws.length * 0.6)) t = ws.map((w, i) => i && /^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w).join(' ');
      return t.charAt(0).toUpperCase() + t.slice(1);
    };
    const f = { iv: [], dv: [], med: [], mod: [], cov: '' };
    const all = texts.filter(Boolean).join(' . ');
    const role = (rx, key) => { let mm; const re = new RegExp(rx, 'gi'); while ((mm = re.exec(all))) { const v = clean(mm[1]); if (v && !f[key].includes(v) && f[key].length < 3) f[key].push(v); } };
    const KEYS = { iv: 'independent', dv: 'dependent', med: '(?:mediating|mediator)', mod: '(?:moderating|moderator)' };
    for (const [key, w] of Object.entries(KEYS)) {
      role(`(?:^|[,.;:]\\s*|\\band\\s+|framework,?\\s+)([^,.;:]{2,60}?)\\s+(?:is|are|was|were|serves as|served as|acts as|(?:is|was|are|were) (?:examined|treated|included|tested) as)\\s+(?:the\\s+|a\\s+|an\\s+)?${w}\\s+variables?`, key);
      role(`the\\s+${w}\\s+variables?\\s*(?:is|was|are|were|:|includes?|included)\\s*(?:the\\s+)?(.+?)${stop}`, key);
    }
    role(`(?:mediating|mediator)\\s+(?:role|effect)\\s+of\\s+(?:the\\s+)?(.+?)${stop}`, 'med');
    role(`(?:moderating|moderator)\\s+(?:role|effect)\\s+of\\s+(?:the\\s+)?(.+?)${stop}`, 'mod');
    if (!f.iv.length || !f.dv.length) {
      const pats = [
        `(?:relationships?|associations?|links?|correlations?)\\s+between\\s+(.+?)\\s+and\\s+(.+?)${stop}`,
        `(?:effects?|impacts?|influences?|roles?)\\s+of\\s+(.+?)\\s+on\\s+(.+?)${stop}`,
        `whether\\s+(.+?)\\s+(?:predicts?|predicted|is associated with|are associated with|was associated with|were associated with|is related to|are related to|relates? to|affects?|influences?|is linked to|are linked to|reduces?|improves?)\\s+(.+?)${stop}`,
      ];
      for (const p of pats) { const mm = all.match(new RegExp(p, 'i')); if (mm) { f.iv = [clean(mm[1])]; f.dv = [clean(mm[2])]; break; } }
    }
    f.found = !!(f.iv.length && f.dv.length);
    if (!f.iv.length || !f.dv.length) {
      const t = String(m.title || ''), seg = t.includes(':') && !/\band\b/i.test(t.split(':')[0]) ? t.split(':').slice(1).join(':') : t.split(':')[0];
      const mm = seg.match(new RegExp(`^\\s*(.+?)\\s+(?:and|on|predicts?|&)\\s+(.+?)${stop}`, 'i'));
      if (mm) { f.iv = [clean(mm[1])]; f.dv = [clean(mm[2])]; }
    }
    const cov = all.match(/controlling for ([^.;]+)/i); if (cov) f.cov = cut(cov[1], 10).replace(/[.…]$/, '');
    if (!f.iv.length) f.iv = ['[Independent variable]']; if (!f.dv.length) f.dv = ['[Dependent variable]'];
    return f;
  }
  function buildDefence(m, cfg = {}) {
    const type = cfg.type === 'thesis' ? 'thesis' : 'proposal', outline = OUTLINES[type];
    const st = buildStory(m), more = cfg.minutes >= 25 ? 2 : 1;
    const parts = m.parts || [];
    const partText = re => parts.filter(p => re.test(p.heading.toLowerCase())).map(p => p.text).join(' ');
    const secText = keys => keys.map(k => m.sections[k] && m.sections[k].text).filter(Boolean).join(' ');
    const ranked = keys => pool(m, keys, {});
    const said = new Set();
    // pick sentences: from a matching heading first, otherwise sentences in the given sections that match a cue
    const pick = (headRe, keys, cue, n, opts = {}) => {
      let out = goodSents(partText(headRe)).filter(x => !said.has(x));
      if (cue && out.length > n) { const hit = out.filter(x => cue.test(x)); if (hit.length) out = hit.concat(out.filter(x => !cue.test(x))); }
      if (out.length < (opts.min || 1)) {
        const extra = ranked(keys).map(x => x.text).filter(x => !said.has(x) && (!cue || cue.test(x)) && (!opts.not || !opts.not.test(x)));
        out = out.concat(extra);
      }
      out = out.filter(x => !opts.not || !opts.not.test(x));
      const res = [...new Set(out)].slice(0, n); res.forEach(x => said.add(x)); return res;
    };
    const short = (t, n = 14) => shorten(t, n).replace(/\s*…$/, '');
    const spk = a => a.map(speak).join(' ');
    const sl = [], add = s => sl.push({ id: id('t'), ...s });
    const sec = name => ({ part: name, section: outline.indexOf(name) + 1, sections: outline.length });
    // optional slides start switched off; the user turns them on per slide
    const opt = (slide, partName) => add({ ...slide, ...sec(partName), optional: true, hidden: true });
    const methTxt = () => [partText(/method|design|instrument|measure|procedure|analysis|metodologi|instrumen|kaedah|analisis/), secText(['method', 'participants'])].join(' ');
    const me = (cfg.presenter || '').trim() || '[your name]';
    const what = type === 'thesis' ? 'thesis' : 'research proposal';
    add({ kind: 'title', title: m.title, notes: `Good morning to the chairperson, the panel of examiners, and everyone present. My name is ${me}, and I am presenting my ${what}, titled ${m.title}.` });
    add({ kind: 'outline', title: 'Presentation Outline', items: outline.slice(), notes: `My presentation has ${outline.length} parts: ${listJoin(outline.map(x => x.toLowerCase()))}.` });

    const GAP = /(little|less) (is|has been) known|few studies|limited (research|evidence|studies|attention|understanding)|remains? (unclear|unknown|under-?studied|under-?explored|scarce)|\bgap\b|lack of|(has|have) not (been|yet)|yet to be|scarce|unexplored|inconsistent|mixed (findings|results|evidence)|no stud(y|ies)|not (well )?understood|overlooked/i;
    const AIM = new RegExp(`\\b(aims?|aimed|objectives?|purpose|goal)\\b.*\\bto\\s+(${OBJ_VERB})|\\b(this|the present|the current) (study|research|thesis|review) (aims?|aimed|seeks?|sought|will|was designed|examine[sd]?|investigate[sd]?|explore[sd]?)|\\bwe (aimed|sought|set out) to\\b`, 'i');
    const SIGSTAT = /significant(ly)?\s+(difference|predict|associat|correlat|effect|relationship|interaction|main|positive|negative|increase|decrease|higher|lower|change)|\bp\s?[<=>]/i;

    // introduction / background
    if (outline.includes('Introduction')) {
      const s = pick(/^(introduction|overview|pengenalan)$/, ['introduction', 'abstract'], null, 2 + more);
      add({ kind: 'text', title: 'Introduction', ...sec('Introduction'), body: s.length ? short(s[0], 24) : '[Add a short introduction]', notes: s.length ? `Let me begin with a short introduction. ${spk(s)}` : '[Add what you will say]' });
    }
    {
      const s = pick(/background|latar belakang/, ['introduction'], null, 3 + more, { not: new RegExp(GAP.source + '|' + AIM.source, 'i') });
      add({ kind: 'bullets', title: 'Background of the Study', ...sec('Background of the Study'), bullets: s.length ? s.slice(0, 3).map(x => short(x)) : ['[Add the background]'], notes: s.length ? `${type === 'thesis' ? 'Let me start with' : 'Next,'} the background of the study. ${spk(s)}` : '[Add what you will say]' });
    }
    // objectives and questions
    const objSrc = partText(/objective|aims?\b|purpose|objektif/) || '';
    let objs = objectivesIn(objSrc);
    if (!objs.length) { const aimS = [...goodSents(secText(['abstract', 'introduction'])), ...goodSents(secText(['method']))].filter(x => AIM.test(x)); for (const a of aimS) { objs = objs.concat(objectivesIn(a)); if (objs.length >= 2) break; } }
    if (!objs.length && st.question) objs = objectivesIn(st.question);
    objs = [...new Set(objs)].slice(0, 5);
    let rqs = (partText(/research questions?|persoalan kajian|soalan kajian/).match(/[^?]{12,}\?/g) || []).map(q => q.replace(/^.*?(RQ\s?\d+\s*[:.)-]?|research question \d+\s*[:.)-]?|\(?[ivx\d]+[.)])\s*/i, '').replace(/^[\s:;,.-]+/, '').trim()).filter(q => wc(q) >= 4);
    if (!rqs.length) rqs = goodSents(secText(['introduction', 'abstract'])).filter(x => /\?$/.test(x));
    let rqMade = false;
    if (!rqs.length) { rqs = objs.map(toQuestion).filter(Boolean); rqMade = rqs.length > 0; }
    rqs = [...new Set(rqs)].slice(0, 5);
    const rqSlide = () => add({ kind: 'numbered', title: 'Research Questions', ...sec('Research Questions'), items: rqs.length ? rqs.map((q, i) => ({ tag: 'RQ' + (i + 1), text: short(q, 24) })) : [{ tag: 'RQ1', text: '[Add your research question]' }], made: rqMade,
      notes: rqs.length ? `This study is guided by ${rqs.length === 1 ? 'one research question' : rqs.length + ' research questions'}. ` + rqs.map((q, i) => `Research question ${i + 1}: ${speak(q)}`).join(' ') : '[Add what you will say]' });
    const objSlide = () => add({ kind: 'numbered', title: 'Research Objectives', ...sec('Research Objectives'), items: objs.length ? objs.map((o, i) => ({ tag: 'RO' + (i + 1), text: short(o, 24) })) : [{ tag: 'RO1', text: '[Add your research objective]' }],
      notes: objs.length ? `${type === 'proposal' ? 'To answer these questions, the' : 'The'} objectives of this study are ${objs.length === 1 ? 'as follows' : 'as follows'}. ` + objs.map((o, i) => `${['First', 'Second', 'Third', 'Fourth', 'Fifth'][i]}, ${speak(o).replace(/^To/, 'to')}.`).join(' ') : '[Add what you will say]' });
    if (type === 'proposal') { rqSlide(); objSlide(); } else { objSlide(); rqSlide(); }
    {
      const htxt = partText(/hypothes|hipotesis/);
      let hs = (htxt.match(/\bH\d+[a-z]?\s*[:.)]?\s*[^.;]+/g) || []).map(x => x.replace(/^H\d+[a-z]?\s*[:.)]?\s*/, '').trim());
      if (!hs.length) hs = goodSents(htxt || secText(['introduction'])).filter(x => /hypothes[ie][sz]ed that|we (expect|predict)ed that|it (is|was) (expected|predicted) that/i.test(x)).map(x => x.replace(/^.*?(hypothes[ie][sz]ed|expected|predicted) that\s+/i, ''));
      hs = [...new Set(hs)].filter(x => wc(x) >= 3).slice(0, 5).map(x => x.charAt(0).toUpperCase() + x.slice(1).replace(/[.;\s]+$/, ''));
      opt({ kind: 'numbered', title: 'Research Hypotheses', items: hs.length ? hs.map((h, i) => ({ tag: 'H' + (i + 1), text: short(h, 22) })) : [{ tag: 'H1', text: '[Add your first hypothesis]' }, { tag: 'H2', text: '[Add your second hypothesis]' }],
        notes: hs.length ? `Based on the literature, I propose ${hs.length === 1 ? 'one hypothesis' : hs.length + ' hypotheses'}. ` + hs.map((h, i) => `Hypothesis ${i + 1}: ${speak(h)}.`).join(' ') : '[Explain each hypothesis and the reasoning behind it]' }, 'Research Questions');
    }
    // problem
    {
      const s = pick(/problem|research gap|rationale|justification|masalah|jurang/, ['introduction', 'abstract', 'discussion'], GAP, 2 + more, { min: 1 });
      const gap = s.filter(x => GAP.test(x));
      const gapS = goodSents([partText(/gap|jurang|literature|sorotan/), secText(['introduction', 'discussion'])].join(' ')).filter(x => GAP.test(x) && !s.includes(x)).slice(0, 3);
      if (gapS.length) gapS.forEach(x => said.add(x));
      const gapSlide = { kind: 'bullets', title: 'Research Gap', bullets: gapS.length ? gapS.map(x => short(x)) : ['[What previous studies have not yet answered]'], notes: gapS.length ? `Looking at the literature, ${spk(gapS).replace(/^\w/, c => c.toLowerCase())}` : '[Explain the gap in the literature]' };
      add({ kind: 'text', title: 'Research Problem', ...sec('Research Problem'), body: gap.length ? short(gap[0], 26) : s.length ? short(s[0], 26) : '[State the research problem]', notes: s.length ? `So what is the problem this study addresses? ${spk(s)}` : '[Add what you will say]' });
      opt(gapSlide, 'Research Problem');
    }
    // underpinning theory (optional)
    {
      const th = goodSents([partText(/theor|underpinning|kerangka teori|teori/), partText(/framework|kerangka/), secText(['introduction'])].join(' ')).filter(x => /\b(theory|theories|model|paradigm|framework|perspective|teori)\b/i.test(x) && !/(independent|dependent|mediating|moderating) variable/i.test(x) && !/^(theoretically|practically)\b|\bextends?\b|contribut/i.test(x) && !said.has(x)).slice(0, 3);
      th.forEach(x => said.add(x));
      opt({ kind: 'bullets', title: 'Underpinning Theory', bullets: th.length ? th.map(x => short(x)) : ['[Name of the theory]', '[How it explains the expected relationships]'], notes: th.length ? `This study is grounded in theory. ${spk(th)}` : '[Explain the theory and why it fits this study]' }, 'Research Framework');
    }
    // framework
    {
      const fw = frameworkFrom(m, [partText(/framework|conceptual model|research model|hypothes|kerangka|hipotesis/), ...objs, st.question, secText(['abstract'])]);
      const pl = a => a.length > 1 || / and /.test(a[0]);
      const lc = a => listJoin(a).replace(/^([A-Z])(?![A-Z])/, c => c.toLowerCase());
      const parts2 = [`${listJoin(fw.iv)} ${pl(fw.iv) ? 'are the independent variables' : 'is the independent variable'}`, `and ${lc(fw.dv)} ${pl(fw.dv) ? 'are the dependent variables' : 'is the dependent variable'}`];
      if (fw.med.length) parts2.push(`${lc(fw.med)} ${pl(fw.med) ? 'are' : 'is'} tested as a mediator`);
      if (fw.mod.length) parts2.push(`${lc(fw.mod)} ${pl(fw.mod) ? 'are' : 'is'} tested as a moderator`);
      const basis = goodSents(partText(/framework|theor|kerangka|teori/)).filter(x => /theor|model|framework/i.test(x))[0];
      add({ kind: 'framework', title: 'Research Framework', ...sec('Research Framework'), fw, guess: !fw.found,
        notes: `This is the research framework of the study. ${parts2.join(', ')}.${fw.cov ? ` The analysis controls for ${fw.cov}.` : ''}${basis ? ' ' + speak(basis) : ''}` });
    }
    // scope
    {
      let s = pick(/scope|delimitation|skop|batasan kajian/, [], null, 3);
      let bullets;
      if (s.length) bullets = s.map(x => short(x, 16));
      else {
        const msents = goodSents(secText(['participants', 'method', 'abstract']));
        const find = re => msents.find(x => re.test(x) && !said.has(x));
        const smp = sampleFrom(m), who = smp ? smp.sentence.text : find(/\b(participants|respondents|students|patients|adults|employees|teachers|sample)\b/i);
        const where = find(/\b(conducted|recruited|collected|located)\s+(in|at|from)\b|universit|hospital|school|district|state of|malaysia|province|city/i);
        const design = find(/cross-sectional|longitudinal|experiment|quasi|qualitative|quantitative|survey|mixed[- ]methods?|randomi[sz]ed|case study|interview|systematic review|meta-analy/i);
        const when = find(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b.*\b(19|20)\d{2}\b|\bbetween (19|20)\d{2}\b/i);
        s = [who, where, design, when].filter(Boolean); s = [...new Set(s)]; s.forEach(x => said.add(x));
        const lab = [['Who', who], ['Where', where], ['Design', design], ['When', when]].filter(x => x[1]);
        const seen = new Set(); bullets = lab.filter(x => !seen.has(x[1]) && seen.add(x[1])).map(([k, v]) => `*${k}:* ${short(v, 14)}`);
      }
      add({ kind: 'bullets', title: 'Scope of the Study', ...sec('Scope of the Study'), bullets: bullets.length ? bullets : ['[Population]', '[Setting]', '[Time frame]'], notes: s.length ? `In terms of scope, ${spk(s).replace(/^\w/, c => c.toLowerCase())}` : '[Add what you will say]' });
    }
    // methodology / stages
    {
      const name = type === 'thesis' ? 'Research Approach by Stages' : 'Research Methodology';
      const stageParts = parts.filter(p => /^(phase|stage|study|fasa|peringkat|kajian)\s*(\d+|one|two|three|four|i{1,3}|iv)\b/i.test(p.heading)).slice(0, 5);
      let steps = stageParts.length >= 2 ? stageParts.map((p, i) => ({ title: p.heading, text: short(goodSents(p.text)[0] || '', 14), hl: false })) : (st.steps || []).map(x => ({ ...x }));
      if (type === 'thesis') steps = steps.map((x, i) => ({ ...x, title: /^(phase|stage|study)\b/i.test(x.title) ? x.title : `Stage ${i + 1}: ${x.title}` }));
      const ord = ['First', 'Next', 'Then', 'After that', 'Finally'];
      add({ kind: 'flow', title: name, ...sec(name), steps: steps.length ? steps : [{ title: '[Design]', text: '' }, { title: '[Sample]', text: '' }, { title: '[Instruments]', text: '' }, { title: '[Analysis]', text: '' }], note: st.methodNote,
        notes: steps.length ? `${type === 'thesis' ? 'The research was carried out in ' + steps.length + ' stages.' : 'Now for the research methodology.'} ` + steps.map((x, i) => { const ph = x.title.match(/^((?:phase|stage|study)\s*\w+)\s*[:.\-–]\s*(.+)$/i), lead = ph ? `In ${ph[1].toLowerCase()}, ${ph[2].toLowerCase()}` : `${i === steps.length - 1 && i > 0 ? 'Finally' : ord[i]}, ${speak(x.title).toLowerCase()}`; return x.text ? `${lead}: ${speak(x.text).replace(/^\w/, c => c.toLowerCase())}.` : `${lead}.`; }).join(' ').replace(/\.\./g, '.') + (st.methodNote ? ' ' + speak(st.methodNote) : '') : '[Add what you will say]' });
    }
    // optional methodology detail: instruments, analysis plan, ethics, timeline
    {
      const mp = type === 'thesis' ? 'Research Approach by Stages' : 'Research Methodology';
      const ms = goodSents(methTxt());
      const INSTR = /\b(scale|questionnaire|inventory|index|checklist|instrument|interview (guide|protocol)|measured|assessed (using|with|by)|soal ?selidik|skala)\b/i;
      const rows = [];
      for (const x of ms.filter(y => INSTR.test(y))) {
        let mm = x.match(/^(.+?)\s+(?:was|were)\s+(?:measured|assessed|evaluated|captured)\s+(?:using|with|by)\s+(?:the\s+|a\s+|an\s+)?(.+?)(?:\s*\(([^)]*\d{4}[^)]*)\))?(?:[,;.]|\s+which|\s+that|$)/i);
        let construct = mm ? mm[1] : '', instr = mm ? mm[2] : '', srcRef = mm && mm[3] ? mm[3] : '';
        if (!mm) { const m2 = x.match(/(?:the\s+)?((?:[A-Z][\w-]*\s+){0,6}(?:Scale|Questionnaire|Inventory|Index|Checklist)(?:\s*\([A-Z0-9-]+\))?)/); if (!m2) continue; instr = m2[1]; construct = ''; }
        const items = (x.match(/(\d+)[- ]items?/i) || [])[1] || '';
        const alpha = (x.match(/(?:α|alpha|Cronbach'?s?\s+alpha)\s*(?:=|of|was|values? (?:above|of))?\s*(0?\.\d+)/i) || [])[1] || '';
        construct = cut(construct.replace(/^(the|a|an)\s+/i, ''), 5).replace(/[.…]$/, ''); instr = cut(instr, 9).replace(/[.…]$/, '');
        if (/\b(SPSS|SmartPLS|AMOS|Mplus|NVivo|ATLAS|Excel|Python|Stata|STATA|R version|software)\b/.test(instr) || /\bmodels?\b/i.test(construct)) continue;
        if (instr && !rows.some(r => r[1] === instr)) rows.push([construct ? construct.charAt(0).toUpperCase() + construct.slice(1) : '—', instr + (srcRef ? ` (${srcRef})` : ''), items || '—', alpha ? 'α = ' + alpha.replace(/^0/, '') : '—']);
        if (rows.length >= 5) break;
      }
      if (!rows.length) { const fw = (sl.find(x => x.kind === 'framework') || {}).fw || {}; [...(fw.iv || []), ...(fw.med || []), ...(fw.mod || []), ...(fw.dv || [])].filter(v => !/^\[/.test(v)).slice(0, 5).forEach(v => rows.push([v, '[Instrument (author, year)]', '[items]', '[α]'])); }
      if (!rows.length) rows.push(['[Variable]', '[Instrument (author, year)]', '[items]', '[α]']);
      opt({ kind: 'grid', title: 'Research Instruments', head: ['Variable', 'Instrument (source)', 'Items', 'Reliability'], rows, notes: rows[0][1].startsWith('[') ? '[Describe each instrument, where it comes from, and its reliability]' : 'These are the instruments used in this study. ' + rows.map(r => `${r[0] !== '—' ? r[0] + ' was measured with ' : ''}${speak(r[1])}${r[2] !== '—' ? `, ${r[2]} items` : ''}${r[3] !== '—' ? `, with Cronbach's alpha of ${speak(r[3].replace('α = ', ''))}` : ''}.`).join(' ') }, mp);
      const AN = /\b(regression|ANOVA|ANCOVA|MANOVA|t-tests?|chi-square|correlation|structural equation|SEM\b|PLS|SmartPLS|SPSS|AMOS|Mplus|R version|bootstrap|thematic analysis|content analysis|NVivo|ATLAS\.ti|descriptive statistics|factor analysis|meta-analy|narrative synthesis|mediation|moderation|PROCESS macro|analis(is|a) data)\b/i;
      const an = ms.filter(x => AN.test(x) && !said.has(x)).slice(0, 3); an.forEach(x => said.add(x));
      opt({ kind: 'bullets', title: 'Data Analysis Plan', bullets: an.length ? an.map(x => short(x)) : ['[Analysis for each research question]', '[Software]'], notes: an.length ? `For the analysis, ${spk(an).replace(/^\w/, c => c.toLowerCase())}` : '[Explain how each research question will be analysed]' }, mp);
      const ETH = /\b(ethic(s|al)|informed consent|consent|IRB|institutional review|approval (was )?(obtained|granted)|anonym|confidential|voluntar|withdraw|data protection|PDPA|etika)\b/i;
      const allS = goodSents([methTxt(), secText(['abstract'])].join(' '));
      const et = allS.filter(x => ETH.test(x) && !said.has(x)).slice(0, 3); et.forEach(x => said.add(x));
      opt({ kind: 'bullets', title: 'Ethical Considerations', bullets: et.length ? et.map(x => short(x)) : ['[Ethics committee and approval reference]', '[Informed consent and right to withdraw]', '[Confidentiality and data storage]'], notes: et.length ? `On ethics, ${spk(et).replace(/^\w/, c => c.toLowerCase())}` : '[Explain ethics approval, consent and data protection]' }, mp);
      if (type === 'proposal') {
        const stp = ((sl.filter(x => x.part === mp && x.kind === 'flow')[0] || {}).steps || []).map(x => x.title.replace(/^(Stage|Phase|Fasa|Peringkat)\s*\w+\s*[:.\-–]\s*/i, ''));
        const tasks = ['Literature review', ...(stp.length >= 2 ? stp : ['Instrument development', 'Pilot study', 'Data collection', 'Data analysis']), 'Thesis writing', 'Submission and viva'];
        const n = tasks.length, total = 24, step = total / n;
        opt({ kind: 'gantt', title: 'Research Timeline', months: total, rows: tasks.map((t, i) => ({ task: t, start: Math.max(1, Math.round(i * step) + 1 - (i ? 1 : 0)), end: Math.min(total, Math.round((i + 1) * step) + (i < n - 1 ? 1 : 0)) })), guess: true,
          notes: `This is my research timeline over ${total} months. ` + tasks.map((t, i) => `${t}`).join(', ') + '. [Adjust the months to your real plan]' }, mp);
      }
    }
    if (type === 'proposal') {
      const s = pick(/significance|contribution|importance of the study|benefit|kepentingan|sumbangan/, ['introduction', 'discussion', 'conclusion', 'abstract'], /contribut|inform|practi(c|s)|polic|important|benefit|useful|help|guide|implication|stakeholder|valuable|add to|extend/i, 3 + more, { not: SIGSTAT, min: 2 });
      add({ kind: 'bullets', title: 'Significance of the Study', ...sec('Significance of the Study'), bullets: s.length ? s.slice(0, 3).map(x => short(x)) : ['[Theoretical significance]', '[Practical significance]'], notes: s.length ? `Finally, the significance of this study. ${spk(s)}` : '[Add what you will say]' });
      const HEADS = { 'Introduction': /^(introduction|overview|pengenalan)$/, 'Background of the Study': /background|latar belakang/, 'Research Questions': /research questions?|persoalan kajian|soalan kajian/, 'Research Objectives': /objective|aims?\b|purpose|objektif/, 'Research Problem': /problem|research gap|rationale|masalah/, 'Research Framework': /framework|conceptual model|kerangka/, 'Scope of the Study': /scope|delimitation|skop/, 'Research Methodology': /method|research design|metodologi|reka bentuk/, 'Research Approach by Stages': /^(phase|stage|fasa|peringkat)\b|method|metodologi/, 'Significance of the Study': /significance|kepentingan/, 'Findings of the Study': /result|finding|dapatan|keputusan/, 'Conclusion': /conclusion|kesimpulan|rumusan/, 'Recommendations': /recommendation|cadangan/, 'Implications of the Study': /implication|implikasi/, 'Suggestions for Future Research': /future|suggestion|lanjutan/ };
      const TITLE_HEADS = { 'Research Hypotheses': /hypothes|hipotesis/, 'Research Gap': /gap|jurang/, 'Underpinning Theory': /theor|teori/, 'Research Instruments': /instrument|measure/, 'Data Analysis Plan': /analysis|analisis/, 'Ethical Considerations': /ethic|etika/, 'Limitations of the Study': /limitation|batasan|limitasi/, 'Contribution to Knowledge': /contribution|sumbangan/ };
      const confOf = x => {
        const txt = [x.body, ...(x.bullets || []), ...(x.items || []).map(y => y.text || y), ...(x.steps || []).map(y => y.title), ...(x.rows || []).filter(Array.isArray).flat(), ...((x.fw && x.fw.iv) || [])].filter(Boolean).join(' ');
        if (/\[[^\]\d]{3,}\]/.test(txt)) return { how: 'missing' };
        if (x.kind === 'gantt' || x.guess || x.made) return { how: 'guess' };
        const re = TITLE_HEADS[x.title] || HEADS[x.part];
        const hp = re && parts.find(p => re.test(p.heading.toLowerCase()));
        if (hp) return { how: 'heading', heading: hp.heading, page: hp.page };
        if (x.part === 'Findings of the Study' && m.sections.results) return { how: 'heading', heading: m.sections.results.heading, page: m.sections.results.page };
        return { how: 'guess' };
      };
      sl.forEach(x => { if (x.part) x.conf = confOf(x); });
      add({ kind: 'end', title: 'Thank you', body: 'Questions and feedback are welcome', notes: 'Thank you, chairperson and panel members. I welcome your questions and feedback, which will help me strengthen this study.' });
      return { slides: sl, minutes: cfg.minutes || 20, wpm: 130, type };
    }
    // thesis: findings, conclusion, recommendations, implications, future research
    {
      const nums = keyNumbers(m).filter(n => !/^\s*CI\b|[[\]]/i.test(n.label || '')), hero = nums.find(n => /%|×|times|=/.test(n.big)) || nums[0];
      const f = sec('Findings of the Study');
      if (m.mode !== 'review') add({ kind: 'stat', title: 'Findings of the Study', ...f, big: hero ? hero.big : '', bigLabel: hero ? hero.label : '', body: shorten(st.resultTitle, 24), figureId: null, ctx: studyContext(m), chart: hero ? chartFor(hero.src || st.resultTitle, hero.big, hero.label) : null, src: hero && hero.src, notes: `Now to the findings. ${speak(st.resultTitle)}${hero ? '' : ''}` });
      st.table = (st.table || []).filter(r => !/[[\]]/.test(r.label + r.value) && wc(r.label) >= 2);
      if (st.table.length >= 2) add({ kind: 'table', title: 'Findings: key results', ...f, head: st.tHead, rows: st.table, notes: 'These are the key results. ' + st.table.map(r => `${speak(r.label)}: ${speak(r.value)}.`).join(' ') });
      if (rqs.length >= 2) {
        const res = goodSents(secText(['results', 'discussion'])).filter(x => findStats(x).length || /\b(found|show|reveal|indicat|support)/i.test(x));
        const df = w => res.filter(x => x.toLowerCase().includes(w)).length || 1, usedR = new Set(), inRes = new Set(goodSents(secText(['results'])));
        const its = rqs.slice(0, 4).map((q, i) => {
          const words = [...new Set((q.toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => !/^(associat|relation|related|effects?|significant|users?|study|between|whether|perceived|there|which|their|among)/.test(w)).map(w => w.slice(0, 6)))];
          const score = x => words.filter(w => x.toLowerCase().includes(w)).reduce((a, w) => a + 1 / df(w), 0);
          const best = list => list.filter(x => !usedR.has(x)).map(x => [x, score(x)]).sort((a, b) => b[1] - a[1])[0];
          let b = best(res.filter(x => inRes.has(x))); if (!b || b[1] < 0.5) b = best(res);
          if (b && b[1] >= 0.5) usedR.add(b[0]);
          return { tag: 'RQ' + (i + 1), text: b && b[1] >= 0.5 ? short(b[0], 22) : '[Answer to this question]' };
        });
        add({ kind: 'numbered', title: 'Findings by research question', ...f, items: its, notes: 'Going back to the research questions. ' + its.map((x, i) => `For research question ${i + 1}, ${speak(x.text).replace(/^\w/, c => c.toLowerCase())}`).join(' ') });
      } else if ((st.items || []).length) add({ kind: 'list', title: 'Findings: summary', ...f, items: st.items, notes: 'To summarise the findings. ' + st.items.map((it, i) => `${['First', 'Second', 'Third', 'Fourth'][i] || 'Also'}, ${speak(it.text).replace(/^\w/, c => c.toLowerCase())}`).join(' ') });
    }
    {
      const s = pick(/^(conclusions?|concluding|kesimpulan|rumusan)/, ['conclusion', 'discussion'], null, 2 + more);
      add({ kind: 'statement', title: 'Conclusion', ...sec('Conclusion'), body: st.take || (s[0] ? short(s[0], 30) : '[Your conclusion]'), notes: `To conclude, ${speak(st.take || '').replace(/^\w/, c => c.toLowerCase())} ${spk(s.filter(x => !st.take || !x.toLowerCase().includes(st.take.replace(/\*/g, '').toLowerCase().slice(0, 30))))}`.trim() });
    }
    {
      const ls = pick(/limitation|batasan|limitasi/, ['limitations', 'discussion'], /limit|cannot|could not|self-report|cross-sectional|small sample|generali[sz]/i, 3, { min: 1 });
      opt({ kind: 'bullets', title: 'Limitations of the Study', bullets: ls.length ? ls.map(x => short(x)) : ['[Main limitation and how it affects the findings]'], notes: ls.length ? `Like any study, this one has limitations. ${spk(ls)}` : '[Explain the main limitations]' }, 'Conclusion');
    }
    const FUT = /future (research|studies|work|investigation)|further (research|studies|investigation)|should (examine|explore|investigate|test|replicate|follow|use|include|consider)|longitudinal|replicat/i;
    {
      const s = pick(/recommendation|^cadangan(?!.*(lanjutan|akan datang|masa))/, ['discussion', 'conclusion', 'limitations'], /\b(should|recommend|need to|must|encourag|could consider|it is suggested|ought to)\b/i, 3 + more, { not: FUT, min: 2 });
      add({ kind: 'bullets', title: 'Recommendations', ...sec('Recommendations'), bullets: s.length ? s.slice(0, 3).map(x => short(x)) : ['[Add your recommendations]'], notes: s.length ? `Based on these findings, I would like to make the following recommendations. ${spk(s)}` : '[Add what you will say]' });
    }
    {
      const s = pick(/implication|implikasi/, ['discussion', 'conclusion'], /implication|theor|practi(c|s)|polic|inform|clinician|educator|practitioner|designer|developer|counsel|intervention|contribut/i, 3 + more, { not: SIGSTAT, min: 2 });
      const tag = x => /theor|literature|knowledge|model|framework|understanding/i.test(x) ? '*Theory:* ' : '*Practice:* ';
      add({ kind: 'bullets', title: 'Implications of the Study', ...sec('Implications of the Study'), bullets: s.length ? s.slice(0, 3).map(x => tag(x) + short(x.replace(/^(theoretically|practically|in practice|in theory),?\s+/i, '').replace(/^\w/, c => c.toUpperCase()), 13)) : ['[Theoretical implications]', '[Practical implications]'], notes: s.length ? `This study has implications for both theory and practice. ${spk(s)}` : '[Add what you will say]' });
    }
    {
      const cs = pick(/contribution|sumbangan|novelty/, ['discussion', 'conclusion', 'introduction'], /contribut|\bextends?\b|first (study|to)|\bnovel\b|adds? to|new (evidence|insight|understanding)|\bfills?\b/i, 3, { not: SIGSTAT, min: 2 });
      opt({ kind: 'bullets', title: 'Contribution to Knowledge', bullets: cs.length ? cs.map(x => short(x)) : ['[Theoretical contribution]', '[Methodological or practical contribution]'], notes: cs.length ? `What does this thesis add to knowledge? ${spk(cs)}` : '[Explain your contribution to knowledge]' }, 'Implications of the Study');
    }
    {
      const s = pick(/future|suggestion|kajian (lanjutan|akan datang|masa (depan|hadapan))/, ['limitations', 'discussion', 'conclusion'], FUT, 3 + more, { min: 2 });
      const lim = st.lim && !s.some(x => x.includes(st.lim.slice(0, 30))) ? st.lim : '';
      add({ kind: 'bullets', title: 'Suggestions for Future Research', ...sec('Suggestions for Future Research'), bullets: s.length ? s.slice(0, 3).map(x => short(x)) : lim ? [short(lim)] : ['[Add your suggestions]'], notes: s.length || lim ? `Finally, suggestions for future research.${lim ? ' ' + speak(lim) : ''} ${spk(s)}`.trim() : '[Add what you will say]' });
    }
    const HEADS = { 'Introduction': /^(introduction|overview|pengenalan)$/, 'Background of the Study': /background|latar belakang/, 'Research Questions': /research questions?|persoalan kajian|soalan kajian/, 'Research Objectives': /objective|aims?\b|purpose|objektif/, 'Research Problem': /problem|research gap|rationale|masalah/, 'Research Framework': /framework|conceptual model|kerangka/, 'Scope of the Study': /scope|delimitation|skop/, 'Research Methodology': /method|research design|metodologi|reka bentuk/, 'Research Approach by Stages': /^(phase|stage|fasa|peringkat)\b|method|metodologi/, 'Significance of the Study': /significance|kepentingan/, 'Findings of the Study': /result|finding|dapatan|keputusan/, 'Conclusion': /conclusion|kesimpulan|rumusan/, 'Recommendations': /recommendation|cadangan/, 'Implications of the Study': /implication|implikasi/, 'Suggestions for Future Research': /future|suggestion|lanjutan/ };
    const TITLE_HEADS = { 'Research Hypotheses': /hypothes|hipotesis/, 'Research Gap': /gap|jurang/, 'Underpinning Theory': /theor|teori/, 'Research Instruments': /instrument|measure/, 'Data Analysis Plan': /analysis|analisis/, 'Ethical Considerations': /ethic|etika/, 'Limitations of the Study': /limitation|batasan|limitasi/, 'Contribution to Knowledge': /contribution|sumbangan/ };
    const confOf = x => {
      const txt = [x.body, ...(x.bullets || []), ...(x.items || []).map(y => y.text || y), ...(x.steps || []).map(y => y.title), ...(x.rows || []).filter(Array.isArray).flat(), ...((x.fw && x.fw.iv) || [])].filter(Boolean).join(' ');
      if (/\[[^\]\d]{3,}\]/.test(txt)) return { how: 'missing' };
      if (x.kind === 'gantt' || x.guess || x.made) return { how: 'guess' };
      const re = TITLE_HEADS[x.title] || HEADS[x.part];
      const hp = re && parts.find(p => re.test(p.heading.toLowerCase()));
      if (hp) return { how: 'heading', heading: hp.heading, page: hp.page };
      if (x.part === 'Findings of the Study' && m.sections.results) return { how: 'heading', heading: m.sections.results.heading, page: m.sections.results.page };
      return { how: 'guess' };
    };
    sl.forEach(x => { if (x.part) x.conf = confOf(x); });
    add({ kind: 'end', title: 'Thank you', body: 'Questions are welcome', notes: 'Thank you, chairperson and members of the panel. I welcome your questions.' });
    return { slides: sl, minutes: cfg.minutes || 30, wpm: 130, type };
  }

  function buildTalk(m, cfg = {}) {
    if (cfg.type === 'proposal' || cfg.type === 'thesis') return buildDefence(m, cfg);
    const st = buildStory(m), nums = keyNumbers(m), we = !!cfg.author;
    const review = m.mode === 'review', sys = !!m.reviewKind, kindW = review || sys ? 'review' : 'study';
    const cite = shortCite(m) || 'the authors';
    const more = cfg.minutes >= 15 ? 2 : cfg.minutes >= 10 ? 1 : 0;
    const used = new Set();
    const extra = (keys, base) => {
      if (!more) return '';
      const seen = (String(base || '') + ' ' + sl.map(z => z.notes + ' ' + (z.body || '')).join(' ')).toLowerCase();
      const novel = t => { const ws = String(t).toLowerCase().match(/[a-z]{4,}/g) || []; return ws.length && ws.filter(w => seen.includes(w)).length / ws.length < 0.6; };
      const xs = pool(m, keys, { filter: x => !used.has(x.clean) && novel(x.text) && wc(x.text) >= 8 && wc(x.text) <= 40 && /^[A-Z]/.test(x.text) && !/^(table|figure|fig\.)/i.test(x.text) }).slice(0, more);
      xs.forEach(x => used.add(x.clean));
      return xs.length ? ' ' + speak(xs.map(x => x.text).join(' ')) : '';
    };
    const co = (m.authors || []).slice(1);
    const sl = [];
    const add = s => sl.push({ id: id('t'), ...s });
    add({ kind: 'title', title: m.title, notes: we
      ? `Hello everyone, and thank you for coming. I'm ${cfg.presenter || '[your name]'}, and today I'll present our ${kindW}, ${m.title}.${co.length ? ` This is joint work with ${listJoin(co.slice(0, 4))}.` : ''}`
      : `Hello everyone${cfg.presenter ? `, I'm ${cfg.presenter}` : ''}. Today I'll present a ${kindW === 'review' ? 'review' : 'paper'} by ${cite}, called ${m.title}${m.journal ? `, published in ${m.journal}` : ''}.` });
    const ctxLine = studyContext(m);
    if (st.question) add({ kind: 'text', title: review ? 'Why this matters' : 'The problem', body: sentencesUpTo(st.question, 28), notes: `Let's start with why this matters. ${speak(st.question)}${extra(['introduction', 'background'], st.question)}` });
    if (sys && m.prisma) {
      const p = m.prisma, f = v => Number(v).toLocaleString('en-US');
      add({ kind: 'prisma', title: 'Search and screening', prisma: { ...p }, note: st.methodNote,
        notes: `To answer this, ${we ? 'we' : 'the authors'} searched the literature systematically. ${speak(st.methodNote)} ${p.identified ? `The searches found ${f(p.identified)} records.` : ''} ${p.screened ? `${f(p.screened)} were screened by title and abstract,` : ''} ${p.fulltext ? `${f(p.fulltext)} full texts were assessed,` : ''} and ${f(p.included)} studies met the criteria.`.replace(/\s+/g, ' ').trim() });
    } else if (review) {
      add({ kind: 'bullets', title: "What we'll cover", bullets: m.topics.slice(0, 6).map(t => t.heading), notes: `This ${we ? 'review' : 'paper'} covers ${m.topics.length} topics: ${listJoin(m.topics.slice(0, 6).map(t => t.heading.toLowerCase()))}. Let's go through them one by one.` });
      m.topics.slice(0, 6).forEach(tp => {
        const sents = (tp.ranked || []).slice(0, 2 + more).sort((a, b) => a.order - b.order).map(x => shorten(x.text, 24));
        const steps = (tp.steps || []).slice(0, 4);
        add({ kind: steps.length ? 'flow' : 'bullets', title: tp.heading, steps: steps.map((x, i) => ({ title: x, text: '', hl: i === steps.length - 1 })), note: steps.length ? sents[0] : '', bullets: steps.length ? undefined : sents.slice(0, 3).map(t => shorten(t, 12).replace(/\s*…$/, "")),
          notes: `${tp.heading}. ${speak(sents.join(' '))}${steps.length ? ` Management follows ${steps.length} steps: ${listJoin(steps.map(x => x.toLowerCase()))}.` : ''}` });
      });
    } else if ((st.steps || []).length) {
      const ord = ['First', 'Next', 'Then', 'Finally'];
      add({ kind: 'flow', title: we ? 'What we did' : 'What they did', steps: st.steps, note: st.methodNote,
        notes: `Here's what ${we ? 'we' : 'the researchers'} did. ` + st.steps.map((s2, i) => `${i === st.steps.length - 1 && i > 0 ? 'Finally' : ord[i]}, ${/^(a total of|\d|participants\b)/i.test(s2.text) ? 'the sample: ' : ''}${speak(s2.text).replace(/^\w/, c => c.toLowerCase())}`).join(' ') });
    }
    const sample = !review && !sys ? sampleFrom(m) : null;
    if (sample) {
      const nTxt = Number(sample.n.replace(/,/g, '')).toLocaleString('en-US'), sent = speak(shorten(sample.sentence.text, 30));
      add({ kind: 'stat', title: 'Who took part', big: nTxt, bigLabel: sample.unit, body: shorten(sample.sentence.text, 22), ctx: ctxLine, chart: chartFor('', nTxt, sample.unit), src: sample.sentence.text,
        notes: /^(a total of|in total|overall)\b/i.test(sent) || sent.includes(nTxt) ? sent : `In total, ${nTxt} ${sample.unit} took part. ${sent}` });
    }
    if (!review) {
      const hero = nums.find(n => /%|×|times|=/.test(n.big)) || (sys ? nums[0] : null);
      add({ kind: 'stat', title: 'The key result', big: hero ? hero.big : '', bigLabel: hero ? hero.label : '', body: shorten(st.resultTitle, 24), figureId: null, ctx: ctxLine, chart: hero ? chartFor(hero.src || st.resultTitle, hero.big, hero.label) : null, src: hero && hero.src,
        notes: `Now for the main finding. ${speak(st.resultTitle)}${hero && sys ? ` In total, ${hero.big} ${hero.label}.` : ''}${extra(['results'], st.resultTitle)}` });
      const rows = (st.table || []).filter(r => !(sample && (r.label.toLowerCase() === sample.unit.toLowerCase() || r.value.replace(/,/g, '') === sample.n.replace(/,/g, ''))));
      if (rows.length) st.table = rows;
      if (rows.length) {
        let notes;
        if (sys) {
          const by = e => st.table.filter(r => r.value === e).map(r => r.label.toLowerCase());
          const parts = [];
          if (by('Benefit').length) parts.push(`benefits were reported for ${listJoin(by('Benefit'))}`);
          if (by('Mixed').length) parts.push(`evidence was mixed for ${listJoin(by('Mixed'))}`);
          if (by('No clear effect').length) parts.push(`there was no clear effect on ${listJoin(by('No clear effect'))}`);
          if (by('Risk').length) parts.push(`${listJoin(by('Risk'))} emerged as a risk`);
          notes = `Across the included studies, ${listJoin(parts)}.`;
        } else notes = `Here are the other key results. ` + st.table.map(r => `${speak(r.label)}: ${speak(r.value)}.`).join(' ');
        add({ kind: 'table', title: sys ? 'What the evidence shows' : 'Key results', head: st.tHead, rows: st.table, notes });
      }
      if (sys) {
        const QUAL = /risk of bias|\bRoB\b|ROBINS|MMAT|Mixed Methods Appraisal|Newcastle[- ]Ottawa|\bJBI\b|Joanna Briggs|\bCASP\b|\bGRADE\b|certainty of (the )?evidence|quality (was |of (the )?(included )?studies )?(appraised|assessed|rated)|methodological quality/i;
        const q = pool(m, ['method', 'results', 'discussion', 'limitations', 'abstract'], { filter: x => QUAL.test(x.text) }).slice(0, 3).map(x => x.text);
        add({ kind: 'bullets', title: 'Quality of the evidence', bullets: q.length ? q.map(x => shorten(x, 14).replace(/\s*…$/, '')) : ['[Risk-of-bias tool and overall rating]', '[Certainty of evidence, e.g. GRADE]'], hidden: !q.length,
          notes: q.length ? `How much can we trust this evidence? ${speak(q.join(' '))}` : '[Explain how study quality and certainty of evidence were assessed]' });
      }
    }
    if ((st.items || []).length) add({ kind: 'list', title: st.fTitle, items: st.items, notes: `To sum up the findings. ` + st.items.map((it, i) => `${['First', 'Second', 'Third', 'Fourth'][i] || 'Also'}, ${speak(it.text).replace(/^\w/, c => c.toLowerCase())}`).join(' ') });
    if (st.why) add({ kind: 'text', title: 'What this means', body: sentencesUpTo(st.why, 28), notes: `So what does this mean? ${speak(st.why)}${extra(['discussion', 'conclusion'], st.why)}` });
    if (st.lim) {
      const fut = pool(m, ['limitations', 'discussion', 'conclusion'], { filter: x => /future (research|studies|work)|should (examine|test|follow|explore)/i.test(x.text) })[0];
      add({ kind: 'bullets', title: 'Limitations and next steps', bullets: [shorten(st.lim, 16).replace(/\s*…$/, ''), fut ? shorten(fut.text, 14).replace(/\s*…$/, '') : null].filter(Boolean), notes: `${we ? 'Our study has' : 'There are'} some limitations to keep in mind. ${speak(st.lim)}${fut ? ' ' + speak(shorten(fut.text, 30)) : ''}` });
    }
    add({ kind: 'statement', title: 'Take-home message', body: st.take, notes: `If you remember one thing from this talk, it's this: ${speak(st.take)}` });
    add({ kind: 'end', title: 'Thank you', body: 'Questions?', notes: `Thank you for listening. ${m.doi ? 'You can scan the QR code for the full paper. ' : ''}I'm happy to take questions.` });
    if (!we) sl.forEach(x => { if (x.kind !== 'title') x.notes = x.notes.replace(/\bWe\b/g, 'They').replace(/\bwe\b/g, 'they').replace(/\bOur\b/g, 'Their').replace(/\bour\b/g, 'their'); });
    return { slides: sl, minutes: cfg.minutes || 10, wpm: 130, type: 'paper' };
  }
  const talkSeconds = (s, wpm = 130) => Math.round(wcount(s.notes) / wpm * 60) + 4;

  function buildReviewPoster(m) {
    const join = (arr, n, per) => arr.slice(0, n).sort((a, b) => a.order - b.order).map(x => shorten(x.text, per)).join(' ');
    const intro = pool(m, ['abstract', 'introduction'], { decay: 0.1 });
    const concl = pool(m, ['conclusion', 'discussion'], { decay: 0.1 });
    const blocks = [];
    const introB = { id: 'intro', col: 0, heading: 'Introduction', kind: 'text', text: join(intro, 3, 36) };
    const tps = m.topics.slice(0, 8).map((tp, i) => ({ id: 't' + i, col: 0, heading: cut(tp.heading, 8).replace(/[.…]$/, ''), kind: 'bullets', bullets: tp.ranked.slice(0, 3).sort((a, b) => a.order - b.order).map(x => shorten(x.text, 22)) }));
    const take = { id: 'takeaway', col: 2, heading: 'Key takeaway', kind: 'callout', text: concl[0] ? shorten(concl[0].text, 30) : (intro[0] ? shorten(intro[0].text, 30) : '') };
    const conc = { id: 'conclusion', col: 2, heading: 'Conclusion', kind: 'text', text: join(concl.slice(1), 2, 34) };
    const w = b => wc(b.text || (b.bullets || []).join(' ')) + 12;
    const loads = [w(introB), 0, w(take) + w(conc)];
    for (const b of tps) { const c = loads.indexOf(Math.min(...loads)); b.col = c; loads[c] += w(b); }
    blocks.push(introB, ...tps, take, conc);
    return { blocks };
  }

  // ---- audience, voice and hooks ----
  const AUD = {
    students: { noun: 'every student', who: 'classmate', occasion: 'exam' },
    clinicians: { noun: 'every junior doctor', who: 'colleague', occasion: 'on-call shift' },
    researchers: { noun: 'every researcher', who: 'colleague', occasion: 'lab meeting' },
    public: { noun: 'everyone', who: 'friend', occasion: 'emergency' },
  };
  const lowerKeepAcronyms = t => t.split(/\s+/).map(w => /^[A-Z0-9&-]{2,6}s?$/.test(w) && /[A-Z]{2}/.test(w) ? w : w.toLowerCase()).join(' ');
  function topicNoun(m) {
    const main = m.title.split(/:|—|–|\s-\s/)[0].split(/\s+(?:and|&)\s+(?:their|its|the)\b/i)[0].trim();
    return lowerKeepAcronyms(wc(main) <= 6 ? main : (m.keywords[0] || main.split(' ').slice(0, 4).join(' ')));
  }
  function hookOptions(m, cfg, info) {
    const a = AUD[cfg.audience] || AUD.students;
    const we = cfg.author;
    const t = m.title.replace(/\s+/g, ' ');
    const main = t.includes(':') ? t.split(':')[0].trim() : t;
    const noun = topicNoun(m);
    const kw = (m.keywords[0] || noun).toLowerCase();
    const out = [];
    if (info.review) {
      const n = info.n;
      out.push(`*${n}* ${noun} ${a.noun} must know`);
      out.push(`Would you recognise these *${n}* ${noun}?`);
      out.push(`Save this before your next ${a.occasion}`);
      out.push(`${noun.replace(/^\w/, c => c.toUpperCase())}: a *${n}-step* survival guide`);
    } else {
      if (info.hero) out.push(`*${info.hero}*. The number that stood out in ${we ? 'our' : 'this'} study`);
      if (info.sample) out.push(`${we ? 'We' : 'Researchers'} studied *${info.sample.n} ${info.sample.unit}*. Here's what ${we ? 'we' : 'they'} found`);
      out.push(`What really happens with ${kw}?`);
      out.push(`${kw.replace(/^\w/, c => c.toUpperCase())}: what ${a.noun} should know`);
    }
    out.push(wc(main) <= 14 ? main : cut(main, 14).replace(/[.…]$/, ''));
    out.push(`${we ? 'Our new' : 'New'} ${info.review ? 'review' : 'study'}: ${wc(main) <= 9 ? main : cut(main, 9).replace(/[.…]$/, '')}`);
    return [...new Set(out)];
  }
  function whereOf(m, sec) { const s = m.sections[sec]; return s ? `${LABELS[sec] || 'Text'}${s.page ? `, page ${s.page}` : ''}` : ''; }
  // shortened options plus the original sentences they came from (for source tracing)
  function optsFrom(m, list, n, where) {
    const seen = new Set(), options = [], srcs = [];
    for (const x of list) {
      const t = shorten(x.text, n); if (!t || seen.has(t)) continue;
      seen.add(t); options.push(t); srcs.push({ text: x.text, where: where || whereOf(m, x.sec) });
      if (options.length >= 8) break;
    }
    return { options, srcs, optIndex: 0 };
  }
  function ctaFor(cfg) {
    const a = AUD[cfg.audience] || AUD.students;
    return `Save this for later, send it to a ${a.who}, and follow for one paper explained every week.`;
  }
  function assignLayouts(slides) {
    let last = '';
    for (const s of slides) {
      if (s.type !== 'text') { last = s.type; continue; }
      if (s.layout) { last = s.layout; continue; }
      s.layout = s.role === 'why' ? 'quote' : last === 'classic' ? 'bold' : 'classic';
      last = s.layout;
    }
    return slides;
  }
  function cheatFrom(slides, review) {
    const by = r => slides.find(s => s.role === r && !s.hidden);
    const items = [];
    const short = (t, n = 13) => shorten(t || '', n);
    const statPhrase = (body, big) => {
      const i = big ? body.indexOf(big) : -1; if (i < 0) return '';
      const ws = body.slice(i).split(/[,;.](?:\s|$)/)[0].split(/\s+/).slice(0, 8);
      while (ws.length > 2 && /^(and|or|but|the|a|an|of|to|than|with|that|is|are|for|in|on|by|as|at|from|who|students?|people|participants)$/i.test(ws[ws.length - 1])) ws.pop();
      return ws.join(' ').replace(big, `*${big}*`);
    };
    if (review) {
      for (const s of slides.filter(s => s.role === 'topic').slice(0, 6)) {
        const st = (s.steps || []).filter(Boolean);
        const h = s.heading.includes(':') ? s.heading.split(':').slice(1).join(':').trim() : s.heading;
        items.push({ title: cut(h.replace(/\s*\([^)]*\)\s*$/, ''), 5).replace(/[.…]$/, ''), text: st.length ? st.slice(0, 3).map(x => cut(x, 4).replace(/[.…]$/, '')).join(' → ') : short(s.body) });
      }
    } else {
      const p = by('problem'), me = by('method'), f1 = by('finding1'), wy = by('why');
      if (p) items.push({ title: 'The question', text: short(p.body) });
      if (me && me.bullets && me.bullets[0]) items.push({ title: 'What was done', text: short(me.bullets[0], 10) });
      if (f1) { const ph = statPhrase(f1.body || '', f1.big || ''); items.push(ph ? { title: 'Key result', big: '', text: ph } : { title: 'Key result', big: f1.big || '', text: short(f1.body, 10) }); }
      if (wy) items.push({ title: 'Why it matters', text: short(wy.body) });
    }
    return items;
  }

  function buildReviewSlides(m, cfg) {
    const slides = [];
    const tps = m.topics.slice(0, 6);
    const hooks = hookOptions(m, cfg, { review: true, n: tps.length });
    slides.push({ id: id('s'), role: 'hook', type: 'hook', label: cfg.series || (cfg.author ? 'Our new review' : 'Review'), hooks, hookIndex: 0, heading: hooks[0], body: 'Swipe for the key points', icon: iconFor(m.title, 'book') });
    const ov = pool(m, ['abstract', 'introduction'], { decay: 0.1 });
    const agenda = `This review covers ${tps.length} topics: ${tps.map(t => cut(t.heading, 4).replace(/[.…]$/, '').toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
    const ovo = optsFrom(m, ov, 24);
    if (!ovo.options.length || /^(acute|chronic)\b/i.test(ovo.options[0])) { ovo.options.unshift(agenda); ovo.srcs.unshift({ text: 'Built from the topic headings in the paper.', where: 'Headings' }); }
    else { ovo.options.push(agenda); ovo.srcs.push({ text: 'Built from the topic headings in the paper.', where: 'Headings' }); }
    slides.push({ id: id('s'), role: 'problem', type: 'text', label: 'Overview', heading: 'Why this matters', ...ovo, icon: 'search' });
    tps.forEach((tp, i) => {
      const o = optsFrom(m, tp.ranked, 22, `${tp.heading}, page ${tp.page}`);
      slides.push({ id: id('s'), role: 'topic', topicIndex: i, steps: (tp.steps || []).slice(0, 4).map(x => cut(x, 6).replace(/[.…]$/, '')), type: 'text', label: `Key point ${i + 1}`, heading: cut(tp.heading, 8).replace(/[.…]$/, ''), ...o, icon: iconFor(tp.heading + ' ' + tp.text.slice(0, 300), ['bulb', 'target', 'alert', 'clipboard', 'heart', 'search'][i % 6]) });
    });
    const tk = pool(m, ['conclusion', 'discussion', 'abstract'], { decay: 0.1 });
    if (tk.length) slides.push({ id: id('s'), role: 'why', type: 'text', label: 'Take-home message', heading: 'The bottom line', ...optsFrom(m, tk, 22), icon: 'bulb' });
    slides.push({ id: id('s'), role: 'cheat', type: 'cheat', label: 'Cheat sheet', heading: 'Save this cheat sheet', items: [], icon: 'bookmark' });
    slides.push({ id: id('s'), role: 'cite', type: 'cite', label: 'Read the paper', heading: cfg.author ? 'Read our full review' : 'Read the full review', body: ctaFor(cfg), icon: 'book' });
    for (const s of slides) if (s.options && s.body === undefined) s.body = s.options[0] || '';
    slides.find(s => s.role === 'cheat').items = cheatFrom(slides, true);
    return assignLayouts(slides);
  }

  function buildSlides(m, cfg = {}) {
    const out = buildSlides0(m, cfg), c = studyContext(m);
    if (c) out.forEach(x => { if (x.type === 'stat') x.ctx = c; });
    return out;
  }
  function buildSlides0(m, cfg = {}) {
    cfg = { audience: 'students', author: false, ...cfg };
    if (m.mode === 'review') return buildReviewSlides(m, cfg);
    const slides = [];
    const sample = sampleFrom(m);
    const resPool = pool(m, ['results', 'abstract', 'discussion'], { decay: 0.15 });
    let f1 = resPool.find(x => heroFrom(x.text) && /%|times|fold/.test(heroFrom(x.text)) && (!sample || x.clean !== sample.sentence.clean))
      || resPool.find(x => heroFrom(x.text)) || resPool[0];
    const hero = f1 ? heroFrom(f1.text) : '';
    const statOpts = resPool.filter(x => heroFrom(x.text));
    const we = cfg.author;

    const hooks = hookOptions(m, cfg, { sample, hero });
    slides.push({ id: id('s'), role: 'hook', type: 'hook', label: cfg.series || (we ? 'Our new research' : 'New research'), hooks, hookIndex: 0, heading: hooks[0], body: 'Swipe to see what the study found', icon: iconFor(m.title + ' ' + m.keywords.join(' '), 'spark') });

    const probPool = pool(m, ['introduction', 'abstract'], { decay: 0.1 });
    const intro = probPool.filter(x => /(little is known|unclear|gap|however|limited|few|concern|problem|challenge|aim|purpose|this study)/i.test(x.text)).concat(probPool);
    if (intro.length) slides.push({ id: id('s'), role: 'problem', type: 'text', label: 'The problem', heading: we ? 'Why we did this study' : 'Why this study matters', ...optsFrom(m, intro, 24), icon: 'search' });

    const meth = pool(m, ['method', 'participants', 'abstract'], { decay: 0.2, filter: x => x.sec !== 'abstract' || /(participants|survey|recruited|design|interview|measured|data)/i.test(x.text) });
    if (meth.length) {
      const mo = optsFrom(m, meth, 10);
      slides.push({ id: id('s'), role: 'method', type: 'list', label: 'Method', heading: we ? 'What we did' : 'What they did', bullets: mo.options.slice(0, 3), options: mo.options, srcs: mo.srcs, icon: iconFor(meth.slice(0, 3).map(x => x.text).join(' '), 'clipboard') });
    }
    if (sample) slides.push({ id: id('s'), role: 'sample', type: 'stat', label: 'Who took part', heading: '', big: Number(sample.n.replace(/,/g, '')).toLocaleString('en-US'), bigLabel: sample.unit, options: [shorten(sample.sentence.text, 20)], srcs: [{ text: sample.sentence.text, where: whereOf(m, sample.sentence.sec) }], optIndex: 0, icon: 'people' });
    if (f1) {
      const ordered = [f1, ...statOpts.filter(x => x !== f1)];
      const o = optsFrom(m, ordered, 22);
      slides.push({ id: id('s'), role: 'finding1', type: 'stat', label: 'Key finding', heading: '', big: hero, bigLabel: '', bigOptions: ordered.map(x => heroFrom(x.text) || '').slice(0, 8), ...o, icon: 'bars' });
    }
    const f2Pool = resPool.filter(x => x !== f1);
    if (f2Pool.length) slides.push({ id: id('s'), role: 'finding2', type: 'figure', label: 'Another finding', heading: we ? 'We also found' : 'They also found', ...optsFrom(m, f2Pool, 22), figureId: null, icon: 'bars' });
    const why = pool(m, ['discussion', 'conclusion', 'abstract'], { decay: 0.1, filter: x => !/limitation/i.test(x.text) });
    if (why.length) slides.push({ id: id('s'), role: 'why', type: 'text', label: 'Why it matters', heading: 'What this means', ...optsFrom(m, why, 22), icon: 'bulb' });
    const lim = pool(m, ['limitations', 'discussion', 'conclusion'], { decay: 0.2, filter: x => x.sec === 'limitations' || /(limitation|caution|generali[sz]|self-report|future (research|studies|work))/i.test(x.text) });
    const lo = lim.length ? optsFrom(m, lim, 20) : { options: ['Add a limitation from the paper here.'], srcs: [], optIndex: 0 };
    slides.push({ id: id('s'), role: 'limits', type: 'text', label: 'Keep in mind', heading: 'Limitations', ...lo, icon: 'alert', hidden: !lim.length });
    slides.push({ id: id('s'), role: 'cheat', type: 'cheat', label: 'Cheat sheet', heading: 'Save this cheat sheet', items: [], icon: 'bookmark' });
    slides.push({ id: id('s'), role: 'cite', type: 'cite', label: 'Read the paper', heading: we ? 'Read our full paper' : 'Read the full paper', body: ctaFor(cfg), icon: 'book' });
    for (const s of slides) if (s.options && s.body === undefined) s.body = s.options[s.optIndex || 0] || '';
    slides.find(s => s.role === 'cheat').items = cheatFrom(slides, false);
    return assignLayouts(slides);
  }

  function buildPoster(m) {
    const base = m.mode === 'review' ? buildReviewPoster(m) : buildClassicPoster(m);
    return { layout: 'story', ...base, bb: buildBillboard(m), story: buildStory(m) };
  }
  function buildClassicPoster(m) {
    const join = (arr, n, perMax) => arr.slice(0, n).sort((a, b) => (a.sec === b.sec ? a.order - b.order : 0)).map(x => shorten(x.text, perMax)).join(' ');
    const intro = pool(m, ['introduction', 'abstract'], { decay: 0.4, filter: x => x.sec !== 'abstract' || !findStats(x.text).length });
    const meth = pool(m, ['method', 'participants'], { decay: 0.05 });
    const res = pool(m, ['results', 'abstract'], { decay: 0.2 });
    const disc = pool(m, ['discussion', 'conclusion'], { decay: 0.05, filter: x => !/limitation/i.test(x.text) });
    const lim = pool(m, ['limitations', 'discussion'], { decay: 0.2, filter: x => x.sec === 'limitations' || /(limitation|caution|generali[sz]|future (research|studies))/i.test(x.text) });
    const concl = pool(m, ['conclusion', 'discussion', 'abstract'], { decay: 0.35 });
    const stats = [];
    for (const x of res) { const h = heroFrom(x.text); if (h && !stats.some(s => s.big === h)) stats.push({ big: h, label: shorten(x.text, 20) }); if (stats.length === 3) break; }
    const sample = sampleFrom(m);
    if (sample && stats.length < 3) stats.unshift({ big: Number(sample.n.replace(/,/g, '')).toLocaleString('en-US'), label: sample.unit.replace(/^\w/, c => c.toUpperCase()) });
    const meth2 = meth.length ? meth : pool(m, ['abstract']);
    return {
      blocks: [
        { id: 'intro', col: 0, heading: 'Introduction', kind: 'text', text: join(intro, 4, 40) },
        { id: 'method', col: 0, heading: 'Method', kind: 'bullets', bullets: meth2.slice(0, 4).map(x => shorten(x.text, 24)) },
        { id: 'stats', col: 1, heading: 'Key numbers', kind: 'stats', stats: stats.slice(0, 3) },
        { id: 'results', col: 1, heading: 'Results', kind: 'text', text: join(res.filter(x => x.sec === 'results').length ? res.filter(x => x.sec === 'results') : res, 3, 36) },
        { id: 'figure', col: 1, heading: 'Figure', kind: 'figure', figureId: null, caption: '' },
        { id: 'discussion', col: 2, heading: 'Discussion', kind: 'text', text: join(disc.filter(x => !concl[0] || x.clean !== concl[0].clean), 3, 38) },
        { id: 'takeaway', col: 2, heading: 'Key takeaway', kind: 'callout', text: concl[0] ? shorten(concl[0].text, 32) : '' },
        { id: 'limits', col: 2, heading: 'Limitations', kind: 'text', text: lim.length ? join(lim, 2, 30) : '' },
      ],
    };
  }

  return { buildTalk, factCheck, studyContext, chartFor, numTokens, toQuestion, objectivesIn, OUTLINES, talkSeconds, speak, buildStory, buildBillboard, detectPrisma, _orderPage: orderPage, extractLines, buildModel, buildSlides, buildPoster, cheatFrom, hookOptions, ctaFor, AUD, topicNoun, findStats, shorten, cleanSentence, wc, shortCite, LABELS, ORDER, STAT_RE, splitSentences };
})();
if (typeof module !== 'undefined') module.exports = P2P;
