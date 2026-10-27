/* App controller: wires the document → story → blocks → visuals → music pipeline to the UI. */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  const state = {
    sourceName: '',
    story: null,
    blocks: [],
    themeKey: 'auto',
    format: 'portrait',
    handle: '',
    maxSlides: 10,
    mood: 'inspiring',
    songs: [],
    song: null,
    audioFile: null,
    slide: 0,
    secondsPerSlide: 3,
    slideCanvases: []
  };
  const player = new Music.SoundtrackPlayer();

  // ---------- setup ----------

  function init() {
    const themeSelect = $('#themeSelect');
    themeSelect.append(new Option('Auto — match the mood', 'auto'));
    for (const [key, t] of Object.entries(Renderer.THEMES)) themeSelect.append(new Option(t.name, key));

    const moodSelect = $('#moodSelect');
    for (const [key, m] of Object.entries(Music.MOODS)) moodSelect.append(new Option(`${m.emoji} ${m.label}`, key));

    const dz = $('#dropzone');
    $('#fileInput').addEventListener('change', e => e.target.files[0] && loadFile(e.target.files[0]));
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e => e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]));

    $('#generateBtn').addEventListener('click', () => {
      const text = $('#pasteInput').value.trim();
      if (!text) return setStatus('Upload a file, paste some text, or try the sample.', true);
      generate(text, 'Pasted text');
    });
    $('#sampleBtn').addEventListener('click', () => {
      $('#pasteInput').value = window.SAMPLE_DOCUMENT;
      generate(window.SAMPLE_DOCUMENT, 'Sample: The Future of Remote Work');
    });

    themeSelect.addEventListener('change', e => { state.themeKey = e.target.value; renderAll(); });
    $$('input[name=format]').forEach(r => r.addEventListener('change', e => { state.format = e.target.value; renderAll(); }));
    $('#handleInput').addEventListener('input', debounce(e => {
      const v = e.target.value.trim().replace(/\s+/g, '');
      state.handle = v ? (v.startsWith('@') ? v : '@' + v) : '';
      renderAll();
    }, 300));
    $('#maxSlidesInput').addEventListener('input', e => { $('#maxSlidesOut').value = e.target.value; });
    $('#maxSlidesInput').addEventListener('change', e => {
      state.maxSlides = +e.target.value;
      if (state.story) { state.blocks = Blocks.buildBlocks(state.story, { maxSlides: state.maxSlides }); state.slide = 0; renderAll(); }
    });

    $$('.tabs button').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));

    $('#prevBtn').addEventListener('click', () => goTo(state.slide - 1));
    $('#nextBtn').addEventListener('click', () => goTo(state.slide + 1));
    document.addEventListener('keydown', e => {
      if (!state.story || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') goTo(state.slide + 1);
      if (e.key === 'ArrowLeft') goTo(state.slide - 1);
    });
    let touchX = null;
    $('#viewport').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    $('#viewport').addEventListener('touchend', e => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) goTo(state.slide + (dx < 0 ? 1 : -1));
      touchX = null;
    });

    $('#addBlockBtn').addEventListener('click', () => {
      const at = Math.max(1, state.blocks.length - 1);
      state.blocks.splice(at, 0, Blocks.newBlock('section', 'New section', ['Add a point here']));
      state.slide = at;
      renderAll();
    });

    moodSelect.addEventListener('change', e => { setMood(e.target.value); renderAll(); });
    $('#previewTrackBtn').addEventListener('click', toggleSoundtrack);
    $('#playSoundBtn').addEventListener('click', toggleSlideshow);
    $('#downloadTrackBtn').addEventListener('click', downloadTrack);
    $('#audioInput').addEventListener('change', e => {
      state.audioFile = e.target.files[0] || null;
      $('#audioInfo').textContent = state.audioFile ? `Using “${state.audioFile.name}” in the video export.` : '';
    });

    $('#downloadSlideBtn').addEventListener('click', () => downloadCanvas(state.slideCanvases[state.slide], `${slug()}-slide-${state.slide + 1}.png`));
    $('#downloadInfographicBtn').addEventListener('click', downloadInfographic);
    $('#infographicBtn2').addEventListener('click', downloadInfographic);
    $('#zipBtn').addEventListener('click', downloadZip);
    $('#secInput').addEventListener('input', e => { state.secondsPerSlide = +e.target.value; $('#secOut').value = e.target.value; updateTrackInfo(); });
    $('#videoBtn').addEventListener('click', exportVideo);
    $('#copyCaptionBtn').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#captionOutput').value); flash($('#copyCaptionBtn'), 'Copied!'); }
      catch { $('#captionOutput').select(); document.execCommand('copy'); flash($('#copyCaptionBtn'), 'Copied!'); }
    });
  }

  // ---------- pipeline ----------

  async function loadFile(file) {
    setStatus(`Reading ${file.name}…`);
    try {
      const text = await Extractor.extractText(file);
      if (!text || text.trim().split(/\s+/).length < 20) throw new Error('Not enough readable text found. Scanned PDFs need OCR first.');
      generate(text, file.name);
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Could not read that file.', true);
    }
  }

  async function generate(text, sourceName) {
    try {
      const story = Analyzer.analyzeDocument(text);
      state.story = story;
      state.sourceName = sourceName;
      state.blocks = Blocks.buildBlocks(story, { maxSlides: state.maxSlides });
      state.slide = 0;
      setMood(story.mood.primary);
      $('#moodSelect').value = state.mood;
      setStatus(`✓ ${story.wordCount.toLocaleString()} words · ${story.stats.length} numbers · ${story.sections.length} sections found in “${sourceName}”.`);
      await fontsReady();
      $('#emptyState').hidden = true;
      $('#editorPanel').hidden = false;
      renderAll();
      selectTab(currentTab() || 'carousel');
    } catch (err) {
      console.error(err);
      setStatus(err.message, true);
    }
  }

  function setMood(mood) {
    state.mood = mood;
    state.songs = Music.suggestSongs(mood, state.story ? state.story.mood.scores : {});
    state.song = state.songs[0] || null;
  }

  function opts() {
    return {
      theme: Renderer.resolveTheme(state.themeKey, state.mood),
      format: state.format,
      handle: state.handle,
      keywords: state.story ? state.story.keywords : [],
      kicker: state.story ? `Infographic · ${state.story.readingMinutes} min read` : 'Infographic',
      source: state.sourceName
    };
  }

  function renderAll() {
    if (!state.story) return;
    state.slide = Math.min(state.slide, state.blocks.length - 1);
    renderSlides();
    Renderer.renderInfographic($('#infographicCanvas'), state.blocks, opts());
    renderEditor();
    renderMusic();
    renderCaption();
  }

  function renderSlides() {
    const o = opts();
    const track = $('#track');
    const thumbs = $('#thumbs');
    track.innerHTML = '';
    thumbs.innerHTML = '';
    state.slideCanvases = state.blocks.map((_, i) => {
      const c = document.createElement('canvas');
      Renderer.renderSlide(c, state.blocks, i, o);
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', `Slide ${i + 1}: ${state.blocks[i].heading || state.blocks[i].items[0] || ''}`);
      track.append(c);

      const tb = document.createElement('button');
      tb.title = `Slide ${i + 1}`;
      const tc = document.createElement('canvas');
      tc.width = 180; tc.height = Math.round(180 * c.height / c.width);
      tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
      tb.append(tc);
      tb.addEventListener('click', () => goTo(i));
      thumbs.append(tb);
      return c;
    });
    $('#postHandle').textContent = (state.handle || '@yourbrand').replace(/^@/, '');
    goTo(state.slide);
  }

  function goTo(i) {
    const n = state.blocks.length;
    if (!n) return;
    state.slide = Math.max(0, Math.min(n - 1, i));
    $('#track').style.transform = `translateX(-${state.slide * 100}%)`;
    $('#prevBtn').disabled = state.slide === 0;
    $('#nextBtn').disabled = state.slide === n - 1;
    $('#igDots').innerHTML = state.blocks.map((_, k) => `<i class="${k === state.slide ? 'on' : ''}"></i>`).join('');
    $$('#thumbs button').forEach((b, k) => b.classList.toggle('on', k === state.slide));
    $$('.block-card').forEach((c, k) => c.classList.toggle('active', k === state.slide));
  }

  // ---------- editor ----------

  function renderEditor() {
    const root = $('#blockEditor');
    root.innerHTML = '';
    const rerender = debounce(() => { renderSlides(); Renderer.renderInfographic($('#infographicCanvas'), state.blocks, opts()); renderCaption(); }, 250);

    state.blocks.forEach((b, i) => {
      const card = document.createElement('div');
      card.className = 'block-card' + (i === state.slide ? ' active' : '');
      card.innerHTML = `
        <div class="block-head">
          <span class="type">${i + 1}. ${Blocks.BLOCK_TYPES[b.type] || b.type}</span>
          <button class="icon-btn" data-act="up" title="Move up" aria-label="Move slide up">↑</button>
          <button class="icon-btn" data-act="down" title="Move down" aria-label="Move slide down">↓</button>
          <button class="icon-btn" data-act="del" title="Delete" aria-label="Delete slide">✕</button>
        </div>`;
      if (b.type !== 'quote') {
        const h = document.createElement('input');
        h.type = 'text'; h.value = b.heading; h.placeholder = 'Heading';
        h.addEventListener('input', () => { b.heading = h.value; rerender(); });
        card.append(h);
      }
      const ta = document.createElement('textarea');
      ta.rows = Math.min(6, Math.max(2, b.items.length + 1));
      ta.value = b.items.join('\n');
      ta.placeholder = b.type === 'stats' ? '58% | of people…' : 'One point per line';
      ta.addEventListener('input', () => { b.items = ta.value.split('\n').map(s => s.trim()).filter(Boolean); rerender(); });
      card.append(ta);

      card.querySelector('.type').addEventListener('click', () => { goTo(i); selectTab('carousel'); });
      card.addEventListener('focusin', () => goTo(i));
      card.querySelector('[data-act=up]').addEventListener('click', () => move(i, -1));
      card.querySelector('[data-act=down]').addEventListener('click', () => move(i, 1));
      card.querySelector('[data-act=del]').addEventListener('click', () => {
        if (state.blocks.length <= 1) return;
        state.blocks.splice(i, 1);
        renderAll();
      });
      root.append(card);
    });
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.blocks.length) return;
    [state.blocks[i], state.blocks[j]] = [state.blocks[j], state.blocks[i]];
    state.slide = j;
    renderAll();
  }

  // ---------- music ----------

  function renderMusic() {
    const m = Music.MOODS[state.mood];
    $('#moodCurrent').innerHTML = `${m.emoji} ${m.label}<small>${m.description}</small>`;
    const scores = state.story.mood.scores;
    const max = Math.max(1, ...Object.values(scores));
    $('#moodBars').innerHTML = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
      `<div class="mood-bar"><span>${Music.MOODS[k].label}</span><span class="bar"><i style="width:${(v / max) * 100}%"></i></span><span>${v}</span></div>`).join('');

    const list = $('#songList');
    list.innerHTML = '';
    state.songs.forEach(s => {
      const li = document.createElement('li');
      li.className = 'song' + (state.song === s ? ' on' : '');
      li.tabIndex = 0;
      li.innerHTML = `<span class="disc">${Music.MOODS[s.mood].emoji}</span>
        <span class="info"><strong></strong><span></span></span>
        <span class="links"><a href="${s.spotify}" target="_blank" rel="noopener">Spotify</a>
        <a href="${s.youtube}" target="_blank" rel="noopener">YouTube</a></span>`;
      li.querySelector('strong').textContent = s.title;
      li.querySelector('.info span').textContent = s.artist + (s.mood !== state.mood ? ` · ${Music.MOODS[s.mood].label}` : '');
      const pick = () => { state.song = s; renderMusic(); renderCaption(); };
      li.addEventListener('click', e => { if (e.target.tagName !== 'A') pick(); });
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      list.append(li);
    });
    $('#postMusic').textContent = state.song ? `♫ ${state.song.title} · ${state.song.artist}` : '♫ Original audio';
    updateTrackInfo();
  }

  function slideshowDuration() { return Math.max(6, state.blocks.length * state.secondsPerSlide); }

  function updateTrackInfo() {
    const st = Music.STYLES[state.mood];
    $('#trackInfo').textContent = `${Music.MOODS[state.mood].label} groove · ${st.bpm} BPM · ${Math.round(slideshowDuration())}s (matches ${state.blocks.length} slides × ${state.secondsPerSlide}s).`;
  }

  let slideshowTimer = null;
  function stopPlayback() {
    player.stop();
    clearInterval(slideshowTimer); slideshowTimer = null;
    $('#previewTrackBtn').textContent = '▶ Preview';
    $('#playSoundBtn').textContent = '▶ Play with soundtrack';
  }

  function toggleSoundtrack() {
    if (player.playing) return stopPlayback();
    player.play(state.mood, slideshowDuration(), stopPlayback);
    $('#previewTrackBtn').textContent = '■ Stop';
  }

  function toggleSlideshow() {
    if (player.playing) return stopPlayback();
    goTo(0);
    player.play(state.mood, slideshowDuration(), stopPlayback);
    $('#playSoundBtn').textContent = '■ Stop';
    slideshowTimer = setInterval(() => {
      if (state.slide >= state.blocks.length - 1) { clearInterval(slideshowTimer); return; }
      goTo(state.slide + 1);
    }, state.secondsPerSlide * 1000);
  }

  async function downloadTrack() {
    const btn = $('#downloadTrackBtn');
    btn.disabled = true;
    try {
      const blob = await Music.renderWav(state.mood, slideshowDuration());
      downloadBlob(blob, `${slug()}-${state.mood}-soundtrack.wav`);
    } finally { btn.disabled = false; }
  }

  // ---------- caption ----------

  function renderCaption() {
    const s = state.story;
    const tags = [...new Set([...s.keywords.slice(0, 6), 'infographic', 'carousel', 'learnoninstagram'])]
      .map(k => '#' + k.replace(/[^a-z0-9]/gi, ''));
    const coverTitle = (state.blocks.find(b => b.type === 'cover') || {}).heading || s.title;
    const lines = [
      `${coverTitle} 📌`,
      '',
      ...s.summary.map(p => `• ${p}`),
      '',
      `Swipe through all ${state.blocks.length} slides ➡️ and save this for later.`,
      state.song ? `🎵 ${state.song.title} — ${state.song.artist}` : '',
      '',
      tags.join(' ')
    ];
    const caption = lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').slice(0, 2200);
    $('#captionOutput').value = caption;
    $('#postCaption').innerHTML = '';
    const b = document.createElement('strong');
    b.textContent = (state.handle || '@yourbrand').replace(/^@/, '') + ' ';
    $('#postCaption').append(b, document.createTextNode(caption));
  }

  // ---------- export ----------

  function downloadInfographic() {
    downloadCanvas($('#infographicCanvas'), `${slug()}-infographic.png`);
  }

  async function downloadZip() {
    const btn = $('#zipBtn');
    btn.disabled = true;
    try {
      const zip = new JSZip();
      for (let i = 0; i < state.slideCanvases.length; i++) {
        zip.file(`${String(i + 1).padStart(2, '0')}-slide.png`, await canvasBlob(state.slideCanvases[i]));
      }
      zip.file('infographic.png', await canvasBlob($('#infographicCanvas')));
      zip.file('caption.txt', $('#captionOutput').value);
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${slug()}-carousel.zip`);
    } finally { btn.disabled = false; }
  }

  async function exportVideo() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      return ($('#videoInfo').textContent = 'Video export needs a browser with MediaRecorder support (Chrome, Edge, Firefox, Safari 14.1+).');
    }
    stopPlayback();
    const btn = $('#videoBtn'), prog = $('#videoProgress');
    btn.disabled = true; prog.hidden = false; prog.value = 0;
    const slides = state.slideCanvases;
    const per = state.secondsPerSlide;
    const fade = 0.4;
    const duration = slides.length * per;

    const canvas = document.createElement('canvas');
    canvas.width = slides[0].width; canvas.height = slides[0].height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(slides[0], 0, 0);

    const actx = new (window.AudioContext || window.webkitAudioContext)();
    await actx.resume();
    const dest = actx.createMediaStreamDestination();
    const start = actx.currentTime + 0.1;
    let source = null;
    if (state.audioFile) {
      try {
        const buf = await actx.decodeAudioData(await state.audioFile.arrayBuffer());
        source = actx.createBufferSource(); source.buffer = buf;
        const g = actx.createGain();
        g.gain.setValueAtTime(1, start + duration - 1.5);
        g.gain.linearRampToValueAtTime(0, start + duration);
        source.connect(g); g.connect(dest); source.start(start); source.stop(start + duration);
      } catch (e) {
        $('#videoInfo').textContent = 'Could not decode your audio file; using the generated soundtrack instead.';
        source = null;
      }
    }
    if (!source) Music.schedule(actx, dest, state.mood, start, duration);

    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(res => (rec.onstop = res));
    rec.start(250);

    const t0 = performance.now();
    await new Promise(resolve => {
      const frame = () => {
        const t = (performance.now() - t0) / 1000;
        prog.value = Math.min(1, t / duration);
        const i = Math.min(slides.length - 1, Math.floor(t / per));
        const into = t - i * per;
        ctx.globalAlpha = 1;
        ctx.drawImage(slides[i], 0, 0);
        if (i < slides.length - 1 && into > per - fade) {
          ctx.globalAlpha = (into - (per - fade)) / fade;
          ctx.drawImage(slides[i + 1], 0, 0);
          ctx.globalAlpha = 1;
        }
        if (t < duration) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
    rec.stop();
    await done;
    actx.close();
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    downloadBlob(new Blob(chunks, { type: mime || 'video/webm' }), `${slug()}-carousel.${ext}`);
    $('#videoInfo').textContent = `Exported a ${Math.round(duration)}s ${ext.toUpperCase()} video${ext === 'webm' ? ' (convert to MP4 if your uploader requires it)' : ''}.`;
    btn.disabled = false; prog.hidden = true;
  }

  // ---------- utilities ----------

  function selectTab(name) {
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.tabpanel').forEach(p => (p.hidden = !state.story || p.dataset.panel !== name));
  }
  function currentTab() { const b = $('.tabs button[aria-selected=true]'); return b && b.dataset.tab; }

  function setStatus(msg, isError) {
    const el = $('#status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  async function fontsReady() {
    if (!document.fonts) return;
    try {
      await Promise.race([
        Promise.all(['800 40px Poppins', '600 40px Poppins', '400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter'].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 2500))
      ]);
    } catch { /* fall back to system fonts */ }
  }

  function slug() {
    return (state.story ? state.story.title : 'carousel').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'carousel';
  }
  const canvasBlob = c => new Promise(res => c.toBlob(res, 'image/png'));
  async function downloadCanvas(c, name) { downloadBlob(await canvasBlob(c), name); }
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function flash(btn, text) { const o = btn.textContent; btn.textContent = text; setTimeout(() => (btn.textContent = o), 1200); }

  init();
})();
