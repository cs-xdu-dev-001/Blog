const dataEl = document.querySelector('#topic-editor-data');
const data = JSON.parse(dataEl?.textContent || '{}');
const form = document.querySelector('[data-topic-editor-form]');
const stateEl = document.querySelector('[data-topic-editor-state]');
const saveButton = document.querySelector('[data-save-topic]');
const deleteTopicButton = document.querySelector('[data-delete-topic]');
const linkedEl = document.querySelector('[data-linked-posts]');
const availableEl = document.querySelector('[data-available-posts]');
const availableSearch = document.querySelector('[data-available-search]');
const linkedCount = document.querySelector('[data-linked-count]');
const state = { item: data.item || null, linked: [], available: [], query: '', dirty: false };
let isSaving = false;
let isDeleting = false;
let changeVersion = 0;
let postsChangeVersion = 0;
let postsSavePending = 0;
let postsSaveQueue = Promise.resolve();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(text, status = 'idle') {
  if (!stateEl) return;
  stateEl.textContent = text;
  stateEl.dataset.state = status;
}

function saveError(response) {
  if (response.status === 401) return '登录已失效，请重新登录';
  if (response.status === 403) return '保存被拒绝，请刷新后重试';
  return `保存失败（${response.status}）`;
}

function formPayload() {
  const values = new FormData(form);
  return {
    title: String(values.get('title') || '').trim(),
    slug: String(values.get('slug') || '').trim(),
    meta: String(values.get('meta') || '').trim(),
    level: Number(values.get('level') || 5),
    text: String(values.get('text') || '').trim(),
  };
}

async function saveTopic(event) {
  event.preventDefault();
  if (isSaving || isDeleting) return;
  const payload = formPayload();
  if (!payload.title) return setStatus('名称不能为空', 'error');
  isSaving = true;
  const savingVersion = changeVersion;
  setStatus(data.mode === 'create' ? '正在创建' : '正在保存', 'saving');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = data.mode === 'create' ? '创建中' : '保存中';
  }
  const url = data.mode === 'create' ? '/api/admin/topics' : `/api/admin/topics/${encodeURIComponent(state.item.slug)}`;
  try {
    const response = await fetch(url, {
      method: data.mode === 'create' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(saveError(response));
    const result = await response.json();
    state.item = result.item;
    state.dirty = changeVersion !== savingVersion;
    if (data.mode === 'create') {
      window.location.href = `/admin/topics/${encodeURIComponent(result.item.slug)}/edit`;
      return;
    }
    setStatus(state.dirty ? '仍有未保存更改' : '已保存', state.dirty ? 'dirty' : 'saved');
    if (result.item.slug !== data.item.slug) {
      window.location.replace(`/admin/topics/${encodeURIComponent(result.item.slug)}/edit`);
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败，请重试', 'error');
  } finally {
    isSaving = false;
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = data.mode === 'create' ? '创建' : '保存';
    }
  }
}

function renderPosts() {
  if (!linkedEl || !availableEl) return;
  linkedCount.textContent = `${state.linked.length}篇`;
  linkedEl.innerHTML = state.linked.length ? state.linked.map((post, index) => `
    <div class="cms-related-row" data-linked-id="${post.id}">
      <span>${escapeHtml(post.title)}</span>
      <span>
        <button type="button" data-move-post="-1" ${index === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
        <button type="button" data-move-post="1" ${index === state.linked.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
        <button type="button" data-remove-post aria-label="移除">×</button>
      </span>
    </div>
  `).join('') : '<div class="cms-index-empty">暂无关联笔记</div>';
  const query = state.query.toLowerCase();
  const available = query
    ? state.available.filter((post) => [post.title, post.kindLabel, post.description, ...(post.tags || [])]
      .some((value) => String(value || '').toLowerCase().includes(query)))
    : state.available;
  availableEl.innerHTML = available.length ? available.map((post) => `
    <div class="cms-related-row" data-available-id="${post.id}">
      <span>${escapeHtml(post.title)}</span>
      <button type="button" data-add-post aria-label="加入">＋</button>
    </div>
  `).join('') : '<div class="cms-index-empty">没有可添加的笔记</div>';
}

async function loadPosts() {
  if (!state.item || !linkedEl) return;
  const response = await fetch(`/api/admin/topics/${encodeURIComponent(state.item.slug)}/posts`);
  if (!response.ok) throw new Error('读取关联笔记失败');
  const result = await response.json();
  state.linked = result.linked || [];
  state.available = result.available || [];
  renderPosts();
}

function enqueuePostsSave() {
  const version = ++postsChangeVersion;
  const postIds = state.linked.map((post) => post.id);
  postsSavePending += 1;
  setStatus('正在保存关联', 'saving');
  postsSaveQueue = postsSaveQueue
    .catch(() => {})
    .then(async () => {
      const response = await fetch(`/api/admin/topics/${encodeURIComponent(state.item.slug)}/posts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds }),
      });
      if (!response.ok) throw new Error(`保存关联失败（${response.status}）`);
      const result = await response.json();
      if (version !== postsChangeVersion) return;
      state.linked = result.linked || [];
      state.available = result.available || [];
      setStatus(state.dirty ? '关联已保存，资料仍有更改' : '关联已保存', state.dirty ? 'dirty' : 'saved');
      renderPosts();
    })
    .catch((error) => {
      if (version === postsChangeVersion) setStatus(error?.message || '保存关联失败', 'error');
    })
    .finally(() => {
      postsSavePending = Math.max(0, postsSavePending - 1);
    });
  return postsSaveQueue;
}

linkedEl?.addEventListener('click', (event) => {
  const row = event.target instanceof Element ? event.target.closest('[data-linked-id]') : null;
  if (!row) return;
  const index = state.linked.findIndex((post) => post.id === Number(row.dataset.linkedId));
  if (event.target.closest('[data-remove-post]')) {
    state.available.unshift(state.linked.splice(index, 1)[0]);
  } else {
    const move = Number(event.target.closest('[data-move-post]')?.dataset.movePost || 0);
    const next = index + move;
    if (!move || next < 0 || next >= state.linked.length) return;
    [state.linked[index], state.linked[next]] = [state.linked[next], state.linked[index]];
  }
  renderPosts();
  enqueuePostsSave();
});

availableEl?.addEventListener('click', (event) => {
  const row = event.target instanceof Element ? event.target.closest('[data-available-id]') : null;
  if (!row || !event.target.closest('[data-add-post]')) return;
  const index = state.available.findIndex((post) => post.id === Number(row.dataset.availableId));
  state.linked.push(state.available.splice(index, 1)[0]);
  renderPosts();
  enqueuePostsSave();
});

availableSearch?.addEventListener('input', () => {
  state.query = availableSearch.value;
  renderPosts();
});

deleteTopicButton?.addEventListener('click', async () => {
  if (isSaving || isDeleting) return;
  if (postsSavePending > 0) return setStatus('关联仍在保存，请稍候', 'saving');
  if (!state.item || !window.confirm(`确认删除主线“${state.item.title}”？`)) return;
  isDeleting = true;
  deleteTopicButton.disabled = true;
  if (saveButton) saveButton.disabled = true;
  setStatus('正在删除', 'saving');
  try {
    const response = await fetch(`/api/admin/topics/${encodeURIComponent(state.item.slug)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`删除失败（${response.status}）`);
    state.dirty = false;
    window.location.href = '/admin/topics';
  } catch (error) {
    setStatus(error?.message || '删除失败，请重试', 'error');
  } finally {
    isDeleting = false;
    deleteTopicButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
  }
});

form?.addEventListener('submit', saveTopic);
form?.addEventListener('input', () => {
  state.dirty = true;
  changeVersion += 1;
  setStatus('未保存', 'dirty');
});
window.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  form?.requestSubmit();
});
window.addEventListener('beforeunload', (event) => {
  if (!state.dirty && !isSaving && !isDeleting && postsSavePending === 0) return;
  event.preventDefault();
  event.returnValue = '';
});
loadPosts().catch((error) => setStatus(error.message));
