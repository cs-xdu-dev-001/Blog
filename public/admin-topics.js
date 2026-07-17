const state = { items: [], query: '', savingOrder: false };
const listEl = document.querySelector('[data-topic-list]');
const searchEl = document.querySelector('[data-topic-search]');
const summaryEl = document.querySelector('[data-topic-summary]');

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
          <button type="button" data-topic-move="-1" aria-label="上移" ${sourceIndex === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-topic-move="1" aria-label="下移" ${sourceIndex === state.items.length - 1 ? 'disabled' : ''}>↓</button>
        </span>
      </div>
    `;
  }).join('');
}

async function loadItems() {
  const response = await fetch('/api/admin/topics');
  if (!response.ok) throw new Error('读取主线失败');
  const data = await response.json();
  state.items = Array.isArray(data.items) ? data.items : [];
  render();
}

async function saveOrder() {
  state.savingOrder = true;
  summaryEl.textContent = '正在保存排序';
  const current = await fetch('/api/admin/site').then((response) => response.json());
  const response = await fetch('/api/admin/site', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: { topics: { ...(current.config?.topics || {}), cards: state.items } },
    }),
  });
  state.savingOrder = false;
  if (!response.ok) throw new Error('保存排序失败');
  summaryEl.textContent = `${state.items.length}条主线`;
  render();
}

listEl?.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-topic-move]') : null;
  if (!button || state.savingOrder) return;
  const row = button.closest('[data-topic-row]');
  const index = state.items.findIndex((item) => item.slug === row?.dataset.topicRow);
  const nextIndex = index + Number(button.dataset.topicMove || 0);
  if (index < 0 || nextIndex < 0 || nextIndex >= state.items.length) return;
  [state.items[index], state.items[nextIndex]] = [state.items[nextIndex], state.items[index]];
  render();
  saveOrder().catch((error) => {
    summaryEl.textContent = error.message;
    loadItems().catch(() => {});
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

loadItems().catch((error) => {
  summaryEl.textContent = error.message;
  listEl.innerHTML = '<div class="cms-index-error">读取失败，请刷新重试</div>';
});
