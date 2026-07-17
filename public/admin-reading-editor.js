const editorData = JSON.parse(document.querySelector('#reading-editor-data')?.textContent || '{}');
const createForm = document.querySelector('[data-reading-create-form]');
const editForm = document.querySelector('[data-reading-editor-form]');
const stateEl = document.querySelector('[data-reading-editor-state]');
let dirty = false;

function setStatus(text) {
  if (stateEl) stateEl.textContent = text;
}

createForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(createForm);
  setStatus('正在创建');
  const response = await fetch('/api/admin/reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: values.get('title'), author: values.get('author'), status: values.get('status') }),
  });
  if (!response.ok) return setStatus('创建失败');
  const data = await response.json();
  window.location.href = `/admin/reading/${data.item.id}/edit`;
});

editForm?.addEventListener('input', () => { dirty = true; setStatus('未保存'); });
editForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(editForm);
  const status = String(values.get('status') || 'reading');
  setStatus('正在保存');
  const response = await fetch(`/api/admin/reading/${editorData.item.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: values.get('title'),
      author: values.get('author'),
      status,
      status_label: status === 'read' ? '已读' : status === 'planned' ? '待读' : '在读',
      progress: values.get('progress'),
      summary: values.get('summary'),
      quote: values.get('quote'),
      review: values.get('review'),
      spine_color: values.get('spine_color'),
      accent_color: values.get('accent_color'),
      is_featured: values.get('is_featured') === 'on',
    }),
  });
  if (!response.ok) return setStatus('保存失败');
  const data = await response.json();
  editorData.item = data.item;
  document.querySelector('h1').textContent = data.item.title;
  dirty = false;
  setStatus('已保存');
});

document.querySelector('[data-reading-image]')?.addEventListener('change', async (event) => {
  const image = event.target.files?.[0];
  if (!image) return;
  const body = new FormData();
  body.set('image', image);
  setStatus('正在上传封面');
  const response = await fetch(`/api/admin/reading/${editorData.item.id}/image`, { method: 'POST', body });
  if (!response.ok) return setStatus('上传失败');
  dirty = false;
  window.location.reload();
});

document.querySelector('[data-delete-reading]')?.addEventListener('click', async () => {
  if (!window.confirm(`确认删除《${editorData.item.title}》？`)) return;
  const response = await fetch(`/api/admin/reading/${editorData.item.id}`, { method: 'DELETE' });
  if (response.ok) window.location.href = '/admin/reading';
  else setStatus('删除失败');
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});
