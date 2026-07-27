import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
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

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function serializeSelection(ctx, view) {
  const serializer = ctx.get(serializerCtx);
  const { state } = view;
  const { from, to } = state.selection;
  const document = serializer(state.doc);
  if (state.selection.empty) {
    return {
      document,
      selection: '',
      original: '',
      from,
      to,
      documentFrom: 0,
      documentTo: state.doc.content.size,
    };
  }

  const slice = state.doc.slice(from, to);
  const { schema } = state.doc.type;
  let wrapper = schema.topNodeType.createAndFill(null, slice.content);
  if (!wrapper) {
    const paragraph = schema.nodes.paragraph?.createAndFill(null, slice.content);
    if (paragraph) wrapper = schema.topNodeType.createAndFill(null, paragraph);
  }
  const selection = wrapper ? serializer(wrapper) : state.doc.textBetween(from, to);
  return {
    document,
    selection,
    original: selection,
    from,
    to,
    documentFrom: 0,
    documentTo: state.doc.content.size,
  };
}

function captureAITarget(crepe) {
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
    <header data-ai-review-drag-handle>
      <span class="post-editor-ai-review-title">${aiIcon}<strong data-ai-review-title>AI建议</strong></span>
      <div class="post-editor-ai-review-actions">
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
  const dragHandle = panel.querySelector('[data-ai-review-drag-handle]');
  const stateEl = panel.querySelector('[data-ai-review-state]');
  const compare = panel.querySelector('[data-ai-review-compare]');
  const originalEl = panel.querySelector('[data-ai-review-original]');
  const resultEl = panel.querySelector('[data-ai-review-result]');
  const acceptButton = panel.querySelector('[data-ai-review-accept]');
  const rejectButton = panel.querySelector('[data-ai-review-reject]');
  let review = null;
  let dragState = null;

  const stopDragging = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (dragHandle.hasPointerCapture(event.pointerId)) {
      dragHandle.releasePointerCapture(event.pointerId);
    }
    dragState = null;
    panel.classList.remove('is-dragging');
  };

  dragHandle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.width = `${rect.width}px`;
    dragHandle.setPointerCapture(event.pointerId);
    panel.classList.add('is-dragging');
    event.preventDefault();
  });

  dragHandle.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const maxLeft = Math.max(12, window.innerWidth - dragState.width - 12);
    const maxTop = Math.max(12, window.innerHeight - dragState.height - 12);
    const left = Math.max(12, Math.min(event.clientX - dragState.offsetX, maxLeft));
    const top = Math.max(12, Math.min(event.clientY - dragState.offsetY, maxTop));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  });
  dragHandle.addEventListener('pointerup', stopDragging);
  dragHandle.addEventListener('pointercancel', stopDragging);

  const setLoading = (loading) => {
    panel.classList.toggle('is-loading', loading);
    acceptButton.disabled = loading || !review?.result;
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
    panel.hidden = true;
    restoreEditor();
    if (restoreStatus) setStatus(review?.previousStatus || 'READY');
    review = null;
  };

  const render = async () => {
    if (!review) return;
    const original = review.original || '';
    const [originalHtml, resultHtml] = await Promise.all([
      renderAIReviewMarkdown(original),
      renderAIReviewMarkdown(review.result),
    ]);
    if (!review) return;
    originalEl.innerHTML = originalHtml;
    resultEl.innerHTML = resultHtml;
  };

  const openResult = (target, result, label = 'AI建议') => {
    if (!target || !String(result || '').trim()) return;
    review = {
      ...target,
      label,
      result: String(result),
      previousStatus: statusEl?.textContent || 'READY',
    };
    title.textContent = label;
    panel.hidden = false;
    crepe.setReadonly(true);
    setLoading(false);
    setStatus('AI REVIEW');
    void render().catch((error) => {
      stateEl.hidden = false;
      compare.hidden = true;
      stateEl.textContent = error instanceof Error ? error.message : '结果预览失败';
      acceptButton.disabled = true;
    });
  };
  const open = openResult;

  acceptButton.addEventListener('click', () => {
    if (!review?.result) return;
    crepe.editor.action(replaceRange(review.result, { from: review.from, to: review.to }));
    panel.hidden = true;
    review = null;
    restoreEditor();
    setStatus('UNSAVED');
  });
  rejectButton.addEventListener('click', () => close());
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    close();
  });

  return { open, openResult, close };
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

function labelAIToolbarButton() {
  document.querySelectorAll('.milkdown-toolbar').forEach((toolbar) => {
    const button = toolbar.querySelector('.toolbar-item:last-child');
    if (!button) return;
    button.classList.add('is-ai');
    button.setAttribute('aria-label', 'AI编辑');
    button.setAttribute('title', 'AI编辑');
  });
}

export async function bootMilkdown() {
  if (!root || !input) return;
  if (root.dataset.milkdownReady === 'true') return window.__postMilkdownEditor;

  root.replaceChildren();
  root.removeAttribute('tabindex');
  const openAdminAgent = () => document.dispatchEvent(new CustomEvent('admin-agent:open'));

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
      [Crepe.Feature.Toolbar]: {
        aiIcon,
        buildToolbar: (builder) => {
          builder.addGroup('ai-tools', 'AI').addItem('ai', {
            icon: aiIcon,
            active: () => false,
            onRun: openAdminAgent,
          });
        },
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
    window.__postAgentBridge = {
      captureContext: () => captureAITarget(crepe),
      reviewProposal: (target, proposal) => {
        if (!target || !proposal?.markdown) return;
        const isDocument = proposal.scope === 'document';
        aiReview.openResult({
          ...target,
          original: isDocument ? target.document : target.selection,
          from: isDocument ? target.documentFrom : target.from,
          to: isDocument ? target.documentTo : target.to,
        }, proposal.markdown, 'Agent修改');
      },
    };
    root.addEventListener('paste', (event) => {
      void insertClipboardImages(event, crepe);
    }, true);
    root.addEventListener('pointerup', () => requestAnimationFrame(labelAIToolbarButton), true);
    root.addEventListener('keyup', () => requestAnimationFrame(labelAIToolbarButton), true);
    root.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '.') {
        event.preventDefault();
        openAdminAgent();
        return;
      }
      if (event.key === 'Enter' && !event.isComposing && removeSlashAI(crepe)) {
        event.preventDefault();
        requestAnimationFrame(openAdminAgent);
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
