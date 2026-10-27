# Carousel Info

Turn any document into an **infographic**, slice it into **Instagram-style carousel posts**, and pair it with **music that fits the mood**. Everything runs in the browser. By default there is no server, no API key, and your document never leaves your machine.

## How it works

1. **Upload a document**: PDF, DOCX, TXT, Markdown, or HTML. You can also paste text or click **Try a sample**.
2. **Analysis** (`js/analyze.js`): the app pulls out
   - the title and a one-line subtitle,
   - the sections (from headings) and the key points in each,
   - the big numbers (percentages, money, multipliers, durations),
   - a quotable line, keywords, and the document's **mood** (inspiring, professional, tech, calm, energetic, serious, or playful).
   - **Optional AI mode** (`js/ai.js`): paste your own Claude API key under *✨ AI mode* and the document text is sent to Claude Haiku, which reads it and writes the title, key messages, meaningful numbers, one slide per main idea, and a takeaway in plain language. The reference list is skipped and long documents are capped at ~15k tokens, so a typical paper costs about US$0.002. The key is stored only in your browser. If the request fails, the built-in analyzer is used instead.
3. **Infographic** (`js/render.js`): everything is laid out as one tall 1080px-wide image. It has a cover, *At a glance*, stat cards with progress bars, numbered sections, a quote, and a key-takeaway call to action.
4. **Carousel**: the same content blocks become one slide each, in 4:5 portrait (1080×1350) or 1:1 square (1080×1080). Each slide has a page counter, progress dots, and a "Swipe →" hint. The preview looks and swipes like a real Instagram post.
5. **Music** (`js/music.js`):
   - **Song suggestions** matched to the detected mood, to pick in Instagram's *Add music* step. Each one links to Spotify and YouTube so you can preview it.
   - **An original soundtrack** for the same mood, generated in the browser with the Web Audio API. It's royalty-free, so you can use it anywhere. Preview it, download it as WAV, or have it baked into the video export.
   - Or upload your own audio track.
6. **Edit and export**: change any slide's text, reorder, add, or delete slides, and switch theme or format. Then download:
   - each slide as a PNG,
   - all slides plus the infographic and caption as a ZIP,
   - the infographic as a PNG,
   - a **slideshow video with music** (MP4 or WebM) for Reels and Stories.

   It also writes a ready-to-paste caption with bullet points, the chosen song, and hashtags.

## Run it

It's a static site. Serve the folder so the PDF worker can load:

```bash
npm start            # or: python3 -m http.server 8000
# open http://localhost:8000
```

Run the tests (Node 18+):

```bash
npm test
```

## Notes

- Instagram doesn't allow third-party apps to attach licensed songs to a post. The suggested songs are what to search for in Instagram's music picker when you upload the slides. The generated soundtrack is original, so you can use it freely, including in the exported video.
- Scanned PDFs (images with no text layer) need OCR before they can be read.
- The third-party libraries (pdf.js, mammoth, JSZip) are bundled in `vendor/`, so the app works offline. Fonts load from Google Fonts and fall back to system fonts.
