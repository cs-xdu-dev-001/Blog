const state = {
  config: null,
  sections: [],
  posts: [],
  query: '',
  focusSlug: '',
};

const listEl = document.querySelector('[data-topic-list]');
const statsEl = document.querySelector('[data-topic-stats]');
const titleInput = document.querySelector('[data-topics-title]');
const saveStateEl = document.querySelector('[data-topic-save-state]');
const searchEl = document.querySelector('[data-topic-search]');
const saveButtons = document.querySelectorAll('[data-save-topics]');
const addButtons = document.querySelectorAll('[data-add-topic]');
const resetButton = document.querySelector('[data-reset-topics]');

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

loadTopics().catch(() => setStatus('LOAD FAILED'));
