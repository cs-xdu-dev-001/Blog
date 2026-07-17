const dataEl = document.querySelector('#topic-editor-data');
const data = JSON.parse(dataEl?.textContent || '{}');
const form = document.querySelector('[data-topic-editor-form]');
const stateEl = document.querySelector('[data-topic-editor-state]');
const linkedEl = document.querySelector('[data-linked-posts]');
const availableEl = document.querySelector('[data-available-posts]');
const availableSearch = document.querySelector('[data-available-search]');
const linkedCount = document.querySelector('[data-linked-count]');
const state = { item: data.item || null, linked: [], available: [], query: '', dirty: false };

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(text) {
  if (stateEl) stateEl.textContent = text;
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
  const payload = formPayload();
  if (!payload.title) return;
  setStatus(data.mode === 'create' ? '正在创建' : '正在保存');
  const url = data.mode === 'create' ? '/api/admin/topics' : `/api/admin/topics/${encodeURIComponent(state.item.slug)}`;
  const response = await fetch(url, {
    method: data.mode === 'create' ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    setStatus(data.mode === 'create' ? '创建失败' : '保存失败');
    return;
  }
  const result = await response.json();
  state.item = result.item;
  state.dirty = false;
  if (data.mode === 'create') {
    window.location.href = `/admin/topics/${encodeURIComponent(result.item.slug)}/edit`;
    return;
  }
  setStatus('已保存');
  if (result.item.slug !== data.item.slug) {
    window.location.replace(`/admin/topics/${encodeURIComponent(result.item.slug)}/edit`);
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
    ? state.available.filter((post) => [post.title, post.category, post.description].some((value) => String(value || '').toLowerCase().includes(query)))
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

async function savePosts() {
  const response = await fetch(`/api/admin/topics/${encodeURIComponent(state.item.slug)}/posts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postIds: state.linked.map((post) => post.id) }),
  });
  if (!response.ok) throw new Error('保存关联失败');
  const result = await response.json();
  state.linked = result.linked || [];
  state.available = result.available || [];
  setStatus('关联已保存');
  renderPosts();
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
  savePosts().catch((error) => setStatus(error.message));
});

availableEl?.addEventListener('click', (event) => {
  const row = event.target instanceof Element ? event.target.closest('[data-available-id]') : null;
  if (!row || !event.target.closest('[data-add-post]')) return;
  const index = state.available.findIndex((post) => post.id === Number(row.dataset.availableId));
  state.linked.push(state.available.splice(index, 1)[0]);
  renderPosts();
  savePosts().catch((error) => setStatus(error.message));
});

availableSearch?.addEventListener('input', () => {
  state.query = availableSearch.value;
  renderPosts();
});

document.querySelector('[data-delete-topic]')?.addEventListener('click', async () => {
  if (!state.item || !window.confirm(`确认删除主线“${state.item.title}”？`)) return;
  const response = await fetch(`/api/admin/topics/${encodeURIComponent(state.item.slug)}`, { method: 'DELETE' });
  if (response.ok) window.location.href = '/admin/topics';
  else setStatus('删除失败');
});

form?.addEventListener('submit', saveTopic);
form?.addEventListener('input', () => { state.dirty = true; setStatus('未保存'); });
window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
loadPosts().catch((error) => setStatus(error.message));
