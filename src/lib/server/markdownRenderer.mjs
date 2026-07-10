function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugifyHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    || 'section';
}

function renderInline(value) {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return html;
}

function flushParagraph(lines, output) {
  if (!lines.length) return;
  output.push(`<p>${renderInline(lines.join(' '))}</p>`);
  lines.length = 0;
}

function flushList(lines, output) {
  if (!lines.length) return;
  output.push('<ul>');
  lines.forEach((line) => output.push(`<li>${renderInline(line)}</li>`));
  output.push('</ul>');
  lines.length = 0;
}

function flushQuote(lines, output) {
  if (!lines.length) return;
  output.push('<blockquote>');
  lines.forEach((line) => output.push(`<p>${renderInline(line)}</p>`));
  output.push('</blockquote>');
  lines.length = 0;
}

function flushCode(block, output) {
  if (!block) return;
  const language = block.language ? ` class="language-${escapeHtml(block.language)}"` : '';
  output.push(`<pre><code${language}>${escapeHtml(block.lines.join('\n'))}</code></pre>`);
}

export function markdownToHtml(markdown = '') {
  const output = [];
  const headings = [];
  const paragraph = [];
  const list = [];
  const quote = [];
  let code = null;

  const flushTextBlocks = () => {
    flushParagraph(paragraph, output);
    flushList(list, output);
    flushQuote(quote, output);
  };

  String(markdown || '').replace(/\r\n/g, '\n').split('\n').forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/g, '');
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (code) {
        flushCode(code, output);
        code = null;
      } else {
        flushTextBlocks();
        code = { language: fence[1] || '', lines: [] };
      }
      return;
    }

    if (code) {
      code.lines.push(rawLine);
      return;
    }

    if (!line.trim()) {
      flushTextBlocks();
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushTextBlocks();
      const depth = heading[1].length;
      const text = heading[2].trim();
      const slug = slugifyHeading(text);
      headings.push({ depth, slug, text });
      output.push(`<h${depth} id="${slug}">${renderInline(text)}</h${depth}>`);
      return;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph(paragraph, output);
      flushQuote(quote, output);
      list.push(listItem[1]);
      return;
    }

    const quoteItem = line.match(/^>\s?(.+)$/);
    if (quoteItem) {
      flushParagraph(paragraph, output);
      flushList(list, output);
      quote.push(quoteItem[1]);
      return;
    }

    flushList(list, output);
    flushQuote(quote, output);
    paragraph.push(line.trim());
  });

  if (code) flushCode(code, output);
  flushTextBlocks();

  return { html: output.join('\n'), headings };
}

export function readingTimeForMarkdown(markdown = '') {
  const text = String(markdown || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`[\]()\-]/g, '');
  return Math.max(1, Math.ceil(text.length / 650));
}
