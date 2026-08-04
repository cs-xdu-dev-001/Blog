const root = document.querySelector('[data-milkdown-editor]');
const fallback = document.querySelector('[data-editor-fallback]');
let editorModulePromise = null;
let loadPromise = null;
let optionalModulesPromise = null;

function preloadOptionalModules() {
  if (optionalModulesPromise || !fallback) return optionalModulesPromise;
  const markdown = fallback.value || '';
  const requests = [];
  if (/^```/m.test(markdown)) requests.push(import('./admin-post-milkdown-code.js'));
  if (/^\s*\|.+\|\s*$[\s\S]*^\s*\|\s*:?-{3,}/m.test(markdown)) {
    requests.push(import('./admin-post-milkdown-table.js'));
  }
  if (/\$\$[\s\S]+?\$\$|(^|[^\\])\$(?!\s)[^\n$]+?\$/m.test(markdown)) {
    requests.push(import('./admin-post-milkdown-latex.js'));
  }
  optionalModulesPromise = Promise.all(requests).catch(() => []);
  return optionalModulesPromise;
}

function getEditorModule() {
  editorModulePromise ??= import('./admin-post-milkdown.js');
  return editorModulePromise;
}

function setEditorState(state) {
  if (!root) return;
  root.dataset.editorState = state;
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function renderRetry() {
  if (!root) return;
  root.parentElement?.querySelector('[data-editor-retry]')?.remove();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'post-editor-load-retry';
  button.setAttribute('data-editor-retry', 'true');
  button.textContent = '重新加载编辑器';
  button.addEventListener('click', () => {
    loadPromise = null;
    void loadEditor().catch(() => {});
  }, { once: true });
  root.parentElement?.append(button);
}

async function loadEditor() {
  if (!root || root.dataset.milkdownReady === 'true') return;
  if (loadPromise) return loadPromise;

  setEditorState('loading');
  performance.mark('post-editor-load-start');
  preloadOptionalModules();
  loadPromise = getEditorModule()
    .then(({ bootMilkdown }) => bootMilkdown())
    .then(() => {
      setEditorState('ready');
      root.parentElement?.querySelector('[data-editor-retry]')?.remove();
      performance.mark('post-editor-ready');
      performance.measure('post-editor-load', 'post-editor-load-start', 'post-editor-ready');
    })
    .catch((error) => {
      setEditorState('error');
      editorModulePromise = null;
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
  fallback?.addEventListener('pointerdown', loadFromInteraction, { once: true, passive: true });
  fallback?.addEventListener('focusin', loadFromInteraction, { once: true });
  document.querySelectorAll('[data-editor-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.editorMode !== 'preview') loadFromInteraction();
    });
  });
}
