# Paper2Poster

Turns a full-text academic PDF into (1) an academic conference poster and (2) an Instagram carousel.
The owner is a beginner coder and a psychology PhD researcher. Explain changes in plain words.

## Hard rules
- The core pipeline is rule-based (pdf.js text positions, keyword dictionaries, regex, TextRank, YAKE) and must
  work fully with no AI.
- AI is an OPTIONAL layer on top, behind buttons the user clicks ("Rewrite simply", "Explain the terms",
  "Suggest headlines", "Write the post caption", "Ask about this paper"). If AI is unavailable, hide those
  buttons; never block the rule-based flow.
- AI providers, in order of preference: (1) Chrome built-in AI (Summarizer/Prompt API, on-device, free, private);
  (2) an opt-in free API (e.g. Gemini free tier) called through a serverless function so the key is never in
  the browser. Warn users that free-tier providers may use content to improve their products.
- AI output must use only facts from the paper. Check every number AI returns against the extracted text and
  keep the original if it is not found. Every AI change must be previewed ("Use this" / "Discard") and undoable.
- Runs in the browser. With AI off, papers never leave the user's device. No tracking.
- Free, open-source libraries only.

## Stack (what the code really uses)
- Plain JavaScript, no framework. One self-contained HTML page is built from four source files:
  - core.js: PDF reading and the rule-based pipeline (sections, TextRank, statistics, talk/defence decks, fact check). Pure functions, also runs in Node and in a Web Worker.
  - render.js: canvas drawing for carousel, posters, talk slides, charts, and the PowerPoint builder.
  - app.js: the user interface, editing, storage (IndexedDB with a localStorage fallback), exports, optional AI.
  - app.html: markup and CSS, with placeholders the build fills in.
- Build: `python3 build.py` writes paper2poster.html (the published file), then copy it to index.html. Never edit either by hand.
- Libraries load from pinned CDN versions only when needed: pdf.js 3.11.174, JSZip, jsPDF, mp4-muxer, PptxGenJS 3.12.0, tesseract.js 5.1.1 (OCR for scanned PDFs), qrcode-generator.

## Tests (run before every publish)
- `node tests/run.js`: scored regression suite on the PDFs in tests/fixtures (research paper, systematic review, four narrative reviews, a thesis, a scanned paper). A fix for one paper type must not lower the score.
- `node tests/smoke.js`: clicks through every tab and editor in a simulated browser and fails on any JavaScript error.
- `node tests/browser.js <folder with node_modules>`: the same in real headless Chromium, including exports, video, OCR, IndexedDB and a phone-sized screen.
- When a real paper fails, add a small made-up PDF that copies its layout to tests/fixtures (never commit copyrighted PDFs) and add checks for it.

## Folder structure
- core.js, render.js, app.js, app.html, build.py: source
- paper2poster.html: built output
- tests/: run.js, smoke.js, browser.js, fixtures/ (made-up test PDFs and the script that makes the thesis one)

## Content model
One JSON object: title, authors, affiliations, doi, keywords, sections (intro, method, participants,
results, discussion, conclusion, limitations), each with ranked sentences and detected statistics, plus
a figure library. Poster and carousel both render from this model.

## Design rules
- Themes: Clean Academic, Bold Editorial, Soft Pastel, Dark Tech. Every colour, font, radius comes from tokens.
- Carousel: 1080x1350 px (4:5). Max ~40 words per slide. Slide counter + swipe arrow on every slide but the last.
- Carousel blueprint: hook, problem, method, sample (big number), key finding 1 (biggest stat, huge type),
  key finding 2, why it matters, limitations, citation + DOI QR + call to action.
- Poster: A0 landscape by default (also A0 portrait, 48x36 in). Title >= 72pt, body >= 24pt at print size.
- Talk slides: 1920x1080. Main text never below 24 pt (48 px); warn instead of shrinking further. Aim for under 40 words per slide; detail goes in the script.
- Talk types: conference talk, proposal defence and thesis defence (viva) follow the outlines in OUTLINES in core.js. Optional examiner slides (theory, hypotheses, instruments, analysis, ethics, timeline, gap, limitations, contribution) start switched off.
- Every claim must be traceable: the Fact check matches each statement to a page and sentence and flags numbers not found in the paper.
- Missing content shows as [placeholder] text, never invented.
  Title banner, 3 columns, Key Takeaway box, footer with QR + references.
- All text must pass WCAG AA contrast. Text auto-fits within limits; warn on overflow instead of breaking layout.
- Always credit original authors and DOI on outputs.

## How to work with me
- Plan before coding; build one phase at a time.
- Keep functions small and files focused. Add a test for each extraction rule.
- After each change, tell me how to check it in the browser.
- Never delete test papers or my CLAUDE.md edits.
