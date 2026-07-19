import { CrepeBuilder } from '@milkdown/crepe/builder';
import { blockEdit } from '@milkdown/crepe/feature/block-edit';
import { codeMirror } from '@milkdown/crepe/feature/code-mirror';
import { cursor } from '@milkdown/crepe/feature/cursor';
import { imageBlock } from '@milkdown/crepe/feature/image-block';
import { latex } from '@milkdown/crepe/feature/latex';
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip';
import { listItem } from '@milkdown/crepe/feature/list-item';
import { placeholder } from '@milkdown/crepe/feature/placeholder';
import { table } from '@milkdown/crepe/feature/table';
import { toolbar } from '@milkdown/crepe/feature/toolbar';
import '@milkdown/crepe/theme/common/reset.css';
import '@milkdown/crepe/theme/common/block-edit.css';
import '@milkdown/crepe/theme/common/code-mirror.css';
import '@milkdown/crepe/theme/common/cursor.css';
import '@milkdown/crepe/theme/common/image-block.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';
import '@milkdown/crepe/theme/common/list-item.css';
import '@milkdown/crepe/theme/common/placeholder.css';
import '@milkdown/crepe/theme/common/toolbar.css';
import '@milkdown/crepe/theme/common/table.css';
import '@milkdown/crepe/theme/common/latex.css';
import '@milkdown/crepe/theme/frame.css';

const root = document.querySelector('[data-milkdown-editor]');
const input = document.querySelector('[data-markdown-input]');
const statusEl = document.querySelector('[data-editor-status]');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

async function uploadPostImage(file) {
  const body = new FormData();
  body.set('image', file);
  const res = await fetch('/api/admin/posts/image', { method: 'POST', body });
  if (!res.ok) throw new Error(`图片上传失败（${res.status}）`);
  const data = await res.json();
  return data.image?.imagePath || data.image?.smallPath || '';
}

function syncMarkdown(markdown) {
  if (!input || input.value === markdown) return;
  input.value = markdown;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function bootMilkdown() {
  if (!root || !input) return;

  const crepe = new CrepeBuilder({
    root,
    defaultValue: input.value || '',
  });

  crepe
    .addFeature(cursor)
    .addFeature(listItem)
    .addFeature(linkTooltip)
    .addFeature(imageBlock, {
      blockUploadButton: '上传图片',
      blockUploadPlaceholderText: '粘贴图片链接',
      blockCaptionPlaceholderText: '图片说明',
      inlineUploadButton: '上传图片',
      inlineUploadPlaceholderText: '粘贴图片链接',
      onUpload: async (file) => {
        setStatus('UPLOADING IMAGE');
        const imagePath = await uploadPostImage(file);
        if (!imagePath) throw new Error('图片上传失败');
        return imagePath;
      },
      onImageLoadError: (event) => {
        event.currentTarget?.classList?.add('is-image-error');
      },
    })
    .addFeature(blockEdit)
    .addFeature(placeholder, {
      text: '开始写正文',
    })
    .addFeature(toolbar)
    .addFeature(codeMirror, {
      languages: [],
      copyText: '复制',
      searchPlaceholder: '搜索语言',
      noResultText: '无结果',
      previewToggleText: (previewOnlyMode) => (previewOnlyMode ? '编辑' : '隐藏'),
    })
    .addFeature(table)
    .addFeature(latex);

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      syncMarkdown(markdown);
    });
  });

  try {
    await crepe.create();
    root.dataset.milkdownReady = 'true';
    window.__postMilkdownEditor = crepe;
  } catch (error) {
    root.dataset.milkdownError = 'true';
    setStatus('EDITOR FAILED');
    console.error(error);
  }
}

bootMilkdown();
