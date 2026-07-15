const state = {
  config: null,
  sections: [],
  posts: [],
  query: '',
  focusSlug: '',
  topicPosts: {
    slug: '',
    title: '',
    linked: [],
    available: [],
    query: '',
    dirty: false,
    draggedId: null,
  },
};

const listEl = document.querySelector('[data-topic-list]');
const statsEl = document.querySelector('[data-topic-stats]');
const titleInput = document.querySelector('[data-topics-title]');
const saveStateEl = document.querySelector('[data-topic-save-state]');
const searchEl = document.querySelector('[data-topic-search]');
const saveButtons = document.querySelectorAll('[data-save-topics]');
const addButtons = document.querySelectorAll('[data-add-topic]');
const resetButton = document.querySelector('[data-reset-topics]');
const topicPostDrawer = document.querySelector('[data-topic-post-drawer]');
const topicPostTitle = document.querySelector('[data-topic-post-title]');
const topicPostCount = document.querySelector('[data-topic-post-count]');
const topicPostStatus = document.querySelector('[data-topic-post-status]');
const topicPostSearch = document.querySelector('[data-topic-post-search]');
const topicPostLinked = document.querySelector('[data-topic-post-linked]');
const topicPostAvailable = document.querySelector('[data-topic-post-available]');
const topicPostSave = document.querySelector('[data-topic-post-save]');
const topicPostCloseButtons = document.querySelectorAll('[data-topic-post-close]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function slugifyTopic(value, fallback = 'new-topic') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function setStatus(text) {
  if (saveStateEl) saveStateEl.textContent = text;
}

function setBusy(busy) {
  saveButtons.forEach((button) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  });
  addButtons.forEach((button) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  });
}

function topicCards() {
  return Array.isArray(state.config?.topics?.cards) ? state.config.topics.cards : [];
}

function countPostsByTopic() {
  const map = new Map();
  state.posts.forEach((post) => {
    (post.topicSlugs || []).forEach((slug) => {
      map.set(slug, (map.get(slug) || 0) + 1);
    });
  });
  return map;
}

function filteredCards() {
  const query = state.query.trim().toLowerCase();
  if (!query) return topicCards();
  return topicCards().filter((card) => [card.title, card.slug, card.meta, card.text]
    .some((value) => String(value || '').toLowerCase().includes(query)));
}

function renderStats() {
  if (!statsEl) return;
  const cards = topicCards();
  const counts = countPostsByTopic();
  const linked = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const empty = cards.filter((card) => !counts.get(card.slug)).length;
  const maxLinked = cards.reduce((max, card) => Math.max(max, counts.get(card.slug) || 0), 0);
  statsEl.innerHTML = [
    ['主线数', cards.length, '首页主线卡片'],
    ['关联笔记', linked, '已挂到主线的笔记关系'],
    ['空主线', empty, '暂未关联笔记'],
    ['最高关联', maxLinked, '单条主线最多笔记'],
  ].map(([label, value, hint]) => `
    <article class="cms-metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${hint}</p>
    </article>
  `).join('');
}

function renderTopicCard(card, index, count) {
  return `
    <article class="topic-admin-card" data-topic-card data-topic-original-slug="${escapeHtml(card.slug || '')}">
      <header>
        <span>${String(index + 1).padStart(2, '0')}</span>
        <strong>${escapeHtml(card.title || '未命名主线')}</strong>
        <b>${count}篇笔记</b>
      </header>
      <div class="topic-admin-fields">
        <label>
          <span>主线名</span>
          <input value="${escapeHtml(card.title || '')}" data-topic-title />
        </label>
        <label>
          <span>Slug</span>
          <input value="${escapeHtml(card.slug || slugifyTopic(card.title, `topic-${index + 1}`))}" data-topic-slug />
        </label>
        <label>
          <span>标签</span>
          <input value="${escapeHtml(card.meta || '')}" data-topic-meta />
        </label>
        <label>
          <span>强度</span>
          <input type="number" min="1" max="8" value="${escapeHtml(card.level ?? 5)}" data-topic-level />
        </label>
      </div>
      <label class="topic-admin-text">
        <span>详情</span>
        <textarea rows="3" data-topic-text>${escapeHtml(card.text || '')}</textarea>
      </label>
      <footer>
        <a href="/topics/${escapeHtml(card.slug || '')}" target="_blank" rel="noreferrer">前台查看</a>
        <div>
          <button type="button" class="topic-admin-manage-posts" data-manage-topic-posts>管理笔记</button>
          <button type="button" data-save-topic>保存</button>
          <button type="button" data-remove-topic>删除</button>
        </div>
      </footer>
    </article>
  `;
}

function renderList() {
  if (!listEl) return;
  const counts = countPostsByTopic();
  const cards = filteredCards();
  if (!cards.length) {
    listEl.innerHTML = `
      <div class="cms-empty topic-admin-empty">
        <strong>没有匹配的主线</strong>
        <button type="button" data-add-topic-inline>新增主线</button>
      </div>
    `;
    return;
  }
  listEl.innerHTML = cards.map((card, index) => renderTopicCard(card, index, counts.get(card.slug) || 0)).join('');
}

function formatPostDate(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.replaceAll('-', '/') : '';
}

function topicPostMeta(post) {
  return [post.category, formatPostDate(post.date), post.published ? '已发布' : '草稿']
    .filter(Boolean)
    .join(' · ');
}

function sortAvailablePosts() {
  state.topicPosts.available.sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))
    || String(left.title || '').localeCompare(String(right.title || ''), 'zh-CN'));
}

function setTopicPostStatus(text) {
  if (topicPostStatus) topicPostStatus.textContent = text;
}

function markTopicPostsDirty() {
  state.topicPosts.dirty = true;
  setTopicPostStatus('UNSAVED');
}

function renderLinkedPost(post, index) {
  const postId = Number(post.id);
  return `
    <article class="topic-post-row topic-post-linked-row" data-topic-post-row data-post-id="${postId}">
      <button
        type="button"
        class="topic-post-drag"
        draggable="true"
        data-topic-post-drag
        data-post-id="${postId}"
        aria-label="拖动${escapeHtml(post.title)}"
        title="拖动排序"
      >⠿</button>
      <div class="topic-post-row-copy">
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(topicPostMeta(post))}</span>
      </div>
      <div class="topic-post-row-actions">
        <button type="button" data-topic-post-move="-1" data-post-id="${postId}" aria-label="上移" title="上移" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-topic-post-move="1" data-post-id="${postId}" aria-label="下移" title="下移" ${index === state.topicPosts.linked.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" data-topic-post-remove data-post-id="${postId}" aria-label="移除关联" title="移除关联">×</button>
      </div>
    </article>
  `;
}

function renderAvailablePost(post) {
  const postId = Number(post.id);
  return `
    <article class="topic-post-row topic-post-available-row" data-post-id="${postId}">
      <div class="topic-post-row-copy">
        <strong>${escapeHtml(post.title)}</strong>
        <span>${escapeHtml(topicPostMeta(post))}</span>
      </div>
      <button type="button" data-topic-post-add data-post-id="${postId}" aria-label="加入主线" title="加入主线">+</button>
    </article>
  `;
}

function renderTopicPostDrawer() {
  if (!topicPostLinked || !topicPostAvailable) return;
  if (topicPostTitle) topicPostTitle.textContent = state.topicPosts.title || '关联笔记';
  if (topicPostCount) topicPostCount.textContent = `${state.topicPosts.linked.length}篇`;

  topicPostLinked.innerHTML = state.topicPosts.linked.length
    ? state.topicPosts.linked.map(renderLinkedPost).join('')
    : '<div class="topic-post-empty">还没有关联笔记</div>';

  const query = state.topicPosts.query.trim().toLowerCase();
  const available = query
    ? state.topicPosts.available.filter((post) => [post.title, post.category, post.description]
      .some((value) => String(value || '').toLowerCase().includes(query)))
    : state.topicPosts.available;
  topicPostAvailable.innerHTML = available.length
    ? available.map(renderAvailablePost).join('')
    : `<div class="topic-post-empty">${query ? '没有匹配的笔记' : '全部笔记均已关联'}</div>`;
}

async function openTopicPosts(slug, title) {
  if (!topicPostDrawer || !slug) return;
  const requestedSlug = slug;
  state.topicPosts = {
    slug,
    title: title || slug,
    linked: [],
    available: [],
    query: '',
    dirty: false,
    draggedId: null,
  };
  if (topicPostSearch) topicPostSearch.value = '';
  if (!topicPostDrawer.open) topicPostDrawer.showModal();
  document.body.classList.add('topic-post-drawer-open');
  setTopicPostStatus('LOADING');
  renderTopicPostDrawer();

  try {
    const response = await fetch(`/api/admin/topics/${encodeURIComponent(slug)}/posts`);
    if (!response.ok) throw new Error('Failed to load topic posts');
    const data = await response.json();
    if (!topicPostDrawer.open || state.topicPosts.slug !== requestedSlug) return;
    state.topicPosts.title = data.topic?.title || title || slug;
    state.topicPosts.linked = Array.isArray(data.linked) ? data.linked : [];
    state.topicPosts.available = Array.isArray(data.available) ? data.available : [];
    sortAvailablePosts();
    renderTopicPostDrawer();
    setTopicPostStatus('READY');
    topicPostSearch?.focus();
  } catch {
    if (state.topicPosts.slug !== requestedSlug) return;
    setTopicPostStatus('LOAD FAILED');
  }
}

function closeTopicPosts(force = false) {
  if (!topicPostDrawer?.open) return;
  if (!force && state.topicPosts.dirty && !window.confirm('关联尚未保存，确认关闭？')) return;
  state.topicPosts.dirty = false;
  topicPostDrawer.close();
}

function moveLinkedPost(postId, offset) {
  const index = state.topicPosts.linked.findIndex((post) => Number(post.id) === Number(postId));
  const nextIndex = index + Number(offset);
  if (index < 0 || nextIndex < 0 || nextIndex >= state.topicPosts.linked.length) return;
  const [post] = state.topicPosts.linked.splice(index, 1);
  state.topicPosts.linked.splice(nextIndex, 0, post);
  markTopicPostsDirty();
  renderTopicPostDrawer();
}

function addTopicPost(postId) {
  const index = state.topicPosts.available.findIndex((post) => Number(post.id) === Number(postId));
  if (index < 0) return;
  const [post] = state.topicPosts.available.splice(index, 1);
  state.topicPosts.linked.push(post);
  markTopicPostsDirty();
  renderTopicPostDrawer();
}

function removeTopicPost(postId) {
  const index = state.topicPosts.linked.findIndex((post) => Number(post.id) === Number(postId));
  if (index < 0) return;
  const [post] = state.topicPosts.linked.splice(index, 1);
  state.topicPosts.available.push(post);
  sortAvailablePosts();
  markTopicPostsDirty();
  renderTopicPostDrawer();
}

function reorderTopicPost(draggedId, targetId, placeAfter) {
  const sourceIndex = state.topicPosts.linked.findIndex((post) => Number(post.id) === Number(draggedId));
  if (sourceIndex < 0 || Number(draggedId) === Number(targetId)) return;
  const [post] = state.topicPosts.linked.splice(sourceIndex, 1);
  let targetIndex = state.topicPosts.linked.findIndex((item) => Number(item.id) === Number(targetId));
  if (targetIndex < 0) {
    state.topicPosts.linked.splice(sourceIndex, 0, post);
    return;
  }
  if (placeAfter) targetIndex += 1;
  state.topicPosts.linked.splice(targetIndex, 0, post);
  markTopicPostsDirty();
  renderTopicPostDrawer();
}

function applyTopicPostsToState(slug, linkedPosts) {
  const linkedIds = new Set(linkedPosts.map((post) => Number(post.id)));
  state.posts = state.posts.map((post) => {
    const slugs = new Set(post.topicSlugs || []);
    if (linkedIds.has(Number(post.id))) slugs.add(slug);
    else slugs.delete(slug);
    return { ...post, topicSlugs: [...slugs].sort((left, right) => left.localeCompare(right)) };
  });
}

async function saveTopicPosts() {
  if (!state.topicPosts.slug || !topicPostSave) return;
  topicPostSave.disabled = true;
  topicPostSave.setAttribute('aria-busy', 'true');
  setTopicPostStatus('SAVING');
  try {
    const response = await fetch(`/api/admin/topics/${encodeURIComponent(state.topicPosts.slug)}/posts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postIds: state.topicPosts.linked.map((post) => Number(post.id)) }),
    });
    if (!response.ok) throw new Error('Failed to save topic posts');
    const data = await response.json();
    state.topicPosts.linked = Array.isArray(data.linked) ? data.linked : [];
    state.topicPosts.available = Array.isArray(data.available) ? data.available : [];
    state.topicPosts.dirty = false;
    sortAvailablePosts();
    applyTopicPostsToState(state.topicPosts.slug, state.topicPosts.linked);
    renderStats();
    renderList();
    renderTopicPostDrawer();
    setTopicPostStatus('SAVED');
  } catch {
    setTopicPostStatus('SAVE FAILED');
  } finally {
    topicPostSave.disabled = false;
    topicPostSave.removeAttribute('aria-busy');
  }
}

function focusTopicCard(slug) {
  if (!slug || !listEl) return;
  const card = [...listEl.querySelectorAll('[data-topic-card]')]
    .find((item) => item.getAttribute('data-topic-original-slug') === slug);
  if (!card) return;
  card.classList.add('is-focus');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => {
    card.querySelector('[data-topic-title]')?.focus();
    card.querySelector('[data-topic-title]')?.select();
  }, 220);
  window.setTimeout(() => card.classList.remove('is-focus'), 1500);
}

function render() {
  if (titleInput) titleInput.value = state.config?.topics?.title || '主线';
  renderStats();
  renderList();
  if (state.focusSlug) {
    const slug = state.focusSlug;
    state.focusSlug = '';
    window.setTimeout(() => focusTopicCard(slug), 60);
  }
}

async function loadTopics() {
  setStatus('LOADING');
  const [siteRes, postsRes] = await Promise.all([
    fetch('/api/admin/site'),
    fetch('/api/admin/posts?filter=all'),
  ]);
  if (!siteRes.ok || !postsRes.ok) throw new Error('Failed to load topics');
  const siteData = await siteRes.json();
  const postData = await postsRes.json();
  state.config = siteData.config;
  state.sections = siteData.sections;
  state.posts = postData.items || [];
  render();
  setStatus('READY');
}

function readTopicCards() {
  const seen = new Map();
  const visibleCards = [...document.querySelectorAll('[data-topic-card]')]
    .map((card, index) => {
      const title = card.querySelector('[data-topic-title]')?.value.trim() || '';
      const rawSlug = card.querySelector('[data-topic-slug]')?.value.trim() || slugifyTopic(title, `topic-${index + 1}`);
      const baseSlug = slugifyTopic(rawSlug, `topic-${index + 1}`);
      const count = seen.get(baseSlug) || 0;
      seen.set(baseSlug, count + 1);
      const slug = count ? `${baseSlug}-${count + 1}` : baseSlug;
      return {
        title,
        slug,
        meta: card.querySelector('[data-topic-meta]')?.value.trim() || '',
        text: card.querySelector('[data-topic-text]')?.value.trim() || '',
        level: Number(card.querySelector('[data-topic-level]')?.value || 5),
      };
    })
    .filter((card) => card.title || card.meta || card.text);
  if (!state.query.trim()) return visibleCards;

  const editedByOriginalSlug = new Map([...document.querySelectorAll('[data-topic-card]')].map((node, index) => [
    node.getAttribute('data-topic-original-slug') || '',
    visibleCards[index],
  ]));
  return topicCards()
    .map((card) => editedByOriginalSlug.get(card.slug) || card)
    .filter((card) => card.title || card.meta || card.text);
}

function readTopicCard(card) {
  const title = card.querySelector('[data-topic-title]')?.value.trim() || '';
  const slug = slugifyTopic(card.querySelector('[data-topic-slug]')?.value.trim() || title, 'new-topic');
  return {
    title,
    slug,
    meta: card.querySelector('[data-topic-meta]')?.value.trim() || '',
    text: card.querySelector('[data-topic-text]')?.value.trim() || '',
    level: Number(card.querySelector('[data-topic-level]')?.value || 5),
  };
}

async function saveTopicTitle() {
  const res = await fetch('/api/admin/site', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        topics: {
          title: titleInput?.value || '主线',
          cards: topicCards(),
        },
      },
      sections: [],
    }),
  });
  if (!res.ok) throw new Error('Failed to save topic title');
  const data = await res.json();
  state.config = data.config;
  state.sections = data.sections;
}

async function saveTopicCard(card, reload = true) {
  const originalSlug = card.getAttribute('data-topic-original-slug') || '';
  const payload = readTopicCard(card);
  if (!payload.title) {
    setStatus('TITLE REQUIRED');
    return;
  }
  const res = await fetch(originalSlug ? `/api/admin/topics/${encodeURIComponent(originalSlug)}` : '/api/admin/topics', {
    method: originalSlug ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    setStatus('SAVE FAILED');
    return;
  }
  const data = await res.json();
  if (state.config?.topics) state.config.topics.cards = data.items || state.config.topics.cards;
  state.focusSlug = data.item?.slug || payload.slug;
  if (reload) await loadTopics();
  else render();
  setStatus('SAVED');
}

async function saveTopics() {
  setStatus('SAVING');
  setBusy(true);
  try {
    await saveTopicTitle();
    const cards = [...document.querySelectorAll('[data-topic-card]')];
    for (const card of cards) {
      await saveTopicCard(card, false);
    }
    await loadTopics();
    setStatus('SAVED');
  } catch {
    setStatus('SAVE FAILED');
  } finally {
    setBusy(false);
  }
}

async function addTopic() {
  setStatus('CREATING');
  setBusy(true);
  try {
    const res = await fetch('/api/admin/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '新主线',
        slug: `new-topic-${topicCards().length + 1}`,
        meta: 'Tag / Tag / Tag',
        text: '',
        level: 5,
      }),
    });
    if (!res.ok) {
      setStatus('CREATE FAILED');
      return;
    }
    const data = await res.json();
    state.focusSlug = data.item?.slug || '';
    state.query = '';
    if (searchEl) searchEl.value = '';
    await loadTopics();
    setStatus('CREATED');
  } catch {
    setStatus('CREATE FAILED');
  } finally {
    setBusy(false);
  }
}

addButtons.forEach((button) => button.addEventListener('click', addTopic));
resetButton?.addEventListener('click', loadTopics);
saveButtons.forEach((button) => button.addEventListener('click', saveTopics));

listEl?.addEventListener('input', () => setStatus('UNSAVED'));
listEl?.addEventListener('click', (event) => {
  const addButton = event.target instanceof Element ? event.target.closest('[data-add-topic-inline]') : null;
  if (addButton) {
    addTopic();
    return;
  }
  const manageButton = event.target instanceof Element ? event.target.closest('[data-manage-topic-posts]') : null;
  if (manageButton) {
    const card = manageButton.closest('[data-topic-card]');
    const slug = card?.getAttribute('data-topic-original-slug') || '';
    const title = card?.querySelector('[data-topic-title]')?.value.trim() || '';
    openTopicPosts(slug, title);
    return;
  }
  const saveButton = event.target instanceof Element ? event.target.closest('[data-save-topic]') : null;
  if (saveButton) {
    const card = saveButton.closest('[data-topic-card]');
    if (card) saveTopicCard(card);
    return;
  }
  const button = event.target instanceof Element ? event.target.closest('[data-remove-topic]') : null;
  if (!button) return;
  const card = button.closest('[data-topic-card]');
  const slug = card?.getAttribute('data-topic-original-slug');
  if (!slug) {
    card?.remove();
    setStatus('DELETED');
    return;
  }
  const count = countPostsByTopic().get(slug) || 0;
  if (count && !window.confirm(`这条主线关联了${count}篇笔记，确认删除？`)) return;
  fetch(`/api/admin/topics/${encodeURIComponent(slug)}`, { method: 'DELETE' })
    .then((res) => {
      if (!res.ok) throw new Error('delete failed');
      return loadTopics();
    })
    .then(() => setStatus('DELETED'))
    .catch(() => setStatus('DELETE FAILED'));
});

titleInput?.addEventListener('input', () => setStatus('UNSAVED'));
searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  renderList();
});

topicPostSearch?.addEventListener('input', () => {
  state.topicPosts.query = topicPostSearch.value;
  renderTopicPostDrawer();
});

topicPostCloseButtons.forEach((button) => button.addEventListener('click', () => closeTopicPosts()));
topicPostSave?.addEventListener('click', saveTopicPosts);

topicPostDrawer?.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeTopicPosts();
});

topicPostDrawer?.addEventListener('close', () => {
  document.body.classList.remove('topic-post-drawer-open');
});

topicPostDrawer?.addEventListener('click', (event) => {
  if (event.target === topicPostDrawer) closeTopicPosts();
});

topicPostLinked?.addEventListener('click', (event) => {
  const moveButton = event.target instanceof Element ? event.target.closest('[data-topic-post-move]') : null;
  if (moveButton) {
    moveLinkedPost(moveButton.getAttribute('data-post-id'), moveButton.getAttribute('data-topic-post-move'));
    return;
  }
  const removeButton = event.target instanceof Element ? event.target.closest('[data-topic-post-remove]') : null;
  if (removeButton) removeTopicPost(removeButton.getAttribute('data-post-id'));
});

topicPostAvailable?.addEventListener('click', (event) => {
  const addButton = event.target instanceof Element ? event.target.closest('[data-topic-post-add]') : null;
  if (addButton) addTopicPost(addButton.getAttribute('data-post-id'));
});

topicPostLinked?.addEventListener('dragstart', (event) => {
  const handle = event.target instanceof Element ? event.target.closest('[data-topic-post-drag]') : null;
  if (!handle) return;
  state.topicPosts.draggedId = Number(handle.getAttribute('data-post-id'));
  handle.closest('[data-topic-post-row]')?.classList.add('is-dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(state.topicPosts.draggedId));
  }
});

topicPostLinked?.addEventListener('dragover', (event) => {
  const row = event.target instanceof Element ? event.target.closest('[data-topic-post-row]') : null;
  if (!row || !state.topicPosts.draggedId) return;
  event.preventDefault();
  topicPostLinked.querySelectorAll('.is-drop-target').forEach((item) => item.classList.remove('is-drop-target'));
  row.classList.add('is-drop-target');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
});

topicPostLinked?.addEventListener('drop', (event) => {
  const row = event.target instanceof Element ? event.target.closest('[data-topic-post-row]') : null;
  if (!row || !state.topicPosts.draggedId) return;
  event.preventDefault();
  const rect = row.getBoundingClientRect();
  const placeAfter = event.clientY > rect.top + rect.height / 2;
  reorderTopicPost(state.topicPosts.draggedId, Number(row.getAttribute('data-post-id')), placeAfter);
  state.topicPosts.draggedId = null;
});

topicPostLinked?.addEventListener('dragend', () => {
  state.topicPosts.draggedId = null;
  topicPostLinked.querySelectorAll('.is-dragging, .is-drop-target').forEach((item) => {
    item.classList.remove('is-dragging', 'is-drop-target');
  });
});

loadTopics().catch(() => setStatus('LOAD FAILED'));
