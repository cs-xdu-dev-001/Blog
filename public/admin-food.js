const state = { items: [], stats: {}, filter: 'all', query: '', controller: null };
const listEl = document.querySelector('[data-food-list]');
const summaryEl = document.querySelector('[data-food-summary]');
const searchEl = document.querySelector('[data-food-search]');
const errorEl = document.querySelector('[data-food-error]');
const initialParams = new URLSearchParams(window.location.search);
state.filter = initialParams.get('filter') || 'all';
state.query = initialParams.get('query') || '';
if (searchEl) searchEl.value = state.query;
document.querySelectorAll('[data-filter]').forEach((button) => {
  button.classList.toggle('active', button.dataset.filter === state.filter);
});
const pagination = window.AdminPagination.create({
  root: document.querySelector('[data-admin-pagination]'),
  onChange: loadItems,
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  summaryEl.textContent = `${state.stats.total || 0}条记录 · ${state.stats.published || 0}条已发布`;
  if (!state.items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的美食记录</div>';
    return;
  }
  listEl.innerHTML = state.items.map((item) => {
    const image = item.image_small_path || item.image_path;
    const thumb = image
      ? `<img class="cms-index-thumb cms-food-thumb" src="${escapeHtml(image)}" alt="" width="40" height="40" loading="lazy" decoding="async" />`
      : '<span class="cms-index-thumb cms-food-thumb">食</span>';
    const badges = [item.status, item.published ? '' : '未发布', item.is_featured ? '首页精选' : ''].filter(Boolean).join(' · ');
    return `
      <a class="cms-index-row" href="/admin/food/${item.id}/edit">
        <span class="cms-index-row-main">
          ${thumb}
          <span>
            <strong class="cms-index-title">${escapeHtml(item.title)}</strong>
            <span class="cms-index-meta">${escapeHtml(item.dish || item.comment || '未填写代表菜')}</span>
          </span>
        </span>
        <span class="cms-index-cell">${escapeHtml(item.area || '未填写')}</span>
        <span class="cms-index-badge">${escapeHtml(badges)}</span>
        <span class="cms-index-action">编辑</span>
      </a>
    `;
  }).join('');
}

async function loadItems() {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  errorEl.hidden = true;
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  pagination.appendTo(params);
  listEl.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(`/api/admin/food?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error('读取美食失败');
    const data = await response.json();
    if (state.controller !== controller) return;
    state.items = data.items || [];
    state.stats = data.stats || {};
    pagination.set(data.pagination);
    pagination.syncUrl({ filter: state.filter, query: state.query });
    render();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    errorEl.hidden = false;
    summaryEl.textContent = error.message;
  } finally {
    if (state.controller === controller) {
      state.controller = null;
      listEl.removeAttribute('aria-busy');
    }
  }
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter || 'all';
    pagination.reset();
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems();
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  pagination.reset();
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadItems, 240);
});

document.querySelector('[data-food-retry]')?.addEventListener('click', loadItems);
loadItems();
