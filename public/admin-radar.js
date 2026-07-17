const state = { items: [], stats: {}, selected: null, filter: 'all', query: '' };
const listEl = document.querySelector('[data-radar-list]');
const summaryEl = document.querySelector('[data-radar-summary]');
const searchEl = document.querySelector('[data-radar-search]');
const drawer = document.querySelector('[data-radar-drawer]');
const drawerTitle = document.querySelector('[data-radar-drawer-title]');
const form = document.querySelector('[data-radar-form]');
const deleteButton = document.querySelector('[data-delete-radar]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function visibleItems() {
  const query = state.query.toLowerCase();
  return query ? state.items.filter((item) => [item.label, item.zh].some((value) => String(value || '').toLowerCase().includes(query))) : state.items;
}

function render() {
  summaryEl.textContent = `${state.stats.total || 0}个标签`;
  const items = visibleItems();
  if (!items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的标签</div>';
    return;
  }
  listEl.innerHTML = items.map((item) => `
    <button class="cms-index-row" type="button" data-radar-id="${item.id}">
      <span class="cms-index-row-main no-media"><span><strong class="cms-index-title">${escapeHtml(item.zh || item.label)}</strong><span class="cms-index-meta">${escapeHtml(item.label)}</span></span></span>
      <span class="cms-index-cell">${item.scope === 'movie' ? '影视' : '技术'}</span>
      <span class="cms-index-badge">${item.value}% · ${item.count}</span>
      <span class="cms-index-action">编辑</span>
    </button>
  `).join('');
}

async function loadItems() {
  const response = await fetch(`/api/admin/radar?scope=${encodeURIComponent(state.filter)}`);
  if (!response.ok) throw new Error('读取标签失败');
  const data = await response.json();
  state.items = data.items || [];
  state.stats = data.stats || {};
  render();
}

function openEditor(item = null) {
  state.selected = item;
  drawerTitle.textContent = item ? '编辑标签' : '新增标签';
  deleteButton.hidden = !item;
  const value = item || { scope: state.filter === 'code' ? 'code' : 'movie', label: '', zh: '', count: 0, value: 50, sort_order: 100, is_enabled: 1 };
  form.innerHTML = `
    <div class="cms-field-grid">
      <label class="cms-field"><span>类型</span><select name="scope"><option value="movie" ${value.scope === 'movie' ? 'selected' : ''}>影视</option><option value="code" ${value.scope === 'code' ? 'selected' : ''}>技术</option></select></label>
      <label class="cms-field"><span>排序</span><input name="sort_order" type="number" min="0" value="${Number(value.sort_order || 0)}" /></label>
      <label class="cms-field"><span>英文标签</span><input name="label" required value="${escapeHtml(value.label)}" /></label>
      <label class="cms-field"><span>中文标签</span><input name="zh" value="${escapeHtml(value.zh)}" /></label>
      <label class="cms-field"><span>计数</span><input name="count" type="number" min="0" value="${Number(value.count || 0)}" /></label>
      <label class="cms-field"><span>雷达权重</span><input name="value" type="number" min="0" max="100" value="${Number(value.value || 0)}" /></label>
    </div>
    <label class="cms-switch"><input type="checkbox" name="is_enabled" ${value.is_enabled ? 'checked' : ''} />前台显示</label>
  `;
  drawer.showModal();
}

function payload() {
  const values = new FormData(form);
  return {
    scope: values.get('scope'), label: values.get('label'), zh: values.get('zh'),
    count: Number(values.get('count') || 0), value: Number(values.get('value') || 0),
    sort_order: Number(values.get('sort_order') || 0), is_enabled: values.get('is_enabled') === 'on',
  };
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await fetch(state.selected ? `/api/admin/radar/${state.selected.id}` : '/api/admin/radar', {
    method: state.selected ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload()),
  });
  if (!response.ok) return;
  drawer.close();
  await loadItems();
});

deleteButton?.addEventListener('click', async () => {
  if (!state.selected || !window.confirm(`确认删除“${state.selected.zh || state.selected.label}”？`)) return;
  const response = await fetch(`/api/admin/radar/${state.selected.id}`, { method: 'DELETE' });
  if (!response.ok) return;
  drawer.close();
  await loadItems();
});

listEl?.addEventListener('click', (event) => {
  const row = event.target instanceof Element ? event.target.closest('[data-radar-id]') : null;
  if (row) openEditor(state.items.find((item) => item.id === Number(row.dataset.radarId)));
});
document.querySelector('[data-create-radar]')?.addEventListener('click', () => openEditor());
document.querySelector('[data-close-radar]')?.addEventListener('click', () => drawer.close());
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  state.filter = button.dataset.filter || 'all';
  document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
  loadItems().catch((error) => { summaryEl.textContent = error.message; });
}));
searchEl?.addEventListener('input', () => { state.query = searchEl.value; render(); });
loadItems().catch((error) => { summaryEl.textContent = error.message; });
