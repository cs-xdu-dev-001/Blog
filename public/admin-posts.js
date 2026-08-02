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
const createButtons = [...document.querySelectorAll('[data-create-post]')];
const initialParams = new URLSearchParams(window.location.search);
state.filter = initialParams.get('filter') || 'all';
state.kind = initialParams.get('kind') || 'all';
state.topicSlug = initialParams.get('topicSlug') || '';
state.query = initialParams.get('query') || '';
if (searchEl) searchEl.value = state.query;
if (kindSelect) kindSelect.value = state.kind;
document.querySelectorAll('[data-post-filter]').forEach((button) => {
  button.classList.toggle('active', button.dataset.postFilter === state.filter);
});
let itemsController = null;
let itemsRequestId = 0;
let creatingPost = false;
const pagination = window.AdminPagination.create({
  root: document.querySelector('[data-admin-pagination]'),
  onChange: () => loadItems(),
});

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
  const response = await fetch('/api/admin/topics?pageSize=100');
  if (!response.ok) throw new Error('读取主线失败');
  const data = await response.json();
  state.topics = Array.isArray(data.items) ? data.items : [];
  topicSelect.innerHTML = [
    '<option value="">全部主线</option>',
    ...state.topics.map((topic) => `<option value="${escapeHtml(topic.slug)}">${escapeHtml(topic.title)}</option>`),
  ].join('');
  topicSelect.value = state.topicSlug;
  renderList();
}

async function loadItems() {
  itemsController?.abort();
  const controller = new AbortController();
  const requestId = ++itemsRequestId;
  itemsController = controller;
  const params = new URLSearchParams({ filter: state.filter, query: state.query, kind: state.kind });
  if (state.topicSlug) params.set('topicSlug', state.topicSlug);
  pagination.appendTo(params);
  listEl.setAttribute('aria-busy', 'true');

  try {
    const response = await fetch(`/api/admin/posts?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error('读取笔记失败');
    const data = await response.json();
    if (requestId !== itemsRequestId) return;
    state.items = Array.isArray(data.items) ? data.items : [];
    state.stats = data.stats || {};
    pagination.set(data.pagination);
    pagination.syncUrl({
      filter: state.filter,
      kind: state.kind,
      topicSlug: state.topicSlug,
      query: state.query,
    });
    setStatus('');
    render();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (requestId === itemsRequestId) setStatus(error.message || '读取笔记失败');
  } finally {
    if (requestId === itemsRequestId) {
      itemsController = null;
      listEl.removeAttribute('aria-busy');
    }
  }
}

function renderStats() {
  const stats = state.stats || {};
  statsEl.textContent = `${stats.total || 0}篇 · ${stats.published || 0}篇已发布 · ${stats.draft || 0}篇草稿`;
}

function renderList() {
  const items = state.items;
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
        <span class="cms-index-cell">${escapeHtml(item.kindLabel || '技术笔记')}</span>
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

async function createPost(kind) {
  if (creatingPost) return;
  creatingPost = true;
  createButtons.forEach((button) => { button.disabled = true; });
  setStatus('正在创建');
  const titlePrefix = kind === 'reflection' ? '未命名随记' : '未命名笔记';
  const title = `${titlePrefix} ${new Date().toLocaleDateString('zh-CN').replaceAll('/', '-')}`;
  try {
    const response = await fetch('/api/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, kind, description: '', body: `# ${title}\n\n`, published: false }),
    });
    if (!response.ok) throw new Error('创建失败');
    const data = await response.json();
    if (!data.item?.id) throw new Error('创建结果无效');
    window.location.href = `/admin/posts/${data.item.id}/edit`;
  } catch (error) {
    setStatus(error.message || '创建失败');
    creatingPost = false;
    createButtons.forEach((button) => { button.disabled = false; });
  }
}

createButtons.forEach((button) => {
  button.addEventListener('click', () => createPost(button.dataset.postKind || 'technical'));
});

document.querySelectorAll('[data-post-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.postFilter || 'all';
    pagination.reset();
    document.querySelectorAll('[data-post-filter]').forEach((item) => item.classList.toggle('active', item === button));
    loadItems();
  });
});

kindSelect?.addEventListener('change', () => {
  state.kind = kindSelect.value;
  pagination.reset();
  loadItems();
});

topicSelect?.addEventListener('change', () => {
  state.topicSlug = topicSelect.value;
  pagination.reset();
  loadItems();
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  pagination.reset();
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadItems, 240);
});

loadTopics().catch((error) => setStatus(error.message));
loadItems();
