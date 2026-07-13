import {
  createAssistantSession,
  renderAssistantMarkdown,
  safeAssistantUrl,
} from '/assistant-core.mjs';

(() => {
  const root = document.querySelector('[data-assistant-root]');
  if (!root || root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';

  const openButton = root.querySelector('[data-assistant-open]');
  const closeButton = root.querySelector('[data-assistant-close]');
  const clearButton = root.querySelector('[data-assistant-clear]');
  const panel = root.querySelector('[data-assistant-panel]');
  const dragHandle = root.querySelector('[data-assistant-drag-handle]');
  const bodyEl = root.querySelector('.dn-assistant-body');
  const form = root.querySelector('[data-assistant-form]');
  const input = root.querySelector('[data-assistant-input]');
  const submitButton = root.querySelector('[data-assistant-submit]');
  const session = createAssistantSession({ historyLimit: 12 });
  let dragState = null;
  const storageKey = 'dev-notes-assistant-window';
  const minPanelSize = { width: 360, height: 430 };
  const compactViewport = window.matchMedia('(max-width: 640px)');

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const chatEl = document.createElement('div');
  chatEl.className = 'dn-assistant-chat';
  bodyEl?.append(chatEl);

  function readWindowState() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return {};
    try {
      return JSON.parse(saved) || {};
    } catch {
      localStorage.removeItem(storageKey);
      return {};
    }
  }

  function saveWindowState(next) {
    localStorage.setItem(storageKey, JSON.stringify({ ...readWindowState(), ...next }));
  }

  const panelBounds = () => {
    const rect = panel?.getBoundingClientRect();
    return {
      width: rect?.width || 420,
      height: rect?.height || 620,
      margin: 12,
    };
  };

  const clampSize = (width, height) => ({
    width: Math.min(Math.max(minPanelSize.width, width), Math.max(minPanelSize.width, window.innerWidth - 24)),
    height: Math.min(Math.max(minPanelSize.height, height), Math.max(minPanelSize.height, window.innerHeight - 24)),
  });

  const clampPosition = (left, top) => {
    const bounds = panelBounds();
    return {
      left: Math.min(Math.max(bounds.margin, left), Math.max(bounds.margin, window.innerWidth - bounds.width - bounds.margin)),
      top: Math.min(Math.max(bounds.margin, top), Math.max(bounds.margin, window.innerHeight - bounds.height - bounds.margin)),
    };
  };

  const applyPanelSize = (width, height, persist = true) => {
    if (!panel || compactViewport.matches) return;
    const next = clampSize(width, height);
    panel.style.width = `${next.width}px`;
    panel.style.height = `${next.height}px`;
    panel.dataset.resized = 'true';
    if (persist) saveWindowState(next);
  };

  const applyPanelPosition = (left, top, persist = true) => {
    if (!panel || compactViewport.matches) return;
    const next = clampPosition(left, top);
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.dataset.dragged = 'true';
    if (persist) saveWindowState(next);
  };

  const clampPanelPosition = () => {
    if (!panel || compactViewport.matches || panel.dataset.dragged !== 'true') return;
    const rect = panel.getBoundingClientRect();
    applyPanelPosition(rect.left, rect.top, false);
  };

  const persistPanelSize = () => {
    if (!panel || compactViewport.matches || !root.classList.contains('is-open')) return;
    const rect = panel.getBoundingClientRect();
    saveWindowState(clampSize(rect.width, rect.height));
    clampPanelPosition();
  };

  const clearPanelPresentation = () => {
    if (!panel) return;
    panel.style.left = '';
    panel.style.top = '';
    panel.style.right = '';
    panel.style.bottom = '';
    panel.style.width = '';
    panel.style.height = '';
    delete panel.dataset.dragged;
    delete panel.dataset.resized;
  };

  const resetPanelWindow = () => {
    clearPanelPresentation();
    localStorage.removeItem(storageKey);
  };

  const restorePanelWindow = () => {
    if (compactViewport.matches) {
      clearPanelPresentation();
      return;
    }
    const state = readWindowState();
    if (Number.isFinite(state.width) && Number.isFinite(state.height)) {
      applyPanelSize(state.width, state.height, false);
    }
    if (Number.isFinite(state.left) && Number.isFinite(state.top)) {
      applyPanelPosition(state.left, state.top, false);
    }
  };

  const setOpen = (isOpen) => {
    root.classList.toggle('is-open', isOpen);
    panel?.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (isOpen) window.requestAnimationFrame(clampPanelPosition);
    if (isOpen) window.setTimeout(() => input?.focus(), 140);
  };

  const setPendingState = (isPending) => {
    root.classList.toggle('is-pending', isPending);
    if (input) input.disabled = isPending;
    submitButton?.setAttribute('aria-label', isPending ? '停止生成' : '发送消息');
  };

  const scrollToBottom = () => {
    if (!bodyEl) return;
    bodyEl.scrollTop = bodyEl.scrollHeight;
  };

  const updateClearState = () => {
    if (clearButton) clearButton.disabled = chatEl.childElementCount === 0;
  };

  const renderSources = (sources) => {
    if (!Array.isArray(sources) || !sources.length) return '';
    return `
      <div class="dn-assistant-message-sources">
        <span>参考</span>
        ${sources.slice(0, 4).map((source) => {
          const href = safeAssistantUrl(source.url || '#');
          const external = /^https?:\/\//i.test(href);
          return `
            <a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
              <small>${escapeHtml(source.typeLabel || '来源')}</small>
              <strong>${escapeHtml(source.title || '未命名')}</strong>
            </a>
          `;
        }).join('')}
      </div>
    `;
  };

  const appendMessage = (role, text, options = {}) => {
    const item = document.createElement('article');
    item.className = `dn-assistant-message dn-assistant-message-${role}${options.loading ? ' is-loading' : ''}${options.error ? ' is-error' : ''}`;
    item.setAttribute('aria-label', role === 'user' ? '你的消息' : 'AI回答');

    const bubble = document.createElement('div');
    bubble.className = 'dn-assistant-bubble';
    bubble.textContent = text || '';
    item.append(bubble);

    if (options.sources?.length) item.insertAdjacentHTML('beforeend', renderSources(options.sources));
    chatEl.append(item);
    updateClearState();
    scrollToBottom();
    return item;
  };

  const updateMessage = (item, text, options = {}) => {
    item.classList.toggle('is-loading', Boolean(options.loading));
    item.classList.toggle('is-error', Boolean(options.error));
    item.classList.toggle('is-cancelled', Boolean(options.cancelled));
    const bubble = item.querySelector('.dn-assistant-bubble');
    if (bubble) {
      if (options.markdown) bubble.innerHTML = renderAssistantMarkdown(text);
      else bubble.textContent = text || '';
    }
    item.querySelector('.dn-assistant-message-sources')?.remove();
    if (options.sources?.length) item.insertAdjacentHTML('beforeend', renderSources(options.sources));
    scrollToBottom();
  };

  const clearConversation = () => {
    session.clear();
    setPendingState(false);
    chatEl.replaceChildren();
    if (input) input.value = '';
    updateClearState();
    input?.focus();
  };

  openButton?.addEventListener('click', () => setOpen(true));
  closeButton?.addEventListener('click', () => setOpen(false));
  clearButton?.addEventListener('click', clearConversation);

  dragHandle?.addEventListener('pointerdown', (event) => {
    if (!panel || compactViewport.matches || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    dragHandle.setPointerCapture(event.pointerId);
    panel.classList.add('is-dragging');
    event.preventDefault();
  });

  dragHandle?.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    applyPanelPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
  });

  const stopDragging = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragHandle.releasePointerCapture(event.pointerId);
    panel?.classList.remove('is-dragging');
    dragState = null;
  };

  dragHandle?.addEventListener('pointerup', stopDragging);
  dragHandle?.addEventListener('pointercancel', stopDragging);
  dragHandle?.addEventListener('dblclick', resetPanelWindow);
  window.addEventListener('resize', clampPanelPosition);
  compactViewport.addEventListener?.('change', restorePanelWindow);

  if ('ResizeObserver' in window && panel) {
    let resizeTimer = null;
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(persistPanelSize, 160);
    });
    resizeObserver.observe(panel);
  }

  restorePanelWindow();
  updateClearState();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('is-open')) setOpen(false);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setOpen(!root.classList.contains('is-open'));
    }
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form?.requestSubmit();
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (session.isPending()) {
      session.cancel();
      setPendingState(false);
      return;
    }

    const question = input.value.trim();
    if (!question) {
      input.focus();
      return;
    }

    const history = session.history();
    const request = session.beginRequest();
    input.value = '';
    setPendingState(true);
    appendMessage('user', question);
    const assistantMessage = appendMessage('assistant', '正在思考...', { loading: true });

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, messages: history }),
        signal: request.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (request.signal.aborted) throw new DOMException('Request aborted', 'AbortError');

      const answer = String(payload.answer || '').trim();
      const failed = Boolean(payload.refused || payload.error || !response.ok || !answer);
      if (failed) {
        updateMessage(assistantMessage, answer || payload.error || '没有得到可用回答。', {
          error: true,
          sources: payload.sources,
        });
      } else {
        updateMessage(assistantMessage, answer, {
          markdown: true,
          sources: payload.sources,
        });
        session.completeTurn(question, answer);
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (assistantMessage.isConnected) {
          updateMessage(assistantMessage, '已停止生成', { cancelled: true });
        }
      } else {
        updateMessage(assistantMessage, '暂时无法连接AI助手。', { error: true });
      }
    } finally {
      if (session.finishRequest(request)) setPendingState(false);
      updateClearState();
      if (!session.isPending()) input.focus();
    }
  });
})();
