const CHAT_ROLES = new Set(['user', 'assistant']);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function trimConversation(messages, limit = 12) {
  const maxMessages = Math.max(0, Number(limit) || 0);
  if (!Array.isArray(messages) || maxMessages === 0) return [];

  return messages
    .filter((message) => message && CHAT_ROLES.has(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? '').replaceAll('\0', '').trim().slice(0, 6000),
    }))
    .filter((message) => message.content)
    .slice(-maxMessages);
}

export function createAssistantSession({ historyLimit = 12 } = {}) {
  let messages = [];
  let activeRequest = null;

  return {
    history() {
      return messages.map((message) => ({ ...message }));
    },

    completeTurn(question, answer) {
      messages = trimConversation([
        ...messages,
        { role: 'user', content: question },
        { role: 'assistant', content: answer },
      ], historyLimit);
    },

    clear() {
      if (activeRequest) activeRequest.abort();
      activeRequest = null;
      messages = [];
    },

    beginRequest() {
      if (activeRequest) activeRequest.abort();
      activeRequest = new AbortController();
      return activeRequest;
    },

    cancel() {
      if (!activeRequest) return false;
      const request = activeRequest;
      activeRequest = null;
      request.abort();
      return true;
    },

    finishRequest(request) {
      if (activeRequest !== request) return false;
      activeRequest = null;
      return true;
    },

    isPending() {
      return Boolean(activeRequest);
    },
  };
}

export function safeAssistantUrl(value) {
  const url = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!url) return '#';
  if (url.startsWith('#') || url.startsWith('?')) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '#';
  } catch {
    return '#';
  }
}

function formatEmphasis(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function renderTextLinks(value) {
  const source = String(value ?? '');
  const linkPattern = /\[([^\]\n]+)]\(([^)\s]+)\)/g;
  const output = [];
  let cursor = 0;
  let match;

  while ((match = linkPattern.exec(source)) !== null) {
    output.push(formatEmphasis(source.slice(cursor, match.index)));
    const label = formatEmphasis(match[1]);
    const href = safeAssistantUrl(match[2]);
    if (href === '#' && match[2] !== '#') {
      output.push(label);
    } else {
      const external = /^https?:\/\//i.test(href);
      output.push(`<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`);
    }
    cursor = match.index + match[0].length;
  }

  output.push(formatEmphasis(source.slice(cursor)));
  return output.join('');
}

function renderInline(value) {
  const source = String(value ?? '');
  const codePattern = /`([^`\n]+)`/g;
  const output = [];
  let cursor = 0;
  let match;

  while ((match = codePattern.exec(source)) !== null) {
    output.push(renderTextLinks(source.slice(cursor, match.index)));
    output.push(`<code>${escapeHtml(match[1])}</code>`);
    cursor = match.index + match[0].length;
  }

  output.push(renderTextLinks(source.slice(cursor)));
  return output.join('');
}

function blockType(line) {
  if (!line.trim()) return 'blank';
  if (/^```/.test(line)) return 'fence';
  if (/^#{1,4}\s+/.test(line)) return 'heading';
  if (/^>\s?/.test(line)) return 'quote';
  if (/^\s*[-+*]\s+/.test(line)) return 'unordered';
  if (/^\s*\d+\.\s+/.test(line)) return 'ordered';
  return 'paragraph';
}

export function renderAssistantMarkdown(value) {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const type = blockType(line);

    if (type === 'blank') {
      index += 1;
      continue;
    }

    if (type === 'fence') {
      const language = line.slice(3).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const className = language ? ` class="language-${language}"` : '';
      output.push(`<pre><code${className}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (type === 'heading') {
      const match = line.match(/^(#{1,4})\s+(.+)$/);
      const level = match[1].length;
      output.push(`<h${level}>${renderInline(match[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (type === 'quote') {
      const quote = [];
      while (index < lines.length && blockType(lines[index]) === 'quote') {
        quote.push(lines[index].replace(/^>\s?/, '').trim());
        index += 1;
      }
      output.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    if (type === 'unordered' || type === 'ordered') {
      const tag = type === 'ordered' ? 'ol' : 'ul';
      const pattern = type === 'ordered' ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;
      const items = [];
      while (index < lines.length && blockType(lines[index]) === type) {
        const match = lines[index].match(pattern);
        items.push(`<li>${renderInline(match[1].trim())}</li>`);
        index += 1;
      }
      output.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length && blockType(lines[index]) === 'paragraph') {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }

  return output.join('');
}
