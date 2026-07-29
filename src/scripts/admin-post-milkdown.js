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
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { undo } from '@milkdown/kit/prose/history';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose, insert, replaceAll, replaceRange } from '@milkdown/utils';
import { reviewIsCurrent } from './admin-agent-review.js';
import { languages as codeLanguages } from './codemirror-language-data.js';
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
  if (!statusEl) return;
  const states = {
    READY: ['已保存', 'saved'],
    已保存: ['已保存', 'saved'],
    UNSAVED: ['有未保存修改', 'dirty'],
    有未保存修改: ['有未保存修改', 'dirty'],
    'AI REVIEW': ['审阅AI修改', 'review'],
    'UPLOADING IMAGE': ['正在上传图片', 'saving'],
  };
  const [label, state] = states[text] || [text, ''];
  statusEl.textContent = label;
  if (state) statusEl.dataset.state = state;
  else statusEl.removeAttribute('data-state');
}

function serializeSelection(ctx, view) {
  const serializer = ctx.get(serializerCtx);
  const { state } = view;
  const { from, to } = state.selection;
  const document = serializer(state.doc);
  const snapshot = {
    id: crypto.randomUUID(),
    document,
    sourceDocument: document,
    documentFrom: 0,
    documentTo: state.doc.content.size,
  };
  if (state.selection.empty) {
    return {
      ...snapshot,
      selection: '',
      original: '',
      from,
      to,
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
    ...snapshot,
    selection,
    original: selection,
    from,
    to,
  };
}

function notifyAgentSelection(selectionState) {
  const { from, to, empty } = selectionState;
  const selection = empty ? '' : selectionState.$from.doc.textBetween(from, to, ' ').trim();
  document.dispatchEvent(new CustomEvent('admin-agent:selection-change', {
    detail: {
      hasSelection: !empty,
      length: Array.from(selection).length,
      preview: selection.replace(/\s+/g, ' ').slice(0, 80),
    },
  }));
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

const inlineAIReviewKey = new PluginKey('admin-inline-ai-review');

function inlineReviewPosition(doc, to) {
  const $to = doc.resolve(to);
  for (let depth = $to.depth; depth > 0; depth -= 1) {
    if ($to.node(depth).isBlock) return $to.after(depth);
  }
  return to;
}

function createInlineReviewDOM(review) {
  const element = document.createElement('section');
  element.className = 'post-ai-inline-review';
  element.contentEditable = 'false';
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', 'AI修改建议');
  element.innerHTML = `
    <div class="post-ai-inline-review-body">
      <p data-inline-review-message></p>
      <div class="article-prose" data-inline-review-result></div>
    </div>
    <div class="post-ai-inline-review-actions">
      <button type="button" data-inline-review-reject aria-label="放弃修改" title="放弃修改">✕</button>
      <button type="button" class="is-primary" data-inline-review-accept aria-label="接纳修改" title="接纳修改">✓</button>
    </div>
  `;
  const messageEl = element.querySelector('[data-inline-review-message]');
  const resultEl = element.querySelector('[data-inline-review-result]');
  messageEl.textContent = review.message;
  messageEl.hidden = !review.message;
  resultEl.innerHTML = review.html;
  element.querySelector('[data-inline-review-reject]')?.addEventListener('click', review.onReject);
  element.querySelector('[data-inline-review-accept]')?.addEventListener('click', review.onAccept);
  return element;
}

const inlineAIReviewFeature = $prose(() => new Plugin({
  key: inlineAIReviewKey,
  state: {
    init: () => null,
    apply: (transaction, current) => {
      const next = transaction.getMeta(inlineAIReviewKey);
      if (next !== undefined) return next;
      return transaction.docChanged ? null : current;
    },
  },
  props: {
    decorations(state) {
      const review = inlineAIReviewKey.getState(state);
      if (!review || review.from >= review.to || review.to > state.doc.content.size) {
        return DecorationSet.empty;
      }
      return DecorationSet.create(state.doc, [
        Decoration.inline(review.from, review.to, { class: 'post-ai-inline-source' }),
        Decoration.widget(
          inlineReviewPosition(state.doc, review.to),
          () => createInlineReviewDOM(review),
          {
            key: `admin-inline-ai-review-${review.id}`,
            side: 1,
            stopEvent: () => true,
          },
        ),
      ]);
    },
  },
}));

function createAIReview(crepe) {
  const panel = document.createElement('section');
  panel.className = 'post-editor-ai-review';
  panel.hidden = true;
  panel.setAttribute('data-ai-review', '');
  panel.innerHTML = `
    <header data-ai-review-drag-handle>
      <span class="post-editor-ai-review-title">${aiIcon}<strong data-ai-review-title>AI建议</strong></span>
      <div class="post-editor-ai-review-actions">
        <button type="button" class="is-icon" data-ai-review-reject aria-label="放弃修改" title="放弃修改">✕</button>
        <button type="button" class="is-icon is-primary" data-ai-review-accept aria-label="接纳修改" title="接纳修改">✓</button>
      </div>
    </header>
    <div class="post-editor-ai-review-state" data-ai-review-state hidden></div>
    <div class="post-editor-ai-review-document" data-ai-review-document>
      <p class="post-editor-ai-review-note" data-ai-review-note hidden></p>
      <section class="post-ai-review-change">
        <div class="post-ai-review-removed">
          <strong>原文</strong>
          <div class="article-prose" data-ai-review-original></div>
        </div>
        <div class="post-ai-review-added">
          <strong>修改后</strong>
          <div class="article-prose" data-ai-review-result></div>
        </div>
      </section>
    </div>
  `;
  const reviewHost = root.closest('.post-editor-write') || document.body;
  reviewHost.append(panel);

  const title = panel.querySelector('[data-ai-review-title]');
  const stateEl = panel.querySelector('[data-ai-review-state]');
  const reviewDocument = panel.querySelector('[data-ai-review-document]');
  const noteEl = panel.querySelector('[data-ai-review-note]');
  const originalEl = panel.querySelector('[data-ai-review-original]');
  const resultEl = panel.querySelector('[data-ai-review-result]');
  const acceptButton = panel.querySelector('[data-ai-review-accept]');
  const rejectButton = panel.querySelector('[data-ai-review-reject]');
  let review = null;
  let activeReviewId = null;

  const clearInlineReview = () => {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setMeta(inlineAIReviewKey, null));
    });
  };

  const showInlineReview = (html, onAccept, onReject) => {
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr
        .setMeta(inlineAIReviewKey, {
          id: review.id,
          from: review.from,
          to: review.to,
          html,
          message: review.message,
          onAccept,
          onReject,
        })
        .scrollIntoView());
    });
    requestAnimationFrame(() => {
      root.querySelector('.post-ai-inline-review')?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  };

  const setLoading = (loading) => {
    panel.classList.toggle('is-loading', loading);
    acceptButton.disabled = loading || !review?.result;
    rejectButton.disabled = loading;
    stateEl.hidden = !loading;
    reviewDocument.hidden = loading;
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

  const resetReviewPanel = () => {
    clearInlineReview();
    panel.removeAttribute('style');
  };

  const close = ({ restoreStatus = true } = {}) => {
    panel.hidden = true;
    resetReviewPanel();
    restoreEditor();
    if (restoreStatus) setStatus(review?.previousStatus || '已保存');
    review = null;
    activeReviewId = null;
  };

  const acceptReview = () => {
    if (!review?.result) return;
    let currentDocument = '';
    let documentSize = 0;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      currentDocument = ctx.get(serializerCtx)(view.state.doc);
      documentSize = view.state.doc.content.size;
    });
    if (!reviewIsCurrent(review, { activeReviewId, currentDocument, documentSize })) {
      panel.hidden = true;
      resetReviewPanel();
      review = null;
      activeReviewId = null;
      restoreEditor();
      setStatus('审阅已过期，请重新生成');
      return;
    }
    crepe.editor.action(replaceRange(review.result, { from: review.from, to: review.to }));
    document.dispatchEvent(new CustomEvent('admin-agent:proposal-applied', {
      detail: { scope: review.scope },
    }));
    panel.hidden = true;
    resetReviewPanel();
    review = null;
    activeReviewId = null;
    restoreEditor();
    setStatus('UNSAVED');
  };

  const render = async () => {
    if (!review) return;
    const original = review.original || '';
    if (review.scope === 'selection') {
      const resultHtml = await renderAIReviewMarkdown(review.result);
      if (!review) return;
      showInlineReview(resultHtml, acceptReview, () => close());
      return;
    }
    const [originalHtml, resultHtml] = await Promise.all([
      renderAIReviewMarkdown(original),
      renderAIReviewMarkdown(review.result),
    ]);
    if (!review) return;
    originalEl.innerHTML = originalHtml;
    resultEl.innerHTML = resultHtml;
  };

  const openResult = (target, result, label = 'AI建议', message = '') => {
    if (!target || !String(result || '').trim()) return;
    review = {
      ...target,
      id: target.id || crypto.randomUUID(),
      label,
      result: String(result),
      message: String(message || '').trim(),
      previousStatus: statusEl?.textContent || '已保存',
    };
    activeReviewId = review.id;
    title.textContent = label;
    noteEl.textContent = String(message || '').trim();
    noteEl.hidden = !noteEl.textContent;
    const isSelection = review.scope === 'selection';
    panel.hidden = isSelection;
    crepe.setReadonly(true);
    setLoading(false);
    setStatus('AI REVIEW');
    void render().catch((error) => {
      if (isSelection) {
        clearInlineReview();
        restoreEditor();
        setStatus(error instanceof Error ? error.message : '结果预览失败');
        return;
      }
      stateEl.hidden = false;
      reviewDocument.hidden = true;
      stateEl.textContent = error instanceof Error ? error.message : '结果预览失败';
      acceptButton.disabled = true;
    });
  };
  const open = openResult;

  acceptButton.addEventListener('click', acceptReview);
  rejectButton.addEventListener('click', () => close());
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      acceptReview();
    }
  });

  root.addEventListener('keydown', (event) => {
    if (!review) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      acceptReview();
    }
  }, true);

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
  window.__postImageUploads = Number(window.__postImageUploads || 0) + 1;
  try {
    const res = await fetch('/api/admin/posts/image', {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-Image-Name': encodeURIComponent(file.name || 'image'),
      },
      credentials: 'same-origin',
      body: file,
    });
    if (!res.ok) {
      if (res.status === 413) throw new Error('图片不能超过8MB');
      if (res.status === 415) throw new Error('仅支持JPG、PNG、WebP和AVIF');
      throw new Error(`图片上传失败（${res.status}）`);
    }
    const data = await res.json();
    return data.image?.imagePath || data.image?.smallPath || '';
  } finally {
    window.__postImageUploads = Math.max(0, Number(window.__postImageUploads || 1) - 1);
  }
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

  const fallback = document.querySelector('[data-editor-fallback]');
  const initialMarkdown = input.value;
  root.replaceChildren();
  root.removeAttribute('tabindex');
  const openAdminAgent = () => document.dispatchEvent(new CustomEvent('admin-agent:open'));

  const crepe = new CrepeBuilder({
    root,
    defaultValue: input.value || '',
  });
  crepe.editor.use(inlineAIReviewFeature);
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
    .addFeature(toolbar, {
      aiIcon,
      buildToolbar: (builder) => {
        builder.addGroup('ai-tools', 'AI').addItem('ai', {
          icon: aiIcon,
          active: () => false,
          onRun: openAdminAgent,
        });
      },
    })
    .addFeature(codeMirror, {
      languages: codeLanguages,
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
    listener.selectionUpdated((_ctx, selection) => {
      notifyAgentSelection(selection);
    });
  });

  try {
    await crepe.create();
    if (input.value !== initialMarkdown) {
      crepe.editor.action(replaceAll(input.value));
    }
    if (fallback) fallback.hidden = true;
    const aiReview = createAIReview(crepe);
    window.__postAgentBridge = {
      captureContext: () => captureAITarget(crepe),
      undoLastChange: () => {
        let undone = false;
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          undone = undo(view.state, view.dispatch);
          if (undone) view.focus();
        });
        return undone;
      },
      reviewProposal: (target, proposal, message = '') => {
        if (!target || !proposal?.markdown) return;
        const isDocument = proposal.scope === 'document';
        aiReview.openResult({
          ...target,
          scope: proposal.scope,
          original: isDocument ? target.document : target.selection,
          from: isDocument ? target.documentFrom : target.from,
          to: isDocument ? target.documentTo : target.to,
        }, proposal.markdown, 'Agent修改', message);
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
