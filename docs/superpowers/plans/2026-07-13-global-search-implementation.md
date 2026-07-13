# 全站搜索实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加覆盖笔记、书籍、影像和标签的双栏全站搜索面板，并在所有公开页面提供统一入口。

**Architecture:** 服务端`searchService`从三个现有SQLite仓储读取公开数据并映射为统一结果，`GET /api/search`只负责参数验证和JSON输出。`GlobalSearch.astro`只提供一份全局面板结构，浏览器脚本负责请求、分组列表、双栏预览、标签展开和键盘导航；各导航栏只增加同一个搜索触发属性。

**Tech Stack:** Astro 5、Node.js、SQLite/better-sqlite3、原生JavaScript、Node Test Runner、Puppeteer。

**Git约束:** 用户自行决定何时推送，本计划执行期间不运行`git add`、`git commit`或`git push`。

---

### Task 1: 聚合公开搜索数据

**Files:**
- Create: `src/lib/server/searchService.mjs`
- Create: `tests/searchService.test.mjs`

- [ ] **Step 1: 写失败测试**

使用三个伪仓储构造已发布笔记、草稿、在读书籍、影像和分类，断言：

```js
const result = service.search('AI');
assert.deepEqual(result.groups.map((group) => group.key), ['posts', 'reading', 'watch', 'tags']);
assert.equal(result.groups.find((group) => group.key === 'posts').items[0].href, '/posts/ai-note');
assert.equal(result.groups.find((group) => group.key === 'tags').items[0].children.length, 2);
assert.equal(JSON.stringify(result).includes('draft note'), false);
```

另测空查询只返回近期笔记、`status=reading`书籍和`status=在看`影像；每组最多6项，标签最多4项。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/searchService.test.mjs`

Expected: FAIL，`searchService.mjs`不存在。

- [ ] **Step 3: 实现统一结果映射**

导出`createSearchService({ posts, reading, watch })`和默认`searchService`。统一条目字段：

```js
{
  id: 'post:12',
  type: 'post',
  title: 'AI时代的学习路径',
  meta: 'AI Knowledge · 2026/07/13',
  excerpt: '文章描述或正文摘要',
  image: '',
  href: '/posts/ai-note'
}
```

标签条目使用`type: 'tag'`、`href: ''`并携带`children`。服务只调用`postRepository.list({ filter: 'published' })`，不读取草稿。

- [ ] **Step 4: 运行服务测试**

Run: `node --test tests/searchService.test.mjs`

Expected: PASS。

### Task 2: 提供公共只读搜索API

**Files:**
- Create: `src/pages/api/search.ts`
- Create: `tests/searchApiSource.test.mjs`

- [ ] **Step 1: 写失败测试**

读取API源码并断言：导出`GET`、调用`searchService.search(query)`、查询超过100字符返回400、响应使用`Response.json`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/searchApiSource.test.mjs`

Expected: FAIL，API文件不存在。

- [ ] **Step 3: 实现GET路由**

```ts
export const GET: APIRoute = ({ url }) => {
  const query = String(url.searchParams.get('q') || '').trim();
  if (query.length > 100) return Response.json({ error: '查询内容过长' }, { status: 400 });
  return Response.json(searchService.search(query));
};
```

路由不接受POST，不记录查询词，不返回仓储原始行。

- [ ] **Step 4: 运行API测试**

Run: `node --test tests/searchApiSource.test.mjs`

Expected: PASS。

### Task 3: 建立安全的客户端搜索状态

**Files:**
- Create: `public/global-search-core.mjs`
- Create: `tests/globalSearchClient.test.mjs`

- [ ] **Step 1: 写失败测试**

测试`escapeSearchHtml`转义HTML、`safeSearchHref`拒绝`javascript:`和协议相对地址、`flattenSearchItems`保持分组顺序且不把标签children混入左栏结果。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/globalSearchClient.test.mjs`

Expected: FAIL，客户端核心模块不存在。

- [ ] **Step 3: 实现纯函数模块**

导出：

```js
export function escapeSearchHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
export function safeSearchHref(value) {
  const href = String(value ?? '').trim();
  return href.startsWith('/') && !href.startsWith('//') ? href : '';
}
export function flattenSearchItems(groups = []) {
  return groups.flatMap((group) => (group.items || []).map((item) => ({
    ...item,
    groupKey: group.key,
    groupLabel: group.label,
  })));
}
```

- [ ] **Step 4: 运行客户端核心测试**

Run: `node --test tests/globalSearchClient.test.mjs`

Expected: PASS。

### Task 4: 创建双栏搜索组件与交互

**Files:**
- Create: `src/components/GlobalSearch.astro`
- Create: `public/global-search.js`
- Modify: `src/styles/global.css`
- Create: `tests/globalSearchShell.test.mjs`

- [ ] **Step 1: 写失败测试**

断言组件包含`role="dialog"`、搜索输入、结果栏、预览栏和遮罩；客户端脚本包含`AbortController`、120毫秒防抖、`ArrowUp`、`ArrowDown`、`ArrowLeft`、`ArrowRight`、`Enter`、`Escape`及标签children渲染。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/globalSearchShell.test.mjs`

Expected: FAIL，组件和脚本不存在。

- [ ] **Step 3: 创建面板语义结构**

`GlobalSearch.astro`包含：

```astro
<div class="global-search" data-global-search hidden>
  <button class="global-search-backdrop" data-global-search-close aria-label="关闭搜索"></button>
  <section class="global-search-panel" role="dialog" aria-modal="true" aria-label="全站搜索">
    <header class="global-search-query">...</header>
    <div class="global-search-layout">
      <div class="global-search-results" data-global-search-results></div>
      <aside class="global-search-preview" data-global-search-preview></aside>
    </div>
  </section>
</div>
```

- [ ] **Step 4: 实现浏览器交互**

脚本监听所有`[data-global-search-open]`，打开时请求空查询默认内容。输入使用120毫秒防抖，每次请求先中止旧`AbortController`。左栏分组渲染普通结果和标签；普通结果更新右侧预览，标签右侧渲染关联笔记按钮。键盘按设计文档移动、展开、打开和关闭。

- [ ] **Step 5: 添加固定尺寸双栏样式**

面板宽度`min(1040px, calc(100vw - 64px))`、高度`min(680px, calc(100vh - 96px))`，左右比例约`52% / 48%`。背景不使用模糊滤镜，选中项使用深蓝底和白字，橙色只用于焦点与类型标识；核心结果文字不小于15px。

- [ ] **Step 6: 运行组件测试**

Run: `node --test tests/globalSearchShell.test.mjs tests/globalSearchClient.test.mjs`

Expected: PASS。

### Task 5: 挂载全局组件和导航触发器

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/Header.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/about.astro`
- Create: `tests/globalSearchIntegration.test.mjs`

- [ ] **Step 1: 写失败测试**

断言`BaseLayout`始终渲染`GlobalSearch`，默认Header、首页自定义导航和About自定义导航各有`data-global-search-open`按钮及可访问名称，按钮使用放大镜SVG且没有可见说明文字。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/globalSearchIntegration.test.mjs`

Expected: FAIL，全局组件尚未挂载。

- [ ] **Step 3: 挂载组件和脚本**

在`BaseLayout`导入并渲染`GlobalSearch`。组件无论`chrome`是否启用都只渲染一次，因此首页和About只添加触发按钮，不复制面板。

- [ ] **Step 4: 添加三处搜索图标按钮**

按钮统一使用：

```astro
<button type="button" class="global-search-trigger" data-global-search-open aria-label="打开全站搜索">
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
</button>
```

- [ ] **Step 5: 运行集成测试**

Run: `node --test tests/globalSearchIntegration.test.mjs`

Expected: PASS。

### Task 6: 综合验证

**Files:**
- Verify only

- [ ] **Step 1: 运行完整测试**

Run: `node --test`

Expected: 全部通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Astro server build成功。

- [ ] **Step 3: 浏览器验证**

在桌面宽度依次验证：首页搜索图标打开面板；空查询显示近期内容；输入“主角”出现书籍和影像并更新预览；输入“AI”出现标签；选择标签后右栏展开笔记；方向键和`Enter`可用；`Esc`关闭并恢复焦点；无控制台错误和破图。

- [ ] **Step 4: 检查改动范围**

Run: `git diff --check && git status --short`

Expected: 只包含搜索功能、设计文档、实施计划及对应测试。
