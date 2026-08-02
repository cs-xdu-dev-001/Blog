const state = { items: [], query: '', savingOrder: false, totalTopics: 0 };
const listEl = document.querySelector('[data-topic-list]');
const searchEl = document.querySelector('[data-topic-search]');
const summaryEl = document.querySelector('[data-topic-summary]');
const errorEl = document.querySelector('[data-topic-error]');
const initialParams = new URLSearchParams(window.location.search);
state.query = initialParams.get('query') || '';
if (searchEl) searchEl.value = state.query;
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
  summaryEl.textContent = state.query
    ? `${pagination.state.total}/${state.totalTopics}条主线`
    : `${state.totalTopics}条主线`;
  const items = state.items;
  if (!items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的主线</div>';
    return;
  }

  listEl.innerHTML = items.map((item, index) => {
    const sourceIndex = (pagination.state.page - 1) * pagination.state.pageSize + index;
    const orderLocked = state.savingOrder || Boolean(state.query.trim());
    return `
      <div class="cms-index-row" data-topic-row="${escapeHtml(item.slug)}">
        <a class="cms-index-row-main no-media" href="/admin/topics/${encodeURIComponent(item.slug)}/edit">
          <span>
            <strong class="cms-index-title">${escapeHtml(item.title)}</strong>
            <span class="cms-index-meta">${escapeHtml(item.text || item.slug)}</span>
          </span>
        </a>
        <span class="cms-index-cell">${escapeHtml(item.meta || '未设置')}</span>
        <span class="cms-index-badge">${Number(item.level || 5)} / 8</span>
        <span class="cms-index-order-actions">
          <button type="button" data-topic-move="-1" aria-label="上移" ${orderLocked || sourceIndex === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-topic-move="1" aria-label="下移" ${orderLocked || sourceIndex === state.totalTopics - 1 ? 'disabled' : ''}>↓</button>
        </span>
      </div>
    `;
  }).join('');
}

async function loadItems() {
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  errorEl.hidden = true;
  listEl.setAttribute('aria-busy', 'true');
  try {
    const params = new URLSearchParams({ query: state.query });
    pagination.appendTo(params);
    const response = await fetch(`/api/admin/topics?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error('读取主线失败');
    const data = await response.json();
    if (loadController !== controller) return;
    state.items = Array.isArray(data.items) ? data.items : [];
    state.totalTopics = Number(data.totalTopics || 0);
    pagination.set(data.pagination);
    pagination.syncUrl({ query: state.query });
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

function showLoadError(error) {
  summaryEl.textContent = error?.message || '读取失败';
  errorEl.hidden = false;
}

async function moveTopic(slug, direction) {
  state.savingOrder = true;
  render();
  summaryEl.textContent = '正在保存排序';
  try {
    const currentResponse = await fetch('/api/admin/site');
    if (!currentResponse.ok) throw new Error('读取站点配置失败');
    const current = await currentResponse.json();
    const cards = [...(current.config?.topics?.cards || [])];
    const index = cards.findIndex((item) => item.slug === slug);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= cards.length) return;
    [cards[index], cards[nextIndex]] = [cards[nextIndex], cards[index]];
    const response = await fetch('/api/admin/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { topics: { ...(current.config?.topics || {}), cards } },
      }),
    });
    if (!response.ok) throw new Error('保存排序失败');
  } finally {
    state.savingOrder = false;
    render();
  }
  await loadItems();
}

listEl?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-topic-move]') : null;
  if (!button || state.savingOrder) return;
  const row = button.closest('[data-topic-row]');
  moveTopic(row?.dataset.topicRow || '', Number(button.dataset.topicMove || 0)).catch((error) => {
    summaryEl.textContent = error.message;
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  pagination.reset();
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(() => loadItems().catch(showLoadError), 240);
});

document.querySelector('[data-topic-retry]')?.addEventListener('click', () => loadItems().catch(showLoadError));
loadItems().catch(showLoadError);
