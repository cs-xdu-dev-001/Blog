(() => {
  const root = document.querySelector('[data-assistant-root]');
  if (!root || root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';

  const openButton = root.querySelector('[data-assistant-open]');
  const closeButton = root.querySelector('[data-assistant-close]');
  const panel = root.querySelector('[data-assistant-panel]');
  const form = root.querySelector('[data-assistant-form]');
  const input = root.querySelector('[data-assistant-input]');
  const answerEl = root.querySelector('[data-assistant-answer]');
  const sourcesEl = root.querySelector('[data-assistant-sources]');
  const welcomeEl = root.querySelector('[data-assistant-welcome]');
  let pending = false;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const setOpen = (isOpen) => {
    root.classList.toggle('is-open', isOpen);
    panel?.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen) window.setTimeout(() => input?.focus(), 140);
  };

  const setStatus = (text) => {
    if (!answerEl) return;
    welcomeEl.hidden = true;
    answerEl.hidden = false;
    answerEl.classList.add('is-loading');
    answerEl.textContent = text;
    sourcesEl.hidden = true;
    sourcesEl.innerHTML = '';
  };

  const renderAnswer = (payload) => {
    answerEl.classList.remove('is-loading', 'is-refused');
    answerEl.classList.toggle('is-refused', Boolean(payload.refused || payload.error));
    answerEl.textContent = payload.answer || payload.error || '没有得到可用回答。';

    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    if (!sources.length) {
      sourcesEl.hidden = true;
      sourcesEl.innerHTML = '';
      return;
    }

    sourcesEl.hidden = false;
    sourcesEl.innerHTML = [
      '<span>参考</span>',
      ...sources.slice(0, 4).map((source) => `
        <a href="${escapeHtml(source.url || '#')}">
          <small>${escapeHtml(source.typeLabel || '来源')}</small>
          <strong>${escapeHtml(source.title || '未命名')}</strong>
        </a>
      `),
    ].join('');
  };

  openButton?.addEventListener('click', () => setOpen(true));
  closeButton?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-open')) setOpen(false);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setOpen(!root.classList.contains('is-open'));
    }
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      form?.requestSubmit();
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    const question = input.value.trim();
    if (!question) {
      input.focus();
      return;
    }

    pending = true;
    root.classList.add('is-pending');
    setStatus('正在思考...');

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const payload = await response.json().catch(() => ({}));
      renderAnswer(payload);
    } catch {
      renderAnswer({ error: '暂时无法连接AI助手。' });
    } finally {
      pending = false;
      root.classList.remove('is-pending');
    }
  });
})();
