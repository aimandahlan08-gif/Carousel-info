/* Extracts plain text from uploaded files (PDF, DOCX, TXT/MD, HTML). */
(function (root) {
  'use strict';

  if (root.pdfjsLib) {
    root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  }

  async function fromPdf(file) {
    if (!root.pdfjsLib) throw new Error('PDF support failed to load.');
    const pdf = await root.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const content = await (await pdf.getPage(p)).getTextContent();
      // Rebuild lines from text items using their vertical position.
      let lastY = null, line = '', lines = [];
      for (const item of content.items) {
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; }
        if (line && item.str && !/\s$/.test(line) && !/^\s/.test(item.str)) line += ' ';
        line += item.str;
        lastY = y;
      }
      lines.push(line.trim());
      pages.push(lines.join('\n'));
    }
    // Paragraph-ize: blank line where a line ends a sentence and the next is a capitalised start.
    return pages.join('\n\n').replace(/([.!?])\n(?=[A-Z])/g, '$1\n\n');
  }

  async function fromDocx(file) {
    if (!root.mammoth) throw new Error('DOCX support failed to load.');
    // Convert to HTML first so headings and lists survive.
    const { value } = await root.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return fromHtmlString(value);
  }

  function fromHtmlString(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,nav,footer,noscript').forEach(n => n.remove());
    const out = [];
    const walk = el => {
      for (const node of el.children) {
        const tag = node.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) out.push('\n' + '#'.repeat(+tag[1]) + ' ' + node.textContent.trim() + '\n');
        else if (tag === 'li') out.push('- ' + node.textContent.trim());
        else if (tag === 'p' || tag === 'blockquote' || tag === 'td') out.push(node.textContent.trim() + '\n');
        else walk(node);
      }
    };
    walk(doc.body);
    const text = out.join('\n').trim();
    return text || doc.body.textContent;
  }

  async function extractText(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return fromPdf(file);
    if (name.endsWith('.docx')) return fromDocx(file);
    if (name.endsWith('.doc')) throw new Error('Legacy .doc files are not supported — save as .docx or PDF.');
    const text = await file.text();
    if (/\.html?$/.test(name)) return fromHtmlString(text);
    return text;
  }

  root.Extractor = { extractText };
})(window);
