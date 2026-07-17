const editorData = JSON.parse(document.querySelector('#watch-editor-data')?.textContent || '{}');
const createForm = document.querySelector('[data-watch-create-form]');
const editForm = document.querySelector('[data-watch-editor-form]');
const stateEl = document.querySelector('[data-watch-editor-state]');
let dirty = false;

function setStatus(text) {
  if (stateEl) stateEl.textContent = text;
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

editForm?.addEventListener('input', () => { dirty = true; setStatus('未保存'); });
editForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(editForm);
  setStatus('正在保存');
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
  if (!response.ok) return setStatus('保存失败');
  const data = await response.json();
  editorData.item = data.item;
  document.querySelector('h1').textContent = data.item.title;
  dirty = false;
  setStatus('已保存');
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
