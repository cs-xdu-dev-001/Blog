const state = {
  items: [],
  stats: null,
  selected: null,
  mode: 'edit',
  filter: 'all',
  query: '',
};

const listEl = document.querySelector('[data-reading-list]');
const statsEl = document.querySelector('[data-reading-stats]');
const editorEl = document.querySelector('[data-reading-editor]');
const searchEl = document.querySelector('[data-reading-search]');
const saveStateEl = document.querySelector('[data-save-state]');
const createButton = document.querySelector('[data-create-reading]');

const statusLabels = {
  reading: '在读',
  read: '已读',
  planned: '待读',
};

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
  const res = await fetch(`/api/admin/reading?${params}`);
  if (!res.ok) throw new Error('Failed to load reading items');
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
    ['总书目', state.stats.total, '全部阅读档案'],
    ['缺封面', state.stats.missingImage, '需要上传图片'],
    ['缺书评', state.stats.missingReview, '等待个人记录'],
    ['缺摘句', state.stats.missingQuote, '等待摘录句子'],
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
    listEl.innerHTML = '<p class="cms-empty">没有匹配的书籍。</p>';
    return;
  }

  listEl.innerHTML = state.items.map((item) => {
    const line = item.review || item.quote || item.summary || '等待补充内容';
    const imageStyle = item.image_path
      ? `style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,.68)), url('${escapeHtml(item.image_path)}')"`
      : `style="background:${escapeHtml(item.spine_color)}"`;
    return `
      <button class="cms-item ${state.mode === 'edit' && state.selected?.id === item.id ? 'active' : ''}" data-id="${item.id}">
        <span class="cms-thumb ${item.image_path ? '' : 'missing'}" ${imageStyle}>${item.image_path ? '' : 'BOOK'}</span>
        <span>
          <small>${escapeHtml(item.status_label)} / ${escapeHtml(item.author)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <em>${escapeHtml(line)}</em>
        </span>
        <b>${item.image_path ? '有封面' : '缺封面'}</b>
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
    <span>New Book Item</span>
    <div class="cms-preview missing">
      <strong>新增书籍</strong>
    </div>
    <form data-create-form>
      <label>书名 <input name="title" required placeholder="例如 三体" /></label>
      <label>作者 <input name="author" placeholder="例如 刘慈欣" /></label>
      <label>状态
        <select name="status">
          <option value="reading">在读</option>
          <option value="read">已读</option>
          <option value="planned" selected>待读</option>
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
    editorEl.innerHTML = '<p>从左侧选择一本书开始编辑，或点击“新增书籍”。</p>';
    return;
  }

  editorEl.innerHTML = `
    <span>Book Editor</span>
    <div class="cms-preview ${item.image_path ? '' : 'missing'}" ${item.image_path ? `style="background-image: linear-gradient(180deg, transparent, rgba(0,0,0,.72)), url('${escapeHtml(item.image_path)}')"` : `style="background:${escapeHtml(item.spine_color)}"`}>
      <strong>${escapeHtml(item.title)}</strong>
    </div>
    <form data-edit-form>
      <label>状态
        <select name="status">
          <option value="reading" ${item.status === 'reading' ? 'selected' : ''}>在读</option>
          <option value="read" ${item.status === 'read' ? 'selected' : ''}>已读</option>
          <option value="planned" ${item.status === 'planned' ? 'selected' : ''}>待读</option>
        </select>
      </label>
      <label>作者 <input name="author" value="${escapeHtml(item.author || '')}" /></label>
      <label>进度 <input name="progress" value="${escapeHtml(item.progress || '')}" placeholder="例如 在读 / 已完成 / 42%" /></label>
      <label>书脊颜色 <input name="spine_color" value="${escapeHtml(item.spine_color || '#263548')}" /></label>
      <label>强调色 <input name="accent_color" value="${escapeHtml(item.accent_color || '#ff9138')}" /></label>
      <label>简介 <textarea name="summary" placeholder="放在书架卡片上的短简介">${escapeHtml(item.summary || '')}</textarea></label>
      <label>摘句 <textarea name="quote" placeholder="放在卡片和详情页里的摘句">${escapeHtml(item.quote || '')}</textarea></label>
      <label>书评 <textarea name="review" placeholder="写你自己的阅读记录">${escapeHtml(item.review || '')}</textarea></label>
      <label class="cms-check"><input type="checkbox" name="is_featured" ${item.is_featured ? 'checked' : ''} /> 首页展示</label>
      <button type="submit">保存内容</button>
    </form>
    <form data-image-form>
      <label>上传对应封面 <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
      <button type="submit">上传封面</button>
      <p>上传后会按书名保存，例如“${escapeHtml(item.title)}.jpg”。</p>
    </form>
    <form data-delete-form class="cms-danger-zone">
      <p>删除重复或误建条目。封面文件会保留，避免误删复用素材。</p>
      <button type="submit">删除当前书籍</button>
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
  const res = await fetch('/api/admin/reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: form.get('title'),
      author: form.get('author'),
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
  const status = String(form.get('status') || 'reading');
  saveStateEl.textContent = 'SAVING';
  const res = await fetch(`/api/admin/reading/${state.selected.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      status_label: statusLabels[status],
      author: form.get('author'),
      progress: form.get('progress'),
      summary: form.get('summary'),
      quote: form.get('quote'),
      review: form.get('review'),
      spine_color: form.get('spine_color'),
      accent_color: form.get('accent_color'),
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
  const res = await fetch(`/api/admin/reading/${state.selected.id}/image`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    saveStateEl.textContent = 'UPLOAD FAILED';
    return;
  }

  const data = await res.json();
  state.selected = data.item;
  saveStateEl.textContent = 'COVER SAVED';
  await loadItems();
}

async function deleteSelected(event) {
  event.preventDefault();
  const item = state.selected;
  if (!item) return;
  if (!window.confirm(`确认删除《${item.title}》？此操作不可撤销。`)) return;

  saveStateEl.textContent = 'DELETING';
  const res = await fetch(`/api/admin/reading/${item.id}`, {
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
