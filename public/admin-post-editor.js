const dataEl = document.getElementById('post-editor-data');
const post = dataEl ? JSON.parse(dataEl.textContent || '{}') : {};
const tagOptionsEl = document.getElementById('post-tag-options-data');
const initialTagOptions = tagOptionsEl ? JSON.parse(tagOptionsEl.textContent || '[]') : [];
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
const tagInput = document.querySelector('[data-tag-input]');
const tagAddButton = document.querySelector('[data-tag-add]');
const tagSummaryButton = document.querySelector('[data-tag-summary]');
const tagPopover = document.querySelector('[data-tag-popover]');
const tagOptionsContainer = document.querySelector('[data-tag-options]');
const tagHiddenContainer = document.querySelector('[data-tag-hidden]');

let previewTimer = null;
let isSaving = false;
let previewRequestId = 0;
let previewAbortController = null;
let allTags = normalizeTags([...initialTagOptions, ...(post.tags || [])]);
let selectedTags = new Set(normalizeTags(post.tags || []));
let tagFilter = '';

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

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,，\n]/);
  const seen = new Set();
  const tags = [];
  source.forEach((item) => {
    const tag = String(item || '')
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ');
    const key = tag.toLocaleLowerCase('zh-CN');
    if (!tag || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });
  return tags;
}

function syncHiddenTags() {
  if (!tagHiddenContainer) return;
  tagHiddenContainer.innerHTML = [...selectedTags]
    .map((tag) => `<input type="hidden" name="tags" value="${escapeHtml(tag)}" />`)
    .join('');
}

function renderTagSummary() {
  if (!tagSummaryButton) return;
  const tags = [...selectedTags];
  tagSummaryButton.classList.toggle('is-empty', tags.length === 0);
  tagSummaryButton.innerHTML = tags.length
    ? tags.map((tag) => `
      <span class="post-tag-chip">
        <span>${escapeHtml(tag)}</span>
        <button type="button" data-tag-remove="${escapeHtml(tag)}" aria-label="移除${escapeHtml(tag)}">×</button>
      </span>
    `).join('')
    : '<span>选择标签</span>';
}

function renderTags() {
  if (!tagOptionsContainer) return;
  syncHiddenTags();
  renderTagSummary();
  const filtered = allTags.filter((tag) => tag.toLocaleLowerCase('zh-CN').includes(tagFilter));
  if (!filtered.length) {
    tagOptionsContainer.innerHTML = '<span class="post-tag-empty">暂无标签</span>';
    return;
  }
  tagOptionsContainer.innerHTML = filtered.map((tag) => {
    const active = selectedTags.has(tag);
    return `
      <div class="post-tag-option ${active ? 'active' : ''}">
        <button type="button" data-tag-toggle="${escapeHtml(tag)}">
          <span class="post-tag-option-check">${active ? '✓' : ''}</span>
          <span>${escapeHtml(tag)}</span>
        </button>
        <button type="button" class="post-tag-delete" data-tag-delete="${escapeHtml(tag)}" aria-label="删除${escapeHtml(tag)}">×</button>
      </div>
    `;
  }).join('');
}

function toggleTagPicker(open) {
  if (!tagPopover || !tagSummaryButton) return;
  const shouldOpen = open ?? tagPopover.hidden;
  tagPopover.hidden = !shouldOpen;
  tagSummaryButton.setAttribute('aria-expanded', String(shouldOpen));
  tagSummaryButton.classList.toggle('active', shouldOpen);
  if (shouldOpen) {
    tagInput?.focus();
  }
}

function addTag(value) {
  const tags = normalizeTags(value);
  if (!tags.length) return;
  tags.forEach((tag) => {
    const existing = allTags.find((item) => item.toLocaleLowerCase('zh-CN') === tag.toLocaleLowerCase('zh-CN'));
    const finalTag = existing || tag;
    if (!existing) allTags.push(finalTag);
    selectedTags.add(finalTag);
  });
  allTags = normalizeTags(allTags).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  if (tagInput) tagInput.value = '';
  tagFilter = '';
  renderTags();
  schedulePreview();
}

function removeTag(value) {
  const [tag] = normalizeTags(value);
  if (!tag) return;
  const existing = [...selectedTags].find((item) => item.toLocaleLowerCase('zh-CN') === tag.toLocaleLowerCase('zh-CN'));
  if (!existing) return;
  selectedTags.delete(existing);
  renderTags();
  schedulePreview();
}

async function deleteGlobalTag(value) {
  const [tag] = normalizeTags(value);
  if (!tag) return;
  const existing = allTags.find((item) => item.toLocaleLowerCase('zh-CN') === tag.toLocaleLowerCase('zh-CN'));
  if (!existing) return;
  if (!window.confirm(`删除标签“${existing}”？它会从所有笔记中移除。`)) return;

  setStatus('DELETING TAG');
  try {
    const res = await fetch('/api/admin/posts/tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: existing }),
    });
    if (!res.ok) {
      setStatus('TAG DELETE FAILED');
      return;
    }
    const data = await res.json();
    allTags = normalizeTags(data.tags || allTags.filter((item) => item.toLocaleLowerCase('zh-CN') !== existing.toLocaleLowerCase('zh-CN')));
    const selected = [...selectedTags].find((item) => item.toLocaleLowerCase('zh-CN') === existing.toLocaleLowerCase('zh-CN'));
    if (selected) selectedTags.delete(selected);
    renderTags();
    schedulePreview();
  } catch {
    setStatus('TAG DELETE FAILED');
  }
}

async function updatePreview() {
  if (!preview || !input) return;
  const requestId = ++previewRequestId;
  previewAbortController?.abort();
  previewAbortController = new AbortController();

  try {
    const res = await fetch('/api/admin/posts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: input.value }),
      signal: previewAbortController.signal,
    });
    if (requestId !== previewRequestId) return;
    if (!res.ok) {
      preview.innerHTML = `<p>预览暂时不可用（${res.status}）。</p>`;
      return;
    }
    const data = await res.json();
    if (requestId === previewRequestId) {
      preview.innerHTML = data.html || '<p>预览会显示在这里。</p>';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (requestId === previewRequestId) {
      preview.innerHTML = '<p>预览暂时不可用。</p>';
    }
  }
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
    tags: data.getAll('tags'),
    topicSlugs: data.getAll('topicSlugs'),
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
tagSummaryButton?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const removeButton = target?.closest('[data-tag-remove]');
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    removeTag(removeButton.dataset.tagRemove);
    return;
  }
  toggleTagPicker();
});
tagSummaryButton?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  toggleTagPicker();
});
tagOptionsContainer?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const deleteButton = target?.closest('[data-tag-delete]');
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    deleteGlobalTag(deleteButton.dataset.tagDelete);
    return;
  }
  const button = target?.closest('[data-tag-toggle]');
  if (!button || !tagOptionsContainer.contains(button)) return;
  const tag = button.dataset.tagToggle;
  if (!tag) return;
  if (selectedTags.has(tag)) selectedTags.delete(tag);
  else selectedTags.add(tag);
  renderTags();
  schedulePreview();
});
tagAddButton?.addEventListener('click', () => addTag(tagInput?.value));
tagInput?.addEventListener('input', () => {
  tagFilter = tagInput.value.trim().toLocaleLowerCase('zh-CN');
  renderTags();
});
tagInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    toggleTagPicker(false);
    return;
  }
  if (event.key !== 'Enter' && event.key !== ',') return;
  event.preventDefault();
  addTag(tagInput.value);
});
document.addEventListener('click', (event) => {
  const picker = document.querySelector('[data-tag-picker]');
  if (!picker || picker.contains(event.target)) return;
  toggleTagPicker(false);
});

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
renderTags();
