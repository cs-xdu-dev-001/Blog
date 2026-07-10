const state = {
  items: [],
  stats: null,
  selected: null,
  mode: 'edit',
  filter: 'all',
  query: '',
};

const listEl = document.querySelector('[data-watch-list]');
const statsEl = document.querySelector('[data-watch-stats]');
const editorEl = document.querySelector('[data-watch-editor]');
const searchEl = document.querySelector('[data-watch-search]');
const saveStateEl = document.querySelector('[data-save-state]');
const createButton = document.querySelector('[data-create-watch]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadItems() {
  const params = new URLSearchParams({ filter: state.filter, query: state.query });
  const res = await fetch(`/api/admin/watch?${params}`);
  if (!res.ok) throw new Error('Failed to load watch items');
  const data = await res.json();
  state.items = data.items;
  state.stats = data.stats;
  if (state.mode !== 'create') {
    if (!state.selected || !state.items.some((item) => item.id === state.selected.id)) {
      state.selected = state.items[0] || null;
    } else {
      state.selected = state.items.find((item) => item.id === state.selected.id);
    }
  }
  render();
}

function renderStats() {
  statsEl.innerHTML = [
    ['总条目', state.stats.total, '全部影像档案'],
    ['缺图', state.stats.missingImage, '需要上传图片'],
    ['缺评论', state.stats.missingComment, '等待个人评论'],
    ['缺佳句', state.stats.missingQuote, '等待佳句摘录'],
  ].map(([label, value, hint]) => `
    <article class="cms-metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${hint}</p>
    </article>
  `).join('');
}

function renderList() {
  if (!state.items.length) {
    listEl.innerHTML = '<p class="cms-empty">没有匹配的影像条目。</p>';
    return;
  }

  listEl.innerHTML = state.items.map((item) => {
    const line = item.quote || item.comment || '等待补充内容';
    const imageStyle = item.image_path
      ? `style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,.68)), url('${escapeHtml(item.image_path)}')"`
      : '';
    return `
      <button class="cms-item ${state.mode === 'edit' && state.selected?.id === item.id ? 'active' : ''}" data-id="${item.id}">
        <span class="cms-thumb ${item.image_path ? '' : 'missing'}" ${imageStyle}>${item.image_path ? '' : 'NO IMG'}</span>
        <span>
          <small>${escapeHtml(item.status)} / ${escapeHtml(item.type)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <em>${escapeHtml(line)}</em>
        </span>
        <b>${item.image_path ? '有图' : '缺图'}</b>
      </button>
    `;
  }).join('');

  listEl.querySelectorAll('[data-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = 'edit';
      state.selected = state.items.find((item) => item.id === Number(button.dataset.id));
      render();
    });
  });
}

function renderCreateForm() {
  editorEl.innerHTML = `
    <span>New Archive Item</span>
    <div class="cms-preview missing">
      <strong>新增影像</strong>
    </div>
    <form data-create-form>
      <label>影像名称 <input name="title" required placeholder="例如 大明王朝1566" /></label>
      <label>类型
        <select name="type">
          <option>电影</option>
          <option>剧集</option>
          <option>纪录片</option>
          <option>动画</option>
          <option>综艺</option>
        </select>
      </label>
      <label>状态
        <select name="status">
          <option>已看</option>
          <option>想看</option>
        </select>
      </label>
      <button type="submit">创建并继续编辑</button>
    </form>
  `;

  editorEl.querySelector('[data-create-form]').addEventListener('submit', createItem);
}

function renderEditor() {
  if (state.mode === 'create') {
    renderCreateForm();
    return;
  }

  const item = state.selected;
  if (!item) {
    editorEl.innerHTML = '<p>从左侧选择一个影像条目开始编辑，或点击“新增影像”。</p>';
    return;
  }

  editorEl.innerHTML = `
    <span>Live Editor</span>
    <div class="cms-preview ${item.image_path ? '' : 'missing'}" ${item.image_path ? `style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,.72)), url('${escapeHtml(item.image_path)}')"` : ''}>
      <strong>${escapeHtml(item.title)}</strong>
    </div>
    <form data-edit-form>
      <label>状态
        <select name="status">
          <option ${item.status === '已看' ? 'selected' : ''}>已看</option>
          <option ${item.status === '想看' ? 'selected' : ''}>想看</option>
        </select>
      </label>
      <label>评分 <input name="rating" value="${escapeHtml(item.rating || '')}" placeholder="例如 4" /></label>
      <label>个人评论 <textarea name="comment" placeholder="写你自己的短评">${escapeHtml(item.comment || '')}</textarea></label>
      <label>佳句 <textarea name="quote" placeholder="摘录一句适合放在卡片上的话">${escapeHtml(item.quote || '')}</textarea></label>
      <label>佳句来源 <input name="quote_source" value="${escapeHtml(item.quote_source || '')}" placeholder="例如 官方台词 / 豆瓣 / 自己整理" /></label>
      <label class="cms-check"><input type="checkbox" name="is_featured" ${item.is_featured ? 'checked' : ''} /> 精选展示</label>
      <button type="submit">保存内容</button>
    </form>
    <form data-image-form>
      <label>上传对应图片 <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
      <button type="submit">上传图片</button>
      <p>上传后会按影像名保存，例如“${escapeHtml(item.title)}.jpg”。</p>
    </form>
    <form data-delete-form class="cms-danger-zone">
      <p>删除重复或误建条目。图片文件会保留，避免误删复用素材。</p>
      <button type="submit">删除当前影像</button>
    </form>
  `;

  editorEl.querySelector('[data-edit-form]').addEventListener('submit', saveSelected);
  editorEl.querySelector('[data-image-form]').addEventListener('submit', uploadImage);
  editorEl.querySelector('[data-delete-form]').addEventListener('submit', deleteSelected);
}

function render() {
  renderStats();
  renderList();
  renderEditor();
}

async function createItem(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveStateEl.textContent = 'CREATING';
  const res = await fetch('/api/admin/watch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: form.get('title'),
      type: form.get('type'),
      status: form.get('status'),
    }),
  });

  if (!res.ok) {
    saveStateEl.textContent = 'CREATE FAILED';
    return;
  }

  const data = await res.json();
  state.mode = 'edit';
  state.filter = 'all';
  state.query = '';
  searchEl.value = '';
  state.selected = data.item;
  saveStateEl.textContent = 'CREATED';
  await loadItems();
}

async function saveSelected(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  saveStateEl.textContent = 'SAVING';
  const res = await fetch(`/api/admin/watch/${state.selected.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: form.get('status'),
      rating: form.get('rating'),
      comment: form.get('comment'),
      quote: form.get('quote'),
      quote_source: form.get('quote_source'),
      is_featured: form.get('is_featured') === 'on',
    }),
  });

  if (!res.ok) {
    saveStateEl.textContent = 'SAVE FAILED';
    return;
  }

  const data = await res.json();
  state.selected = data.item;
  saveStateEl.textContent = 'SAVED';
  await loadItems();
}

async function uploadImage(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  if (!form.get('image')?.size) return;
  saveStateEl.textContent = 'UPLOADING';
  const res = await fetch(`/api/admin/watch/${state.selected.id}/image`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    saveStateEl.textContent = 'UPLOAD FAILED';
    return;
  }

  const data = await res.json();
  state.selected = data.item;
  saveStateEl.textContent = 'IMAGE SAVED';
  await loadItems();
}

async function deleteSelected(event) {
  event.preventDefault();
  const item = state.selected;
  if (!item) return;
  if (!window.confirm(`确认删除《${item.title}》？此操作不可撤销。`)) return;

  saveStateEl.textContent = 'DELETING';
  const res = await fetch(`/api/admin/watch/${item.id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    saveStateEl.textContent = 'DELETE FAILED';
    return;
  }

  state.selected = null;
  saveStateEl.textContent = 'DELETED';
  await loadItems();
}

createButton?.addEventListener('click', () => {
  state.mode = 'create';
  state.selected = null;
  render();
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.mode = 'edit';
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((el) => el.classList.toggle('active', el === button));
    loadItems();
  });
});

searchEl.addEventListener('input', () => {
  state.mode = 'edit';
  state.query = searchEl.value;
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadItems, 180);
});

loadItems().catch(() => {
  saveStateEl.textContent = 'LOAD FAILED';
});
