import {
  consumeAssistantSse,
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
  const retryRequests = new WeakMap();
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
    item.querySelector('.dn-assistant-message-actions')?.remove();
    retryRequests.delete(item);
    if (options.sources?.length) item.insertAdjacentHTML('beforeend', renderSources(options.sources));
    if (options.retry) {
      const actions = document.createElement('div');
      actions.className = 'dn-assistant-message-actions';
      const retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'dn-assistant-retry';
      retryButton.dataset.assistantRetry = 'true';
      retryButton.textContent = '重试';
      actions.append(retryButton);
      item.append(actions);
      retryRequests.set(item, options.retry);
    }
    scrollToBottom();
  };

  const errorText = (payload = {}) => {
    const message = String(payload.message || payload.error || 'AI助手暂时不可用').trim();
    const code = String(payload.code || 'INTERNAL_ERROR').trim();
    return `${message}（${code}）`;
  };

  const runAssistantRequest = async ({
    question,
    historySnapshot,
    assistantMessage,
  }) => {
    if (session.isPending()) return;
    const request = session.beginRequest();
    setPendingState(true);
    updateMessage(assistantMessage, '正在连接', { loading: true });

    let answer = '';
    let sources = [];
    let completed = false;
    let streamError = null;
    let responseReader = null;

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, messages: historySnapshot }),
        signal: request.signal,
      });
      if (request.signal.aborted) throw new DOMException('Request aborted', 'AbortError');

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok || !contentType.includes('text/event-stream')) {
        const payload = await response.json().catch(() => ({}));
        streamError = {
          code: payload.code || (response.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_HTTP_ERROR'),
          message: payload.error || `请求失败（HTTP ${response.status}）`,
          retryable: payload.retryable !== false,
        };
      } else if (!response.body) {
        streamError = {
          code: 'EMPTY_RESPONSE',
          message: '模型没有返回内容',
          retryable: true,
        };
      } else {
        responseReader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const consumeEvents = (events) => {
          for (const message of events) {
            if (message.event === 'sources') {
              sources = Array.isArray(message.data?.sources) ? message.data.sources : [];
            } else if (message.event === 'delta') {
              const delta = String(message.data?.text || '');
              if (!delta) continue;
              if (!answer) {
                assistantMessage.dataset.status = '正在生成';
                updateMessage(assistantMessage, '正在生成', { loading: true });
              }
              answer += delta;
              updateMessage(assistantMessage, answer, { loading: true });
            } else if (message.event === 'done') {
              completed = true;
            } else if (message.event === 'error') {
              streamError = {
                code: message.data?.code || 'INTERNAL_ERROR',
                message: message.data?.message || 'AI助手暂时不可用',
                retryable: message.data?.retryable !== false,
              };
            }
          }
        };

        while (!completed && !streamError) {
          const chunk = await responseReader.read();
          if (chunk.done) break;
          const parsed = consumeAssistantSse(buffer, decoder.decode(chunk.value, { stream: true }));
          buffer = parsed.buffer;
          consumeEvents(parsed.events);
        }
        const tail = consumeAssistantSse(buffer, decoder.decode(), { flush: true });
        consumeEvents(tail.events);
        if (!completed && !streamError) {
          streamError = {
            code: answer ? 'STREAM_PROTOCOL_ERROR' : 'EMPTY_RESPONSE',
            message: answer ? '响应意外中断' : '模型没有返回内容',
            retryable: true,
          };
        }
      }

      if (streamError) {
        updateMessage(assistantMessage, errorText(streamError), {
          error: true,
          sources,
          retry: streamError.retryable ? { question, historySnapshot } : null,
        });
      } else if (answer.trim()) {
        updateMessage(assistantMessage, answer, { markdown: true, sources });
        session.completeTurn(question, answer);
      } else {
        const empty = { code: 'EMPTY_RESPONSE', message: '模型没有返回内容', retryable: true };
        updateMessage(assistantMessage, errorText(empty), {
          error: true,
          sources,
          retry: { question, historySnapshot },
        });
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (assistantMessage.isConnected) {
          updateMessage(assistantMessage, '已停止生成', { cancelled: true });
        }
      } else {
        const failure = { code: 'NETWORK_ERROR', message: '暂时无法连接AI助手', retryable: true };
        updateMessage(assistantMessage, errorText(failure), {
          error: true,
          retry: { question, historySnapshot },
        });
      }
    } finally {
      await responseReader?.cancel().catch(() => {});
      responseReader?.releaseLock();
      delete assistantMessage.dataset.status;
      if (session.finishRequest(request)) setPendingState(false);
      updateClearState();
      if (!session.isPending()) input?.focus();
    }
  };

  const clearMessageRetries = () => {
    chatEl.querySelectorAll('.dn-assistant-message-actions').forEach((actions) => {
      const message = actions.closest('.dn-assistant-message-assistant');
      if (message) retryRequests.delete(message);
      actions.remove();
    });
  };

  const clearConversation = () => {
    session.cancel();
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
  chatEl.addEventListener('click', (event) => {
    const retryButton = event.target.closest('[data-assistant-retry]');
    if (!retryButton || session.isPending()) return;
    const assistantMessage = retryButton.closest('.dn-assistant-message-assistant');
    const retry = assistantMessage ? retryRequests.get(assistantMessage) : null;
    if (!retry) return;
    runAssistantRequest({
      question: retry.question,
      historySnapshot: retry.historySnapshot,
      assistantMessage,
    });
  });

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

    const historySnapshot = session.history();
    input.value = '';
    clearMessageRetries();
    appendMessage('user', question);
    const assistantMessage = appendMessage('assistant', '正在连接', { loading: true });
    await runAssistantRequest({
      question,
      historySnapshot,
      assistantMessage,
    });
  });
})();
