const state = { items: [], stats: {}, filter: 'all', query: '', controller: null };
const listEl = document.querySelector('[data-food-list]');
const summaryEl = document.querySelector('[data-food-summary]');
const searchEl = document.querySelector('[data-food-search]');
const errorEl = document.querySelector('[data-food-error]');

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
    const style = image ? `style="background-image:url('${escapeHtml(image)}')"` : '';
    const badges = [item.status, item.published ? '' : '未发布', item.is_featured ? '首页精选' : ''].filter(Boolean).join(' · ');
    return `
      <a class="cms-index-row" href="/admin/food/${item.id}/edit">
        <span class="cms-index-row-main">
          <span class="cms-index-thumb cms-food-thumb" ${style}>${image ? '' : '食'}</span>
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
  try {
    const response = await fetch(`/api/admin/food?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error('读取美食失败');
    const data = await response.json();
    if (state.controller !== controller) return;
    state.items = data.items || [];
    state.stats = data.stats || {};
    render();
  } catch (error) {
    if (error.name === 'AbortError') return;
    errorEl.hidden = false;
    summaryEl.textContent = error.message;
  }
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter || 'all';
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems();
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadItems, 180);
});

document.querySelector('[data-food-retry]')?.addEventListener('click', loadItems);
loadItems();
