const editorData = JSON.parse(document.querySelector('#watch-editor-data')?.textContent || '{}');
const createForm = document.querySelector('[data-watch-create-form]');
const editForm = document.querySelector('[data-watch-editor-form]');
const stateEl = document.querySelector('[data-watch-editor-state]');
const saveButton = document.querySelector('[data-save-watch]');
let dirty = false;
let isSaving = false;
let changeVersion = 0;

function setStatus(text, state = 'idle') {
  if (!stateEl) return;
  stateEl.textContent = text;
  stateEl.dataset.state = state;
}

function saveError(response) {
  if (response.status === 401) return '登录已失效，请重新登录';
  if (response.status === 403) return '保存被拒绝，请刷新后重试';
  return `保存失败（${response.status}）`;
}

createForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(createForm);
  setStatus('正在创建');
  const response = await fetch('/api/admin/watch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: values.get('title'), type: values.get('type'), status: values.get('status') }),
  });
  if (!response.ok) return setStatus('创建失败');
  const data = await response.json();
  window.location.href = `/admin/watch/${data.item.id}/edit`;
});

editForm?.addEventListener('input', () => {
  dirty = true;
  changeVersion += 1;
  setStatus('未保存', 'dirty');
});
editForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSaving) return;
  isSaving = true;
  const savingVersion = changeVersion;
  const values = new FormData(editForm);
  setStatus('正在保存', 'saving');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = '保存中';
  }
  try {
    const response = await fetch(`/api/admin/watch/${editorData.item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.get('title'),
        type: values.get('type'),
        status: values.get('status'),
        rating: values.get('rating'),
        comment: values.get('comment'),
        quote: values.get('quote'),
        quote_source: values.get('quote_source'),
        progress_text: values.get('progress_text'),
        completed_at: values.get('completed_at'),
        is_featured: values.get('is_featured') === 'on',
        is_activity_featured: values.get('is_activity_featured') === 'on',
      }),
    });
    if (!response.ok) throw new Error(saveError(response));
    const data = await response.json();
    editorData.item = data.item;
    document.querySelector('h1').textContent = data.item.title;
    dirty = changeVersion !== savingVersion;
    setStatus(dirty ? '仍有未保存更改' : '已保存', dirty ? 'dirty' : 'saved');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败，请重试', 'error');
  } finally {
    isSaving = false;
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = '保存';
    }
  }
});

document.querySelector('[data-watch-image]')?.addEventListener('change', async (event) => {
  const image = event.target.files?.[0];
  if (!image) return;
  const body = new FormData();
  body.set('image', image);
  setStatus('正在上传图片');
  const response = await fetch(`/api/admin/watch/${editorData.item.id}/image`, { method: 'POST', body });
  if (!response.ok) return setStatus('上传失败');
  dirty = false;
  window.location.reload();
});

document.querySelector('[data-delete-watch]')?.addEventListener('click', async () => {
  if (!window.confirm(`确认删除《${editorData.item.title}》？`)) return;
  const response = await fetch(`/api/admin/watch/${editorData.item.id}`, { method: 'DELETE' });
  if (response.ok) window.location.href = '/admin/watch';
  else setStatus('删除失败');
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
