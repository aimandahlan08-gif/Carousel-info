# Paper2Poster

Turns a research PDF (paper, review or thesis) into:
- an Instagram/LinkedIn carousel, animated video and graphical abstract
- a conference poster (Story, Billboard or Classic layout)
- a talk deck with a timed speaker script: conference talk, proposal defence or thesis defence (viva), with PowerPoint, PDF and printable-script exports

Everything runs in the browser and is rule-based. Papers never leave the device unless you choose "Ask Claude".

## Use it
Open `index.html` (a copy of `paper2poster.html`) in a browser, or serve the folder:
```
python3 -m http.server 8000   # then open http://localhost:8000
```
If GitHub Pages is on for this repo, it is also at `/paper2poster/` on the Pages site. Outside Claude, the "Ask Claude" buttons are hidden and files download normally.

## Build and test
```
python3 build.py          # writes paper2poster.html
node tests/run.js         # scored regression suite
node tests/smoke.js       # simulated-browser click-through
```
First run `npm install` for the test tools (pdf.js, jsdom, canvas, fonts). `tests/browser.js` also needs Playwright with Chromium.

## Files
- `core.js`: reads the PDF and does the rule-based work (sections, ranking, statistics, talk and defence decks, fact check)
- `render.js`: draws the carousel, posters, talk slides and charts; builds the PowerPoint
- `app.js`: the interface, editing, saving and exports
- `app.html`: page layout and styles
- `build.py`: combines the four files into `paper2poster.html`
- `tests/`: scored regression suite, click-through tests, and made-up test PDFs
See CLAUDE.md for the rules the project follows.
