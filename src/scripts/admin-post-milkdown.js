import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { AllSelection, TextSelection } from '@milkdown/kit/prose/state';
import { insert, replaceRange } from '@milkdown/utils';
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

const aiIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Zm6.5 12 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z"/>
  </svg>
`;

const aiActions = [
  { id: 'polish', label: '润色', prompt: '润色这段内容，提升表达准确性和可读性，保留原意与Markdown结构。' },
  { id: 'shorten', label: '精简', prompt: '精简这段内容，删除重复表达，保留关键信息与Markdown结构。' },
  { id: 'expand', label: '扩写', prompt: '扩写这段内容，补足必要细节，保持原有语气与Markdown结构。' },
  { id: 'continue', label: '续写', prompt: '根据已有内容自然续写，只返回新增的Markdown内容。' },
  { id: 'format', label: '修复格式', prompt: '修复这段内容的Markdown格式，不改变事实与表达含义。' },
];

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function selectAITarget(crepe, shouldInsert) {
  if (shouldInsert) return;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { selection, doc } = view.state;
    if (!selection.empty) return;
    const from = selection.$from.start();
    const to = selection.$from.end();
    const nextSelection = to > from
      ? TextSelection.create(doc, from, to)
      : new AllSelection(doc);
    view.dispatch(view.state.tr.setSelection(nextSelection));
  });
}

function serializeSelection(ctx, view) {
  const serializer = ctx.get(serializerCtx);
  const { state } = view;
  const { from, to } = state.selection;
  const document = serializer(state.doc);
  if (state.selection.empty) {
    return { document, selection: '', original: '', from, to };
  }

  const slice = state.doc.slice(from, to);
  const { schema } = state.doc.type;
  let wrapper = schema.topNodeType.createAndFill(null, slice.content);
  if (!wrapper) {
    const paragraph = schema.nodes.paragraph?.createAndFill(null, slice.content);
    if (paragraph) wrapper = schema.topNodeType.createAndFill(null, paragraph);
  }
  const selection = wrapper ? serializer(wrapper) : state.doc.textBetween(from, to);
  return { document, selection, original: selection, from, to };
}

function captureAITarget(crepe, shouldInsert) {
  selectAITarget(crepe, shouldInsert);
  let target = null;
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    target = serializeSelection(ctx, view);
  });
  return target;
}

async function renderAIReviewMarkdown(markdown) {
  const response = await fetch('/api/admin/posts/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ markdown }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.html !== 'string') {
    throw new Error('结果预览失败');
  }
  return data.html;
}

function createAIReview(crepe) {
  const panel = document.createElement('section');
  panel.className = 'post-editor-ai-review';
  panel.hidden = true;
  panel.setAttribute('data-ai-review', '');
  panel.innerHTML = `
    <header>
      <span class="post-editor-ai-review-title">${aiIcon}<strong data-ai-review-title>AI建议</strong></span>
      <div class="post-editor-ai-review-actions">
        <button type="button" data-ai-review-retry>重新生成</button>
        <button type="button" data-ai-review-reject>放弃</button>
        <button type="button" class="is-primary" data-ai-review-accept>接纳</button>
      </div>
    </header>
    <div class="post-editor-ai-review-state" data-ai-review-state hidden></div>
    <div class="post-editor-ai-review-compare" data-ai-review-compare>
      <section>
        <strong>原文</strong>
        <div class="article-prose" data-ai-review-original></div>
      </section>
      <section>
        <strong>AI结果</strong>
        <div class="article-prose" data-ai-review-result></div>
      </section>
    </div>
  `;
  (root.closest('.post-editor-page') || document.body).append(panel);

  const title = panel.querySelector('[data-ai-review-title]');
  const stateEl = panel.querySelector('[data-ai-review-state]');
  const compare = panel.querySelector('[data-ai-review-compare]');
  const originalEl = panel.querySelector('[data-ai-review-original]');
  const resultEl = panel.querySelector('[data-ai-review-result]');
  const acceptButton = panel.querySelector('[data-ai-review-accept]');
  const rejectButton = panel.querySelector('[data-ai-review-reject]');
  const retryButton = panel.querySelector('[data-ai-review-retry]');
  let review = null;
  let abortController = null;

  const setLoading = (loading) => {
    panel.classList.toggle('is-loading', loading);
    acceptButton.disabled = loading || !review?.result;
    retryButton.disabled = loading;
    stateEl.hidden = !loading;
    compare.hidden = loading;
    if (loading) stateEl.textContent = '正在生成建议';
  };

  const restoreEditor = ({ focus = true } = {}) => {
    crepe.setReadonly(false);
    if (focus) {
      requestAnimationFrame(() => {
        crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
      });
    }
  };

  const close = ({ restoreStatus = true } = {}) => {
    abortController?.abort();
    abortController = null;
    panel.hidden = true;
    restoreEditor();
    if (restoreStatus) setStatus(review?.previousStatus || 'READY');
    review = null;
  };

  const render = async () => {
    if (!review) return;
    const original = review.original || (review.shouldInsert ? '当前位置后插入' : '');
    const [originalHtml, resultHtml] = await Promise.all([
      renderAIReviewMarkdown(original),
      renderAIReviewMarkdown(review.result),
    ]);
    if (!review) return;
    originalEl.innerHTML = originalHtml;
    resultEl.innerHTML = resultHtml;
  };

  const request = async () => {
    if (!review) return;
    abortController?.abort();
    abortController = new AbortController();
    review.result = '';
    title.textContent = review.label ? `${review.label}结果` : 'AI建议';
    panel.hidden = false;
    setLoading(true);
    setStatus('AI WORKING');

    try {
      const response = await fetch('/api/admin/assistant/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: abortController.signal,
        body: JSON.stringify({
          document: review.document,
          selection: review.selection,
          instruction: review.instruction,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.text) {
        throw new Error(data.error || `AI请求失败（${response.status}）`);
      }
      review.result = String(data.text);
      await render();
      setLoading(false);
      setStatus('AI REVIEW');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      stateEl.hidden = false;
      compare.hidden = true;
      stateEl.textContent = error instanceof Error ? error.message : 'AI请求失败';
      panel.classList.remove('is-loading');
      retryButton.disabled = false;
      acceptButton.disabled = true;
      setStatus('AI FAILED');
    }
  };

  const open = (target, instruction, label, shouldInsert) => {
    if (!target) return;
    review = {
      ...target,
      instruction,
      label,
      shouldInsert,
      result: '',
      previousStatus: statusEl?.textContent || 'READY',
    };
    crepe.setReadonly(true);
    void request();
  };

  acceptButton.addEventListener('click', () => {
    if (!review?.result) return;
    crepe.editor.action(replaceRange(review.result, { from: review.from, to: review.to }));
    panel.hidden = true;
    abortController = null;
    review = null;
    restoreEditor();
    setStatus('UNSAVED');
  });
  rejectButton.addEventListener('click', () => close());
  retryButton.addEventListener('click', () => void request());
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  });

  return { open, close };
}

function createAIPalette(crepe, aiReview) {
  const palette = document.createElement('div');
  palette.className = 'post-editor-ai-palette';
  palette.hidden = true;
  palette.innerHTML = `
    <form data-ai-palette-form>
      <span class="post-editor-ai-icon">${aiIcon}</span>
      <input type="text" autocomplete="off" placeholder="告诉AI如何处理" aria-label="AI编辑指令" data-ai-palette-input>
      <button type="submit" aria-label="执行AI编辑">发送</button>
    </form>
    <div class="post-editor-ai-actions" aria-label="AI快捷操作">
      ${aiActions.map((action) => `<button type="button" data-ai-action="${action.id}">${action.label}</button>`).join('')}
    </div>
  `;
  (root.closest('.post-editor-page') || document.body).append(palette);

  const form = palette.querySelector('[data-ai-palette-form]');
  const promptInput = palette.querySelector('[data-ai-palette-input]');

  const close = ({ restoreFocus = true } = {}) => {
    palette.hidden = true;
    if (restoreFocus) {
      crepe.editor.action((ctx) => ctx.get(editorViewCtx).focus());
    }
  };

  const run = (instruction, label = '') => {
    const value = String(instruction || '').trim();
    if (!value) return;
    const shouldInsert = /续写|继续写|接着写|continue/i.test(value);
    const target = captureAITarget(crepe, shouldInsert);
    close({ restoreFocus: false });
    aiReview.open(target, value, label || value, shouldInsert);
  };

  const position = () => {
    palette.hidden = false;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const rect = view.coordsAtPos(view.state.selection.to);
      const width = Math.min(380, window.innerWidth - 24);
      const left = Math.min(
        Math.max(12, rect.left - (width / 2)),
        Math.max(12, window.innerWidth - width - 12),
      );
      const top = Math.min(Math.max(68, rect.bottom + 12), window.innerHeight - 190);
      palette.style.width = `${width}px`;
      palette.style.left = `${left}px`;
      palette.style.top = `${top}px`;
    });
    requestAnimationFrame(() => promptInput?.focus());
  };

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    run(promptInput?.value);
  });
  palette.querySelectorAll('[data-ai-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = aiActions.find((item) => item.id === button.dataset.aiAction);
      if (action) run(action.prompt, action.label);
    });
  });
  palette.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!palette.hidden && !palette.contains(event.target)) close({ restoreFocus: false });
  }, true);

  return { open: position, close, run };
}

function removeSlashAI(crepe) {
  return crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { selection } = view.state;
    if (!selection.empty || selection.$from.parent.type.name !== 'paragraph') return false;
    if (selection.$from.parentOffset !== 3 || selection.$from.parent.textContent !== '/ai') return false;
    view.dispatch(view.state.tr.delete(selection.from - 3, selection.from));
    return true;
  });
}

async function uploadPostImage(file) {
  const res = await fetch('/api/admin/posts/image', {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-Image-Name': encodeURIComponent(file.name || 'image'),
    },
    credentials: 'same-origin',
    body: file,
  });
  if (!res.ok) throw new Error(`图片上传失败（${res.status}）`);
  const data = await res.json();
  return data.image?.imagePath || data.image?.smallPath || '';
}

function clipboardImageFiles(event) {
  return Array.from(event.clipboardData?.files || [])
    .filter((file) => file?.type?.startsWith('image/'));
}

function imageAlt(file) {
  return String(file?.name || '图片')
    .replace(/\.[^.]+$/, '')
    .replace(/[[\]()]/g, '')
    .trim() || '图片';
}

async function insertClipboardImages(event, crepe) {
  const files = clipboardImageFiles(event);
  if (!files.length) return;

  event.preventDefault();
  event.stopPropagation();
  setStatus('UPLOADING IMAGE');

  try {
    const images = [];
    for (const file of files) {
      const imagePath = await uploadPostImage(file);
      if (!imagePath) throw new Error('图片上传失败');
      images.push(`![${imageAlt(file)}](${imagePath})`);
    }
    crepe.editor.action(insert(images.join('\n\n')));
    setStatus('UNSAVED');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'IMAGE UPLOAD FAILED');
  }
}

function syncMarkdown(markdown) {
  if (!input || input.value === markdown) return;
  input.value = markdown;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function bootMilkdown() {
  if (!root || !input) return;
  if (root.dataset.milkdownReady === 'true') return window.__postMilkdownEditor;

  root.replaceChildren();
  root.removeAttribute('tabindex');

  const crepe = new Crepe({
    root,
    defaultValue: input.value || '',
    featureConfigs: {
      [Crepe.Feature.ImageBlock]: {
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
      },
      [Crepe.Feature.Placeholder]: {
        text: '开始写正文',
      },
      [Crepe.Feature.CodeMirror]: {
        languages: [],
        copyText: '复制',
        searchPlaceholder: '搜索语言',
        noResultText: '无结果',
        previewToggleText: (previewOnlyMode) => (previewOnlyMode ? '编辑' : '隐藏'),
      },
    },
  });

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      syncMarkdown(markdown);
    });
  });

  try {
    await crepe.create();
    const aiReview = createAIReview(crepe);
    const aiPalette = createAIPalette(crepe, aiReview);
    root.addEventListener('paste', (event) => {
      void insertClipboardImages(event, crepe);
    }, true);
    root.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '.') {
        event.preventDefault();
        aiPalette.open();
        return;
      }
      if (event.key === 'Enter' && !event.isComposing && removeSlashAI(crepe)) {
        event.preventDefault();
        requestAnimationFrame(() => aiPalette.open());
      }
    }, true);
    root.dataset.milkdownReady = 'true';
    window.__postMilkdownEditor = crepe;
    return crepe;
  } catch (error) {
    root.dataset.milkdownError = 'true';
    setStatus('EDITOR FAILED');
    throw error;
  }
}
