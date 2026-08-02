const state = { items: [], query: '', totalComments: 0 };
const listEl = document.querySelector('[data-comments-list]');
const summaryEl = document.querySelector('[data-comments-summary]');
const searchEl = document.querySelector('[data-comments-search]');
const errorEl = document.querySelector('[data-comments-error]');
const errorMessageEl = document.querySelector('[data-comments-error-message]');
const refreshButton = document.querySelector('[data-comments-refresh]');
const initialParams = new URLSearchParams(window.location.search);
state.query = initialParams.get('query') || '';
if (searchEl) searchEl.value = state.query;
let loadController = null;
const pagination = window.AdminPagination.create({
  root: document.querySelector('[data-admin-pagination]'),
  onChange: () => loadComments(),
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知时间';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function render() {
  const items = state.items;
  summaryEl.textContent = state.query
    ? `${pagination.state.total}/${state.totalComments}条`
    : `${state.totalComments}条`;

  if (!items.length) {
    listEl.innerHTML = `<div class="cms-index-empty">${state.totalComments ? '没有匹配的留言' : '暂无留言'}</div>`;
    return;
  }

  listEl.innerHTML = items.map((item) => {
    const avatar = item.author?.avatarUrl
      ? `<img src="${escapeHtml(item.author.avatarUrl)}" alt="" width="42" height="42" loading="lazy" decoding="async" />`
      : '<span class="cms-comment-avatar-fallback" aria-hidden="true">GH</span>';
    const replyBadge = item.isReply ? '<span class="cms-index-badge">回复</span>' : '';
    const minimizedBadge = item.isMinimized ? '<span class="cms-index-badge">已隐藏</span>' : '';
    return `
      <article class="cms-comment-row" data-comment-id="${escapeHtml(item.id)}">
        <div class="cms-comment-main">
          <span class="cms-comment-avatar">${avatar}</span>
          <div>
            <div class="cms-comment-author">
              <strong>@${escapeHtml(item.author?.login || 'ghost')}</strong>
              ${replyBadge}
              ${minimizedBadge}
            </div>
            <p>${escapeHtml(item.body || '空留言')}</p>
            <span class="cms-comment-context">${escapeHtml(item.discussion?.title || '首页留言')}</span>
          </div>
        </div>
        <time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(formatDate(item.createdAt))}</time>
        <div class="cms-comment-actions">
          <a href="${escapeHtml(item.url || item.discussion?.url || '#')}" target="_blank" rel="noreferrer">打开</a>
          <button type="button" data-delete-comment="${escapeHtml(item.id)}" data-comment-author="${escapeHtml(item.author?.login || 'ghost')}">删除</button>
        </div>
      </article>
    `;
  }).join('');
}

function showError(message) {
  summaryEl.textContent = '读取失败';
  errorMessageEl.textContent = message || '留言读取失败';
  errorEl.hidden = false;
}

async function loadComments({ force = false } = {}) {
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  errorEl.hidden = true;
  summaryEl.textContent = '正在读取';
  listEl.setAttribute('aria-busy', 'true');
  refreshButton.disabled = true;

  try {
    const baseUrl = force ? '/api/admin/comments?refresh=1' : '/api/admin/comments';
    const params = new URLSearchParams(baseUrl.split('?')[1] || '');
    params.set('query', state.query);
    pagination.appendTo(params);
    const url = `${baseUrl.split('?')[0]}?${params}`;
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '留言读取失败');
    if (loadController !== controller) return;
    state.items = Array.isArray(data.items) ? data.items : [];
    state.totalComments = Number(data.totalComments || 0);
    pagination.set(data.pagination);
    pagination.syncUrl({ query: state.query });
    render();
  } catch (error) {
    if (error.name === 'AbortError') return;
    showError(error.message);
  } finally {
    if (loadController === controller) {
      loadController = null;
      listEl.removeAttribute('aria-busy');
      refreshButton.disabled = false;
    }
  }
}

async function deleteComment(button) {
  const id = button.dataset.deleteComment || '';
  const author = button.dataset.commentAuthor || '该用户';
  if (!id || !window.confirm(`确定删除${author}的这条留言？删除后无法恢复。`)) return;

  button.disabled = true;
  errorEl.hidden = true;
  try {
    const response = await fetch(`/api/admin/comments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '留言删除失败');
    state.items = state.items.filter((item) => item.id !== id);
    state.totalComments = Math.max(0, state.totalComments - 1);
    const total = Math.max(0, pagination.state.total - 1);
    pagination.set({
      page: pagination.state.page,
      pageSize: pagination.state.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.state.pageSize)),
    });
    render();
  } catch (error) {
    errorMessageEl.textContent = error?.message || '留言删除失败';
    errorEl.hidden = false;
  } finally {
    button.disabled = false;
  }
}

listEl?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-comment]');
  if (button) deleteComment(button);
});

searchEl?.addEventListener('input', () => {
  state.query = searchEl.value;
  pagination.reset();
  window.clearTimeout(searchEl._timer);
  searchEl._timer = window.setTimeout(loadComments, 240);
});

document.querySelector('[data-comments-refresh]')?.addEventListener('click', () => loadComments({ force: true }));
document.querySelector('[data-comments-retry]')?.addEventListener('click', () => loadComments({ force: true }));
loadComments();
