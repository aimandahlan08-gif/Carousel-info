const { JSDOM, VirtualConsole } = require(__dirname + '/../node_modules/jsdom');
const napi = require(__dirname + '/../node_modules/@napi-rs/canvas');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../paper2poster.html', 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
const vc = new VirtualConsole(); const errors = [];
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));
const dom = new JSDOM('<!doctype html><html><head></head><body>' + html + '</body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc, url: 'https://example.org/' });
const w = dom.window;
w.qrcode = require(__dirname + '/../node_modules/qrcode-generator');
w.Path2D = napi.Path2D;
w.matchMedia = q => ({ matches: false, addEventListener() {}, removeEventListener() {} });
w.document.fonts = { load: async () => [], addEventListener() {}, ready: Promise.resolve() };
w.HTMLCanvasElement.prototype.getContext = function () { if (!this._c || this._c.width !== this.width || this._c.height !== this.height) { this._c = napi.createCanvas(this.width || 300, this.height || 150); } const ctx = this._c.getContext('2d'); const orig = ctx.drawImage.bind(ctx); ctx.drawImage = (img, ...r) => orig(img && img._c ? img._c : (img && img._napi ? img._napi : img), ...r); return ctx; };
w.HTMLCanvasElement.prototype.toDataURL = function (t) { this.getContext('2d'); return this._c.toDataURL(t === 'image/jpeg' ? 'image/jpeg' : 'image/png'); };
w.HTMLCanvasElement.prototype.toBlob = function (cb) { this.getContext('2d'); cb(new w.Blob([this._c.toBuffer('image/png')], { type: 'image/png' })); };
w.HTMLImageElement.prototype.decode = async function () { const im = new napi.Image(); im.src = Buffer.from(this.src.split(',')[1], 'base64'); this._napi = im; Object.defineProperty(this, 'width', { value: im.width, configurable: true }); Object.defineProperty(this, 'height', { value: im.height, configurable: true }); };
w.Element.prototype.scrollIntoView = function () {}; w.scrollTo = () => {};
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
try { w.eval(js.join('\n;\n')); } catch (e) { errors.push('eval: ' + e.stack); }
const $ = s => w.document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const go = async t => { if (t === 'extracted') { $('#fcBadge').click(); await sleep(50); return; } if (!$('#checkModal').hidden) $('#checkClose').click(); const m = { carousel: ['social', 1], poster: ['poster', 1], talk: ['talk', 1], kit: ['social', 3] }[t]; $(`.mode[data-mode="${m[0]}"]`).click(); await sleep(30); $(`#steps [data-step="${m[1]}"]`).click(); await sleep(30); };
(async () => {
  await sleep(1500);
  const report = () => console.log('slides:', $('#strip').children.length, '| notice:', ($('#notice').textContent || '').slice(0, 70), '| inspector:', ($('#insp .insp-h .t') || {}).textContent);
  report(); if (errors.length) { console.log(errors.slice(0,5).join(' || ')); process.exit(1); }
  // click through every tab and every slide
  for (const t of ['poster', 'kit', 'extracted', 'carousel']) { await go(t); await sleep(150); }
  const thumbs = [...$('#strip').children];
  for (const b of thumbs) { b.click(); await sleep(30); }
  console.log('kit caption length:', ($('#kit-caption') || {}).value?.length, '| alt lines:', ($('#kit-alt') || {}).value?.split('\n\n').length, '| thread posts:', ($('#kit-thread') || {}).value?.split('\n\n').length);
  console.log('licence box:', $('.kitb.lic h3') && $('.kitb.lic h3').textContent);
  // brand & voice
  $('#mHandle').value = '@aiman.reads'; $('#mHandle').dispatchEvent(new w.Event('input'));
  $('#bSeries').value = 'Paper of the Week #12'; $('#bSeries').dispatchEvent(new w.Event('input'));
  $('#cAud').value = 'clinicians'; $('#cAud').dispatchEvent(new w.Event('change'));
  $('#vAuthor').checked = true; $('#vAuthor').dispatchEvent(new w.Event('change'));
  await sleep(200);
  thumbs[0].click(); await sleep(50);
  console.log('hook after voice:', $('#iHeading') && $('#iHeading').value);
  // layout change on a text slide, cheat editor, source box
  for (const b of thumbs) { b.click(); await sleep(20); if ($('#iLayout')) { $('#iLayout').value = 'quote'; $('#iLayout').dispatchEvent(new w.Event('change')); console.log('layout set on', $('#insp .insp-h .t').textContent, '| source box:', !!$('details.src')); break; } }
  for (const b of thumbs) { b.click(); await sleep(20); if ($('#iItems')) { console.log('cheat items:', $('#iItems').value.split('\n').length); $('#iCheatRefresh').click(); break; } }
  // undo / redo
  $('#undoBtn').click(); await sleep(50); $('#redoBtn').click(); await sleep(50);
  // export menu opens
  $('#exportBtn').click(); console.log('menu open:', !$('#exportMenu').hidden);
  w.document.body.click(); console.log('menu closed:', $('#exportMenu').hidden);
  // graphical abstract render (save fails gracefully without downloads)
  $('#exportMenu [data-x="ga"]').click(); await sleep(300);
  console.log('toast:', $('#toast').textContent);
  // poster tab + click a block
  await go('poster'); await sleep(100);
  console.log('poster blocks in inspector:', w.document.querySelectorAll('.blk').length, '| poster meta:', $('#pMeta').textContent);
  await sleep(300);
  console.log('POSTER WARN:', $('#warns') && $('#warns').textContent);
  await go('kit'); await sleep(100);
  console.log('CAPTION:\n' + $('#kit-caption').value);
  console.log('THREAD:\n' + $('#kit-thread').value.split('\n\n').slice(0, 3).join('\n'));
  $('#shareBtn').click(); await sleep(50);
  console.log('share cards:', w.document.querySelectorAll('.shc').length, '| X link:', decodeURIComponent(w.document.querySelectorAll('.shc a')[4].href).slice(0, 140));
  w.document.querySelectorAll('.shc [data-sh]')[7].click(); await sleep(300);
  console.log('after WhatsApp tap -> modal hidden:', $('#shareModal').hidden, '| toast:', $('#toast').textContent);
  await go('poster'); await sleep(150);
  console.log('STORY layout:', $('#pLayout').value, '| size:', $('#pSize').value, '| blocks:', [...w.document.querySelectorAll('.blk')].map(b => b.dataset.b).join(','), '| meta:', $('#pMeta').textContent);
  // study sheet editor (the default layout)
  const shTa = $('#insp textarea[data-b2]'); shTa.value = shTa.value + ' **Edited**'; shTa.dispatchEvent(new w.Event('input'));
  const shShow = $('#insp [data-f="show"]'); shShow.checked = false; shShow.dispatchEvent(new w.Event('change')); await sleep(80);
  const shTone = $('#insp select[data-f="tone"]'); shTone.value = 'dark'; shTone.dispatchEvent(new w.Event('change'));
  const shMv = $('#insp [data-mv="1"]'); shMv.click(); await sleep(80);
  console.log('sheet editor ok, meta:', $('#pMeta').textContent);
  $('#pLayout').value = 'story'; $('#pLayout').dispatchEvent(new w.Event('change')); await sleep(150);
  const tk = $('textarea[data-s="take"]'); tk.value = 'Cycling to campus goes with *lower loneliness*.'; tk.dispatchEvent(new w.Event('input'));
  const cs = $('select[data-col="why"]'); cs.value = '1'; cs.dispatchEvent(new w.Event('change'));
  const stp = $('textarea[data-s="steps"]'); stp.value = 'Survey | 486 students\nAnalysis | Regression'; stp.dispatchEvent(new w.Event('input'));
  const conf = $('input[data-s="conference"]'); conf.value = 'ICAP 2026'; conf.dispatchEvent(new w.Event('input'));
  await sleep(150);
  console.log('story after edits meta:', $('#pMeta').textContent, '| warns:', $('#warns') && $('#warns').textContent);
  $('#pLayout').value = 'billboard'; $('#pLayout').dispatchEvent(new w.Event('change')); await sleep(150);
  console.log('BB inspector blocks:', [...w.document.querySelectorAll('.blk')].map(b => b.dataset.b).join(','), '| meta:', $('#pMeta').textContent);
  const st = $('.blk[data-b="statement"] textarea'); st.value = 'Cycling to campus is linked to *lower loneliness* in new students.'; st.dispatchEvent(new w.Event('input')); await sleep(100);
  const vs = $('select[data-k="visual"]'); vs.value = 'none'; vs.dispatchEvent(new w.Event('change')); await sleep(100);
  const pr = $('[data-pr="included"]'); pr.value = '12'; pr.dispatchEvent(new w.Event('input'));
  const n0 = $('[data-num="0"][data-nf="big"]'); n0.value = '486'; n0.dispatchEvent(new w.Event('input')); await sleep(100);
  $('#pLayout').value = 'classic'; $('#pLayout').dispatchEvent(new w.Event('change')); await sleep(100);
  console.log('classic blocks:', w.document.querySelectorAll('.blk').length);
  $('#pLayout').value = 'billboard'; $('#pLayout').dispatchEvent(new w.Event('change')); await sleep(100);
  console.log('back to billboard, statement kept:', $('.blk[data-b="statement"] textarea').value.slice(0, 40), '| meta:', $('#pMeta').textContent);
  $('#bbReset').click(); await sleep(100);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no runtime errors');
  process.exit(0);
})();
