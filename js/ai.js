/*
 * Optional AI mode: sends the document text to the Claude API (Haiku, the cheapest model)
 * and gets back a properly understood story — real title, key messages, meaningful numbers,
 * one slide per main idea and a takeaway.
 *
 * Uses the person's own API key, stored only in this browser (localStorage).
 * The rule-based Analyzer is still used for word count, keywords and as a fallback.
 */
(function (root) {
  'use strict';

  const MODEL = 'claude-haiku-5-5';
  const KEY_STORAGE = 'carouselinfo.anthropicKey';
  const MAX_CHARS = 60000; // ~15k tokens: keeps cost tiny and well under Haiku's cheaper price tier
  const MOOD_KEYS = ['inspiring', 'corporate', 'tech', 'calm', 'energetic', 'serious', 'playful'];

  function getKey() {
    try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
  }
  function setKey(key) {
    try { key ? localStorage.setItem(KEY_STORAGE, key) : localStorage.removeItem(KEY_STORAGE); } catch { /* storage blocked */ }
  }

  /** Drop the reference list (often a third of a paper) and cap the length. */
  function prepareText(text) {
    let t = String(text || '').replace(/\r/g, '').trim();
    const lines = t.split('\n');
    const refIdx = lines.findIndex((l, i) =>
      i > lines.length * 0.4 && /^\s*(\d+\.?\s*)?(references|bibliography|works cited|literature cited|reference list)\s*:?\s*$/i.test(l));
    if (refIdx > 0) t = lines.slice(0, refIdx).join('\n');
    if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS) + '\n[…document truncated…]';
    return t;
  }

  const TOOL = {
    name: 'make_carousel',
    description: 'Return the carousel content for the document.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, complete, catchy title (max 8 words). Never cut off mid-phrase.' },
        subtitle: { type: 'string', description: 'One sentence (max 20 words) saying what the reader will learn.' },
        key_points: { type: 'array', items: { type: 'string' }, description: 'The 3 most important messages, each max 18 words, plain language.' },
        stats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string', description: 'The number as shown, e.g. "58%", "15 min", "2.3×".' },
              label: { type: 'string', description: 'What the number means, max 12 words, understandable on its own.' }
            },
            required: ['value', 'label']
          },
          description: 'Up to 3 numbers that genuinely matter to the message. Empty array if none are meaningful.'
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string', description: 'Short slide heading, max 6 words.' },
              points: { type: 'array', items: { type: 'string' }, description: '2-3 bullet points, each max 16 words, complete sentences.' }
            },
            required: ['heading', 'points']
          },
          description: 'One slide per main idea, in a logical teaching order (4-7 slides).'
        },
        quote: { type: 'string', description: 'One memorable line (max 25 words) faithful to the document.' },
        takeaway: { type: 'string', description: 'The single thing the reader should remember or do (max 25 words).' },
        keywords: { type: 'array', items: { type: 'string' }, description: '5-6 single-word hashtags, lowercase, no #.' },
        mood: { type: 'string', enum: MOOD_KEYS, description: 'Mood that best fits the document, for the soundtrack.' }
      },
      required: ['title', 'subtitle', 'key_points', 'stats', 'sections', 'takeaway', 'mood']
    }
  };

  const SYSTEM = 'You turn documents (research papers, clinical notes, reports, lecture notes) into clear, accurate ' +
    'Instagram carousel content for a general but educated audience. Read and understand the whole document first, ' +
    'then explain it: rewrite in plain language rather than copying sentences, keep every claim faithful to the source, ' +
    'never invent facts or numbers, keep each bullet self-contained, and avoid fragments such as sentences starting ' +
    'with "Therefore" or "It". Ignore references, author lists, page headers and footers.';

  async function analyze(text, key, opts = {}) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{
          role: 'user',
          content: `Make carousel content for this document${opts.maxSlides ? ` (about ${opts.maxSlides} slides in total)` : ''}.\n\n<document>\n${prepareText(text)}\n</document>`
        }]
      }),
      signal: opts.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && data.error.message) || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error('API key was rejected. Check it in the AI settings.');
      if (res.status === 402 || /credit/i.test(msg)) throw new Error('Your API account has no credit left.');
      throw new Error(`AI request failed: ${msg}`);
    }
    const call = (data.content || []).find(c => c.type === 'tool_use');
    if (!call || !call.input) throw new Error('AI returned no content.');
    return { result: call.input, usage: data.usage || null };
  }

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const list = a => (Array.isArray(a) ? a.map(clean).filter(Boolean) : []);

  /** Merge the AI result into the story shape the rest of the app expects. */
  function toStory(ai, base) {
    const keyPoints = list(ai.key_points);
    const sections = (Array.isArray(ai.sections) ? ai.sections : [])
      .map(s => ({ heading: clean(s && s.heading), points: list(s && s.points) }))
      .filter(s => s.heading && s.points.length);
    const stats = (Array.isArray(ai.stats) ? ai.stats : [])
      .map(s => ({ value: clean(s && s.value), label: clean(s && s.label) }))
      .filter(s => s.value && s.label)
      .slice(0, 6);
    const keywords = list(ai.keywords).map(k => k.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const mood = MOOD_KEYS.includes(ai.mood) ? ai.mood : base.mood.primary;
    return {
      ...base,
      title: clean(ai.title) || base.title,
      subtitle: clean(ai.subtitle) || base.subtitle,
      summary: keyPoints.slice(0, 3),
      keyPoints: keyPoints.length ? keyPoints : base.keyPoints,
      stats,
      sections: sections.length ? sections : base.sections,
      quote: clean(ai.quote),
      takeaway: clean(ai.takeaway),
      keywords: keywords.length ? keywords : base.keywords,
      mood: { ...base.mood, primary: mood },
      aiGenerated: true
    };
  }

  const api = { MODEL, getKey, setKey, prepareText, analyze, toStory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AI = api;
})(typeof window !== 'undefined' ? window : globalThis);
