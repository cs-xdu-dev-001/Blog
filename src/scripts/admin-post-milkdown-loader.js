const root = document.querySelector('[data-milkdown-editor]');
let editorModulePromise = import('./admin-post-milkdown.js');
let loadPromise = null;

function setEditorState(state) {
  if (!root) return;
  root.dataset.editorState = state;
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function renderRetry() {
  if (!root) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'post-editor-load-retry';
  button.setAttribute('data-editor-retry', 'true');
  button.textContent = '重新加载编辑器';
  button.addEventListener('click', () => {
    editorModulePromise = import('./admin-post-milkdown.js');
    loadPromise = null;
    void loadEditor().catch(() => {});
  }, { once: true });
  root.replaceChildren(button);
}

async function loadEditor() {
  if (!root || root.dataset.milkdownReady === 'true') return;
  if (loadPromise) return loadPromise;

  setEditorState('loading');
  loadPromise = editorModulePromise
    .then(({ bootMilkdown }) => bootMilkdown())
    .then(() => {
      setEditorState('ready');
    })
    .catch((error) => {
      setEditorState('error');
      renderRetry();
      console.error(error);
      throw error;
    });
  return loadPromise;
}

function loadFromInteraction() {
  void loadEditor().catch(() => {});
}

if (root) {
  root.addEventListener('pointerdown', loadFromInteraction, { once: true, passive: true });
  root.addEventListener('focusin', loadFromInteraction, { once: true });
  document.querySelectorAll('[data-editor-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.editorMode !== 'preview') loadFromInteraction();
    });
  });

  requestAnimationFrame(loadFromInteraction);
}
