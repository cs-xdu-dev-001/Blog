const state = { items: [], stats: {}, filter: 'all', query: '' };
const listEl = document.querySelector('[data-watch-list]');
const summaryEl = document.querySelector('[data-watch-summary]');
const searchEl = document.querySelector('[data-watch-search]');
const errorEl = document.querySelector('[data-watch-error]');
const initialParams = new URLSearchParams(window.location.search);
state.filter = initialParams.get('filter') || 'all';
state.query = initialParams.get('query') || '';
if (searchEl) searchEl.value = state.query;
document.querySelectorAll('[data-filter]').forEach((button) => {
  button.classList.toggle('active', button.dataset.filter === state.filter);
});
let loadController = null;
const pagination = window.AdminPagination.create({
  root: document.querySelector('[data-admin-pagination]'),
  onChange: () => loadItems().catch(showLoadError),
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
  summaryEl.textContent = `${state.stats.total || 0}部影像`;
  if (!state.items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的影像</div>';
    return;
  }
  listEl.innerHTML = state.items.map((item) => {
    const image = item.image_small_path || item.image_path;
    const thumb = image
      ? `<img class="cms-index-thumb" src="${escapeHtml(image)}" alt="" width="40" height="48" loading="lazy" decoding="async" />`
      : '<span class="cms-index-thumb">影</span>';
    const activity = item.is_activity_featured ? ' · 观看近况' : '';
    return `
      <a class="cms-index-row" href="/admin/watch/${item.id}/edit">
        <span class="cms-index-row-main">
          ${thumb}
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
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  errorEl.hidden = true;
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  pagination.appendTo(params);
  listEl.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(`/api/admin/watch?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error('读取影像失败');
    const data = await response.json();
    if (loadController !== controller) return;
    state.items = data.items || [];
    state.stats = data.stats || {};
    pagination.set(data.pagination);
    pagination.syncUrl({ filter: state.filter, query: state.query });
    render();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    throw error;
  } finally {
    if (loadController === controller) {
      loadController = null;
      listEl.removeAttribute('aria-busy');
    }
  }
}

function showLoadError() {
  summaryEl.textContent = '读取失败';
  errorEl.hidden = false;
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter || 'all';
    pagination.reset();
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems().catch(showLoadError);
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  pagination.reset();
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(() => loadItems().catch(showLoadError), 240);
});

document.querySelector('[data-watch-retry]')?.addEventListener('click', () => loadItems().catch(showLoadError));
loadItems().catch(showLoadError);
