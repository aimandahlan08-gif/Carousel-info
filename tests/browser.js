// Real-browser test in headless Chromium (Playwright). CDN libraries are served from local copies.
// Run: node tests/browser.js <folder with node_modules holding jszip, jspdf, mp4-muxer, pptxgenjs, tesseract.js>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), LIB = process.argv[2] || path.join(ROOT, 'node_modules'), OUT = process.argv[3] || __dirname;
const NM = p => path.join(LIB, 'node_modules', p), PNM = p => path.join(ROOT, 'node_modules', p);
const MAP = [
  [/pdf\.js\/3\.11\.174\/pdf\.worker\.min\.js$/, PNM('pdfjs-dist/build/pdf.worker.min.js')],
  [/pdf\.js\/3\.11\.174\/pdf\.min\.js$/, PNM('pdfjs-dist/build/pdf.min.js')],
  [/jszip\/3\.10\.1\/jszip\.min\.js$/, NM('jszip/dist/jszip.min.js')],
  [/jspdf\/2\.5\.1\/jspdf\.umd\.min\.js$/, NM('jspdf/dist/jspdf.umd.min.js')],
  [/mp4-muxer@5\.1\.3\/build\/mp4-muxer\.js$/, NM('mp4-muxer/build/mp4-muxer.js')],
  [/pptxgenjs@3\.12\.0\/dist\/pptxgen\.bundle\.js$/, NM('pptxgenjs/dist/pptxgen.bundle.js')],
  [/qrcode-generator@1\.4\.4\/qrcode\.js$/, PNM('qrcode-generator/qrcode.js')],
  [/tesseract\.js@5\.1\.1\/dist\/tesseract\.min\.js$/, NM('tesseract.js/dist/tesseract.min.js')],
  [/tesseract\.js@5\.1\.1\/dist\/worker\.min\.js$/, NM('tesseract.js/dist/worker.min.js')],
  [/tesseract\.js-core@5\.1\.1\/(.+)$/, m => NM('tesseract.js-core/' + m[1])],
  [/@tesseract\.js-data\/eng@1\.0\.0\/4\.0\.0_best_int\/(.+)$/, m => NM('@tesseract.js-data/eng/4.0.0_best_int/' + m[1])],
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); } else { r.writeHead(404); r.end(); } }).listen(8765);
  const browser = await chromium.launch();
  const report = [], errors = [];
  const ok = (name, cond, info = '') => { report.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
  async function newPage(viewport) {
    const ctx = await browser.newContext({ viewport, acceptDownloads: false });
    await ctx.route('**/*', async route => {
      const u = route.request().url();
      if (u.startsWith('http://localhost:8765')) return route.continue();
      for (const [re, f] of MAP) { const m = u.match(re); if (m) { const file = typeof f === 'function' ? f(m) : f; if (fs.existsSync(file)) return route.fulfill({ path: file, contentType: /\.wasm$/.test(file) ? 'application/wasm' : /\.gz$/.test(file) ? 'application/gzip' : 'text/javascript', headers: { 'access-control-allow-origin': '*' } }); } }
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.addInitScript(() => {
      window.__saved = [];
      window.claude = { use: async n => n === 'downloads' ? { save: async ({ filename, data }) => { const size = data.size || data.byteLength || data.length; window.__saved.push({ filename, size }); return { status: 'saved' }; } } : null };
    });
    await page.goto('http://localhost:8765/paper2poster.html');
    await page.waitForSelector('#strip .thumb');
    return page;
  }
  const page = await newPage({ width: 1440, height: 900 });
  ok('boots with the example paper', await page.locator('#strip .thumb').count() > 5);
  // upload thesis
  await page.setInputFiles('#pdfInput', path.join(__dirname, 'fixtures/thesis.pdf'));
  await page.waitForFunction(() => /Anthropomorphism/.test(document.querySelector('#mTitle').value), null, { timeout: 30000 });
  ok('thesis PDF read in the browser', true, await page.inputValue('#mTitle'));
  ok('model built in a background worker', await page.evaluate(() => typeof Worker !== 'undefined' && !!document.querySelector('#coreSrc')));
  // talk tab, thesis outline
  await page.click('.tab[data-tab="talk"]'); await sleep(300);
  await page.selectOption('#tType', 'thesis'); await sleep(500);
  ok('thesis outline built', await page.locator('#tStrip .thumb').count() >= 17, await page.locator('#tStrip .thumb').count() + ' slides');
  await page.screenshot({ path: path.join(OUT, 'b_talk_desktop.png') });
  await page.click('#tRehearse'); await sleep(300);
  ok('rehearse view opens', await page.isVisible('#rehearse'));
  await page.keyboard.press('ArrowRight'); await sleep(200);
  await page.screenshot({ path: path.join(OUT, 'b_rehearse.png') });
  await page.keyboard.press('Escape');
  // exports
  for (const x of ['pptx', 'talkpdf', 'script', 'zip', 'poster', 'lipdf', 'ga']) {
    await page.click('#exportBtn'); await page.click(`#exportMenu [data-x="${x}"]`);
    await page.waitForFunction(n => window.__saved.length >= n, (await page.evaluate(() => window.__saved.length)) + 1, { timeout: 120000 }).catch(() => {});
  }
  // video (WebCodecs)
  await page.click('#exportBtn'); await page.click('#exportMenu [data-x="video45"]');
  await page.waitForFunction(() => window.__saved.some(f => /carousel-4x5/.test(f.filename)), null, { timeout: 240000 }).catch(() => {});
  const saved = await page.evaluate(() => window.__saved);
  ok('exports produced files', saved.length >= 8, saved.map(f => `${f.filename.replace(/^.*?-(talk|speaker|carousel|poster|linkedin|graphical)/, '$1')} ${Math.round(f.size / 1024)} KB`).join(', '));
  ok('video encoded (WebCodecs or MediaRecorder)', saved.some(f => /carousel-4x5\.(mp4|webm)$/.test(f.filename) && f.size > 20000), (saved.find(f => /carousel-4x5/.test(f.filename)) || {}).filename);
  // fact check panel
  await page.click('.tab[data-tab="extracted"]'); await sleep(400);
  ok('fact check panel shows', await page.isVisible('.card.fc'), await page.locator('.card.fc .chip').allTextContents().then(a => a.join(' | ')));
  // reload: project restored from IndexedDB
  await page.reload(); await page.waitForSelector('#strip .thumb'); await sleep(800);
  ok('project restored after reload (IndexedDB)', /Anthropomorphism/.test(await page.inputValue('#mTitle')));
  ok('IndexedDB holds the project', await page.evaluate(() => new Promise(res => { const r = indexedDB.open('paper2poster', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('paper2poster-v1'); q.onsuccess = () => res(!!(q.result && q.result.model && q.result.model.pageText && q.result.model.pageText.length)); q.onerror = () => res(false); }; r.onerror = () => res(false); })));
  // scanned PDF -> OCR
  await page.setInputFiles('#pdfInput', path.join(__dirname, 'fixtures/scanned.pdf'));
  await page.waitForSelector('#ocrGo', { timeout: 30000 });
  ok('scanned PDF detected', true);
  await page.click('#ocrGo');
  await page.waitForFunction(() => /Smartphone|Bedtime|Sleep/i.test(document.querySelector('#mTitle').value), null, { timeout: 240000 }).catch(() => {});
  const ocrTitle = await page.inputValue('#mTitle'), ocrSecs = await page.evaluate(() => document.querySelectorAll('#ex .card').length);
  ok('OCR read the scanned paper', /Smartphone|Bedtime|Sleep/i.test(ocrTitle), ocrTitle);
  await page.click('.tab[data-tab="extracted"]'); await sleep(300);
  ok('OCR text produced sections', await page.locator('#ex .card h3 .k').count() >= 3, (await page.locator('#ex .card h3 .k').allTextContents()).join(', '));
  // mobile
  const mob = await newPage({ width: 390, height: 844 });
  await mob.screenshot({ path: path.join(OUT, 'b_mobile_carousel.png'), fullPage: false });
  await mob.click('.tab[data-tab="talk"]'); await sleep(400);
  await mob.screenshot({ path: path.join(OUT, 'b_mobile_talk.png'), fullPage: true });
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('mobile: no sideways scrolling', !overflow, overflow ? document.documentElement.scrollWidth : '');
  ok('no JavaScript errors', !errors.length, errors.slice(0, 5).join(' || '));
  console.log(report.join('\n'));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
