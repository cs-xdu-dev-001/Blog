const state = {
  config: null,
  sections: [],
};

const formEl = document.querySelector('[data-site-config-form]');
const saveButtons = document.querySelectorAll('[data-save-site]');
const testButtons = document.querySelectorAll('[data-test-assistant]');
const resetButton = document.querySelector('[data-reset-site]');
const saveStateEl = document.querySelector('[data-save-state]');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(text) {
  if (saveStateEl) saveStateEl.textContent = text;
}

function setBusy(buttons, busy) {
  buttons.forEach((button) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  });
}

async function loadConfig() {
  setStatus('LOADING');
  const res = await fetch('/api/admin/site');
  if (!res.ok) throw new Error('Failed to load site config');
  const data = await res.json();
  state.config = data.config;
  state.sections = data.sections;
  render();
  setStatus('READY');
}

function input(name, label, value, placeholder = '', type = 'text') {
  return `
    <label>
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}

function textarea(name, label, value, rows = 4) {
  return `
    <label>
      <span>${label}</span>
      <textarea name="${name}" rows="${rows}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function checkbox(name, label, checked) {
  return `
    <label class="site-config-check">
      <input type="checkbox" name="${name}" ${checked ? 'checked' : ''} />
      <span>${label}</span>
    </label>
  `;
}

function select(name, label, value, options) {
  return `
    <label>
      <span>${label}</span>
      <select name="${name}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === value ? 'selected' : ''}>${escapeHtml(option.label)}</option>
        `).join('')}
      </select>
    </label>
  `;
}

function renderSections() {
  return state.sections.map((section) => `
    <article class="site-section-row" data-section-key="${escapeHtml(section.key)}">
      <label class="site-section-enable">
        <input type="checkbox" name="section.${section.key}.enabled" ${section.enabled ? 'checked' : ''} />
        显示
      </label>
      <label><span>标题</span><input name="section.${section.key}.title" value="${escapeHtml(section.title)}" /></label>
      <label><span>小字</span><input name="section.${section.key}.eyebrow" value="${escapeHtml(section.eyebrow)}" /></label>
      <label><span>导航</span><input name="section.${section.key}.navLabel" value="${escapeHtml(section.navLabel)}" /></label>
      <label><span>角标</span><input name="section.${section.key}.navSmall" value="${escapeHtml(section.navSmall)}" /></label>
      <label><span>排序</span><input name="section.${section.key}.sortOrder" type="number" value="${escapeHtml(section.sortOrder)}" /></label>
    </article>
  `).join('');
}

function render() {
  const config = state.config;
  if (!formEl || !config) return;
  const assistant = config.assistant || {};
  const modules = assistant.modules || {};

  formEl.innerHTML = `
    <nav class="site-config-tabs" aria-label="站点设置分区">
      <a href="#site-basic">站点信息</a>
      <a href="#home-copy">首页文案</a>
      <a href="#social-links">社交链接</a>
      <a href="#assistant-config">AI助手</a>
      <a href="#about-config">About</a>
      <a href="#home-sections">首页模块</a>
    </nav>
    <form class="site-config-form" data-site-form>
      <section class="site-config-card" id="site-basic" data-site-section>
        <span>基础</span>
        <div class="site-config-fields two">
          ${input('brandName', '站点名', config.brandName)}
          ${input('pageTitle', '浏览器标题', config.pageTitle)}
        </div>
        ${textarea('pageDescription', '页面描述', config.pageDescription, 2)}
      </section>

      <section class="site-config-card" id="home-copy" data-site-section>
        <span>首页首屏</span>
        <div class="site-config-fields two">
          ${input('heroKicker', '首屏标识', config.heroKicker)}
          ${input('heroMeta', '首屏右上信息', config.heroMeta)}
        </div>
        ${textarea('heroLine', '第一句', config.heroLine, 2)}
        ${textarea('heroSubline', '第二句', config.heroSubline, 2)}
        ${textarea('heroHighlight', '高亮句', config.heroHighlight, 2)}
        ${input('orbitTags', '动态标签，用/分隔', config.orbitTags)}
      </section>

      <section class="site-config-card" id="social-links" data-site-section>
        <span>社交链接</span>
        <div class="site-config-fields three">
          ${input('social.github', 'GitHub', config.social?.github)}
          ${input('social.bilibili', 'B站', config.social?.bilibili)}
          ${input('social.qq', 'QQ号', config.social?.qq)}
        </div>
      </section>

      <section class="site-config-card" id="assistant-config" data-site-section>
        <div class="site-config-card-head">
          <span>AI助手</span>
          <button type="button" data-test-assistant>测试当前配置</button>
        </div>
        ${checkbox('assistant.enabled', '开启AI助手', assistant.enabled !== false)}
        <div class="site-config-fields two">
          ${input('assistant.title', '面板标题', assistant.title || 'Ask Dev Notes')}
          ${input('assistant.placeholder', '输入框提示', assistant.placeholder || '')}
        </div>
        ${textarea('assistant.welcome', '欢迎语', assistant.welcome || '', 2)}
        <div class="site-config-fields three">
          ${input('assistant.apiBaseUrl', 'API Base URL', assistant.apiBaseUrl || '', '例如 https://api.example.com/v1')}
          ${input('assistant.model', '模型名', assistant.model || '', '例如 deepseek-chat')}
          ${input('assistant.apiKey', 'API Key', assistant.apiKey || '', '服务端保存，不会输出到前台', 'password')}
        </div>
        <div class="site-config-fields two">
          ${select('assistant.apiMode', '接口类型', assistant.apiMode || 'chat', [
            { value: 'chat', label: 'Chat Completions /chat/completions' },
            { value: 'responses', label: 'Responses /responses' },
          ])}
          ${input('assistant.proxyUrl', '本地代理', assistant.proxyUrl || '', '例如 http://127.0.0.1:7890，不填则直连')}
        </div>
        <div class="site-config-fields two">
          <label>
            <span>路径说明</span>
            <input value="Base URL建议填到/v1；选择接口类型后自动拼接路径" disabled />
          </label>
          <label>
            <span>代理说明</span>
            <input value="只影响服务端AI请求；不会输出到前台页面" disabled />
          </label>
        </div>
        <div class="site-config-fields four">
          ${input('assistant.dailyLimit', '每日次数', assistant.dailyLimit ?? 200, '', 'number')}
          ${input('assistant.minuteLimit', '每分钟次数', assistant.minuteLimit ?? 20, '', 'number')}
          ${input('assistant.maxQuestionLength', '问题字数', assistant.maxQuestionLength ?? 1000, '', 'number')}
          ${input('assistant.maxAnswerLength', '回答token', assistant.maxAnswerLength ?? 1200, '', 'number')}
        </div>
        <div class="site-config-module-row">
          ${checkbox('assistant.modules.posts', '笔记', modules.posts !== false)}
          ${checkbox('assistant.modules.reading', '阅读', modules.reading !== false)}
          ${checkbox('assistant.modules.watch', '影像', modules.watch !== false)}
          ${checkbox('assistant.modules.about', '关于', modules.about !== false)}
        </div>
        <div class="site-config-test-result" data-assistant-test-result>
          <strong>AI接口状态</strong>
          <p>填写API Base URL、模型名和API Key后，可以先测试当前表单，再保存。</p>
        </div>
      </section>

      <section class="site-config-card" id="about-config" data-site-section>
        <span>About</span>
        ${textarea('aboutTitle', 'About标题', config.aboutTitle, 2)}
        ${textarea('aboutBody', 'About正文，支持换行', config.aboutBody, 6)}
        <div class="site-config-fields three">
          ${textarea('aboutNow', '正在关注', config.aboutNow, 4)}
          ${textarea('aboutMethod', '记录方式', config.aboutMethod, 4)}
          ${textarea('aboutTaste', '审美偏好', config.aboutTaste, 4)}
        </div>
      </section>

      <section class="site-config-card site-section-card" id="home-sections" data-site-section>
        <span>首页模块</span>
        <div class="site-section-list">${renderSections()}</div>
      </section>
    </form>
  `;

  formEl.querySelector('[data-site-form]').addEventListener('input', () => setStatus('UNSAVED'));
  formEl.querySelectorAll('[data-test-assistant]').forEach((button) => button.addEventListener('click', testAssistant));
}

function readForm() {
  const form = new FormData(formEl.querySelector('[data-site-form]'));
  return {
    config: {
      brandName: form.get('brandName'),
      pageTitle: form.get('pageTitle'),
      pageDescription: form.get('pageDescription'),
      heroKicker: form.get('heroKicker'),
      heroMeta: form.get('heroMeta'),
      heroLine: form.get('heroLine'),
      heroSubline: form.get('heroSubline'),
      heroHighlight: form.get('heroHighlight'),
      orbitTags: form.get('orbitTags'),
      aboutTitle: form.get('aboutTitle'),
      aboutBody: form.get('aboutBody'),
      aboutNow: form.get('aboutNow'),
      aboutMethod: form.get('aboutMethod'),
      aboutTaste: form.get('aboutTaste'),
      social: {
        github: form.get('social.github'),
        bilibili: form.get('social.bilibili'),
        qq: form.get('social.qq'),
      },
      assistant: {
        enabled: form.get('assistant.enabled') === 'on',
        title: form.get('assistant.title'),
        welcome: form.get('assistant.welcome'),
        placeholder: form.get('assistant.placeholder'),
        apiBaseUrl: form.get('assistant.apiBaseUrl'),
        apiKey: form.get('assistant.apiKey'),
        model: form.get('assistant.model'),
        apiMode: form.get('assistant.apiMode'),
        proxyUrl: form.get('assistant.proxyUrl'),
        dailyLimit: Number(form.get('assistant.dailyLimit') || 200),
        minuteLimit: Number(form.get('assistant.minuteLimit') || 20),
        maxQuestionLength: Number(form.get('assistant.maxQuestionLength') || 1000),
        maxAnswerLength: Number(form.get('assistant.maxAnswerLength') || 1200),
        modules: {
          posts: form.get('assistant.modules.posts') === 'on',
          reading: form.get('assistant.modules.reading') === 'on',
          watch: form.get('assistant.modules.watch') === 'on',
          about: form.get('assistant.modules.about') === 'on',
        },
      },
    },
    sections: state.sections.map((section) => ({
      key: section.key,
      title: form.get(`section.${section.key}.title`),
      eyebrow: form.get(`section.${section.key}.eyebrow`),
      navLabel: form.get(`section.${section.key}.navLabel`),
      navSmall: form.get(`section.${section.key}.navSmall`),
      enabled: form.get(`section.${section.key}.enabled`) === 'on',
      sortOrder: Number(form.get(`section.${section.key}.sortOrder`) || section.sortOrder),
    })),
  };
}

async function saveConfig() {
  setStatus('SAVING');
  setBusy(saveButtons, true);
  const res = await fetch('/api/admin/site', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(readForm()),
  });
  if (!res.ok) {
    setStatus('SAVE FAILED');
    setBusy(saveButtons, false);
    return;
  }
  const data = await res.json();
  state.config = data.config;
  state.sections = data.sections;
  render();
  setStatus('SAVED / 前台刷新后生效');
  setBusy(saveButtons, false);
}

function renderTestResult(result, ok) {
  const target = document.querySelector('[data-assistant-test-result]');
  if (!target) return;
  target.classList.toggle('is-ok', ok);
  target.classList.toggle('is-error', !ok);
  target.innerHTML = `
    <strong>${ok ? '接口测试通过' : '接口测试失败'}</strong>
    <dl>
      <div><dt>模式</dt><dd>${escapeHtml(result.mode || '-')}</dd></div>
      <div><dt>端点</dt><dd>${escapeHtml(result.endpoint || '-')}</dd></div>
      <div><dt>模型</dt><dd>${escapeHtml(result.model || '-')}</dd></div>
      <div><dt>代理</dt><dd>${escapeHtml(result.proxy || '直连')}</dd></div>
    </dl>
    <p>${escapeHtml(ok ? (result.answer || 'OK') : (result.error || '未知错误'))}</p>
  `;
}

async function testAssistant() {
  setStatus('TESTING AI');
  setBusy(testButtons, true);
  const innerButtons = formEl.querySelectorAll('[data-test-assistant]');
  setBusy(innerButtons, true);
  try {
    const payload = readForm().config.assistant;
    const res = await fetch('/api/admin/assistant/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assistant: payload }),
    });
    const result = await res.json().catch(() => ({}));
    renderTestResult(result, res.ok && result.ok);
    setStatus(res.ok && result.ok ? 'AI TEST OK' : 'AI TEST FAILED');
  } catch (error) {
    renderTestResult({ error: error?.message || '请求失败' }, false);
    setStatus('AI TEST FAILED');
  } finally {
    setBusy(testButtons, false);
    setBusy(innerButtons, false);
  }
}

saveButtons.forEach((button) => button.addEventListener('click', saveConfig));
testButtons.forEach((button) => button.addEventListener('click', testAssistant));
resetButton?.addEventListener('click', loadConfig);

loadConfig().catch(() => setStatus('LOAD FAILED'));

