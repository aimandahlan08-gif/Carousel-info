/*
 * Turns an analysed story into an ordered list of content blocks.
 * The same blocks are stacked into the infographic and split into carousel slides,
 * so editing a block updates both.
 *
 * Block shape: { id, type, heading, items[] }
 *   cover   – heading = title, items = [subtitle]
 *   summary – items = key points
 *   stats   – items = ["value | label", ...]
 *   section – items = bullet points
 *   quote   – items = [quote]
 *   cta     – heading = takeaway title, items = [takeaway, call to action]
 */
(function (root) {
  'use strict';

  let nextId = 1;
  const block = (type, heading, items) => ({ id: 'b' + nextId++, type, heading, items: items.filter(Boolean) });

  function buildBlocks(story, opts = {}) {
    const maxSlides = Math.max(3, Math.min(20, opts.maxSlides || 10));
    const blocks = [];
    blocks.push(block('cover', story.title, [story.subtitle]));

    if (story.summary.length) blocks.push(block('summary', 'At a glance', story.summary));

    const stats = story.stats.map(s => `${s.value} | ${s.label}`);
    for (let i = 0; i < Math.min(stats.length, 6); i += 3) {
      blocks.push(block('stats', i === 0 ? 'By the numbers' : 'More numbers', stats.slice(i, i + 3)));
    }

    const sections = story.sections.length
      ? story.sections
      : chunk(story.keyPoints.slice(story.summary.length), 3).map((points, i) => ({ heading: `Key insight ${i + 1}`, points }));
    for (const s of sections) blocks.push(block('section', s.heading, s.points));

    if (story.quote) blocks.push(block('quote', '', [story.quote]));

    const takeaway = story.takeaway || (story.sections.length
      ? story.sections[story.sections.length - 1].points[0]
      : story.keyPoints[story.keyPoints.length - 1]);
    blocks.push(block('cta', 'Key takeaway', [takeaway || story.subtitle, 'Save this post & share it with someone who needs it']));

    // Respect the slide budget: keep cover + cta, trim from the middle (latest sections first).
    while (blocks.length > maxSlides) {
      const removable = blocks.map((b, i) => [b, i]).filter(([b]) => b.type === 'quote' || b.type === 'section' || (b.type === 'stats' && b.heading !== 'By the numbers'));
      const victim = removable.find(([b]) => b.type === 'quote') || removable.find(([b]) => b.type === 'stats') || removable[removable.length - 1];
      if (!victim) break;
      blocks.splice(victim[1], 1);
    }
    return blocks;
  }

  function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function parseStat(line) {
    const [value, ...rest] = line.split('|');
    return { value: value.trim(), label: rest.join('|').trim() };
  }

  const BLOCK_TYPES = {
    cover: 'Cover',
    summary: 'At a glance',
    stats: 'Big numbers',
    section: 'Section',
    quote: 'Quote',
    cta: 'Takeaway / CTA'
  };

  const api = { buildBlocks, parseStat, BLOCK_TYPES, newBlock: block };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Blocks = api;
})(typeof window !== 'undefined' ? window : globalThis);
