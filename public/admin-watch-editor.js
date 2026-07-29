const editorData = JSON.parse(document.querySelector('#watch-editor-data')?.textContent || '{}');
const createForm = document.querySelector('[data-watch-create-form]');
const editForm = document.querySelector('[data-watch-editor-form]');
const stateEl = document.querySelector('[data-watch-editor-state]');
const saveButton = document.querySelector('[data-save-watch]');
const createButton = createForm?.querySelector('[type="submit"]');
const imageInput = document.querySelector('[data-watch-image]');
const deleteButton = document.querySelector('[data-delete-watch]');
let dirty = false;
let isSaving = false;
let isCreating = false;
let isUploading = false;
let isDeleting = false;
let changeVersion = 0;

function setStatus(text, state = 'idle') {
  if (!stateEl) return;
  stateEl.textContent = text;
  stateEl.dataset.state = state;
}

function saveError(response) {
  if (response.status === 401) return '登录已失效，请重新登录';
  if (response.status === 403) return '保存被拒绝，请刷新后重试';
  if (response.status === 413) return '图片不能超过8MB';
  if (response.status === 415) return '仅支持JPG、PNG、WebP和AVIF';
  return `保存失败（${response.status}）`;
}

createForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isCreating) return;
  isCreating = true;
  if (createButton) createButton.disabled = true;
  const values = new FormData(createForm);
  setStatus('正在创建', 'saving');
  try {
    const response = await fetch('/api/admin/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: values.get('title'), type: values.get('type'), status: values.get('status') }),
    });
    if (!response.ok) throw new Error(saveError(response));
    const data = await response.json();
    if (!data.item?.id) throw new Error('创建结果无效');
    isCreating = false;
    window.location.href = `/admin/watch/${data.item.id}/edit`;
  } catch (error) {
    isCreating = false;
    if (createButton) createButton.disabled = false;
    setStatus(error instanceof Error ? error.message : '创建失败，请重试', 'error');
  }
});

editForm?.addEventListener('input', () => {
  dirty = true;
  changeVersion += 1;
  setStatus('未保存', 'dirty');
});
async function saveEdits() {
  if (!editForm || isSaving || isUploading || isDeleting) return false;
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
    return !dirty;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败，请重试', 'error');
    return false;
  } finally {
    isSaving = false;
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = '保存';
    }
  }
}

editForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveEdits();
});

imageInput?.addEventListener('change', async (event) => {
  const image = event.target.files?.[0];
  if (!image || isUploading || isDeleting) return;
  if (dirty && !(await saveEdits())) {
    event.target.value = '';
    return;
  }
  isUploading = true;
  imageInput.disabled = true;
  const body = new FormData();
  body.set('image', image);
  setStatus('正在上传图片', 'saving');
  try {
    const response = await fetch(`/api/admin/watch/${editorData.item.id}/image`, { method: 'POST', body });
    if (!response.ok) throw new Error(saveError(response));
    dirty = false;
    isUploading = false;
    window.location.reload();
  } catch (error) {
    isUploading = false;
    imageInput.disabled = false;
    event.target.value = '';
    setStatus(error instanceof Error ? error.message : '上传失败，请重试', 'error');
  }
});

deleteButton?.addEventListener('click', async () => {
  if (isSaving || isUploading || isDeleting) return;
  if (!window.confirm(`确认删除《${editorData.item.title}》？`)) return;
  isDeleting = true;
  deleteButton.disabled = true;
  setStatus('正在删除', 'saving');
  try {
    const response = await fetch(`/api/admin/watch/${editorData.item.id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(saveError(response));
    dirty = false;
    isDeleting = false;
    window.location.href = '/admin/watch';
  } catch (error) {
    isDeleting = false;
    deleteButton.disabled = false;
    setStatus(error instanceof Error ? error.message : '删除失败，请重试', 'error');
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty && !isSaving && !isCreating && !isUploading && !isDeleting) return;
  event.preventDefault();
  event.returnValue = '';
});

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  (editForm || createForm)?.requestSubmit();
});
