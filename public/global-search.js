import {
  escapeSearchHtml,
  flattenSearchItems,
  safeSearchHref,
} from '/global-search-core.mjs';

const root = document.querySelector('[data-global-search]');

if (root) {
  const input = root.querySelector('[data-global-search-input]');
  const resultsEl = root.querySelector('[data-global-search-results]');
  const previewEl = root.querySelector('[data-global-search-preview]');
  const backButton = root.querySelector('[data-global-search-back]');
  const compactViewport = window.matchMedia('(max-width: 640px)');
  let groups = [];
  let items = [];
  let selectedIndex = -1;
  let tagChildIndex = -1;
  let activeRequest = null;
  let inputTimer = 0;
  let returnFocus = null;

  const typeGlyph = {
    post: '文',
    reading: '书',
    watch: '影',
    tag: '#',
  };

  function currentItem() {
    return items[selectedIndex] || null;
  }

  function currentTagChild() {
    const item = currentItem();
    return item?.type === 'tag' && Array.isArray(item.children)
      ? item.children[tagChildIndex] || null
      : null;
  }

  function setPreviewing(isPreviewing) {
    root.classList.toggle('is-previewing', compactViewport.matches && Boolean(isPreviewing));
  }

  function resultRow(item, index) {
    const selected = index === selectedIndex;
    return `
      <button
        type="button"
        class="global-search-result ${selected ? 'is-selected' : ''}"
        role="option"
        aria-selected="${selected}"
        id="global-search-result-${index}"
        data-global-search-index="${index}"
      >
        <span class="global-search-result-icon" aria-hidden="true">${escapeSearchHtml(typeGlyph[item.type] || '·')}</span>
        <span class="global-search-result-copy">
          <strong>${escapeSearchHtml(item.title)}</strong>
          ${item.meta ? `<span>${escapeSearchHtml(item.meta)}</span>` : ''}
        </span>
        ${item.type === 'tag' ? '<i aria-hidden="true">›</i>' : ''}
      </button>
    `;
  }

  function renderResults() {
    if (!items.length) {
      resultsEl.innerHTML = '<div class="global-search-state">没有匹配内容</div>';
      input.removeAttribute('aria-activedescendant');
      return;
    }

    let offset = 0;
    resultsEl.innerHTML = groups.map((group) => {
      if (!Array.isArray(group.items) || !group.items.length) return '';
      const rows = group.items.map((item, localIndex) => resultRow(item, offset + localIndex)).join('');
      offset += group.items.length;
      return `
        <section class="global-search-group" aria-label="${escapeSearchHtml(group.label)}">
          <div class="global-search-group-label">${escapeSearchHtml(group.label)}</div>
          ${rows}
        </section>
      `;
    }).join('');

    if (selectedIndex >= 0) input.setAttribute('aria-activedescendant', `global-search-result-${selectedIndex}`);
    resultsEl.querySelectorAll('[data-global-search-index]').forEach((button) => {
      const index = Number(button.dataset.globalSearchIndex);
      button.addEventListener('pointerenter', () => selectIndex(index));
      button.addEventListener('click', () => {
        selectIndex(index);
        activateCurrent();
      });
    });
  }

  function previewMedia(item) {
    const image = safeSearchHref(item.image);
    if (image) {
      return `<div class="global-search-preview-media has-image"><img src="${escapeSearchHtml(image)}" alt="" /></div>`;
    }
    return `<div class="global-search-preview-media"><span aria-hidden="true">${escapeSearchHtml(typeGlyph[item.type] || '·')}</span></div>`;
  }

  function renderTagPreview(item) {
    const children = Array.isArray(item.children) ? item.children : [];
    previewEl.innerHTML = `
      <div class="global-search-preview-head">
        <span>#</span>
        <h3>${escapeSearchHtml(item.title)}</h3>
      </div>
      <div class="global-search-tag-children">
        ${children.map((child, index) => `
          <button
            type="button"
            class="global-search-tag-child ${index === tagChildIndex ? 'is-selected' : ''}"
            data-global-search-child="${index}"
          >
            <strong>${escapeSearchHtml(child.title)}</strong>
            <span>${escapeSearchHtml(child.meta || '')}</span>
          </button>
        `).join('')}
      </div>
    `;
    previewEl.querySelectorAll('[data-global-search-child]').forEach((button) => {
      const index = Number(button.dataset.globalSearchChild);
      button.addEventListener('pointerenter', () => selectTagChild(index));
      button.addEventListener('click', () => {
        selectTagChild(index);
        openItem(currentTagChild());
      });
    });
  }

  function renderPreview() {
    const item = currentItem();
    if (!item) {
      previewEl.innerHTML = '';
      return;
    }
    if (item.type === 'tag') {
      renderTagPreview(item);
      return;
    }

    previewEl.innerHTML = `
      ${previewMedia(item)}
      <div class="global-search-preview-copy">
        <span>${escapeSearchHtml(item.groupLabel || '')}</span>
        <h3>${escapeSearchHtml(item.title)}</h3>
        ${item.meta ? `<strong>${escapeSearchHtml(item.meta)}</strong>` : ''}
        ${item.excerpt ? `<p>${escapeSearchHtml(item.excerpt)}</p>` : ''}
      </div>
      <a class="global-search-preview-open" href="${escapeSearchHtml(safeSearchHref(item.href))}" aria-label="打开${escapeSearchHtml(item.title)}">→</a>
    `;
  }

  function syncResultSelection() {
    resultsEl.querySelectorAll('[data-global-search-index]').forEach((button) => {
      const selected = Number(button.dataset.globalSearchIndex) === selectedIndex;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    if (selectedIndex >= 0) input.setAttribute('aria-activedescendant', `global-search-result-${selectedIndex}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function selectIndex(index) {
    if (!items.length) return;
    selectedIndex = (index + items.length) % items.length;
    tagChildIndex = -1;
    syncResultSelection();
    renderPreview();
    resultsEl.querySelector(`[data-global-search-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function selectTagChild(index) {
    const item = currentItem();
    if (item?.type !== 'tag' || !Array.isArray(item.children) || !item.children.length) return;
    tagChildIndex = (index + item.children.length) % item.children.length;
    previewEl.querySelectorAll('[data-global-search-child]').forEach((button) => {
      button.classList.toggle('is-selected', Number(button.dataset.globalSearchChild) === tagChildIndex);
    });
  }

  function openItem(item) {
    const href = safeSearchHref(item?.href);
    if (href) window.location.href = href;
  }

  function activateCurrent() {
    const item = currentItem();
    if (!item) return;
    if (compactViewport.matches && !root.classList.contains('is-previewing')) {
      setPreviewing(true);
      return;
    }
    if (item.type === 'tag') {
      if (tagChildIndex < 0) selectTagChild(0);
      else openItem(currentTagChild());
      return;
    }
    openItem(item);
  }

  function setLoading() {
    setPreviewing(false);
    resultsEl.innerHTML = '<div class="global-search-state is-loading">检索中</div>';
    previewEl.innerHTML = '';
  }

  async function requestResults(query) {
    activeRequest?.abort();
    activeRequest = new AbortController();
    const request = activeRequest;
    setLoading();

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: request.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (activeRequest !== request) return;
      groups = Array.isArray(payload.groups) ? payload.groups : [];
      items = flattenSearchItems(groups);
      selectedIndex = items.length ? 0 : -1;
      tagChildIndex = -1;
      renderResults();
      renderPreview();
    } catch (error) {
      if (error?.name === 'AbortError') return;
      groups = [];
      items = [];
      selectedIndex = -1;
      resultsEl.innerHTML = '<div class="global-search-state">搜索暂时不可用</div>';
      previewEl.innerHTML = '';
    }
  }

  function openSearch(trigger) {
    returnFocus = trigger || document.activeElement;
    root.hidden = false;
    setPreviewing(false);
    document.body.classList.add('global-search-open');
    window.requestAnimationFrame(() => root.classList.add('is-open'));
    input.focus({ preventScroll: true });
    requestResults(input.value.trim());
  }

  function closeSearch() {
    activeRequest?.abort();
    window.clearTimeout(inputTimer);
    root.classList.remove('is-open');
    setPreviewing(false);
    document.body.classList.remove('global-search-open');
    window.setTimeout(() => {
      root.hidden = true;
      returnFocus?.focus?.({ preventScroll: true });
    }, 180);
  }

  input.addEventListener('input', () => {
    setPreviewing(false);
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(() => requestResults(input.value.trim()), 120);
  });

  root.querySelectorAll('[data-global-search-close]').forEach((button) => button.addEventListener('click', closeSearch));
  backButton?.addEventListener('click', () => {
    setPreviewing(false);
    input.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-global-search-open]').forEach((button) => button.addEventListener('click', () => openSearch(button)));
  compactViewport.addEventListener?.('change', () => setPreviewing(false));

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (root.hidden) openSearch(document.activeElement);
      else closeSearch();
      return;
    }
    if (root.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (tagChildIndex >= 0) selectTagChild(tagChildIndex + 1);
      else selectIndex(selectedIndex + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (tagChildIndex >= 0) selectTagChild(tagChildIndex - 1);
      else selectIndex(selectedIndex - 1);
      return;
    }
    if (event.key === 'ArrowRight' && currentItem()?.type === 'tag') {
      event.preventDefault();
      selectTagChild(Math.max(0, tagChildIndex));
      return;
    }
    if (event.key === 'ArrowLeft' && tagChildIndex >= 0) {
      event.preventDefault();
      tagChildIndex = -1;
      renderPreview();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateCurrent();
    }
  });
}
