const dataEl = document.getElementById('post-editor-data');
const post = dataEl ? JSON.parse(dataEl.textContent || '{}') : {};
const tagOptionsEl = document.getElementById('post-tag-options-data');
const initialTagOptions = tagOptionsEl ? JSON.parse(tagOptionsEl.textContent || '[]') : [];
const shell = document.querySelector('[data-editor-shell]');
const form = document.querySelector('[data-post-form]');
const metaToggle = document.querySelector('[data-editor-meta-toggle]');
const input = document.querySelector('[data-markdown-input]');
const preview = document.querySelector('[data-markdown-preview]');
const writePane = document.querySelector('.post-editor-write');
const statusEl = document.querySelector('[data-editor-status]');
const saveButton = document.querySelector('[data-save-post]');
const deleteButton = document.querySelector('[data-delete-post]');
const previewButton = document.querySelector('[data-preview-link]');
const historyButton = document.querySelector('[data-post-history-toggle]');
const historyDialog = document.querySelector('[data-post-history-dialog]');
const historyCloseButton = document.querySelector('[data-post-history-close]');
const historyList = document.querySelector('[data-post-history-list]');
const historySelected = document.querySelector('[data-post-history-selected]');
const historyDiff = document.querySelector('[data-post-history-diff]');
const historyRestoreButton = document.querySelector('[data-post-history-restore]');
const localDraftNotice = document.querySelector('[data-local-draft-notice]');
const localDraftTime = document.querySelector('[data-local-draft-time]');
const localDraftRestoreButton = document.querySelector('[data-local-draft-restore]');
const localDraftDiscardButton = document.querySelector('[data-local-draft-discard]');
const slugInput = document.querySelector('[data-slug-input]');
const regenerateSlugButton = document.querySelector('[data-regenerate-slug]');
const tagInput = document.querySelector('[data-tag-input]');
const tagAddButton = document.querySelector('[data-tag-add]');
const tagSummaryButton = document.querySelector('[data-tag-summary]');
const tagPopover = document.querySelector('[data-tag-popover]');
const tagOptionsContainer = document.querySelector('[data-tag-options]');
const tagHiddenContainer = document.querySelector('[data-tag-hidden]');
const lockedNoteKeyInput = document.querySelector('[data-locked-note-key]');
const unlockLockedPostButton = document.querySelector('[data-unlock-locked-post]');
const lockedNoteStatus = document.querySelector('[data-locked-note-status]');
const PREVIEW_DELAY_MS = 400;
const PREVIEW_RETRY_DELAY_MS = 350;
const AUTO_SAVE_DELAY_MS = 2500;
const META_COLLAPSED_STORAGE_KEY = 'dev-notes-post-editor-meta-collapsed';
const LOCAL_DRAFT_STORAGE_PREFIX = 'dev-notes-post-draft-v1';
const LOCAL_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_DRAFT_DELAY_MS = 300;

let previewTimer = null;
let isSaving = false;
let isDeleting = false;
let isDirty = false;
let autoSavePaused = false;
let autoSaveTimer = null;
let lastSavedSignature = '';
let previewRequestId = 0;
let previewAbortController = null;
let previewPendingMarkdown = '';
let lastPreviewMarkdown = '';
let editorMode = 'edit';
let metaCollapsed = false;
let hasSuccessfulPreview = false;
let allTags = normalizeTags([...initialTagOptions, ...(post.tags || [])]);
let selectedTags = new Set(normalizeTags(post.tags || []));
let tagFilter = '';
let tableEditorState = null;
let tableEditorDrag = null;
let tableEditorPosition = null;
let selectedVersionId = null;
let localDraftTimer = null;
let pendingLocalDraft = null;

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

function setStatus(text, state = '') {
  if (!statusEl) return;
  statusEl.textContent = text;
  if (state) statusEl.dataset.state = state;
  else statusEl.removeAttribute('data-state');
}

function setMetaCollapsed(collapsed, { persist = true } = {}) {
  metaCollapsed = Boolean(collapsed);
  shell?.classList.toggle('is-meta-collapsed', metaCollapsed);
  if (metaToggle) {
    metaToggle.classList.toggle('is-collapsed', metaCollapsed);
    metaToggle.setAttribute('aria-expanded', String(!metaCollapsed));
    const label = metaCollapsed ? '显示笔记属性' : '隐藏笔记属性';
    metaToggle.setAttribute('aria-label', label);
    metaToggle.title = label;
  }
  if (!persist) return;
  try {
    window.localStorage.setItem(META_COLLAPSED_STORAGE_KEY, String(metaCollapsed));
  } catch {
    // Storage may be unavailable in private browsing; the current view still works.
  }
}

try {
  setMetaCollapsed(window.localStorage.getItem(META_COLLAPSED_STORAGE_KEY) === 'true', { persist: false });
} catch {
  setMetaCollapsed(false, { persist: false });
}

function payloadSignature(payload = collectPayload()) {
  const { versionSource: _versionSource, ...content } = payload;
  return JSON.stringify(content);
}

function localDraftStorageKey() {
  return `${LOCAL_DRAFT_STORAGE_PREFIX}:${post.id}`;
}

function clearLocalDraft() {
  window.clearTimeout(localDraftTimer);
  pendingLocalDraft = null;
  localDraftNotice?.setAttribute('hidden', '');
  try {
    window.localStorage.removeItem(localDraftStorageKey());
  } catch {
    // Local recovery is optional when browser storage is unavailable.
  }
}

function localDraftPayload() {
  const payload = collectPayload();
  if (payload.visibility === 'locked') return null;
  const { lockedNoteKey: _lockedNoteKey, versionSource: _versionSource, ...content } = payload;
  return content;
}

function persistLocalDraft() {
  window.clearTimeout(localDraftTimer);
  if (!isDirty) {
    clearLocalDraft();
    return;
  }
  const payload = localDraftPayload();
  if (!payload) {
    clearLocalDraft();
    return;
  }
  try {
    window.localStorage.setItem(localDraftStorageKey(), JSON.stringify({
      postId: Number(post.id),
      updatedAt: Date.now(),
      baseSignature: lastSavedSignature,
      payload,
    }));
  } catch {
    // Server saves remain available when browser storage is full or disabled.
  }
}

function scheduleLocalDraft() {
  window.clearTimeout(localDraftTimer);
  if (!isDirty) {
    clearLocalDraft();
    return;
  }
  localDraftTimer = window.setTimeout(persistLocalDraft, LOCAL_DRAFT_DELAY_MS);
}

function readLocalDraft() {
  try {
    const raw = window.localStorage.getItem(localDraftStorageKey());
    if (!raw) return null;
    const draft = JSON.parse(raw);
    const expired = !Number.isFinite(draft?.updatedAt) || Date.now() - draft.updatedAt > LOCAL_DRAFT_TTL_MS;
    if (Number(draft?.postId) !== Number(post.id) || expired || draft?.payload?.visibility === 'locked') {
      clearLocalDraft();
      return null;
    }
    if (payloadSignature({ ...draft.payload, lockedNoteKey: '' }) === lastSavedSignature) {
      clearLocalDraft();
      return null;
    }
    return draft;
  } catch {
    clearLocalDraft();
    return null;
  }
}

function setNamedField(name, value) {
  const field = form?.elements?.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    field.value = String(value ?? '');
  }
}

function applyLocalDraft(draft) {
  const payload = draft?.payload;
  if (!payload || payload.visibility === 'locked') return;
  ['title', 'slug', 'kind', 'description', 'date'].forEach((name) => setNamedField(name, payload[name]));
  form?.querySelectorAll('[name="published"], [name="featured"]').forEach((field) => {
    if (field instanceof HTMLInputElement) field.checked = Boolean(payload[field.name]);
  });
  form?.querySelectorAll('[name="visibility"]').forEach((field) => {
    if (field instanceof HTMLInputElement) field.checked = field.value === payload.visibility;
  });
  form?.querySelectorAll('[name="topicSlugs"]').forEach((field) => {
    if (field instanceof HTMLInputElement) field.checked = (payload.topicSlugs || []).includes(field.value);
  });
  selectedTags = new Set(normalizeTags(payload.tags || []));
  renderTags();
  if (input) {
    input.value = String(payload.body || '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  autoSavePaused = true;
  window.clearTimeout(autoSaveTimer);
  pendingLocalDraft = null;
  localDraftNotice?.setAttribute('hidden', '');
  setSaveState('dirty', '已恢复本地草稿');
}

function offerLocalDraftRecovery() {
  pendingLocalDraft = readLocalDraft();
  if (!pendingLocalDraft || !localDraftNotice) return;
  if (localDraftTime) {
    localDraftTime.textContent = new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(pendingLocalDraft.updatedAt));
  }
  localDraftNotice.hidden = false;
}

function setSaveState(state, message) {
  const labels = {
    saved: '已保存',
    dirty: '有未保存修改',
    saving: '正在保存',
    error: '保存失败',
  };
  setStatus(message || labels[state] || '', state);
}

function scheduleAutoSave() {
  window.clearTimeout(autoSaveTimer);
  if (!isDirty || isSaving || isDeleting || autoSavePaused
    || document.querySelector('[data-post-editor-page]')?.dataset.agentEditorLocked === 'true') {
    return;
  }
  autoSaveTimer = window.setTimeout(() => void savePost({ automatic: true }), AUTO_SAVE_DELAY_MS);
}

function markDirty() {
  autoSavePaused = false;
  isDirty = payloadSignature() !== lastSavedSignature;
  setSaveState(isDirty ? 'dirty' : 'saved');
  scheduleLocalDraft();
  scheduleAutoSave();
}

function getLineBounds(value, position) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const nextLineBreak = value.indexOf('\n', position);
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  return { lineStart, lineEnd };
}

function isInsideFence(value, position) {
  const before = value.slice(0, position);
  const fenceCount = (before.match(/^```/gm) || []).length;
  return fenceCount % 2 === 1;
}

function insertTextAtCursor(textarea, text) {
  textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function replaceLines(textarea, nextText, selectionStart, selectionEnd) {
  textarea.value = nextText;
  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function replaceCurrentLine(textarea, text, cursorOffset = text.length, selectLength = 0) {
  const { lineStart, lineEnd } = getLineBounds(textarea.value, textarea.selectionStart);
  const nextValue = `${textarea.value.slice(0, lineStart)}${text}${textarea.value.slice(lineEnd)}`;
  const selectionStart = lineStart + cursorOffset;
  replaceLines(textarea, nextValue, selectionStart, selectionStart + selectLength);
}

function selectedTextOrPlaceholder(textarea, placeholder) {
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  return selected || placeholder;
}

function wrapSelection(textarea, before, after = before, placeholder = '文本') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = selectedTextOrPlaceholder(textarea, placeholder);
  textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
  if (start === end) {
    textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertLink(textarea) {
  const selected = selectedTextOrPlaceholder(textarea, '网页');
  const url = window.prompt('链接地址', 'https://') || 'https://';
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.setRangeText(`[${selected}](${url})`, start, end, 'end');
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function codeFenceTemplate(line) {
  const match = String(line || '').match(/^(\s*)```([a-zA-Z0-9_-]*)\s*$/);
  if (!match) return null;
  const indent = match[1] || '';
  const language = match[2] || '';
  const opening = `${indent}\`\`\`${language}`;
  return {
    text: `${opening}\n\n${indent}\`\`\``,
    cursorOffset: opening.length + 1,
  };
}

function expandCodeFenceShortcut(event) {
  if (!input || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
    return false;
  }
  if (input.selectionStart !== input.selectionEnd) return false;
  const { lineStart } = getLineBounds(input.value, input.selectionStart);
  const previousText = input.value.slice(0, lineStart);
  if ((previousText.match(/^\s{0,3}(```|~~~)/gm) || []).length % 2 === 1) return false;
  const lineBeforeCursor = input.value.slice(lineStart, input.selectionStart);
  const template = codeFenceTemplate(lineBeforeCursor);
  if (!template) return false;

  event.preventDefault();
  replaceCurrentLine(input, template.text, template.cursorOffset);
  return true;
}

function slashCommandTemplate(command) {
  const key = command.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
  const table = '|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |';
  const templates = {
    '/表格': { text: table, cursorOffset: 2 },
    '/table': { text: table, cursorOffset: 2 },
    '/图片': { text: '![图片说明](图片地址)', cursorOffset: 2, selectLength: 4 },
    '/image': { text: '![图片说明](图片地址)', cursorOffset: 2, selectLength: 4 },
    '/img': { text: '![图片说明](图片地址)', cursorOffset: 2, selectLength: 4 },
    '/math': { text: '$$\n\n$$', cursorOffset: 3 },
    '/公式': { text: '$$\n\n$$', cursorOffset: 3 },
    '/行内公式': { text: '$公式$', cursorOffset: 1, selectLength: 2 },
    '/inline公式': { text: '$公式$', cursorOffset: 1, selectLength: 2 },
    '/代码': { text: '```markdown\n\n```', cursorOffset: 12 },
    '/code': { text: '```markdown\n\n```', cursorOffset: 12 },
    '/分割线': { text: '---\n', cursorOffset: 4 },
    '/hr': { text: '---\n', cursorOffset: 4 },
    '/todo': { text: '- [ ] ', cursorOffset: 6 },
    '/待办': { text: '- [ ] ', cursorOffset: 6 },
    '/有序': { text: '1. ', cursorOffset: 3 },
    '/无序': { text: '- ', cursorOffset: 2 },
    '/引用': { text: '> ', cursorOffset: 2 },
  };
  return templates[key] || null;
}

function expandSlashCommand(event) {
  if (!input || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
    return false;
  }
  if (input.selectionStart !== input.selectionEnd || isInsideFence(input.value, input.selectionStart)) return false;
  const { lineStart } = getLineBounds(input.value, input.selectionStart);
  const lineBeforeCursor = input.value.slice(lineStart, input.selectionStart);
  const template = slashCommandTemplate(lineBeforeCursor);
  if (!template) return false;

  event.preventDefault();
  replaceCurrentLine(input, template.text, template.cursorOffset, template.selectLength || 0);
  return true;
}

function imageFilesFromList(fileList) {
  return Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
}

function imageAlt(file) {
  return String(file?.name || '图片')
    .replace(/\.[^.]+$/, '')
    .replace(/[[\]()]/g, '')
    .trim() || '图片';
}

async function uploadPostImage(file) {
  window.__postImageUploads = Number(window.__postImageUploads || 0) + 1;
  try {
    const res = await fetch('/api/admin/posts/image', {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-Image-Name': encodeURIComponent(file.name || 'image'),
        'X-Post-ID': String(post.id || 0),
      },
      credentials: 'same-origin',
      body: file,
    });
    if (!res.ok) {
      if (res.status === 413) throw new Error('图片不能超过8MB');
      if (res.status === 415) throw new Error('仅支持JPG、PNG、WebP和AVIF');
      throw new Error(`图片上传失败（${res.status}）`);
    }
    const data = await res.json();
    return data.image?.imagePath || data.image?.smallPath || '';
  } finally {
    window.__postImageUploads = Math.max(0, Number(window.__postImageUploads || 1) - 1);
  }
}

async function insertUploadedImages(files) {
  if (!input || !files.length) return;
  setStatus('UPLOADING IMAGE');
  try {
    for (const file of files) {
      const imagePath = await uploadPostImage(file);
      if (!imagePath) continue;
      insertTextAtCursor(input, `![${imageAlt(file)}](${imagePath})\n`);
    }
    setSaveState('dirty');
    schedulePreview();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'IMAGE UPLOAD FAILED');
  }
}

function handleMarkdownShortcut(event) {
  if (!input || event.isComposing || event.altKey) return false;
  const key = event.key.toLowerCase();
  if (!event.ctrlKey && !event.metaKey) return false;

  if (key === 'b' && !event.shiftKey) {
    event.preventDefault();
    wrapSelection(input, '**', '**', '加粗');
    return true;
  }
  if (key === 'i' && !event.shiftKey) {
    event.preventDefault();
    wrapSelection(input, '*', '*', '倾斜');
    return true;
  }
  if (key === 'e' && !event.shiftKey) {
    event.preventDefault();
    wrapSelection(input, '`', '`', 'hello');
    return true;
  }
  if (key === 'k' && !event.shiftKey) {
    event.preventDefault();
    insertLink(input);
    return true;
  }
  if (key === 'h' && event.shiftKey) {
    event.preventDefault();
    wrapSelection(input, '{{red:', '}}', '红色文字');
    return true;
  }
  return false;
}

function nextMarkdownPrefix(line) {
  if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) return '';

  const task = line.match(/^(\s*)([-+*])\s+\[[ xX]\]\s*(.*)$/);
  if (task) return `${task[1]}${task[2]} [ ] `;

  const ordered = line.match(/^(\s*)(\d+)([.)])\s*(.*)$/);
  if (ordered) return `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `;

  const bullet = line.match(/^(\s*)([-+*])\s*(.*)$/);
  if (bullet) return `${bullet[1]}${bullet[2]} `;

  const quote = line.match(/^(\s*>\s?)(.*)$/);
  if (quote) return quote[1];

  return '';
}

function continueMarkdownBlock(event) {
  if (!input || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
    return false;
  }
  if (input.selectionStart !== input.selectionEnd || isInsideFence(input.value, input.selectionStart)) return false;

  const { lineStart } = getLineBounds(input.value, input.selectionStart);
  const currentLineBeforeCursor = input.value.slice(lineStart, input.selectionStart);
  const prefix = nextMarkdownPrefix(currentLineBeforeCursor);
  if (!prefix) return false;

  event.preventDefault();
  insertTextAtCursor(input, `\n${prefix}`);
  return true;
}

function adjustMarkdownIndent(event) {
  if (!input || event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;

  event.preventDefault();
  const value = input.value;
  const startBounds = getLineBounds(value, input.selectionStart);
  const endBounds = getLineBounds(value, input.selectionEnd);
  const blockStart = startBounds.lineStart;
  const blockEnd = endBounds.lineEnd;
  const lines = value.slice(blockStart, blockEnd).split('\n');
  let startDelta = 0;
  let endDelta = 0;

  const nextLines = lines.map((line, index) => {
    if (!event.shiftKey) {
      if (index === 0) startDelta += 2;
      endDelta += 2;
      return `  ${line}`;
    }
    if (line.startsWith('  ')) {
      if (index === 0) startDelta -= Math.min(2, input.selectionStart - blockStart);
      endDelta -= 2;
      return line.slice(2);
    }
    if (line.startsWith('\t')) {
      if (index === 0) startDelta -= Math.min(1, input.selectionStart - blockStart);
      endDelta -= 1;
      return line.slice(1);
    }
    return line;
  });

  const nextBlock = nextLines.join('\n');
  replaceLines(
    input,
    `${value.slice(0, blockStart)}${nextBlock}${value.slice(blockEnd)}`,
    Math.max(blockStart, input.selectionStart + startDelta),
    Math.max(blockStart, input.selectionEnd + endDelta),
  );
  return true;
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

function splitMarkdownTableRow(line) {
  let source = String(line || '').trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|') && source.at(-2) !== '\\') source = source.slice(0, -1);

  const cells = [];
  let cell = '';
  let escaped = false;
  for (const char of source) {
    if (escaped) {
      cell += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      cell += char;
      continue;
    }
    if (char === '|') {
      cells.push(cell.trim().replace(/\\\|/g, '|'));
      cell = '';
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim().replace(/\\\|/g, '|'));
  return cells;
}

function isMarkdownTableSeparator(line) {
  const cells = splitMarkdownTableRow(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isMarkdownTableRow(line) {
  return /\|/.test(line) && String(line || '').trim().length > 0;
}

function fencedLineMap(lines) {
  const map = [];
  let inside = false;
  lines.forEach((line, index) => {
    const fence = /^\s{0,3}(```|~~~)/.test(line);
    map[index] = inside || fence;
    if (fence) inside = !inside;
  });
  return map;
}

function parseMarkdownTable(block) {
  const rows = String(block || '')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !isMarkdownTableSeparator(line))
    .map(splitMarkdownTableRow);
  const width = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ''));
}

function findMarkdownTables(markdown) {
  const value = String(markdown || '');
  const lines = value.split('\n');
  const offsets = [];
  let position = 0;
  lines.forEach((line) => {
    offsets.push(position);
    position += line.length + 1;
  });
  const fenced = fencedLineMap(lines);
  const tables = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (fenced[index] || fenced[index + 1]) continue;
    if (!isMarkdownTableRow(lines[index]) || !isMarkdownTableSeparator(lines[index + 1])) continue;

    let endLine = index + 2;
    while (endLine < lines.length && !fenced[endLine] && isMarkdownTableRow(lines[endLine])) {
      endLine += 1;
    }
    const start = offsets[index];
    const end = endLine < lines.length ? Math.max(start, offsets[endLine] - 1) : value.length;
    const block = value.slice(start, end);
    tables.push({ start, end, rows: parseMarkdownTable(block) });
    index = endLine - 1;
  }

  return tables;
}

function escapeMarkdownTableCell(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').trim();
}

function serializeMarkdownTable(rows) {
  const sourceRows = Array.isArray(rows) && rows.length ? rows : [['']];
  const width = Math.max(1, ...sourceRows.map((row) => Array.isArray(row) ? row.length : 0));
  const normalized = sourceRows.map((row) => Array.from({ length: width }, (_, index) => escapeMarkdownTableCell(row?.[index])));
  while (normalized.length < 2) normalized.push(Array.from({ length: width }, () => ''));
  const separator = Array.from({ length: width }, () => '---');
  return [normalized[0], separator, ...normalized.slice(1)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function tableMarkdownBlocks() {
  return findMarkdownTables(input?.value || '');
}

function clampTableEditorPosition(left, top, panel) {
  const margin = 10;
  const width = panel?.offsetWidth || 760;
  const height = panel?.offsetHeight || 420;
  return {
    left: Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - width - margin)),
    top: Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight - height - margin)),
  };
}

function moveTableEditor(panel, left, top) {
  if (!panel) return;
  const position = clampTableEditorPosition(left, top, panel);
  panel.style.left = `${position.left}px`;
  panel.style.top = `${position.top}px`;
  panel.style.right = 'auto';
  tableEditorPosition = position;
}

function startTableEditorDrag(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (event.button !== 0 || target?.closest('button, input, textarea, select')) return;
  const panel = target?.closest('.post-table-editor-panel');
  if (!(panel instanceof HTMLElement)) return;
  const rect = panel.getBoundingClientRect();
  tableEditorDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  panel.classList.add('is-dragging');
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function dragTableEditor(event) {
  if (!tableEditorDrag || event.pointerId !== tableEditorDrag.pointerId) return;
  const panel = document.querySelector('.post-table-editor-panel');
  if (!(panel instanceof HTMLElement)) return;
  moveTableEditor(panel, event.clientX - tableEditorDrag.offsetX, event.clientY - tableEditorDrag.offsetY);
}

function endTableEditorDrag(event) {
  if (!tableEditorDrag || event.pointerId !== tableEditorDrag.pointerId) return;
  document.querySelector('.post-table-editor-panel')?.classList.remove('is-dragging');
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  tableEditorDrag = null;
}

function ensureTableEditor() {
  let editor = document.querySelector('[data-table-editor]');
  if (editor) return editor;

  editor = document.createElement('div');
  editor.className = 'post-table-editor';
  editor.dataset.tableEditor = '';
  editor.hidden = true;
  editor.innerHTML = `
    <section class="post-table-editor-panel" role="dialog" aria-label="编辑表格">
      <div class="post-table-editor-top">
        <strong>编辑表格</strong>
        <button type="button" class="post-table-editor-close" data-table-editor-close aria-label="关闭">×</button>
      </div>
      <div class="post-table-editor-grid" data-table-editor-grid></div>
      <div class="post-table-editor-actions">
        <button type="button" data-table-add-row>加行</button>
        <button type="button" data-table-add-column>加列</button>
        <button type="button" data-table-remove-row>删行</button>
        <button type="button" data-table-remove-column>删列</button>
        <span></span>
        <button type="button" data-table-editor-close>取消</button>
        <button type="button" class="primary" data-table-apply>应用</button>
      </div>
    </section>
  `;
  document.querySelector('[data-post-editor-page]')?.appendChild(editor) || document.body.appendChild(editor);
  const dragHandle = editor.querySelector('.post-table-editor-top');
  dragHandle?.addEventListener('pointerdown', startTableEditorDrag);
  dragHandle?.addEventListener('pointermove', dragTableEditor);
  dragHandle?.addEventListener('pointerup', endTableEditorDrag);
  dragHandle?.addEventListener('pointercancel', endTableEditorDrag);
  return editor;
}

function renderTableEditor() {
  if (!tableEditorState) return;
  const editor = ensureTableEditor();
  const grid = editor.querySelector('[data-table-editor-grid]');
  if (!grid) return;
  const rows = tableEditorState.rows;
  grid.innerHTML = `
    <table>
      <tbody>
        ${rows.map((row, rowIndex) => `
          <tr>
            ${row.map((cell, columnIndex) => `
              <${rowIndex === 0 ? 'th' : 'td'}>
                <input value="${escapeHtml(cell)}" data-table-cell-row="${rowIndex}" data-table-cell-column="${columnIndex}" aria-label="第${rowIndex + 1}行第${columnIndex + 1}列" />
              </${rowIndex === 0 ? 'th' : 'td'}>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function closeTableEditor() {
  const editor = document.querySelector('[data-table-editor]');
  if (editor) editor.hidden = true;
  tableEditorState = null;
}

function openTableEditor(tableIndex) {
  const blocks = tableMarkdownBlocks();
  const block = blocks[Number(tableIndex)];
  if (!block) {
    setStatus('TABLE EDIT FAILED');
    return;
  }
  tableEditorState = {
    tableIndex: Number(tableIndex),
    sourceStart: block.start,
    sourceEnd: block.end,
    rows: block.rows.map((row) => [...row]),
  };
  const editor = ensureTableEditor();
  renderTableEditor();
  editor.hidden = false;
  const panel = editor.querySelector('.post-table-editor-panel');
  if (tableEditorPosition && panel instanceof HTMLElement) {
    moveTableEditor(panel, tableEditorPosition.left, tableEditorPosition.top);
  }
  editor.querySelector('input')?.focus();
}

function updateTableCell(rowIndex, columnIndex, value) {
  if (!tableEditorState) return;
  const row = Number(rowIndex);
  const column = Number(columnIndex);
  if (!Number.isFinite(row) || !Number.isFinite(column) || !tableEditorState.rows[row]) return;
  tableEditorState.rows[row][column] = value;
}

function resizeTableEditor(action) {
  if (!tableEditorState) return;
  const rows = tableEditorState.rows;
  const width = Math.max(1, ...rows.map((row) => row.length));
  if (action === 'add-row') {
    rows.push(Array.from({ length: width }, () => ''));
  }
  if (action === 'add-column') {
    rows.forEach((row) => row.push(''));
  }
  if (action === 'remove-row' && rows.length > 2) {
    rows.pop();
  }
  if (action === 'remove-column' && width > 1) {
    rows.forEach((row) => row.pop());
  }
  renderTableEditor();
}

function applyTableEdit() {
  if (!input || !tableEditorState) return;
  const blocks = tableMarkdownBlocks();
  const block = blocks[tableEditorState.tableIndex];
  if (!block || block.start !== tableEditorState.sourceStart || block.end !== tableEditorState.sourceEnd) {
    setStatus('TABLE EDIT FAILED');
    return;
  }
  const replacement = serializeMarkdownTable(tableEditorState.rows);
  const nextValue = `${input.value.slice(0, block.start)}${replacement}${input.value.slice(block.end)}`;
  replaceLines(input, nextValue, block.start, block.start + replacement.length);
  closeTableEditor();
  updatePreview();
}

function enhancePreviewTables() {
  if (!preview || !input) return;
  const blocks = tableMarkdownBlocks();
  preview.querySelectorAll('table').forEach((table, index) => {
    if (!blocks[index] || table.closest('.post-preview-table-wrap')) return;
    table.classList.add('post-preview-editable-table');
    table.setAttribute('data-preview-table-index', String(index));
    const wrap = document.createElement('div');
    wrap.className = 'post-preview-table-wrap';
    table.parentNode?.insertBefore(wrap, table);
    wrap.appendChild(table);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'post-preview-table-edit';
    button.setAttribute('data-preview-table-index', String(index));
    button.textContent = '编辑表格';
    wrap.appendChild(button);
  });
}

function previewIsVisible() {
  return editorMode === 'preview' || editorMode === 'split';
}

function setPreviewState(state, message = '') {
  if (!preview) return;
  preview.dataset.previewState = state;
  preview.setAttribute('aria-busy', String(state === 'loading'));
  if (message) preview.title = message;
  else preview.removeAttribute('title');
}

function clearPreviewStatus() {
  preview?.querySelector('[data-preview-status]')?.remove();
}

function renderPreviewLoading() {
  if (!preview) return;
  clearPreviewStatus();
  if (hasSuccessfulPreview) return;
  const status = document.createElement('div');
  status.className = 'post-preview-status is-loading';
  status.setAttribute('data-preview-status', 'loading');
  status.setAttribute('role', 'status');
  status.textContent = '正在生成预览';
  preview.replaceChildren(status);
}

function renderPreviewError(failureStatus) {
  if (!preview) return;
  clearPreviewStatus();
  const status = document.createElement('div');
  status.className = 'post-preview-status is-error';
  status.setAttribute('data-preview-status', 'error');
  status.setAttribute('role', 'alert');

  const message = document.createElement('span');
  message.textContent = failureStatus ? `预览连接失败（${failureStatus}）` : '预览连接失败';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.setAttribute('data-preview-retry', 'true');
  retry.textContent = '重试';
  retry.addEventListener('click', () => void updatePreview(), { once: true });
  status.append(message, retry);

  if (hasSuccessfulPreview) preview.prepend(status);
  else preview.replaceChildren(status);
}

function waitForPreviewRetry() {
  return new Promise((resolve) => window.setTimeout(resolve, PREVIEW_RETRY_DELAY_MS));
}

async function updatePreview() {
  if (!preview || !input || !previewIsVisible()) return;
  const markdown = input.value;
  if (hasSuccessfulPreview && markdown === lastPreviewMarkdown) {
    setPreviewState('ready');
    return;
  }
  if (markdown === previewPendingMarkdown && previewAbortController) return;
  const requestId = ++previewRequestId;
  previewAbortController?.abort();
  const controller = new AbortController();
  previewAbortController = controller;
  previewPendingMarkdown = markdown;
  setPreviewState('loading');
  renderPreviewLoading();
  let failureStatus = null;

  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch('/api/admin/posts/preview', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ markdown }),
          signal: controller.signal,
        });
        if (requestId !== previewRequestId || controller.signal.aborted) return;
        if (!res.ok) {
          failureStatus = res.status;
          const retryable = res.status === 429 || res.status >= 500;
          if (attempt === 0 && retryable) {
            await waitForPreviewRetry();
            if (controller.signal.aborted) return;
            continue;
          }
          break;
        }
        if (!String(res.headers.get('content-type') || '').includes('application/json')) {
          throw new Error('Preview response is not JSON');
        }
        const data = await res.json();
        if (requestId !== previewRequestId || controller.signal.aborted) return;
        preview.innerHTML = data.html || '<p>预览会显示在这里。</p>';
        hasSuccessfulPreview = true;
        lastPreviewMarkdown = markdown;
        setPreviewState('ready');
        enhancePreviewTables();
        return;
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        if (attempt === 0) {
          await waitForPreviewRetry();
          if (controller.signal.aborted) return;
          continue;
        }
      }
    }

    if (requestId === previewRequestId) {
      renderPreviewError(failureStatus);
      setPreviewState('error', failureStatus ? `预览更新失败（${failureStatus}）` : '预览更新失败');
    }
  } finally {
    if (previewAbortController === controller) {
      previewAbortController = null;
      previewPendingMarkdown = '';
    }
  }
}

function schedulePreview() {
  markDirty();
  window.clearTimeout(previewTimer);
  if (!previewIsVisible()) return;
  previewTimer = window.setTimeout(updatePreview, PREVIEW_DELAY_MS);
}

function collectPayload({ automatic = false } = {}) {
  const data = new FormData(form);
  return {
    title: data.get('title'),
    slug: data.get('slug') || slugify(data.get('title')) || fallbackSlug(),
    kind: data.get('kind'),
    description: data.get('description'),
    date: data.get('date'),
    body: input.value,
    published: data.get('published') === 'on',
    featured: data.get('featured') === 'on',
    visibility: data.get('visibility'),
    lockedNoteKey: data.get('lockedNoteKey'),
    tags: data.getAll('tags'),
    topicSlugs: data.getAll('topicSlugs'),
    versionSource: automatic ? 'autosave' : 'manual',
  };
}

async function savePost({ automatic = false } = {}) {
  if (isSaving || isDeleting) return false;
  window.clearTimeout(autoSaveTimer);
  const payload = collectPayload({ automatic });
  const savingSignature = payloadSignature(payload);
  if (!isDirty && savingSignature === lastSavedSignature) {
    setSaveState('saved');
    return true;
  }
  isSaving = true;
  autoSavePaused = false;
  if (saveButton) saveButton.disabled = true;
  if (deleteButton) deleteButton.disabled = true;
  if (previewButton) previewButton.disabled = true;
  setSaveState('saving', automatic ? '正在自动保存' : '正在保存');
  let succeeded = false;
  try {
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `保存失败（${res.status}）`);
    }
    const data = await res.json();
    const currentPayload = collectPayload();
    const currentSignature = payloadSignature(currentPayload);
    const slugChangedDuringSave = currentPayload.slug !== payload.slug;
    post.slug = data.item.slug;
    post.title = data.item.title;
    if (slugInput && !slugChangedDuringSave) slugInput.value = data.item.slug;
    lastSavedSignature = payloadSignature({ ...payload, slug: data.item.slug });
    if (currentSignature === savingSignature) lastSavedSignature = payloadSignature();
    isDirty = payloadSignature() !== lastSavedSignature;
    setSaveState(isDirty ? 'dirty' : 'saved');
    if (isDirty) scheduleLocalDraft();
    else clearLocalDraft();
    succeeded = !isDirty;
  } catch (error) {
    isDirty = true;
    autoSavePaused = true;
    setSaveState('error', error instanceof Error ? error.message : '保存失败');
    persistLocalDraft();
  } finally {
    isSaving = false;
    if (saveButton) saveButton.disabled = false;
    if (deleteButton) deleteButton.disabled = false;
    if (previewButton) previewButton.disabled = false;
    if (isDirty && !autoSavePaused) scheduleAutoSave();
  }
  return succeeded;
}

async function unlockLockedPost() {
  const key = lockedNoteKeyInput?.value?.trim();
  if (!key) {
    setStatus('KEY REQUIRED');
    lockedNoteKeyInput?.focus();
    return;
  }
  setStatus('UNLOCKING');
  const res = await fetch(`/api/admin/posts/${post.id}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lockedNoteKey: key }),
  });
  if (!res.ok) {
    setStatus('UNLOCK FAILED');
    if (lockedNoteStatus) lockedNoteStatus.textContent = '密钥不对';
    return;
  }
  setStatus('UNLOCKED');
  window.location.reload();
}

async function deletePost() {
  if (isSaving || isDeleting || Number(window.__postImageUploads || 0) > 0) return;
  const title = form?.querySelector('input[name="title"]')?.value || post.title || '当前笔记';
  if (!window.confirm(`确认删除“${title}”？此操作不可撤销。`)) return;
  window.clearTimeout(autoSaveTimer);
  autoSavePaused = true;
  isDeleting = true;
  if (deleteButton) deleteButton.disabled = true;
  if (saveButton) saveButton.disabled = true;
  if (previewButton) previewButton.disabled = true;
  setStatus('正在删除', 'saving');
  try {
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) throw new Error(`删除失败（${res.status}）`);
    isDirty = false;
    clearLocalDraft();
    window.location.href = '/admin/posts';
  } catch (error) {
    autoSavePaused = false;
    setStatus(error instanceof Error ? error.message : '删除失败', 'error');
    scheduleAutoSave();
  } finally {
    isDeleting = false;
    if (deleteButton) deleteButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
    if (previewButton) previewButton.disabled = false;
  }
}

async function openFrontendPreview() {
  if (isSaving || isDeleting) return;
  if (Number(window.__postImageUploads || 0) > 0) {
    setStatus('图片仍在上传，请稍候', 'saving');
    return;
  }
  const previewWindow = window.open('about:blank', '_blank');
  if (!previewWindow) return;
  previewWindow.opener = null;
  if (isDirty && !await savePost()) {
    previewWindow.close();
    return;
  }
  const slug = form?.querySelector('[name="slug"]')?.value || post.slug;
  previewWindow.location.replace(`/posts/${slug}`);
}

function versionSourceLabel(source) {
  return source === 'autosave' ? '自动保存' : source === 'restore' ? '恢复前' : '手动保存';
}

function formatVersionTime(value) {
  const date = new Date(String(value || '').replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.valueOf())) return String(value || '');
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function renderVersionDiff(result) {
  if (!historyDiff) return;
  if (result.locked) {
    historyDiff.innerHTML = '<p class="post-history-empty">先解锁笔记，再查看正文差异。</p>';
    return;
  }
  const metadataFields = [
    ['标题', 'title'], ['摘要', 'description'], ['日期', 'date'], ['类型', 'kindLabel'],
    ['发布', 'published'], ['重点', 'featured'], ['权限', 'visibility'],
  ];
  const formatMetadataValue = (key, value) => {
    if (key === 'published' || key === 'featured') return Number(value) ? '是' : '否';
    if (key === 'visibility') return value === 'locked' ? '加密' : '公开';
    return String(value ?? '') || '空';
  };
  const metadataChanges = metadataFields.flatMap(([label, key]) => {
    const before = formatMetadataValue(key, result.version?.[key]);
    const after = formatMetadataValue(key, result.current?.[key]);
    return before === after ? [] : [{ label, before, after }];
  });
  [['标签', 'tags'], ['主线', 'topicSlugs']].forEach(([label, key]) => {
    const before = [...(result.version?.[key] || [])].sort().join('、') || '无';
    const after = [...(result.current?.[key] || [])].sort().join('、') || '无';
    if (before !== after) metadataChanges.push({ label, before, after });
  });
  const metadataHtml = metadataChanges.length
    ? `<div class="post-history-metadata">${metadataChanges.map((item) => `<div><strong>${escapeHtml(item.label)}</strong><del>${escapeHtml(item.before)}</del><ins>${escapeHtml(item.after)}</ins></div>`).join('')}</div>`
    : '';
  const meaningfulChanges = (result.changes || []).filter((change) => change.added || change.removed);
  const bodyHtml = meaningfulChanges.length ? (result.changes || []).map((change) => {
    const kind = change.added ? 'added' : change.removed ? 'removed' : 'same';
    const marker = change.added ? '+' : change.removed ? '−' : '';
    if (kind === 'same') {
      return `<div class="post-history-change is-omitted"><span>···</span><pre>未修改 ${Number(change.count || 0)} 行</pre></div>`;
    }
    return `<div class="post-history-change is-${kind}"><span>${marker}</span><pre>${escapeHtml(change.value)}</pre></div>`;
  }).join('') : '<p class="post-history-empty">正文没有变化</p>';
  historyDiff.innerHTML = `${metadataHtml}${bodyHtml}`;
}

async function selectVersion(versionId, button = null) {
  if (!historyDiff || !historySelected || !historyRestoreButton) return;
  selectedVersionId = Number(versionId);
  historyList?.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
  historySelected.textContent = '正在读取';
  historyRestoreButton.disabled = true;
  historyDiff.innerHTML = '<p class="post-history-empty">正在比较</p>';
  try {
    const response = await fetch(`/api/admin/posts/${post.id}/versions/${selectedVersionId}`, {
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`读取失败（${response.status}）`);
    const result = await response.json();
    historySelected.textContent = `${formatVersionTime(result.version.created_at)} · ${versionSourceLabel(result.version.source)}`;
    historyRestoreButton.disabled = false;
    renderVersionDiff(result);
  } catch (error) {
    selectedVersionId = null;
    historySelected.textContent = '读取失败';
    historyDiff.innerHTML = `<p class="post-history-empty is-error">${escapeHtml(error instanceof Error ? error.message : '读取失败')}</p>`;
  }
}

async function loadVersionHistory() {
  if (!historyList || !historyDiff || !historyRestoreButton) return;
  historyList.innerHTML = '<p class="post-history-empty">正在读取</p>';
  historyDiff.innerHTML = '';
  historyRestoreButton.disabled = true;
  selectedVersionId = null;
  try {
    const response = await fetch(`/api/admin/posts/${post.id}/versions`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`读取失败（${response.status}）`);
    const data = await response.json();
    if (!data.items?.length) {
      historyList.innerHTML = '<p class="post-history-empty">保存一次后会生成历史版本。</p>';
      return;
    }
    historyList.replaceChildren(...data.items.map((version) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.versionId = String(version.id);
      button.innerHTML = `<strong>${escapeHtml(formatVersionTime(version.createdAt))}</strong><span>${escapeHtml(versionSourceLabel(version.source))}</span>`;
      return button;
    }));
    const first = historyList.querySelector('button');
    if (first) await selectVersion(first.dataset.versionId, first);
  } catch (error) {
    historyList.innerHTML = `<p class="post-history-empty is-error">${escapeHtml(error instanceof Error ? error.message : '读取失败')}</p>`;
  }
}

async function openVersionHistory() {
  if (!historyDialog) return;
  if (isDirty && !await savePost()) return;
  if (typeof historyDialog.showModal === 'function') historyDialog.showModal();
  else historyDialog.setAttribute('open', '');
  await loadVersionHistory();
}

async function restoreSelectedVersion() {
  if (!selectedVersionId || !historyRestoreButton) return;
  if (!window.confirm('恢复此版本？当前内容会先保留为一个历史版本。')) return;
  historyRestoreButton.disabled = true;
  historyRestoreButton.textContent = '正在恢复';
  try {
    const response = await fetch(`/api/admin/posts/${post.id}/versions/${selectedVersionId}`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `恢复失败（${response.status}）`);
    }
    isDirty = false;
    window.location.reload();
  } catch (error) {
    historyRestoreButton.disabled = false;
    historyRestoreButton.textContent = '恢复此版本';
    setSaveState('error', error instanceof Error ? error.message : '恢复失败');
  }
}

document.querySelectorAll('[data-editor-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.editorMode;
    editorMode = mode;
    shell?.classList.toggle('is-edit', mode === 'edit');
    shell?.classList.toggle('is-preview', mode === 'preview');
    shell?.classList.toggle('is-split', mode === 'split');
    document.querySelectorAll('[data-editor-mode]').forEach((el) => {
      const active = el === button;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', String(active));
    });
    writePane?.setAttribute('aria-hidden', String(mode === 'preview'));
    preview?.setAttribute('aria-hidden', String(mode === 'edit'));
    window.clearTimeout(previewTimer);
    if (previewIsVisible()) updatePreview();
    else previewAbortController?.abort();
  });
});

metaToggle?.addEventListener('click', () => {
  setMetaCollapsed(!metaCollapsed);
});

input?.addEventListener('input', schedulePreview);
input?.addEventListener('keydown', (event) => {
  if (handleMarkdownShortcut(event)) return;
  if (expandSlashCommand(event)) return;
  if (expandCodeFenceShortcut(event)) return;
  if (continueMarkdownBlock(event)) return;
  adjustMarkdownIndent(event);
});
input?.addEventListener('paste', (event) => {
  const files = imageFilesFromList(event.clipboardData?.files);
  if (!files.length) return;
  event.preventDefault();
  insertUploadedImages(files);
});
input?.addEventListener('dragover', (event) => {
  if (!imageFilesFromList(event.dataTransfer?.files).length) return;
  event.preventDefault();
});
input?.addEventListener('drop', (event) => {
  const files = imageFilesFromList(event.dataTransfer?.files);
  if (!files.length) return;
  event.preventDefault();
  insertUploadedImages(files);
});
form?.addEventListener('input', (event) => {
  const target = event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || event.target instanceof HTMLSelectElement
    ? event.target
    : null;
  if (!target?.name) return;
  schedulePreview();
});
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

saveButton?.addEventListener('click', () => void savePost());
unlockLockedPostButton?.addEventListener('click', unlockLockedPost);
deleteButton?.addEventListener('click', deletePost);
previewButton?.addEventListener('click', () => void openFrontendPreview());
historyButton?.addEventListener('click', () => void openVersionHistory());
historyCloseButton?.addEventListener('click', () => historyDialog?.close());
historyList?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-version-id]') : null;
  if (!(button instanceof HTMLButtonElement)) return;
  void selectVersion(button.dataset.versionId, button);
});
historyRestoreButton?.addEventListener('click', () => void restoreSelectedVersion());
localDraftRestoreButton?.addEventListener('click', () => applyLocalDraft(pendingLocalDraft));
localDraftDiscardButton?.addEventListener('click', clearLocalDraft);
preview?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const button = target?.closest('.post-preview-table-edit');
  if (!button || !preview.contains(button)) return;
  openTableEditor(button.dataset.previewTableIndex);
});
preview?.addEventListener('dblclick', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const table = target?.closest('.post-preview-editable-table');
  if (!table || !preview.contains(table)) return;
  openTableEditor(table.dataset.previewTableIndex);
});
document.addEventListener('input', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const cell = target?.closest('[data-table-cell-row]');
  if (!(cell instanceof HTMLInputElement)) return;
  updateTableCell(cell.dataset.tableCellRow, cell.dataset.tableCellColumn, cell.value);
});
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-table-editor-close]')) {
    closeTableEditor();
    return;
  }
  if (target?.closest('[data-table-add-row]')) {
    resizeTableEditor('add-row');
    return;
  }
  if (target?.closest('[data-table-add-column]')) {
    resizeTableEditor('add-column');
    return;
  }
  if (target?.closest('[data-table-remove-row]')) {
    resizeTableEditor('remove-row');
    return;
  }
  if (target?.closest('[data-table-remove-column]')) {
    resizeTableEditor('remove-column');
    return;
  }
  if (target?.closest('[data-table-apply]')) {
    applyTableEdit();
  }
});
document.addEventListener('keydown', (event) => {
  const primary = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (primary && key === 's') {
    event.preventDefault();
    void savePost();
    return;
  }
  if (primary && !event.shiftKey && key === 'p') {
    event.preventDefault();
    void openFrontendPreview();
    return;
  }
  if (primary && event.shiftKey && key === 'p') {
    event.preventDefault();
    document.dispatchEvent(new CustomEvent('admin-agent:open'));
    return;
  }
  if (primary && event.key === '\\') {
    event.preventDefault();
    document.querySelector('[data-editor-mode="split"]')?.click();
    return;
  }
  if (event.key === 'Escape' && tableEditorState) closeTableEditor();
});
window.addEventListener('beforeunload', (event) => {
  if (isDirty) persistLocalDraft();
  if (!isDirty && !isSaving && !isDeleting && Number(window.__postImageUploads || 0) === 0) return;
  event.preventDefault();
  event.returnValue = '';
});
window.addEventListener('pagehide', () => {
  if (isDirty) persistLocalDraft();
});
window.addEventListener('resize', () => {
  if (!tableEditorPosition) return;
  const panel = document.querySelector('.post-table-editor-panel');
  if (panel instanceof HTMLElement) moveTableEditor(panel, tableEditorPosition.left, tableEditorPosition.top);
});

renderTags();
lastSavedSignature = payloadSignature();
setSaveState('saved');
offerLocalDraftRecovery();
