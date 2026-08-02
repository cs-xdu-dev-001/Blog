const toggle = document.querySelector('[data-admin-agent-toggle]');
const page = document.querySelector('[data-post-editor-page]');
const panel = document.querySelector('[data-admin-agent-panel]');
const messages = document.querySelector('[data-admin-agent-messages]');
const emptyState = document.querySelector('[data-admin-agent-empty]');
let agentModulePromise = null;
let agentLoaded = false;

function setLoading(loading) {
  toggle?.setAttribute('aria-busy', String(loading));
  toggle?.classList.toggle('is-loading', loading);
}

function showLoadError() {
  if (!panel || !messages) return;
  panel.hidden = false;
  page?.classList.add('is-agent-open');
  toggle?.classList.add('active');
  toggle?.setAttribute('aria-expanded', 'true');
  emptyState?.setAttribute('hidden', '');
  messages.querySelector('[data-agent-load-error]')?.remove();

  const error = document.createElement('article');
  error.className = 'post-editor-agent-message is-error';
  error.setAttribute('data-agent-load-error', '');
  const text = document.createElement('div');
  text.textContent = 'Agent加载失败';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重新加载';
  retry.addEventListener('click', () => {
    retry.disabled = true;
    void openAgent().catch(showLoadError);
  }, { once: true });
  error.append(text, retry);
  messages.append(error);
}

function loadAgent() {
  agentModulePromise ??= import('./admin-post-agent.js')
    .then((module) => {
      agentLoaded = true;
      return module;
    })
    .catch((error) => {
      agentModulePromise = null;
      throw error;
    });
  return agentModulePromise;
}

function syncSelectionContext() {
  const target = window.__postAgentBridge?.captureContext?.();
  const selection = String(target?.selection || '');
  document.dispatchEvent(new CustomEvent('admin-agent:selection-change', {
    detail: {
      hasSelection: Boolean(selection),
      length: Array.from(selection).length,
      preview: selection.replace(/\s+/g, ' ').trim().slice(0, 80),
    },
  }));
}

async function openAgent() {
  setLoading(true);
  try {
    await loadAgent();
    messages?.querySelector('[data-agent-load-error]')?.remove();
    if (!messages?.querySelector('.post-editor-agent-message')) {
      emptyState?.removeAttribute('hidden');
    }
    syncSelectionContext();
    document.dispatchEvent(new CustomEvent('admin-agent:open', {
      detail: { agentLoaded: true },
    }));
  } finally {
    setLoading(false);
  }
}

toggle?.addEventListener('pointerenter', () => {
  void loadAgent().catch(() => {});
}, { once: true, passive: true });

toggle?.addEventListener('focusin', () => {
  void loadAgent().catch(() => {});
}, { once: true });

toggle?.addEventListener('click', () => {
  if (!agentLoaded) void openAgent().catch(showLoadError);
});

document.addEventListener('admin-agent:open', (event) => {
  if (agentLoaded || event.detail?.agentLoaded) return;
  event.stopImmediatePropagation();
  void openAgent().catch(showLoadError);
}, true);
