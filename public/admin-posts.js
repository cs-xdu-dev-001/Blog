const state = {
  items: [],
  stats: null,
  topics: [],
  filter: 'all',
  kind: 'all',
  topicSlug: '',
  query: '',
};

const listEl = document.querySelector('[data-post-list]');
const statsEl = document.querySelector('[data-post-stats]');
const searchEl = document.querySelector('[data-post-search]');
const kindSelect = document.querySelector('[data-post-kind-filter]');
const topicSelect = document.querySelector('[data-post-topic-filter]');
const saveStateEl = document.querySelector('[data-post-save-state]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(text) {
  if (!saveStateEl) return;
  saveStateEl.hidden = !text;
  saveStateEl.textContent = text;
}

function topicTitle(slug) {
  return state.topics.find((topic) => topic.slug === slug)?.title || slug;
}

async function loadTopics() {
  const response = await fetch('/api/admin/topics');
  if (!response.ok) return;
  const data = await response.json();
  state.topics = Array.isArray(data.items) ? data.items : [];
  topicSelect.innerHTML = [
    '<option value="">全部主线</option>',
    ...state.topics.map((topic) => `<option value="${escapeHtml(topic.slug)}">${escapeHtml(topic.title)}</option>`),
  ].join('');
  topicSelect.value = state.topicSlug;
}

async function loadItems() {
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  if (state.topicSlug) params.set('topicSlug', state.topicSlug);
  const response = await fetch(`/api/admin/posts?${params}`);
  if (!response.ok) throw new Error('读取笔记失败');
  const data = await response.json();
  state.items = Array.isArray(data.items) ? data.items : [];
  state.stats = data.stats || {};
  render();
}

function visibleItems() {
  return state.items.filter((item) => {
    if (state.kind === 'reflection') return item.category === '随记';
    if (state.kind === 'technical') return item.category !== '随记';
    return true;
  });
}

function renderStats() {
  const stats = state.stats || {};
  statsEl.textContent = `${stats.total || 0}篇 · ${stats.published || 0}篇已发布 · ${stats.draft || 0}篇草稿`;
}

function renderList() {
  const items = visibleItems();
  if (!items.length) {
    listEl.innerHTML = '<div class="cms-index-empty">没有匹配的笔记</div>';
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const topics = (item.topicSlugs || []).map(topicTitle).filter(Boolean).join(' / ');
    const stateLabel = item.featured ? '精选' : item.published ? '已发布' : '草稿';
    return `
      <a class="cms-index-row" href="/admin/posts/${item.id}/edit">
        <span class="cms-index-row-main no-media">
          <span>
            <strong class="cms-index-title">${escapeHtml(item.title)}</strong>
            <span class="cms-index-meta">${escapeHtml(item.description || topics || '未填写摘要')}</span>
          </span>
        </span>
        <span class="cms-index-cell">${escapeHtml(item.category || '未分类')}</span>
        <span class="cms-index-badge">${stateLabel}</span>
        <span class="cms-index-action">编辑</span>
      </a>
    `;
  }).join('');
}

function render() {
  renderStats();
  renderList();
}

async function createPost(category) {
  setStatus('正在创建');
  const titlePrefix = category === '随记' ? '未命名随记' : '未命名笔记';
  const title = `${titlePrefix} ${new Date().toLocaleDateString('zh-CN').replaceAll('/', '-')}`;
  const response = await fetch('/api/admin/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, category, description: '', body: `# ${title}\n\n`, published: false }),
  });
  if (!response.ok) {
    setStatus('创建失败');
    return;
  }
  const data = await response.json();
  window.location.href = `/admin/posts/${data.item.id}/edit`;
}

document.querySelectorAll('[data-create-post]').forEach((button) => {
  button.addEventListener('click', () => createPost(button.dataset.postCategory || 'Notes'));
});

document.querySelectorAll('[data-post-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.postFilter || 'all';
    document.querySelectorAll('[data-post-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems().catch((error) => setStatus(error.message));
  });
});

kindSelect?.addEventListener('change', () => {
  state.kind = kindSelect.value;
  renderList();
});

topicSelect?.addEventListener('change', () => {
  state.topicSlug = topicSelect.value;
  loadItems().catch((error) => setStatus(error.message));
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(() => loadItems().catch((error) => setStatus(error.message)), 180);
});

Promise.all([loadTopics(), loadItems()]).catch((error) => setStatus(error.message));
