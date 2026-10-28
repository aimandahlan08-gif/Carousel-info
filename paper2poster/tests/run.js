// Regression tests for the rule-based pipeline. Run: node tests/run.js
// Each check is scored, so a fix for one paper type that breaks another shows up straight away.
const path = require('path'), fs = require('fs');
const pdfjs = require('../node_modules/pdfjs-dist/legacy/build/pdf.js');
const P = require('../core.js');
const FX = path.join(__dirname, 'fixtures');
const results = [];
const check = (group, name, ok, got) => results.push({ group, name, ok: !!ok, got });
async function model(file) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(FX, file))), isEvalSupported: false }).promise;
  return P.buildModel(await P.extractLines(pdf, { maxPages: 300 }), {});
}
const has = (arr, re) => (arr || []).some(x => re.test(typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  // research paper
  let m = await model('test.pdf');
  check('research', 'title read', /Smartphone Bedtime Use/.test(m.title), m.title);
  check('research', 'read as research', m.mode === 'research', m.mode);
  check('research', 'sections found (≥5)', Object.keys(m.sections).length >= 5, Object.keys(m.sections).join(','));
  check('research', 'study context has N = 612', /N = 612/.test(P.studyContext(m)), P.studyContext(m));
  let t = P.buildTalk(m, { minutes: 10 });
  check('research', 'talk has 9+ slides', t.slides.length >= 9, t.slides.length);
  check('research', 'key result has a chart', t.slides.some(s => s.title === 'The key result' && s.chart), (t.slides.find(s => s.title === 'The key result') || {}).chart);
  const fc = P.factCheck(m, t.slides.flatMap(s => [s.body, ...(s.bullets || [])]).filter(Boolean).map(text => ({ text })));
  check('research', 'talk text traced to the paper (no unknown numbers)', fc.every(r => r.status !== 'number'), fc.filter(r => r.status === 'number').map(r => r.missingNums));
  check('research', 'fact check finds pages', fc.some(r => r.source && r.source.page), '');
  // systematic review
  m = await model('sr.pdf');
  check('systematic review', 'detected as systematic', m.reviewKind === 'systematic', m.reviewKind);
  check('systematic review', 'PRISMA included = 7', m.prisma && m.prisma.included === 7, m.prisma);
  t = P.buildTalk(m, { minutes: 10 });
  check('systematic review', 'talk has PRISMA slide', t.slides.some(s => s.kind === 'prisma'), '');
  check('systematic review', 'talk has evidence-quality slide', t.slides.some(s => /Quality of the evidence/.test(s.title)), '');
  // narrative reviews
  const TOPICS = { enta: 5, entb: 5, entc: 2, entd: 3 }; // number of topic headings in each test paper
  for (const f of Object.keys(TOPICS)) {
    m = await model(f + '.pdf');
    check('narrative review', `${f}: read as review`, m.mode === 'review', m.mode);
    check('narrative review', `${f}: all ${TOPICS[f]} topics found`, (m.topics || []).length === TOPICS[f], (m.topics || []).length);
  }
  // thesis
  m = await model('thesis.pdf');
  check('thesis', 'headings captured', has((m.parts || []).map(p => p.heading), /Problem Statement/), (m.parts || []).map(p => p.heading).join(' | '));
  check('thesis', 'sample is main study (412), not pilot (40)', /N = 412/.test(P.studyContext(m)), P.studyContext(m));
  for (const type of ['proposal', 'thesis']) {
    t = P.buildTalk(m, { type, minutes: 20 });
    const by = title => t.slides.find(s => s.title === title) || {};
    check(type, 'outline slide has all parts', (by('Presentation Outline').items || []).length === P.OUTLINES[type].length, (by('Presentation Outline').items || []).length);
    check(type, '3 research questions', (by('Research Questions').items || []).length === 3, by('Research Questions').items);
    check(type, '3 research objectives', (by('Research Objectives').items || []).length === 3, by('Research Objectives').items);
    const fw = by('Research Framework').fw || {};
    check(type, 'framework variables', fw.iv && fw.iv[0] === 'Anthropomorphism' && /well-being/i.test(fw.dv && fw.dv[0]) && /self-disclosure/i.test(fw.med && fw.med[0]) && /loneliness/i.test(fw.mod && fw.mod[0]), fw);
    check(type, 'RQ slide found under its heading', by('Research Questions').conf && by('Research Questions').conf.how === 'heading', by('Research Questions').conf);
    check(type, 'optional slides present and off', t.slides.filter(s => s.optional).every(s => s.hidden) && t.slides.some(s => s.optional), t.slides.filter(s => s.optional).length);
  }
  t = P.buildTalk(m, { type: 'thesis', minutes: 30 });
  const fq = (t.slides.find(s => s.title === 'Findings by research question') || {}).items || [];
  check('thesis', 'RQ1 answered by the level result', /mean level/i.test((fq[0] || {}).text || ''), fq[0]);
  check('thesis', 'RQ3 answered by the mediation result', /indirect effect/i.test((fq[2] || {}).text || ''), fq[2]);
  // unit rules
  check('rules', 'objective → question (whether…predicts)', P.toQuestion('to examine whether the amount of smartphone use predicts sleep quality') === 'Does the amount of smartphone use predict sleep quality?', P.toQuestion('to examine whether the amount of smartphone use predicts sleep quality'));
  check('rules', 'objective → question (relationship)', P.toQuestion('to examine the relationship between X and Y') === 'What is the relationship between X and Y?', '');
  check('rules', 'objectives split', P.objectivesIn('(i) to identify A in B; (ii) to examine C and D; and (iii) to determine E of F.').length === 3, P.objectivesIn('(i) to identify A in B; (ii) to examine C and D; and (iii) to determine E of F.'));
  check('rules', 'chart: from…to comparison', (P.chartFor('from 6.1 among non-cyclists to 4.4 among daily cyclists') || {}).kind === 'compare', '');
  check('rules', 'chart: effect size', (P.chartFor('correlated with loneliness (r = −.21, p < .001)', 'r = −.21') || {}).kind === 'effect', '');
  // report
  const groups = [...new Set(results.map(r => r.group))];
  let pass = 0;
  for (const g of groups) {
    const rs = results.filter(r => r.group === g), ok = rs.filter(r => r.ok).length; pass += ok;
    console.log(`\n${g}: ${ok}/${rs.length}`);
    rs.forEach(r => console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  → got: ' + JSON.stringify(r.got).slice(0, 200)}`));
  }
  console.log(`\nScore: ${pass}/${results.length} (${Math.round(pass / results.length * 100)}%)`);
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
