const EMPTY_STATS = Object.freeze({ total: 0 });
const state = { items: [], stats: { ...EMPTY_STATS }, filter: 'all', query: '' };
const listEl = document.querySelector('[data-reading-list]');
const statsEl = document.querySelector('[data-reading-stats]');
const searchEl = document.querySelector('[data-reading-search]');
const errorEl = document.querySelector('[data-reading-error]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusLabel(item) {
  if (item.status_label) return item.status_label;
  return item.status === 'read' ? '已读' : item.status === 'planned' ? '待读' : '在读';
}

function render() {
  statsEl.textContent = `${state.stats.total || 0}本书`;
  if (!state.items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的书籍</div>';
    return;
  }
  listEl.innerHTML = state.items.map((item) => {
    const image = item.image_small_path || item.image_path;
    const style = image
      ? `style="background-image:url('${escapeHtml(image)}')"`
      : `style="background-color:${escapeHtml(item.spine_color || '#263548')}"`;
    return `
      <a class="cms-index-row" href="/admin/reading/${item.id}/edit">
        <span class="cms-index-row-main">
          <span class="cms-index-thumb" ${style}>${image ? '' : '书'}</span>
          <span>
            <strong class="cms-index-title">${escapeHtml(item.title)}</strong>
            <span class="cms-index-meta">${escapeHtml(item.summary || item.quote || '未填写内容')}</span>
          </span>
        </span>
        <span class="cms-index-cell">${escapeHtml(item.author || '未填写')}</span>
        <span class="cms-index-badge">${escapeHtml(statusLabel(item))}</span>
        <span class="cms-index-action">编辑</span>
      </a>
    `;
  }).join('');
}

async function loadItems() {
  errorEl.hidden = true;
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  const response = await fetch(`/api/admin/reading?${params}`);
  if (!response.ok) throw new Error('读取书籍失败');
  const data = await response.json();
  state.items = data.items || [];
  state.stats = { ...EMPTY_STATS, ...(data.stats || {}) };
  render();
}

function showLoadError() {
  statsEl.textContent = '读取失败';
  errorEl.hidden = false;
  listEl.innerHTML = '';
}

document.querySelectorAll('[data-reading-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.readingFilter || 'all';
    document.querySelectorAll('[data-reading-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems().catch(showLoadError);
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(() => loadItems().catch(showLoadError), 180);
});

document.querySelector('[data-reading-retry]')?.addEventListener('click', () => loadItems().catch(showLoadError));
loadItems().catch(showLoadError);
