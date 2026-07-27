const page = document.querySelector('[data-post-editor-page]');
const panel = document.querySelector('[data-admin-agent-panel]');
const toggle = document.querySelector('[data-admin-agent-toggle]');
const closeButton = document.querySelector('[data-admin-agent-close]');
const clearButton = document.querySelector('[data-admin-agent-clear]');
const form = document.querySelector('[data-admin-agent-form]');
const input = document.querySelector('[data-admin-agent-input]');
const messagesEl = document.querySelector('[data-admin-agent-messages]');
const stopButton = document.querySelector('[data-admin-agent-stop]');
const resizeHandle = document.querySelector('[data-admin-agent-resize]');
const titleInput = document.querySelector('[name="title"]');
const descriptionInput = document.querySelector('[name="description"]');

let history = [];
let abortController = null;
let resizeState = null;

function setOpen(open) {
  if (!page || !panel) return;
  panel.hidden = !open;
  page.classList.toggle('is-agent-open', open);
  toggle?.classList.toggle('active', open);
  toggle?.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => input?.focus());
}

function addMessage(role, content, { proposal = null, target = null } = {}) {
  if (!messagesEl) return;
  const article = document.createElement('article');
  article.className = `post-editor-agent-message is-${role}`;
  const body = document.createElement('div');
  body.textContent = String(content || '');
  article.append(body);

  if (proposal && target) {
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = '查看修改';
    action.addEventListener('click', () => {
      window.__postAgentBridge?.reviewProposal(target, proposal);
    });
    article.append(action);
  }
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setBusy(busy) {
  if (input) input.disabled = busy;
  if (stopButton) stopButton.hidden = !busy;
  form?.querySelector('button[type="submit"]')?.toggleAttribute('disabled', busy);
}

async function sendMessage(message) {
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

  addMessage('user', message);
  const requestHistory = history.slice(-8);
  history = [...history, { role: 'user', content: message }].slice(-8);
  abortController?.abort();
  abortController = new AbortController();
  setBusy(true);

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
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.message) {
      throw new Error(data.error || `请求失败（${response.status}）`);
    }
    addMessage('assistant', data.message, {
      proposal: data.proposal,
      target,
    });
    history = [...history, { role: 'assistant', content: data.message }].slice(-8);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      addMessage('error', error instanceof Error ? error.message : 'Agent暂时不可用');
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

clearButton?.addEventListener('click', () => {
  abortController?.abort();
  history = [];
  messagesEl?.replaceChildren();
  setBusy(false);
  input?.focus();
});
stopButton?.addEventListener('click', () => abortController?.abort());

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
