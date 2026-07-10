const state = {
  items: [],
  stats: null,
  selected: null,
  mode: 'edit',
  filter: 'all',
  query: '',
};

const listEl = document.querySelector('[data-radar-list]');
const statsEl = document.querySelector('[data-radar-stats]');
const editorEl = document.querySelector('[data-radar-editor]');
const searchEl = document.querySelector('[data-radar-search]');
const saveStateEl = document.querySelector('[data-save-state]');
const createButton = document.querySelector('[data-create-radar]');

const scopeLabels = {
  movie: 'Movie 电影',
  code: 'Code 技术',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function visibleItems() {
  const query = state.query.trim().toLowerCase();
  return state.items.filter((item) => {
    const matchQuery = !query
      || item.label.toLowerCase().includes(query)
      || item.zh.toLowerCase().includes(query)
      || item.scope.toLowerCase().includes(query);
    return matchQuery;
  });
}

async function loadItems() {
  const params = new URLSearchParams({ scope: state.filter });
  const res = await fetch(`/api/admin/radar?${params}`);
  if (!res.ok) throw new Error('Failed to load radar tags');
  const data = await res.json();
  state.items = data.items;
  state.stats = data.stats;
  if (state.mode !== 'create') {
    if (!state.selected || !state.items.some((item) => item.id === state.selected.id)) {
      state.selected = state.items[0] || null;
    } else {
      state.selected = state.items.find((item) => item.id === state.selected.id);
    }
  }
  render();
}

function renderStats() {
  statsEl.innerHTML = [
    ['总标签', state.stats.total, '首页雷达配置项'],
    ['Movie', state.stats.movie, '影像类型标签'],
    ['Code', state.stats.code, '技术主线标签'],
    ['停用', state.stats.disabled, '暂不显示在前台'],
  ].map(([label, value, hint]) => `
    <article class="cms-metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${hint}</p>
    </article>
  `).join('');
}

function renderList() {
  const items = visibleItems();
  if (!items.length) {
    listEl.innerHTML = '<p class="cms-empty">没有匹配的统计标签。</p>';
    return;
  }

  listEl.innerHTML = items.map((item) => `
    <button class="cms-item ${state.mode === 'edit' && state.selected?.id === item.id ? 'active' : ''}" data-id="${item.id}">
      <span class="cms-thumb cms-thumb-radar ${item.scope}">${item.scope.toUpperCase()}</span>
      <span>
        <small>${scopeLabels[item.scope] || item.scope} / sort ${item.sort_order}</small>
        <strong>${escapeHtml(item.label)} ${escapeHtml(item.zh)}</strong>
        <em>count ${item.count} · value ${item.value}% · ${item.is_enabled ? '前台显示' : '已停用'}</em>
      </span>
      <b>${item.value}%</b>
    </button>
  `).join('');

  listEl.querySelectorAll('[data-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = 'edit';
      state.selected = state.items.find((item) => item.id === Number(button.dataset.id));
      render();
    });
  });
}

function editorForm(item, mode) {
  return `
    <span>${mode === 'create' ? 'New Radar Tag' : 'Radar Tag Editor'}</span>
    <form data-radar-form>
      <label>所属雷达
        <select name="scope">
          <option value="movie" ${item.scope === 'movie' ? 'selected' : ''}>Movie 电影</option>
          <option value="code" ${item.scope === 'code' ? 'selected' : ''}>Code 技术</option>
        </select>
      </label>
      <label>英文标签 <input name="label" required value="${escapeHtml(item.label || '')}" placeholder="Drama" /></label>
      <label>中文标签 <input name="zh" value="${escapeHtml(item.zh || '')}" placeholder="剧情" /></label>
      <label>计数 <input name="count" type="number" min="0" step="1" value="${escapeHtml(item.count ?? 0)}" /></label>
      <label>雷达权重 0-100 <input name="value" type="number" min="0" max="100" step="1" value="${escapeHtml(item.value ?? 0)}" /></label>
      <label>排序 <input name="sort_order" type="number" min="0" step="1" value="${escapeHtml(item.sort_order ?? 0)}" /></label>
      <label class="cms-check"><input type="checkbox" name="is_enabled" ${item.is_enabled ? 'checked' : ''} /> 前台显示</label>
      <button type="submit">${mode === 'create' ? '创建标签' : '保存标签'}</button>
    </form>
    ${mode === 'edit' ? `
      <form data-delete-form class="cms-danger-zone">
        <p>删除后首页雷达会立即移除该标签。</p>
        <button type="submit">删除当前标签</button>
      </form>
    ` : ''}
  `;
}

function renderCreateForm() {
  editorEl.innerHTML = editorForm({
    scope: state.filter === 'code' ? 'code' : 'movie',
    label: '',
    zh: '',
    count: 0,
    value: 50,
    sort_order: 100,
    is_enabled: 1,
  }, 'create');
  editorEl.querySelector('[data-radar-form]').addEventListener('submit', createItem);
}

function renderEditor() {
  if (state.mode === 'create') {
    renderCreateForm();
    return;
  }

  const item = state.selected;
  if (!item) {
    editorEl.innerHTML = '<p>从左侧选择一个标签开始编辑，或点击“新增标签”。</p>';
    return;
  }

  editorEl.innerHTML = editorForm(item, 'edit');
  editorEl.querySelector('[data-radar-form]').addEventListener('submit', saveSelected);
  editorEl.querySelector('[data-delete-form]').addEventListener('submit', deleteSelected);
}

function readForm(form) {
  return {
    scope: form.get('scope'),
    label: form.get('label'),
    zh: form.get('zh'),
    count: Number(form.get('count') || 0),
    value: Number(form.get('value') || 0),
    sort_order: Number(form.get('sort_order') || 0),
    is_enabled: form.get('is_enabled') === 'on',
  };
}

function render() {
  renderStats();
  renderList();
  renderEditor();
}

async function createItem(event) {
  event.preventDefault();
  saveStateEl.textContent = 'CREATING';
  const form = new FormData(event.currentTarget);
  const res = await fetch('/api/admin/radar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(readForm(form)),
  });
  if (!res.ok) {
    saveStateEl.textContent = 'CREATE FAILED';
    return;
  }
  const data = await res.json();
  state.mode = 'edit';
  state.filter = data.item.scope;
  state.selected = data.item;
  document.querySelectorAll('[data-filter]').forEach((el) => el.classList.toggle('active', el.dataset.filter === state.filter));
  saveStateEl.textContent = 'CREATED';
  await loadItems();
}

async function saveSelected(event) {
  event.preventDefault();
  if (!state.selected) return;
  saveStateEl.textContent = 'SAVING';
  const form = new FormData(event.currentTarget);
  const res = await fetch(`/api/admin/radar/${state.selected.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(readForm(form)),
  });
  if (!res.ok) {
    saveStateEl.textContent = 'SAVE FAILED';
    return;
  }
  const data = await res.json();
  state.selected = data.item;
  saveStateEl.textContent = 'SAVED';
  await loadItems();
}

async function deleteSelected(event) {
  event.preventDefault();
  const item = state.selected;
  if (!item) return;
  if (!window.confirm(`确认删除 ${item.label} ${item.zh}？`)) return;

  saveStateEl.textContent = 'DELETING';
  const res = await fetch(`/api/admin/radar/${item.id}`, { method: 'DELETE' });
  if (!res.ok) {
    saveStateEl.textContent = 'DELETE FAILED';
    return;
  }
  state.selected = null;
  saveStateEl.textContent = 'DELETED';
  await loadItems();
}

createButton?.addEventListener('click', () => {
  state.mode = 'create';
  state.selected = null;
  render();
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.mode = 'edit';
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((el) => el.classList.toggle('active', el === button));
    loadItems();
  });
});

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

loadItems().catch(() => {
  saveStateEl.textContent = 'LOAD FAILED';
});
