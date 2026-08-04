const root = document.querySelector('[data-milkdown-editor]');
const fallback = document.querySelector('[data-editor-fallback]');
const writePane = root?.closest('.post-editor-write');
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

function clearFallbackNotice() {
  writePane?.classList.remove('is-editor-fallback');
  root?.removeAttribute('hidden');
  writePane?.querySelector('[data-editor-fallback-notice]')?.remove();
}

function activateFallback(error) {
  if (!root || !fallback || !writePane) return;
  writePane.classList.add('is-editor-fallback');
  root.hidden = true;
  fallback.hidden = false;
  fallback.removeAttribute('aria-hidden');
  writePane.querySelector('[data-editor-fallback-notice]')?.remove();
  const notice = document.createElement('div');
  notice.className = 'post-editor-fallback-notice';
  notice.setAttribute('data-editor-fallback-notice', 'true');
  notice.innerHTML = '<span>已切换到Markdown编辑</span><button type="button" data-editor-retry>重试富文本</button>';
  notice.title = error instanceof Error ? error.message : '富文本编辑器加载失败';
  notice.querySelector('[data-editor-retry]')?.addEventListener('click', () => {
    loadPromise = null;
    clearFallbackNotice();
    void loadEditor().catch(() => {});
  }, { once: true });
  writePane.append(notice);
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
      clearFallbackNotice();
      performance.mark('post-editor-ready');
      performance.measure('post-editor-load', 'post-editor-load-start', 'post-editor-ready');
    })
    .catch((error) => {
      setEditorState('error');
      editorModulePromise = null;
      activateFallback(error);
      console.error('[post-editor] Milkdown failed; Markdown fallback enabled.', error);
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
