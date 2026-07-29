function escapeMarkdownLabel(value) {
  return String(value || '').replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

export function buildReferenceMarkdown(item) {
  const title = escapeMarkdownLabel(item?.title).trim();
  const url = String(item?.url || '').trim();
  return title && url ? `[${title}](${url})` : '';
}

export function findReferenceTrigger(textInput, caretInput) {
  const text = String(textInput || '');
  const caret = Math.max(0, Math.min(Number(caretInput) || 0, text.length));
  const before = text.slice(0, caret);
  const start = before.lastIndexOf('[[');
  if (start < 0) return null;
  const query = before.slice(start + 2);
  if (query.includes('\n') || query.includes(']]') || query.includes('[[') || query.length > 80) {
    return null;
  }
  return { from: start, to: caret, query };
}

export function attachPostReferencePicker({
  root,
  getTrigger,
  insertReference,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!root || typeof getTrigger !== 'function' || typeof insertReference !== 'function') {
    return () => {};
  }

  const popover = document.createElement('div');
  popover.className = 'post-reference-picker';
  popover.hidden = true;
  popover.setAttribute('role', 'listbox');
  document.body.append(popover);

  let timer = 0;
  let request = null;
  let trigger = null;
  let items = [];
  let activeIndex = 0;
  let sequence = 0;

  function close() {
    window.clearTimeout(timer);
    request?.abort();
    request = null;
    trigger = null;
    items = [];
    activeIndex = 0;
    popover.hidden = true;
    popover.replaceChildren();
  }

  function position(nextTrigger) {
    const coords = nextTrigger?.coords;
    if (!coords) return;
    const width = Math.min(360, Math.max(240, window.innerWidth - 24));
    const left = Math.max(12, Math.min(coords.left, window.innerWidth - width - 12));
    const top = Math.min(coords.bottom + 8, window.innerHeight - 300);
    popover.style.width = `${width}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.max(12, Math.round(top))}px`;
  }

  function choose(index) {
    const item = items[index];
    const markdown = buildReferenceMarkdown(item);
    if (!item || !markdown || !trigger) return;
    insertReference({ ...trigger, markdown, item });
    close();
  }

  function render() {
    popover.replaceChildren();
    items.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'post-reference-picker-item';
      button.dataset.active = String(index === activeIndex);
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === activeIndex));

      const main = document.createElement('span');
      const title = document.createElement('strong');
      const subtitle = document.createElement('span');
      const type = document.createElement('em');
      title.textContent = item.title;
      subtitle.textContent = item.subtitle || item.url;
      type.textContent = item.typeLabel || '';
      main.append(title, subtitle);
      button.append(main, type);
      button.addEventListener('pointerdown', (event) => event.preventDefault());
      button.addEventListener('click', () => choose(index));
      popover.append(button);
    });
    popover.hidden = items.length === 0;
  }

  async function search(nextTrigger) {
    const query = String(nextTrigger?.query || '').trim();
    if (!query) {
      close();
      return;
    }
    trigger = nextTrigger;
    position(trigger);
    request?.abort();
    request = new AbortController();
    const requestSequence = ++sequence;
    try {
      const response = await fetchImpl(`/api/admin/references?q=${encodeURIComponent(query)}`, {
        credentials: 'same-origin',
        signal: request.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (requestSequence !== sequence) return;
      items = Array.isArray(data.items) ? data.items : [];
      activeIndex = 0;
      render();
    } catch (error) {
      if (error?.name !== 'AbortError' && requestSequence === sequence) close();
    }
  }

  function schedule() {
    window.clearTimeout(timer);
    const nextTrigger = getTrigger();
    if (!nextTrigger) {
      close();
      return;
    }
    trigger = nextTrigger;
    position(trigger);
    timer = window.setTimeout(() => void search(nextTrigger), 120);
  }

  function onKeydown(event) {
    if (popover.hidden || !items.length) return;
    if (event.key === 'ArrowDown') {
      activeIndex = (activeIndex + 1) % items.length;
      render();
    } else if (event.key === 'ArrowUp') {
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      render();
    } else if (event.key === 'Enter') {
      choose(activeIndex);
    } else if (event.key === 'Escape') {
      close();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  const onOutsidePointer = (event) => {
    if (!popover.contains(event.target) && !root.contains(event.target)) close();
  };
  root.addEventListener('keydown', onKeydown, true);
  root.addEventListener('keyup', schedule, true);
  root.addEventListener('pointerup', schedule, true);
  document.addEventListener('pointerdown', onOutsidePointer, true);

  return () => {
    close();
    root.removeEventListener('keydown', onKeydown, true);
    root.removeEventListener('keyup', schedule, true);
    root.removeEventListener('pointerup', schedule, true);
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    popover.remove();
  };
}
