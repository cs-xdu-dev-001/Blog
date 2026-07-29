const state = { items: [], query: '', savingOrder: false };
const listEl = document.querySelector('[data-topic-list]');
const searchEl = document.querySelector('[data-topic-search]');
const summaryEl = document.querySelector('[data-topic-summary]');
const errorEl = document.querySelector('[data-topic-error]');
let loadController = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function filteredItems() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.items;
  return state.items.filter((item) => [item.title, item.slug, item.meta, item.text]
    .some((value) => String(value || '').toLowerCase().includes(query)));
}

function render() {
  summaryEl.textContent = `${state.items.length}条主线`;
  const items = filteredItems();
  if (!items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的主线</div>';
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const sourceIndex = state.items.findIndex((topic) => topic.slug === item.slug);
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
          <button type="button" data-topic-move="1" aria-label="下移" ${orderLocked || sourceIndex === state.items.length - 1 ? 'disabled' : ''}>↓</button>
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
    const response = await fetch('/api/admin/topics', { signal: controller.signal });
    if (!response.ok) throw new Error('读取主线失败');
    const data = await response.json();
    if (loadController !== controller) return;
    state.items = Array.isArray(data.items) ? data.items : [];
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

async function saveOrder(previousItems) {
  state.savingOrder = true;
  render();
  summaryEl.textContent = '正在保存排序';
  try {
    const currentResponse = await fetch('/api/admin/site');
    if (!currentResponse.ok) throw new Error('读取站点配置失败');
    const current = await currentResponse.json();
    const response = await fetch('/api/admin/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { topics: { ...(current.config?.topics || {}), cards: state.items } },
      }),
    });
    if (!response.ok) throw new Error('保存排序失败');
  } catch (error) {
    state.items = previousItems;
    throw error;
  } finally {
    state.savingOrder = false;
    render();
  }
}

listEl?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-topic-move]') : null;
  if (!button || state.savingOrder) return;
  const row = button.closest('[data-topic-row]');
  const index = state.items.findIndex((item) => item.slug === row?.dataset.topicRow);
  const nextIndex = index + Number(button.dataset.topicMove || 0);
  if (index < 0 || nextIndex < 0 || nextIndex >= state.items.length) return;
  const previousItems = [...state.items];
  [state.items[index], state.items[nextIndex]] = [state.items[nextIndex], state.items[index]];
  render();
  saveOrder(previousItems).catch((error) => {
    summaryEl.textContent = error.message;
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

document.querySelector('[data-topic-retry]')?.addEventListener('click', () => loadItems().catch(showLoadError));
loadItems().catch(showLoadError);
