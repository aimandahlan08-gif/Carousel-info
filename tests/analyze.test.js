// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const A = require('../js/analyze.js');
const B = require('../js/blocks.js');
const { SAMPLE_DOCUMENT } = require('../js/sample.js');

test('extracts title, sections and stats from the sample', () => {
  const s = A.analyzeDocument(SAMPLE_DOCUMENT);
  assert.strictEqual(s.title, 'The Future of Remote Work');
  assert.deepStrictEqual(s.sections.map(x => x.heading), [
    'Adoption Is Here to Stay', 'Productivity and Wellbeing', 'What Great Teams Do Differently', 'The Cost Equation', 'Looking Ahead'
  ]);
  const values = s.stats.map(x => x.value);
  for (const v of ['58%', '41%', '$11,000', '2.3×']) assert.ok(values.includes(v), `missing stat ${v}`);
  assert.ok(s.keyPoints.length >= 3);
  assert.ok(s.mood.primary in A.MOOD_LEXICON);
});

test('handles plain unstructured text', () => {
  const text = 'Sleep matters for health. Adults who sleep seven hours report 30% less stress. ' +
    'A calm bedtime routine helps the mind rest. Reducing screens an hour before bed improves sleep quality. ' +
    'Mindful breathing lowers heart rate and helps relaxation.';
  const s = A.analyzeDocument(text);
  assert.strictEqual(s.mood.primary, 'calm');
  assert.ok(s.stats.some(x => x.value === '30%'));
  const blocks = B.buildBlocks(s, { maxSlides: 10 });
  assert.strictEqual(blocks[0].type, 'cover');
  assert.strictEqual(blocks[blocks.length - 1].type, 'cta');
});

test('respects the slide budget', () => {
  const s = A.analyzeDocument(SAMPLE_DOCUMENT);
  for (const max of [4, 6, 10]) {
    const blocks = B.buildBlocks(s, { maxSlides: max });
    assert.ok(blocks.length <= max, `${blocks.length} > ${max}`);
    assert.strictEqual(blocks[0].type, 'cover');
    assert.strictEqual(blocks[blocks.length - 1].type, 'cta');
  }
});

test('rejects empty documents', () => {
  assert.throws(() => A.analyzeDocument('   '), /empty/);
});

test('condense shortens long sentences', () => {
  const long = Array.from({ length: 40 }, (_, i) => 'word' + i).join(' ') + '.';
  assert.ok(A.condense(long, 20).split(/\s+/).length <= 20);
});
