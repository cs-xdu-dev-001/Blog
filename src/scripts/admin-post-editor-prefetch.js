let editorModulePromise = null;

function canPrefetch() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return false;
  return !String(connection?.effectiveType || '').includes('2g');
}

function prefetchEditor() {
  if (!canPrefetch()) return null;
  editorModulePromise ??= import('./admin-post-milkdown.js');
  return editorModulePromise;
}

function requestEditorPrefetch() {
  const request = prefetchEditor();
  request?.catch(() => {
    editorModulePromise = null;
  });
}

function isEditorLink(target) {
  return target instanceof Element && Boolean(target.closest('a[href^="/admin/posts/"][href$="/edit"]'));
}

document.addEventListener('pointerover', (event) => {
  if (isEditorLink(event.target)) requestEditorPrefetch();
}, { passive: true });

document.addEventListener('focusin', (event) => {
  if (isEditorLink(event.target)) requestEditorPrefetch();
});

const idlePrefetch = () => requestEditorPrefetch();
if ('requestIdleCallback' in window) {
  window.requestIdleCallback(idlePrefetch, { timeout: 3000 });
} else {
  window.setTimeout(idlePrefetch, 2000);
}
