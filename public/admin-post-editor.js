const dataEl = document.getElementById('post-editor-data');
const post = dataEl ? JSON.parse(dataEl.textContent || '{}') : {};
const shell = document.querySelector('[data-editor-shell]');
const form = document.querySelector('[data-post-form]');
const input = document.querySelector('[data-markdown-input]');
const preview = document.querySelector('[data-markdown-preview]');
const statusEl = document.querySelector('[data-editor-status]');
const saveButton = document.querySelector('[data-save-post]');
const deleteButton = document.querySelector('[data-delete-post]');
const previewButton = document.querySelector('[data-preview-link]');
const slugInput = document.querySelector('[data-slug-input]');
const regenerateSlugButton = document.querySelector('[data-regenerate-slug]');

let previewTimer = null;
let isSaving = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fallbackSlug() {
  return `note-${new Date().toISOString().slice(0, 10)}`;
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function markdownPreview(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let list = [];
  let code = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    html.push('<ul>');
    list.forEach((item) => html.push(`<li>${inlineMarkdown(item)}</li>`));
    html.push('</ul>');
    list = [];
  };

  const flushText = () => {
    flushParagraph();
    flushList();
  };

  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/g, '');
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (code) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        flushText();
        code = [];
      }
      return;
    }
    if (code) {
      code.push(rawLine);
      return;
    }
    if (!line.trim()) {
      flushText();
      return;
    }
    const image = line.match(/^!\[([^\]]*)]\(([^)\s]+)\)$/);
    if (image) {
      flushText();
      html.push(`<img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" />`);
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushText();
      const depth = heading[1].length;
      html.push(`<h${depth}>${inlineMarkdown(heading[2])}</h${depth}>`);
      return;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      return;
    }
    flushList();
    paragraph.push(line.trim());
  });

  flushText();
  return html.join('') || '<p>预览会显示在这里。</p>';
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function updatePreview() {
  if (!preview || !input) return;
  preview.innerHTML = markdownPreview(input.value);
}

function schedulePreview() {
  setStatus('UNSAVED');
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(updatePreview, 120);
}

function collectPayload() {
  const data = new FormData(form);
  return {
    title: data.get('title'),
    slug: data.get('slug') || slugify(data.get('title')) || fallbackSlug(),
    category: data.get('category'),
    description: data.get('description'),
    date: data.get('date'),
    body: input.value,
    published: data.get('published') === 'on',
    featured: data.get('featured') === 'on',
  };
}

async function savePost() {
  if (isSaving) return;
  isSaving = true;
  setStatus('SAVING');
  const res = await fetch(`/api/admin/posts/${post.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collectPayload()),
  });
  if (!res.ok) {
    setStatus('SAVE FAILED');
    isSaving = false;
    return;
  }
  const data = await res.json();
  post.slug = data.item.slug;
  post.title = data.item.title;
  if (slugInput) slugInput.value = data.item.slug;
  setStatus('SAVED');
  isSaving = false;
}

async function deletePost() {
  const title = form?.querySelector('input[name="title"]')?.value || post.title || '当前笔记';
  if (!window.confirm(`确认删除“${title}”？此操作不可撤销。`)) return;
  setStatus('DELETING');
  const res = await fetch(`/api/admin/posts/${post.id}`, { method: 'DELETE' });
  if (!res.ok) {
    setStatus('DELETE FAILED');
    return;
  }
  window.location.href = '/admin/posts';
}

document.querySelectorAll('[data-editor-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.editorMode;
    shell?.classList.toggle('is-edit', mode === 'edit');
    shell?.classList.toggle('is-preview', mode === 'preview');
    shell?.classList.toggle('is-split', mode === 'split');
    document.querySelectorAll('[data-editor-mode]').forEach((el) => el.classList.toggle('active', el === button));
    updatePreview();
  });
});

input?.addEventListener('input', schedulePreview);
form?.addEventListener('input', schedulePreview);

regenerateSlugButton?.addEventListener('click', () => {
  const title = form?.querySelector('input[name="title"]')?.value || post.title;
  if (!slugInput) return;
  slugInput.value = slugify(title) || fallbackSlug();
  schedulePreview();
});

saveButton?.addEventListener('click', savePost);
deleteButton?.addEventListener('click', deletePost);
previewButton?.addEventListener('click', () => {
  const slug = form?.querySelector('[name="slug"]')?.value || post.slug;
  window.open(`/posts/${slug}`, '_blank', 'noreferrer');
});

updatePreview();
