const page = document.querySelector('[data-site-section]');
const section = page?.dataset.siteSection || 'site';
const form = document.querySelector('[data-site-form]');
const saveState = document.querySelector('[data-save-state]');
const saveButtons = [...document.querySelectorAll('[type="submit"][form="site-settings-form"]')];
const testAssistantButton = document.querySelector('[data-test-assistant]');
const state = { config: null, sections: [], loaded: false, saving: false, dirty: false, savedSignature: '' };

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(text) {
  if (!saveState) return;
  saveState.textContent = text;
  saveState.dataset.state = text.includes('失败')
    ? 'error'
    : text.includes('未保存') || text.includes('新修改')
      ? 'dirty'
      : text.includes('正在')
        ? 'saving'
        : 'saved';
}

function setSaveDisabled(disabled) {
  saveButtons.forEach((button) => { button.disabled = disabled; });
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function fillForm() {
  form?.querySelectorAll('[name]').forEach((field) => {
    const value = getPath(state.config, field.name);
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value ?? '';
  });
  renderSections();
  renderAboutPreview();
  renderCommentsStatus();
}

function renderSections() {
  const target = document.querySelector('[data-home-sections]');
  if (!target) return;
  target.innerHTML = state.sections.map((item) => `
    <article class="cms-home-section-row" data-section-key="${escapeHtml(item.key)}">
      <label class="cms-switch"><input type="checkbox" name="section.${escapeHtml(item.key)}.enabled" ${item.enabled ? 'checked' : ''} />显示</label>
      <label class="cms-setting-field"><span>标题</span><input name="section.${escapeHtml(item.key)}.title" value="${escapeHtml(item.title)}" /></label>
      <label class="cms-setting-field"><span>导航</span><input name="section.${escapeHtml(item.key)}.navLabel" value="${escapeHtml(item.navLabel)}" /></label>
      <label class="cms-setting-field"><span>角标</span><input name="section.${escapeHtml(item.key)}.navSmall" value="${escapeHtml(item.navSmall)}" /></label>
      <label class="cms-setting-field"><span>排序</span><input name="section.${escapeHtml(item.key)}.sortOrder" type="number" value="${Number(item.sortOrder)}" /></label>
    </article>
  `).join('');
}

function renderAboutPreview() {
  const preview = document.querySelector('[data-about-preview]');
  const body = form?.elements.aboutBody;
  if (!preview || !body) return;
  preview.textContent = body.value || '';
}

function renderCommentsStatus() {
  const target = document.querySelector('[data-comments-status]');
  if (!target || !form) return;
  const values = new FormData(form);
  const ready = ['comments.repo', 'comments.repoId', 'comments.category', 'comments.categoryId']
    .every((name) => String(values.get(name) || '').trim());
  target.textContent = ready ? '配置完整' : '待完成配置';
  target.classList.toggle('is-ready', ready);
}

async function loadConfig() {
  setSaveDisabled(true);
  setStatus('正在读取');
  const response = await fetch('/api/admin/site');
  if (!response.ok) throw new Error('读取失败');
  const data = await response.json();
  state.config = data.config || {};
  state.sections = data.sections || [];
  fillForm();
  state.loaded = true;
  state.savedSignature = currentPayloadSignature();
  state.dirty = false;
  setSaveDisabled(false);
  setStatus('已保存');
}

function sitePayload(values) {
  return {
    brandName: values.get('brandName'),
    pageTitle: values.get('pageTitle'),
    pageDescription: values.get('pageDescription'),
    social: {
      github: values.get('social.github'),
      bilibili: values.get('social.bilibili'),
      qq: values.get('social.qq'),
      monitor: values.get('social.monitor'),
      ai: values.get('social.ai'),
    },
  };
}

function homePayload(values) {
  return {
    heroKicker: values.get('heroKicker'),
    heroMeta: values.get('heroMeta'),
    heroLine: values.get('heroLine'),
    heroSubline: values.get('heroSubline'),
    heroHighlight: values.get('heroHighlight'),
    orbitTags: values.get('orbitTags'),
    comments: {
      repo: values.get('comments.repo'),
      repoId: values.get('comments.repoId'),
      category: values.get('comments.category'),
      categoryId: values.get('comments.categoryId'),
    },
  };
}

function assistantPayload(values) {
  return {
    assistant: {
      enabled: values.get('assistant.enabled') === 'on',
      title: values.get('assistant.title'),
      placeholder: values.get('assistant.placeholder'),
      welcome: values.get('assistant.welcome'),
      apiBaseUrl: values.get('assistant.apiBaseUrl'),
      model: values.get('assistant.model'),
      apiKey: values.get('assistant.apiKey'),
      apiMode: values.get('assistant.apiMode'),
      proxyUrl: values.get('assistant.proxyUrl'),
      dailyLimit: Number(values.get('assistant.dailyLimit') || 200),
      minuteLimit: Number(values.get('assistant.minuteLimit') || 20),
      maxQuestionLength: Number(values.get('assistant.maxQuestionLength') || 1000),
      maxAnswerLength: Number(values.get('assistant.maxAnswerLength') || 1200),
      modules: {
        posts: values.get('assistant.modules.posts') === 'on',
        reading: values.get('assistant.modules.reading') === 'on',
        watch: values.get('assistant.modules.watch') === 'on',
        about: values.get('assistant.modules.about') === 'on',
      },
    },
  };
}

function sectionPayload(values) {
  if (section === 'site') return sitePayload(values);
  if (section === 'home') return homePayload(values);
  if (section === 'assistant') return assistantPayload(values);
  return { aboutTitle: values.get('aboutTitle'), aboutBody: values.get('aboutBody') };
}

function homeSections(values) {
  if (section !== 'home') return [];
  return state.sections.map((item) => ({
    key: item.key,
    enabled: values.get(`section.${item.key}.enabled`) === 'on',
    title: values.get(`section.${item.key}.title`),
    navLabel: values.get(`section.${item.key}.navLabel`),
    navSmall: values.get(`section.${item.key}.navSmall`),
    sortOrder: Number(values.get(`section.${item.key}.sortOrder`) || item.sortOrder),
  }));
}

function currentPayload() {
  const values = new FormData(form);
  return { config: sectionPayload(values), sections: homeSections(values) };
}

function currentPayloadSignature() {
  return JSON.stringify(currentPayload());
}

function updateDirtyState() {
  if (!state.loaded) return;
  state.dirty = currentPayloadSignature() !== state.savedSignature;
  setStatus(state.dirty ? '未保存' : '已保存');
}

form?.addEventListener('input', () => {
  updateDirtyState();
  renderAboutPreview();
  renderCommentsStatus();
});
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.loaded || state.saving) return;
  const payload = currentPayload();
  const submittedSignature = JSON.stringify(payload);
  state.saving = true;
  setSaveDisabled(true);
  setStatus('正在保存');
  try {
    const response = await fetch('/api/admin/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('保存失败');
    const data = await response.json();
    state.config = data.config;
    state.sections = data.sections;
    if (currentPayloadSignature() === submittedSignature) {
      fillForm();
      state.savedSignature = currentPayloadSignature();
      state.dirty = false;
    } else {
      state.savedSignature = submittedSignature;
      state.dirty = true;
    }
    setStatus(state.dirty ? '有新修改未保存' : '已保存');
  } catch {
    state.dirty = true;
    setStatus('保存失败');
  } finally {
    state.saving = false;
    setSaveDisabled(false);
  }
});

testAssistantButton?.addEventListener('click', async () => {
  const target = document.querySelector('[data-assistant-test-result]');
  const assistant = assistantPayload(new FormData(form)).assistant;
  testAssistantButton.disabled = true;
  setStatus('正在测试');
  try {
    const response = await fetch('/api/admin/assistant/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistant }),
    });
    const result = await response.json().catch(() => ({}));
    target.hidden = false;
    target.classList.toggle('is-ok', response.ok && result.ok);
    target.textContent = response.ok && result.ok ? `接口正常：${result.answer || '已响应'}` : `测试失败：${result.error || response.status}`;
  } catch {
    target.hidden = false;
    target.classList.remove('is-ok');
    target.textContent = '测试失败：网络不可用';
  } finally {
    testAssistantButton.disabled = false;
    setStatus(state.dirty ? '未保存' : '已保存');
  }
});

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty && !state.saving) return;
  event.preventDefault();
  event.returnValue = '';
});

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  event.preventDefault();
  if (state.loaded && !state.saving) form?.requestSubmit();
});

loadConfig().catch((error) => setStatus(error.message));
