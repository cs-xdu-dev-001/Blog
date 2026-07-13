# 影像影评详情页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为首页全部影像卡片增加双击详情入口，并提供可渲染Markdown个人影评的档案式详情页。

**Architecture:** 继续使用`watch_items`现有数据和数字主键。`watchArchiveView`只向首页暴露`id`与`href`，动态路由`/watch/[id]`按ID读取完整记录并使用现有Markdown渲染器输出影评；首页脚本统一处理双击与键盘跳转，保留近期卡单击展开逻辑。

**Tech Stack:** Astro 5、Node.js、SQLite/better-sqlite3、现有Markdown渲染器、原生DOM事件、Node Test Runner。

**Git约束:** 用户自行提交，本计划执行过程中禁止`git add`、`git commit`和`git push`。

---

### Task 1: 首页影像数据暴露稳定详情地址

**Files:**
- Modify: `src/lib/server/watchArchiveView.mjs`
- Modify: `tests/watchArchiveView.test.mjs`

- [ ] **Step 1: 写失败测试**

为测试仓储条目补充`id`，断言精选卡与轮换卡映射得到相同的`id`和`/watch/[id]`地址：

```js
assert.equal(archive.activity.finished.id, 2);
assert.equal(archive.activity.finished.href, '/watch/2');
assert.ok(archive.rows.flatMap((row) => row.items).some((item) => item.href === '/watch/2'));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchArchiveView.test.mjs`

Expected: FAIL，`archive.activity.finished.id`为`undefined`。

- [ ] **Step 3: 最小实现映射**

在`watchArchiveView.mjs`的条目映射中加入：

```js
id: item.id,
href: `/watch/${item.id}`,
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/watchArchiveView.test.mjs`

Expected: PASS。

### Task 2: 创建档案式影评详情页

**Files:**
- Create: `src/pages/watch/[id].astro`
- Modify: `src/styles/global.css`
- Create: `tests/watchReviewDetailSource.test.mjs`

- [ ] **Step 1: 写失败测试**

读取详情页源码并断言：使用`watchRepository.get(id)`、非法ID返回404、调用`markdownToHtml(item.comment)`、仅在有内容时展示佳句和影评、存在返回影像档案入口。

```js
assert.match(page, /watchRepository\.get\(id\)/);
assert.match(page, /status:\s*404/);
assert.match(page, /markdownToHtml\(item\.comment\)/);
assert.match(page, /href="\/#watch"/);
assert.match(page, /item\.quote &&/);
assert.match(page, /item\.comment &&/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchReviewDetailSource.test.mjs`

Expected: FAIL，详情页文件不存在。

- [ ] **Step 3: 实现动态路由**

页面前置逻辑：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { markdownToHtml } from '../../lib/server/markdownRenderer.mjs';
import { watchRepository } from '../../lib/server/watchRepository.mjs';

export const prerender = false;
const rawId = String(Astro.params.id || '');
const id = /^\d+$/.test(rawId) ? Number(rawId) : 0;
const item = id > 0 ? watchRepository.get(id) : null;
if (!item) return new Response('Not Found', { status: 404 });
const review = markdownToHtml(item.comment || '');
---
```

页面主体采用B档案式：返回入口、封面、片名、类型、状态、评分、佳句、来源和Markdown影评。空佳句与空影评不输出占位文字。

- [ ] **Step 4: 添加详情页样式**

在`global.css`增加独立的`.watch-review-*`样式：桌面端宽版容器、封面与档案信息双列头部、细线分隔、橙色字段名、长文正文宽度限制及Markdown标题、列表、引用、代码块样式。无封面时用纯浅灰占位块，不使用渐变和说明小字。

- [ ] **Step 5: 运行详情页测试**

Run: `node --test tests/watchReviewDetailSource.test.mjs`

Expected: PASS。

### Task 3: 所有首页影像卡片接入双击和键盘跳转

**Files:**
- Modify: `src/pages/index.astro`
- Create: `tests/watchReviewHomepageInteraction.test.mjs`

- [ ] **Step 1: 写失败测试**

断言两张近期卡与轮换卡均包含`data-watch-detail`和`data-href`，脚本监听`dblclick`与`Enter`，近期卡原有`Space`展开仍保留。

```js
assert.equal((homepage.match(/data-watch-detail/g) || []).length >= 3, true);
assert.match(homepage, /data-href=\{watchArchive\.activity\.watching\.href\}/);
assert.match(homepage, /data-href=\{item\.href\}/);
assert.match(homepage, /addEventListener\('dblclick'/);
assert.match(homepage, /event\.key === 'Enter'/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchReviewHomepageInteraction.test.mjs`

Expected: FAIL，首页尚未包含详情入口。

- [ ] **Step 3: 为卡片补充语义和地址**

近期卡增加`data-watch-detail`和对应`data-href`。轮换卡增加`tabindex="0"`、`role="link"`、可读的`aria-label`、`data-watch-detail`和`data-href={item.href}`。

- [ ] **Step 4: 实现统一跳转事件**

首页脚本新增：

```js
document.querySelectorAll('[data-watch-detail]').forEach((card) => {
  const openDetail = () => {
    const href = card.getAttribute('data-href');
    if (href) window.location.href = href;
  };
  card.addEventListener('dblclick', openDetail);
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    openDetail();
  });
});
```

近期卡原键盘逻辑只让空格触发展开，避免`Enter`同时展开和跳转。

- [ ] **Step 5: 运行交互与近期卡回归测试**

Run: `node --test tests/watchReviewHomepageInteraction.test.mjs tests/watchActivityHomepage.test.mjs`

Expected: PASS。

### Task 4: 管理端明确Markdown影评输入

**Files:**
- Modify: `public/admin-watch.js`
- Modify: `tests/watchAdminActivitySource.test.mjs`

- [ ] **Step 1: 写失败测试**

断言管理端出现“个人影评”标签和Markdown占位提示，并继续提交`comment`字段。

```js
assert.match(adminScript, /个人影评/);
assert.match(adminScript, /支持Markdown/);
assert.match(adminScript, /comment:\s*form\.get\('comment'\)/);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchAdminActivitySource.test.mjs`

Expected: FAIL，当前标签仍为“个人评论”。

- [ ] **Step 3: 最小修改表单文案**

将字段改为：

```html
<label>个人影评 <textarea name="comment" placeholder="支持Markdown">...</textarea></label>
```

不新增说明段落、预览面板或数据库字段。

- [ ] **Step 4: 运行管理端测试**

Run: `node --test tests/watchAdminActivitySource.test.mjs`

Expected: PASS。

### Task 5: 综合验证

**Files:**
- Verify only

- [ ] **Step 1: 运行完整测试**

Run: `node --test`

Expected: 全部通过，无失败。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Astro server build成功。

- [ ] **Step 3: 浏览器验证**

在桌面宽度打开首页与《主角》详情页，确认：轮换卡悬停暂停不变；双击进入详情；近期卡单击展开、双击进入详情；详情页字段对齐；Markdown长文、引用和列表无溢出；空影评作品不显示占位解释。

- [ ] **Step 4: 检查改动范围**

Run: `git diff --check && git status --short`

Expected: 无空白错误，只包含本功能、设计文档、实施计划和此前用户确认但尚未提交的改动。
