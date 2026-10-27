/*
 * Document analysis: turns raw text into a structured "story" that the
 * infographic and carousel renderers consume. Pure functions, no DOM, so it
 * runs in the browser and in Node (for tests).
 */
(function (root) {
  'use strict';

  const STOPWORDS = new Set((
    'a about above after again against all also am an and any are as at be because been before being below between both but by ' +
    'can could did do does doing down during each few for from further had has have having he her here hers herself him himself his ' +
    'how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out ' +
    'over own same she should so some such than that the their theirs them themselves then there these they this those through to too ' +
    'under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves ' +
    'may might must shall us one two three many much well also however therefore thus within without across per via upon among ' +
    'new use used using make made get got like way ways need needs including include includes based e.g i.e etc'
  ).split(/\s+/));

  // Mood lexicon used to pick the soundtrack.
  const MOOD_LEXICON = {
    inspiring: ['growth', 'future', 'dream', 'achieve', 'success', 'inspire', 'vision', 'opportunity', 'empower', 'transform', 'journey', 'goal', 'potential', 'innovation', 'innovative', 'possible', 'hope', 'change', 'impact', 'lead', 'leadership', 'mission', 'purpose', 'together', 'build'],
    corporate: ['revenue', 'market', 'business', 'strategy', 'quarter', 'profit', 'customer', 'customers', 'sales', 'investment', 'stakeholder', 'roi', 'kpi', 'company', 'enterprise', 'financial', 'budget', 'performance', 'report', 'management', 'operations', 'industry', 'brand', 'clients'],
    tech: ['data', 'ai', 'software', 'digital', 'technology', 'algorithm', 'cloud', 'platform', 'app', 'automation', 'machine', 'learning', 'cyber', 'network', 'code', 'system', 'systems', 'model', 'models', 'device', 'internet', 'online', 'tools'],
    calm: ['health', 'wellness', 'mindful', 'mindfulness', 'sleep', 'relax', 'balance', 'nature', 'calm', 'care', 'peace', 'meditation', 'stress', 'breath', 'breathing', 'gentle', 'rest', 'self', 'mental', 'wellbeing', 'yoga', 'quiet'],
    energetic: ['fitness', 'sport', 'sports', 'workout', 'fast', 'power', 'energy', 'win', 'challenge', 'race', 'speed', 'action', 'exercise', 'training', 'strong', 'boost', 'launch', 'exciting', 'run', 'team', 'competition'],
    serious: ['risk', 'crisis', 'climate', 'warning', 'danger', 'threat', 'decline', 'loss', 'death', 'disease', 'poverty', 'emergency', 'problem', 'critical', 'urgent', 'violence', 'pollution', 'security', 'challenge', 'fail', 'failure', 'damage'],
    playful: ['fun', 'game', 'games', 'kids', 'children', 'happy', 'play', 'creative', 'colorful', 'food', 'travel', 'party', 'joy', 'friends', 'pet', 'pets', 'recipe', 'holiday', 'summer', 'adventure', 'easy', 'tips']
  };

  function normalize(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/ /g, ' ')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[ \t]+/g, ' ')
      .replace(/-\n(?=[a-z])/g, '')   // re-join words hyphenated across lines (PDFs)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function tokenize(text) {
    return (text.toLowerCase().match(/[a-z][a-z'\-]+/g) || [])
      .map(w => w.replace(/'s$/, ''))
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  function splitSentences(text) {
    const protectedText = text
      .replace(/\b(e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|Inc|Ltd|Co|No|Fig|approx)\./gi, m => m.replace('.', '\u0001'))
      .replace(/(\d)\.(\d)/g, '$1\u0001$2');
    return protectedText
      .split(/(?<=[.!?])\s+(?=["'(\[]?[A-Z0-9])|\n+/)
      .map(s => s.replace(/\u0001/g, '.').trim())
      .filter(s => s.length > 0);
  }

  function isHeadingLine(line, next) {
    const t = line.trim();
    if (!t) return false;
    if (/^#{1,6}\s+/.test(t)) return true;
    if (t.length > 70 || /[.,;:!?]$/.test(t) && !/:$/.test(t)) return false;
    if (/^[-*•\d]+[.)]?\s/.test(t) && !/^\d+(\.\d+)*\.?\s+[A-Z]/.test(t)) return false;
    const words = t.split(/\s+/);
    if (words.length > 10) return false;
    const capitalised = words.filter(w => /^[A-Z0-9]/.test(w)).length / words.length;
    const allCaps = t === t.toUpperCase() && /[A-Z]/.test(t);
    // A heading is followed by body text and looks title-like.
    return (allCaps || capitalised >= 0.6 || /:$/.test(t) || /^\d+(\.\d+)*\.?\s+[A-Z]/.test(t)) && (next === undefined || next.trim().length > 0);
  }

  function cleanHeading(t) {
    return t.trim().replace(/^#{1,6}\s+/, '').replace(/^\d+(\.\d+)*\.?\s+/, '').replace(/:$/, '').trim();
  }

  function toTitleCase(s) {
    if (s !== s.toUpperCase()) return s;
    return s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase());
  }

  /** Split the document into {heading, text, bullets} sections. */
  function parseSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let current = { heading: null, lines: [], bullets: [] };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();
      if (!t) { current.lines.push(''); continue; }
      if (isHeadingLine(t, lines[i + 1])) {
        if (current.heading || current.lines.some(l => l.trim())) sections.push(current);
        current = { heading: toTitleCase(cleanHeading(t)), lines: [], bullets: [] };
        continue;
      }
      const bullet = t.match(/^(?:[-*•▪◦–]|\d+[.)])\s+(.*)$/);
      if (bullet) current.bullets.push(bullet[1].trim());
      current.lines.push(bullet ? bullet[1] + (/[.!?]$/.test(bullet[1]) ? '' : '.') : t);
    }
    if (current.heading || current.lines.some(l => l.trim())) sections.push(current);
    return sections.map(s => ({
      heading: s.heading,
      bullets: s.bullets,
      text: s.lines.join('\n').replace(/([^\n.!?:])\n(?=[a-z])/g, '$1 ').trim()
    }));
  }

  function wordFrequencies(text) {
    const freq = new Map();
    for (const w of tokenize(text)) freq.set(w, (freq.get(w) || 0) + 1);
    const max = Math.max(1, ...freq.values());
    for (const [k, v] of freq) freq.set(k, v / max);
    return freq;
  }

  function scoreSentence(sentence, freq, index, total) {
    const words = tokenize(sentence);
    if (!words.length) return 0;
    const wc = sentence.split(/\s+/).length;
    let score = words.reduce((s, w) => s + (freq.get(w) || 0), 0) / Math.sqrt(words.length);
    if (/\d/.test(sentence)) score *= 1.25;
    if (index < total * 0.15) score *= 1.2;            // lead sentences carry the thesis
    if (wc < 6 || wc > 45) score *= 0.5;                // too short / too long for a slide
    if (/^(this|these|it|they|that)\b/i.test(sentence)) score *= 0.8; // dangling references
    return score;
  }

  /** Shorten a sentence so it fits on a slide without losing its meaning. */
  function condense(sentence, maxWords = 24) {
    let s = sentence.trim()
      .replace(/^(however|moreover|furthermore|additionally|in addition|also|overall|in fact|importantly|notably|as a result|in conclusion|finally|first|second|third|lastly),?\s+/i, '')
      .replace(/\s*\([^)]{0,80}\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/\s{2,}/g, ' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    const words = s.split(/\s+/);
    if (words.length > maxWords) {
      // Prefer cutting at a clause boundary.
      const head = words.slice(0, maxWords).join(' ');
      const cut = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(' — '));
      s = (cut > head.length * 0.5 ? head.slice(0, cut) : head.replace(/[,;:]?\s+\S*$/, '')) + '…';
    }
    return s.replace(/[.;:,]+$/, m => (m.startsWith('.') ? '.' : ''));
  }

  const STAT_RE = /(?:[$€£¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|bn|b|million|billion|trillion|thousand)?|\d[\d,]*(?:\.\d+)?\s?(?:%|percent|x\b|times\b|million\b|billion\b|trillion\b|thousand\b|k\b|m\b|bn\b)|\b\d+(?:\.\d+)?\s?(?:in|out of)\s?\d+\b|\b\d+(?:\.\d+)?\s(?:minutes|hours|days|weeks|months|years)\b|\b\d{1,3}(?:,\d{3})+\b)/gi;

  function formatStatValue(raw) {
    return raw.trim()
      .replace(/\s?percent$/i, '%')
      .replace(/\s?(million)$/i, 'M')
      .replace(/\s?(billion|bn)$/i, 'B')
      .replace(/\s?(trillion)$/i, 'T')
      .replace(/\s?(thousand)$/i, 'K')
      .replace(/\s?times$/i, '×')
      .replace(/(\d)\s?x$/i, '$1×')
      .replace(/\s+/g, ' ');
  }

  /** Pull "big number" facts out of the text: {value, label, numeric, isPercent}. */
  function extractStats(sentences, limit = 6) {
    const stats = [];
    const seen = new Set();
    for (const sentence of sentences) {
      const matches = sentence.match(STAT_RE);
      if (!matches) continue;
      for (const m of matches.slice(0, 1)) {
        const value = formatStatValue(m);
        if (seen.has(value) || /^(19|20)\d\d$/.test(value)) continue;
        seen.add(value);
        // Keep the whole (condensed) sentence as the label: removing the number
        // from it tends to leave ungrammatical fragments.
        const label = condense(sentence, 18);
        const numeric = parseFloat(m.replace(/[^\d.]/g, ''));
        stats.push({ value, label, source: sentence, numeric: isFinite(numeric) ? numeric : null, isPercent: /%|percent/i.test(m) });
        if (stats.length >= limit) return stats;
      }
    }
    return stats;
  }

  function detectMood(text) {
    const words = tokenize(text);
    const scores = {};
    for (const mood of Object.keys(MOOD_LEXICON)) scores[mood] = 0;
    const index = new Map();
    for (const [mood, list] of Object.entries(MOOD_LEXICON)) for (const w of list) {
      if (!index.has(w)) index.set(w, []);
      index.get(w).push(mood);
    }
    for (const w of words) for (const mood of index.get(w) || []) scores[mood]++;
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = ranked[0][1] > 0 ? ranked[0][0] : 'inspiring';
    return { primary, scores };
  }

  function topKeywords(freq, n = 8) {
    return [...freq.entries()]
      .filter(([w]) => w.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([w]) => w);
  }

  /**
   * Main entry point. Returns:
   * { title, subtitle, summary, keyPoints[], stats[], sections[{heading, points[]}],
   *   quote, keywords[], mood{primary,scores}, readingMinutes, wordCount }
   */
  function analyzeDocument(rawText, opts = {}) {
    const text = normalize(rawText);
    if (!text) throw new Error('The document appears to be empty.');
    const sections = parseSections(text);
    const bodyText = sections.map(s => s.text).join('\n');
    const sentences = splitSentences(bodyText).filter(s => /[a-z]/i.test(s) && s.split(/\s+/).length >= 4);
    const freq = wordFrequencies(bodyText);

    const scored = sentences.map((s, i) => ({ s, i, score: scoreSentence(s, freq, i, sentences.length) }));
    const ranked = [...scored].sort((a, b) => b.score - a.score);

    // Title: explicit option, first heading, or first short line.
    const firstLine = text.split('\n')[0].trim();
    let title = opts.title || (sections[0] && sections[0].heading) ||
      (firstLine.split(/\s+/).length <= 12 ? firstLine.replace(/[.:]$/, '') : null);
    if (!title) title = topKeywords(freq, 3).map(w => w[0].toUpperCase() + w.slice(1)).join(' · ');
    title = cleanHeading(title);

    const stats = extractStats(ranked.map(r => r.s), opts.maxStats || 6);
    const statSentences = new Set(stats.map(st => st.source));

    // Key points: top-ranked sentences, kept in document order, avoiding duplicates.
    const keyPoints = [];
    const usedTokens = [];
    for (const r of ranked) {
      if (keyPoints.length >= (opts.maxPoints || 8)) break;
      const toks = new Set(tokenize(r.s));
      const overlap = usedTokens.some(u => [...toks].filter(t => u.has(t)).length / Math.max(1, Math.min(toks.size, u.size)) > 0.6);
      if (overlap || r.s === title) continue;
      usedTokens.push(toks);
      keyPoints.push({ text: condense(r.s), order: r.i });
    }
    keyPoints.sort((a, b) => a.order - b.order);

    // Section summaries (only when the document actually has structure).
    const sectionSummaries = sections
      .filter(s => s.heading && s.text && s.heading !== title)
      .map(s => {
        let points;
        if (s.bullets.length) points = s.bullets.slice(0, 4).map(b => condense(b, 16));
        else {
          const ss = splitSentences(s.text).filter(x => x.split(/\s+/).length >= 4);
          points = ss.map((x, i) => ({ x, score: scoreSentence(x, freq, i, ss.length) }))
            .sort((a, b) => b.score - a.score).slice(0, 3)
            .sort((a, b) => ss.indexOf(a.x) - ss.indexOf(b.x))
            .map(o => condense(o.x, 20));
        }
        return { heading: s.heading, points };
      })
      .filter(s => s.points.length);

    // Quote: a punchy, high-scoring sentence of moderate length.
    const quoteCandidate = ranked.find(r => {
      const wc = r.s.split(/\s+/).length;
      return wc >= 8 && wc <= 28 && !statSentences.has(r.s);
    }) || ranked[0];
    const quote = quoteCandidate ? condense(quoteCandidate.s, 28) : '';

    const lead = scored.slice(0, 3).sort((a, b) => b.score - a.score)[0];
    const subtitle = lead ? condense(lead.s, 18) : '';
    const wordCount = text.split(/\s+/).length;

    return {
      title,
      subtitle,
      summary: keyPoints.slice(0, 3).map(k => k.text),
      keyPoints: keyPoints.map(k => k.text),
      stats,
      sections: sectionSummaries.slice(0, 8),
      quote,
      keywords: topKeywords(freq),
      mood: detectMood(text),
      wordCount,
      readingMinutes: Math.max(1, Math.round(wordCount / 230))
    };
  }

  const api = { analyzeDocument, normalize, splitSentences, parseSections, extractStats, detectMood, condense, MOOD_LEXICON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analyzer = api;
})(typeof window !== 'undefined' ? window : globalThis);
