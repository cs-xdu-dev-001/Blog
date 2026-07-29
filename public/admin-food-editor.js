const editorData = JSON.parse(document.querySelector('#food-editor-data')?.textContent || '{}');
const createForm = document.querySelector('[data-food-create-form]');
const editForm = document.querySelector('[data-food-editor-form]');
const stateEl = document.querySelector('[data-food-editor-state]');
const saveButton = document.querySelector('[data-save-food]');
const createButton = createForm?.querySelector('[type="submit"]');
const imageInput = document.querySelector('[data-food-image]');
const deleteButton = document.querySelector('[data-delete-food]');
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

function errorMessage(response, action) {
  if (response.status === 401) return '登录已失效，请重新登录';
  if (response.status === 413) return '图片不能超过8MB';
  if (response.status === 415) return '仅支持JPG、PNG、WebP和AVIF';
  return `${action}失败（${response.status}）`;
}

createForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isCreating) return;
  isCreating = true;
  if (createButton) createButton.disabled = true;
  const values = new FormData(createForm);
  setStatus('正在创建', 'saving');
  try {
    const response = await fetch('/api/admin/food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.get('title'),
        dish: values.get('dish'),
        status: values.get('status'),
        published: values.get('published') === 'on',
      }),
    });
    if (!response.ok) throw new Error(errorMessage(response, '创建'));
    const data = await response.json();
    if (!data.item?.id) throw new Error('创建结果无效');
    isCreating = false;
    window.location.href = `/admin/food/${data.item.id}/edit`;
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
    const response = await fetch(`/api/admin/food/${editorData.item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.get('title'),
        dish: values.get('dish'),
        area: values.get('area'),
        status: values.get('status'),
        rating: values.get('rating'),
        visit_date: values.get('visit_date'),
        sort_order: values.get('sort_order'),
        comment: values.get('comment'),
        would_revisit: values.get('would_revisit') === 'on',
        is_featured: values.get('is_featured') === 'on',
        published: values.get('published') === 'on',
      }),
    });
    if (!response.ok) throw new Error(errorMessage(response, '保存'));
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
    const response = await fetch(`/api/admin/food/${editorData.item.id}/image`, { method: 'POST', body });
    if (!response.ok) throw new Error(errorMessage(response, '上传'));
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
  if (!window.confirm(`确认删除“${editorData.item.title}”？`)) return;
  isDeleting = true;
  deleteButton.disabled = true;
  setStatus('正在删除', 'saving');
  try {
    const response = await fetch(`/api/admin/food/${editorData.item.id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(errorMessage(response, '删除'));
    dirty = false;
    isDeleting = false;
    window.location.href = '/admin/food';
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
