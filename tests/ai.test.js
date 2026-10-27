// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const AI = require('../js/ai.js');
const A = require('../js/analyze.js');
const B = require('../js/blocks.js');
const { SAMPLE_DOCUMENT } = require('../js/sample.js');

test('drops the reference list and caps length', () => {
  const body = Array.from({ length: 30 }, (_, i) => `Body line ${i} about the findings.`).join('\n');
  const t = AI.prepareText(`${body}\nReferences\n1. Smith J. 2020. Some paper.`);
  assert.ok(!/Smith J/.test(t));
  assert.ok(/Body line 29/.test(t));
  assert.ok(AI.prepareText('x'.repeat(100000)).length < 61000);
});

test('keeps an early "References" heading (not the reference list)', () => {
  const t = AI.prepareText('Intro\nReferences\nThis section explains how to cite sources properly in the essay.\n' + 'More text.\n'.repeat(20));
  assert.ok(/cite sources/.test(t));
});

test('merges AI output into a story that builds valid blocks', () => {
  const base = A.analyzeDocument(SAMPLE_DOCUMENT);
  const story = AI.toStory({
    title: 'Remote Work Is Here to Stay',
    subtitle: 'What 2,400 employees taught us about working from anywhere.',
    key_points: ['Most firms now offer hybrid work.', 'Productivity held steady or improved.', 'Clear routines matter most.'],
    stats: [{ value: '58%', label: 'of employees work hybrid' }, { value: '', label: 'dropped' }],
    sections: [{ heading: 'Adoption', points: ['Hybrid is the new default.'] }, { heading: '', points: ['no heading'] }],
    quote: 'Flexibility is now an expectation.',
    takeaway: 'Set clear team routines before going hybrid.',
    keywords: ['#Remote', 'hybrid'],
    mood: 'corporate'
  }, base);
  assert.strictEqual(story.title, 'Remote Work Is Here to Stay');
  assert.strictEqual(story.stats.length, 1);
  assert.strictEqual(story.sections.length, 1);
  assert.strictEqual(story.mood.primary, 'corporate');
  assert.deepStrictEqual(story.keywords, ['remote', 'hybrid']);
  assert.strictEqual(story.wordCount, base.wordCount);
  const blocks = B.buildBlocks(story, { maxSlides: 10 });
  assert.strictEqual(blocks[0].heading, 'Remote Work Is Here to Stay');
  assert.strictEqual(blocks[blocks.length - 1].items[0], 'Set clear team routines before going hybrid.');
});

test('falls back to base values on an invalid mood', () => {
  const base = A.analyzeDocument(SAMPLE_DOCUMENT);
  const story = AI.toStory({ title: 'T', subtitle: 'S', key_points: [], stats: [], sections: [], takeaway: 'X', mood: 'weird' }, base);
  assert.strictEqual(story.mood.primary, base.mood.primary);
  assert.deepStrictEqual(story.sections, base.sections);
});

test('calls the Claude API with Haiku and forced tool output', async () => {
  let sent;
  global.fetch = async (url, init) => {
    sent = { url, headers: init.headers, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({
      content: [{ type: 'tool_use', name: 'make_carousel', input: { title: 'Hi' } }],
      usage: { input_tokens: 100, output_tokens: 50 }
    }) };
  };
  const { result, usage } = await AI.analyze('Some document text here.', 'sk-test');
  assert.strictEqual(sent.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(sent.body.model, 'claude-haiku-5-5');
  assert.strictEqual(sent.body.tool_choice.name, 'make_carousel');
  assert.strictEqual(sent.headers['x-api-key'], 'sk-test');
  assert.strictEqual(result.title, 'Hi');
  assert.strictEqual(usage.output_tokens, 50);
});

test('reports a rejected key clearly', async () => {
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
  await assert.rejects(AI.analyze('text', 'bad'), /rejected/);
});
