(function initializeAdminPagination(global) {
  const PAGE_SIZES = [10, 30, 50, 100];
  const STORAGE_KEY = 'dev-notes.admin.page-size';

  function positiveInteger(value, fallback) {
    const number = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function savedPageSize() {
    try {
      const value = Number(global.localStorage.getItem(STORAGE_KEY));
      return PAGE_SIZES.includes(value) ? value : 30;
    } catch {
      return 30;
    }
  }

  function initialState() {
    const params = new URLSearchParams(global.location.search);
    const requestedSize = Number(params.get('pageSize'));
    return {
      page: positiveInteger(params.get('page'), 1),
      pageSize: PAGE_SIZES.includes(requestedSize) ? requestedSize : savedPageSize(),
      total: 0,
      totalPages: 1,
    };
  }

  function create({ root, onChange }) {
    const state = initialState();

    function syncUrl(values = {}) {
      const params = new URLSearchParams();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined && value !== 'all') {
          params.set(key, String(value));
        }
      });
      if (state.page > 1) params.set('page', String(state.page));
      if (state.pageSize !== 30) params.set('pageSize', String(state.pageSize));
      const query = params.toString();
      global.history.replaceState(null, '', `${global.location.pathname}${query ? `?${query}` : ''}${global.location.hash}`);
    }

    function appendTo(params) {
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      return params;
    }

    function render() {
      if (!root) return;
      root.innerHTML = `
        <label class="cms-page-size">
          <span aria-hidden="true">▤</span>
          <select aria-label="每页条数">
            ${PAGE_SIZES.map((size) => `<option value="${size}" ${size === state.pageSize ? 'selected' : ''}>${size}条/页</option>`).join('')}
          </select>
        </label>
        <button type="button" data-page-direction="previous" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
        <span class="cms-page-position">第 ${state.page} / ${state.totalPages} 页</span>
        <button type="button" data-page-direction="next" ${state.page >= state.totalPages ? 'disabled' : ''}>下一页</button>
      `;
    }

    function set(meta = {}) {
      state.page = positiveInteger(meta.page, state.page);
      state.pageSize = PAGE_SIZES.includes(Number(meta.pageSize)) ? Number(meta.pageSize) : state.pageSize;
      state.total = Math.max(0, Number(meta.total) || 0);
      state.totalPages = Math.max(1, Number(meta.totalPages) || 1);
      render();
    }

    function reset() {
      state.page = 1;
    }

    root?.addEventListener('change', (event) => {
      const select = event.target.closest('select');
      if (!select) return;
      const nextSize = Number(select.value);
      if (!PAGE_SIZES.includes(nextSize)) return;
      state.pageSize = nextSize;
      state.page = 1;
      try { global.localStorage.setItem(STORAGE_KEY, String(nextSize)); } catch {}
      render();
      onChange?.({ ...state });
    });

    root?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-page-direction]');
      if (!button || button.disabled) return;
      const offset = button.dataset.pageDirection === 'next' ? 1 : -1;
      const nextPage = Math.min(state.totalPages, Math.max(1, state.page + offset));
      if (nextPage === state.page) return;
      state.page = nextPage;
      render();
      onChange?.({ ...state });
    });

    render();
    return { state, set, reset, appendTo, syncUrl };
  }

  global.AdminPagination = { create };
})(window);
