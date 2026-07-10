const state = {
  items: [],
  stats: null,
  filter: 'all',
  query: '',
};

const listEl = document.querySelector('[data-post-list]');
const statsEl = document.querySelector('[data-post-stats]');
const searchEl = document.querySelector('[data-post-search]');
const saveStateEl = document.querySelector('[data-post-save-state]');
const createButton = document.querySelector('[data-create-post]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(text) {
  if (saveStateEl) saveStateEl.textContent = text;
}

async function loadItems() {
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  const res = await fetch(`/api/admin/posts?${params}`);
  if (!res.ok) throw new Error('Failed to load posts');
  const data = await res.json();
  state.items = data.items;
  state.stats = data.stats;
  render();
}

function renderStats() {
  if (!statsEl || !state.stats) return;
  statsEl.innerHTML = [
    ['总笔记', state.stats.total, '数据库内全部笔记'],
    ['已发布', state.stats.published, '前台可见内容'],
    ['草稿', state.stats.draft, '暂不公开'],
    ['重点', state.stats.featured, '首页主推候选'],
  ].map(([label, value, hint]) => `
    <article class="cms-metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${hint}</p>
    </article>
  `).join('');
}

function renderList() {
  if (!listEl) return;
  if (!state.items.length) {
    listEl.innerHTML = '<p class="cms-empty">没有匹配的笔记。</p>';
    return;
  }

  listEl.innerHTML = state.items.map((item) => `
    <a class="cms-item cms-post-list-item" href="/admin/posts/${item.id}/edit">
      <span class="cms-thumb cms-thumb-post">${item.published ? 'POST' : 'DRAFT'}</span>
      <span>
        <small>${escapeHtml(item.category)} / ${escapeHtml(item.date)}</small>
        <strong>${escapeHtml(item.title)}</strong>
        <em>${escapeHtml(item.description || '等待补充摘要')}</em>
      </span>
      <b>${item.featured ? '重点' : item.published ? '发布' : '草稿'}</b>
    </a>
  `).join('');
}

function render() {
  renderStats();
  renderList();
}

async function createPost() {
  setStatus('CREATING');
  const title = `未命名笔记 ${new Date().toLocaleDateString('zh-CN').replaceAll('/', '-')}`;
  const res = await fetch('/api/admin/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      category: 'Notes',
      description: '',
      body: `# ${title}\n\n`,
      published: false,
    }),
  });
  if (!res.ok) {
    setStatus('CREATE FAILED');
    return;
  }
  const data = await res.json();
  window.location.href = `/admin/posts/${data.item.id}/edit`;
}

createButton?.addEventListener('click', createPost);

document.querySelectorAll('[data-post-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.postFilter;
    document.querySelectorAll('[data-post-filter]').forEach((el) => el.classList.toggle('active', el === button));
    loadItems();
  });
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadItems, 180);
});

loadItems().catch(() => setStatus('LOAD FAILED'));
