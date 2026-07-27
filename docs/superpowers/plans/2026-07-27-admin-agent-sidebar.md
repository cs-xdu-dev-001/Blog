# 管理端内嵌Agent实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在笔记编辑器右侧加入可收起、可调宽的Agent面板，使其能够连续对话、读取当前笔记和选区，并将修改建议交给现有对比面板确认。

**Architecture:** 前端新增独立Agent控制器，Milkdown只通过`window.__postAgentBridge`暴露上下文快照和建议审阅能力。服务端新增管理员专用JSON接口，在现有AI配置上构建结构化Agent请求，返回普通回答和可选Markdown建议；Agent不能直接保存或写数据库。

**Tech Stack:** Astro 5、原生浏览器JavaScript、Milkdown/ProseMirror、Node.js测试、现有OpenAI兼容AI配置

---

## 文件结构

- Create: `src/lib/server/adminAgentService.mjs`
  - 校验Agent请求、构建模型提示、调用现有AI提供器、解析结构化回答。
- Create: `src/pages/api/admin/assistant/agent.ts`
  - 管理员鉴权并暴露Agent JSON接口。
- Create: `src/scripts/admin-post-agent.js`
  - 管理Agent侧栏状态、对话、取消、清空、调宽和建议审阅。
- Modify: `src/pages/admin/posts/[id]/edit.astro`
  - 添加Agent入口、侧栏语义结构和脚本加载。
- Modify: `src/scripts/admin-post-milkdown.js`
  - 暴露上下文快照及打开现有对比面板的桥接接口。
- Modify: `src/styles/global.css`
  - 添加Agent停靠布局和管理端一致的视觉样式。
- Create: `tests/adminAgentService.test.mjs`
  - 覆盖服务端校验、上下文限制、普通回答、修改建议和错误。
- Create: `tests/adminAgentUiSource.test.mjs`
  - 锁定侧栏结构、取消、清空、宽度限制和diff接纳边界。
- Modify: `tests/adminWritingAssistant.test.mjs`
  - 锁定Milkdown桥接不直接保存正文。

### Task 1: Agent服务协议

**Files:**
- Create: `tests/adminAgentService.test.mjs`
- Create: `src/lib/server/adminAgentService.mjs`
- Modify: `src/lib/server/assistantService.mjs`

- [ ] **Step 1: 写失败测试**

测试四条行为：

```js
test('admin agent rejects empty messages', async () => {
  const result = await runAdminAgent({ message: '', document: '正文' }, { config: configured });
  assert.equal(result.code, 'INVALID_REQUEST');
});

test('admin agent limits history and document context', async () => {
  await runAdminAgent({
    message: '整理',
    document: 'a'.repeat(50000),
    messages: Array.from({ length: 20 }, () => ({ role: 'user', content: 'x' })),
  }, deps);
  assert.ok(sentPrompt.length < 40000);
  assert.equal(sentHistory.length, 8);
});

test('admin agent returns a normal answer without a proposal', async () => {
  mockAnswer({ message: '这段内容可以保留。', proposal: null });
  assert.deepEqual(result, { ok: true, message: '这段内容可以保留。', proposal: null });
});

test('admin agent validates a markdown proposal', async () => {
  mockAnswer({
    message: '我整理了结构。',
    proposal: { scope: 'selection', markdown: '## 新结构' },
  });
  assert.equal(result.proposal.scope, 'selection');
  assert.equal(result.proposal.markdown, '## 新结构');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
node --test tests/adminAgentService.test.mjs
```

Expected: FAIL，原因是`adminAgentService.mjs`不存在。

- [ ] **Step 3: 暴露最小AI调用边界**

在`assistantService.mjs`中导出一个不包含站内搜索逻辑的文本调用函数：

```js
export async function requestAssistantText({
  systemText,
  messages,
  maxTokens,
  config = siteConfigRepository.getSiteConfig(),
  signal,
}) {
  // 复用assistantEndpoint、assistantFetchOptions、assistantApiKey、
  // assistantModel、assistantApiMode和readModelAnswer。
}
```

该函数只接收服务端构造的消息，不读取数据库，不暴露API密钥。

- [ ] **Step 4: 实现Agent服务**

`runAdminAgent`执行以下固定规则：

```js
const limits = {
  message: 1200,
  document: 30000,
  selection: 12000,
  history: 8,
  historyMessage: 1600,
};
```

系统提示要求模型只返回JSON：

```json
{
  "message": "对用户的回答",
  "proposal": {
    "scope": "selection",
    "markdown": "建议替换的Markdown"
  }
}
```

没有修改建议时`proposal`必须为`null`。解析时允许外层Markdown代码围栏，但拒绝非法scope、空建议和超长建议。

- [ ] **Step 5: 运行服务测试**

Run:

```powershell
node --test tests/adminAgentService.test.mjs tests/adminWritingAssistant.test.mjs tests/assistantService.test.mjs
```

Expected: PASS。

### Task 2: 管理端Agent接口

**Files:**
- Create: `src/pages/api/admin/assistant/agent.ts`
- Modify: `tests/adminAgentService.test.mjs`

- [ ] **Step 1: 写接口失败测试**

源码测试锁定：

```js
assert.match(endpoint, /requireAdmin\(context\)/);
assert.match(endpoint, /runAdminAgent/);
assert.match(endpoint, /context\.request\.signal/);
assert.match(endpoint, /Method not allowed/);
```

- [ ] **Step 2: 运行并确认失败**

Run:

```powershell
node --test tests/adminAgentService.test.mjs
```

Expected: FAIL，接口文件不存在。

- [ ] **Step 3: 实现接口**

接口只接受POST：

```ts
const input = await context.request.json().catch(() => ({}));
const result = await runAdminAgent(input, { signal: context.request.signal });
```

未登录返回401；业务错误沿用服务返回的状态码和错误码；成功返回`message`与`proposal`。

- [ ] **Step 4: 运行测试**

Run:

```powershell
node --test tests/adminAgentService.test.mjs
```

Expected: PASS。

### Task 3: Milkdown Agent桥接

**Files:**
- Modify: `tests/adminWritingAssistant.test.mjs`
- Modify: `src/scripts/admin-post-milkdown.js`

- [ ] **Step 1: 写失败测试**

新增源码断言：

```js
assert.match(editor, /window\.__postAgentBridge/);
assert.match(editor, /captureContext/);
assert.match(editor, /reviewProposal/);
assert.match(editor, /openResult/);
assert.doesNotMatch(editor, /__postAgentBridge[\s\S]*savePost/);
```

- [ ] **Step 2: 运行并确认失败**

Run:

```powershell
node --test tests/adminWritingAssistant.test.mjs
```

Expected: FAIL，桥接尚不存在。

- [ ] **Step 3: 扩展现有审阅面板**

为`createAIReview`增加`openResult(target, result, label)`：

```js
const openResult = (target, result, label = 'Agent建议') => {
  review = { ...target, result, label, previousStatus: statusEl?.textContent || 'READY' };
  crepe.setReadonly(true);
  panel.hidden = false;
  void render().then(() => {
    setLoading(false);
    setStatus('AI REVIEW');
  });
};
```

继续复用原有接纳、放弃和编辑器恢复逻辑。

- [ ] **Step 4: 暴露只读桥接**

Milkdown初始化成功后设置：

```js
window.__postAgentBridge = {
  captureContext() {
    // 返回document、selection、original、from、to的快照。
  },
  reviewProposal({ target, markdown, label }) {
    aiReview.openResult(target, markdown, label);
  },
};
```

AI工具栏和`Ctrl+.`改为派发`admin-agent:open`事件，不再打开旧指令浮层；原有对比面板继续保留。

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test tests/adminWritingAssistant.test.mjs tests/adminPostPreviewSource.test.mjs
```

Expected: PASS。

### Task 4: Agent侧栏结构

**Files:**
- Create: `tests/adminAgentUiSource.test.mjs`
- Modify: `src/pages/admin/posts/[id]/edit.astro`
- Create: `src/scripts/admin-post-agent.js`

- [ ] **Step 1: 写失败测试**

锁定以下结构和行为：

```js
assert.match(page, /data-admin-agent-toggle/);
assert.match(page, /data-admin-agent-panel/);
assert.match(page, /data-admin-agent-messages/);
assert.match(page, /data-admin-agent-input/);
assert.match(client, /AbortController/);
assert.match(client, /data-admin-agent-clear/);
assert.match(client, /admin-agent:open/);
assert.match(client, /__postAgentBridge\?\.captureContext/);
assert.match(client, /__postAgentBridge\?\.reviewProposal/);
```

- [ ] **Step 2: 运行并确认失败**

Run:

```powershell
node --test tests/adminAgentUiSource.test.mjs
```

Expected: FAIL，页面和脚本尚无Agent侧栏。

- [ ] **Step 3: 添加语义化侧栏**

在顶部操作区加入仅含图标的Agent按钮，并在页面末尾加入：

```html
<aside class="post-editor-agent" data-admin-agent-panel aria-label="AI Agent" hidden>
  <header>新对话、收起</header>
  <div data-admin-agent-messages></div>
  <form data-admin-agent-form>
    <textarea data-admin-agent-input aria-label="给Agent发送消息"></textarea>
    <button type="submit">发送</button>
    <button type="button" data-admin-agent-stop hidden>停止</button>
  </form>
</aside>
```

页面通过模块脚本加载`admin-post-agent.js`。

- [ ] **Step 4: 实现侧栏状态**

脚本负责：

- 展开和收起，不销毁当前对话。
- 保存最多8轮内存对话，刷新后清空。
- 发送前通过桥接捕获不可变上下文快照。
- 请求`/api/admin/assistant/agent`。
- 使用`textContent`渲染普通消息，避免注入。
- 将返回的建议保存到对应Agent消息，并提供“查看修改”按钮。
- “查看修改”调用桥接的`reviewProposal`，不直接更新正文。
- 请求期间显示停止按钮；停止后保留用户输入并允许重试。
- 清空时取消当前请求并重置消息区。

- [ ] **Step 5: 运行测试**

Run:

```powershell
node --test tests/adminAgentUiSource.test.mjs tests/adminWritingAssistant.test.mjs
```

Expected: PASS。

### Task 5: 停靠布局与宽度调整

**Files:**
- Modify: `tests/adminAgentUiSource.test.mjs`
- Modify: `src/styles/global.css`
- Modify: `src/scripts/admin-post-agent.js`

- [ ] **Step 1: 写失败测试**

```js
assert.match(styles, /\.post-editor-agent/);
assert.match(styles, /--post-agent-width/);
assert.match(styles, /\.post-editor-page\.is-agent-open/);
assert.match(client, /setPointerCapture/);
assert.match(client, /Math\.max\(320,\s*Math\.min/);
```

- [ ] **Step 2: 运行并确认失败**

Run:

```powershell
node --test tests/adminAgentUiSource.test.mjs
```

Expected: FAIL，停靠样式和拖动逻辑不存在。

- [ ] **Step 3: 实现桌面停靠布局**

页面打开Agent时设置：

```css
.post-editor-page {
  --post-agent-width: 380px;
}

.post-editor-page.is-agent-open .post-editor-shell {
  margin-right: var(--post-agent-width);
}

.post-editor-agent {
  position: fixed;
  top: 56px;
  right: 0;
  bottom: 0;
  width: var(--post-agent-width);
}
```

侧栏使用当前CMS变量，消息区独立滚动，不添加大标题、欢迎卡片或说明小字。

- [ ] **Step 4: 实现宽度拖动**

左侧拖动条将宽度限制在320px到桌面宽度的45%，使用Pointer Events和`setPointerCapture`。双击拖动条恢复380px。

- [ ] **Step 5: 补充窄屏退化**

视口小于900px时侧栏覆盖编辑区，宽度为`min(420px, 100vw)`；不挤压编辑器，不增加额外移动端导航。

- [ ] **Step 6: 运行测试**

Run:

```powershell
node --test tests/adminAgentUiSource.test.mjs
```

Expected: PASS。

### Task 6: 完整验证

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: 运行相关测试**

```powershell
node --test tests/adminAgentService.test.mjs tests/adminAgentUiSource.test.mjs tests/adminWritingAssistant.test.mjs tests/adminPostPreviewSource.test.mjs tests/assistantService.test.mjs
```

Expected: all PASS。

- [ ] **Step 2: 检查格式与构建**

```powershell
git diff --check
npm run build
```

Expected: both exit 0。

- [ ] **Step 3: 浏览器验证**

在本地管理端验证：

1. 打开笔记并展开Agent，编辑区宽度平滑缩小。
2. 拖动侧栏边界，宽度保持在限制范围内。
3. 普通提问产生Agent消息，不修改正文。
4. 选中文字要求润色，返回建议后打开原文/AI结果对比。
5. 放弃不改变正文；接纳只改变编辑器并显示未保存状态。
6. 停止请求、重试、清空和收起均正常。

- [ ] **Step 4: 提交实现**

```powershell
git add -- src/lib/server/adminAgentService.mjs src/lib/server/assistantService.mjs src/pages/api/admin/assistant/agent.ts src/pages/admin/posts/[id]/edit.astro src/scripts/admin-post-agent.js src/scripts/admin-post-milkdown.js src/styles/global.css tests/adminAgentService.test.mjs tests/adminAgentUiSource.test.mjs tests/adminWritingAssistant.test.mjs
git commit -m "Add embedded admin agent"
```

