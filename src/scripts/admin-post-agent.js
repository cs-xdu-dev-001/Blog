const page = document.querySelector('[data-post-editor-page]');
const panel = document.querySelector('[data-admin-agent-panel]');
const toggle = document.querySelector('[data-admin-agent-toggle]');
const closeButton = document.querySelector('[data-admin-agent-close]');
const clearButton = document.querySelector('[data-admin-agent-clear]');
const form = document.querySelector('[data-admin-agent-form]');
const input = document.querySelector('[data-admin-agent-input]');
const messagesEl = document.querySelector('[data-admin-agent-messages]');
const emptyState = document.querySelector('[data-admin-agent-empty]');
const emptyTitle = document.querySelector('[data-admin-agent-empty-title]');
const contextLabel = document.querySelector('[data-admin-agent-context]');
const contextContainer = contextLabel?.parentElement;
const stopButton = document.querySelector('[data-admin-agent-stop]');
const resizeHandle = document.querySelector('[data-admin-agent-resize]');
const scopeSelect = document.querySelector('[data-admin-agent-scope]');
const commandButtons = document.querySelectorAll('[data-admin-agent-command]');
const titleInput = document.querySelector('[name="title"]');
const descriptionInput = document.querySelector('[name="description"]');

const commandPrompts = {
  polish: '润色内容，保持原意和事实不变，使表达更自然。',
  continue: '沿用现有语气和结构续写内容。',
  shorten: '压缩内容，删除重复表达，保留关键信息。',
  rewrite: '重新组织并改写内容，使逻辑更清晰。',
  structure: '整理内容结构，合理使用标题、列表和段落。',
};

let history = [];
let abortController = null;
let resizeState = null;

function updateSelectionContext(detail = {}) {
  const hasSelection = Boolean(detail.hasSelection);
  const length = Number.isFinite(detail.length) ? detail.length : 0;
  if (contextLabel) {
    contextLabel.textContent = hasSelection ? `已选内容 · ${length}字` : '当前笔记';
    contextLabel.title = hasSelection ? String(detail.preview || '') : '';
  }
  contextContainer?.classList.toggle('has-selection', hasSelection);
  if (emptyTitle) {
    emptyTitle.textContent = hasSelection ? '想对选中内容做什么？' : '想对当前笔记做什么？';
  }
  if (input) {
    input.placeholder = hasSelection ? '询问或修改选中内容' : '询问或修改当前笔记';
  }
}

function setOpen(open) {
  if (!page || !panel) return;
  panel.hidden = !open;
  page.classList.toggle('is-agent-open', open);
  toggle?.classList.toggle('active', open);
  toggle?.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => input?.focus());
}

function addMessage(role, content, { undo = false } = {}) {
  if (!messagesEl) return;
  if (emptyState) emptyState.hidden = true;
  const article = document.createElement('article');
  article.className = `post-editor-agent-message is-${role}`;
  const body = document.createElement('div');
  body.textContent = String(content || '');
  article.append(body);

  if (undo) {
    messagesEl.querySelectorAll('[data-agent-undo]').forEach((button) => {
      button.disabled = true;
    });
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = '撤销';
    action.dataset.agentUndo = '';
    action.addEventListener('click', () => {
      if (!window.__postAgentBridge?.undoLastChange?.()) return;
      body.textContent = '已撤销修改';
      action.remove();
    });
    article.append(action);
  }
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createTrace() {
  if (!messagesEl) return null;
  if (emptyState) emptyState.hidden = true;
  const article = document.createElement('article');
  article.className = 'post-editor-agent-message is-assistant is-working';
  const details = document.createElement('details');
  details.setAttribute('data-admin-agent-trace', '');
  details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = '执行过程';
  const list = document.createElement('ol');
  details.append(summary, list);
  article.append(details);
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { article, details, list, phases: new Map() };
}

function updateTrace(trace, phase) {
  if (!trace || !phase?.id) return;
  let item = trace.phases.get(phase.id);
  if (!item) {
    item = document.createElement('li');
    trace.phases.set(phase.id, item);
    trace.list.append(item);
  }
  item.dataset.status = phase.status || 'active';
  item.textContent = phase.label || '';
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function readEventStream(response, onEvent) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('服务没有返回可读取的数据');
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      let eventType = 'message';
      let data = {};
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) eventType = line.slice(6).trim();
        if (line.startsWith('data:')) data = JSON.parse(line.slice(5).trim() || '{}');
      }
      onEvent(eventType, data);
    }
    if (done) break;
  }
}

function setBusy(busy) {
  if (input) input.disabled = busy;
  if (stopButton) stopButton.hidden = !busy;
  if (scopeSelect) scopeSelect.disabled = busy;
  commandButtons.forEach((button) => { button.disabled = busy; });
  form?.querySelector('button[type="submit"]')?.toggleAttribute('disabled', busy);
}

async function sendMessage(message, displayMessage = message) {
  if (page?.dataset.agentEditorLocked === 'true') {
    addMessage('error', '请先解锁笔记，再让Agent读取或修改正文');
    return;
  }

  const bridge = window.__postAgentBridge;
  const target = bridge?.captureContext?.();
  if (!target) {
    addMessage('error', '编辑器尚未就绪');
    return;
  }
  if (scopeSelect?.value === 'selection' && !target.selection) {
    addMessage('error', '请先在正文中选中要修改的内容');
    return;
  }
  updateSelectionContext({
    hasSelection: Boolean(target.selection),
    length: Array.from(target.selection || '').length,
    preview: String(target.selection || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  });

  addMessage('user', displayMessage);
  const requestHistory = history.slice(-8);
  history = [...history, { role: 'user', content: message }].slice(-8);
  abortController?.abort();
  abortController = new AbortController();
  setBusy(true);
  const trace = createTrace();
  let result = null;

  try {
    const response = await fetch('/api/admin/assistant/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      signal: abortController.signal,
      body: JSON.stringify({
        message,
        history: requestHistory,
        title: titleInput?.value || '',
        description: descriptionInput?.value || '',
        document: target.document,
        selection: target.selection,
        scopePreference: scopeSelect?.value || 'auto',
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `请求失败（${response.status}）`);
    }
    await readEventStream(response, (eventType, data) => {
      if (eventType === 'phase') updateTrace(trace, data);
      if (eventType === 'result') {
        updateTrace(trace, {
          id: 'generate',
          label: data.proposal ? '修改建议已生成' : '回答已生成',
          status: 'done',
        });
        result = data;
      }
      if (eventType === 'error') throw new Error(data.message || 'Agent暂时不可用');
    });
    if (!result?.message) throw new Error('模型没有返回可用结果');
    trace?.article.classList.remove('is-working');
    if (trace?.details) trace.details.open = false;
    if (result.proposal) {
      window.__postAgentBridge?.reviewProposal(target, result.proposal, result.message);
    } else {
      addMessage('assistant', result.message);
    }
    history = [...history, { role: 'assistant', content: result.message }].slice(-8);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      trace?.article.remove();
      addMessage('error', error instanceof Error ? error.message : 'Agent暂时不可用');
    } else if (trace) {
      trace.article.classList.remove('is-working');
      trace.details.open = false;
    }
  } finally {
    abortController = null;
    setBusy(false);
    input?.focus();
  }
}

toggle?.addEventListener('click', () => setOpen(panel?.hidden));
closeButton?.addEventListener('click', () => setOpen(false));
document.addEventListener('admin-agent:open', () => setOpen(true));
document.addEventListener('admin-agent:selection-change', (event) => {
  updateSelectionContext(event.detail);
});
document.addEventListener('admin-agent:proposal-applied', () => {
  addMessage('assistant', '已接纳修改', { undo: true });
});

clearButton?.addEventListener('click', () => {
  abortController?.abort();
  history = [];
  messagesEl?.replaceChildren();
  if (messagesEl && emptyState) {
    emptyState.hidden = false;
    messagesEl.append(emptyState);
  }
  setBusy(false);
  input?.focus();
});
stopButton?.addEventListener('click', () => abortController?.abort());
commandButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const message = commandPrompts[button.dataset.adminAgentCommand];
    if (!message || abortController) return;
    void sendMessage(message, button.textContent.trim());
  });
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = String(input?.value || '').trim();
  if (!message || abortController) return;
  input.value = '';
  void sendMessage(message);
});
input?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  form?.requestSubmit();
});

resizeHandle?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  resizeState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    width: panel.getBoundingClientRect().width,
  };
  resizeHandle.setPointerCapture(event.pointerId);
  page?.classList.add('is-agent-resizing');
  event.preventDefault();
});
resizeHandle?.addEventListener('pointermove', (event) => {
  if (!resizeState || event.pointerId !== resizeState.pointerId) return;
  const width = Math.max(320, Math.min(window.innerWidth * 0.45, resizeState.width + resizeState.startX - event.clientX));
  page?.style.setProperty('--post-agent-width', `${Math.round(width)}px`);
});
const stopResize = (event) => {
  if (!resizeState || event.pointerId !== resizeState.pointerId) return;
  resizeState = null;
  page?.classList.remove('is-agent-resizing');
};
resizeHandle?.addEventListener('pointerup', stopResize);
resizeHandle?.addEventListener('pointercancel', stopResize);
resizeHandle?.addEventListener('dblclick', () => {
  page?.style.setProperty('--post-agent-width', '380px');
});
