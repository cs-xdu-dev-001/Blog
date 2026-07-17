const state = { items: [], stats: {}, filter: 'all', query: '' };
const listEl = document.querySelector('[data-watch-list]');
const summaryEl = document.querySelector('[data-watch-summary]');
const searchEl = document.querySelector('[data-watch-search]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  summaryEl.textContent = `${state.stats.total || 0}部影像`;
  if (!state.items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的影像</div>';
    return;
  }
  listEl.innerHTML = state.items.map((item) => {
    const image = item.image_small_path || item.image_path;
    const style = image ? `style="background-image:url('${escapeHtml(image)}')"` : '';
    const activity = item.is_activity_featured ? ' · 观看近况' : '';
    return `
      <a class="cms-index-row" href="/admin/watch/${item.id}/edit">
        <span class="cms-index-row-main">
          <span class="cms-index-thumb" ${style}>${image ? '' : '影'}</span>
          <span>
            <strong class="cms-index-title">${escapeHtml(item.title)}</strong>
            <span class="cms-index-meta">${escapeHtml(item.quote || item.comment || '未填写内容')}</span>
          </span>
        </span>
        <span class="cms-index-cell">${escapeHtml(item.type || '未分类')}</span>
        <span class="cms-index-badge">${escapeHtml(item.status || '未设置')}${activity}</span>
        <span class="cms-index-action">编辑</span>
      </a>
    `;
  }).join('');
}

async function loadItems() {
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  const response = await fetch(`/api/admin/watch?${params}`);
  if (!response.ok) throw new Error('读取影像失败');
  const data = await response.json();
  state.items = data.items || [];
  state.stats = data.stats || {};
  render();
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter || 'all';
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems().catch((error) => { summaryEl.textContent = error.message; });
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(() => loadItems().catch((error) => { summaryEl.textContent = error.message; }), 180);
});

loadItems().catch((error) => {
  summaryEl.textContent = error.message;
  listEl.innerHTML = '<div class="cms-index-error">读取失败，请刷新重试</div>';
});
