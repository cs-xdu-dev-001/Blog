# Public Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让Dev Notes全部公开页面在390px、768px和1440px视口下无溢出、无遮挡并保持完整交互。

**Architecture:** 继续使用现有Astro结构和`src/styles/global.css`，在文件末尾增加集中式公开页面响应式覆盖，避免改动桌面规则。全站搜索增加窄屏预览状态，AI助手在窄屏切换为受控视口窗口。

**Tech Stack:** Astro、原生JavaScript、TailwindCSS、Node test、Puppeteer Core

---

### Task 1: 响应式契约

**Files:**
- Create: `tests/publicResponsiveSource.test.mjs`
- Modify: `src/styles/global.css`

- [ ] 写入失败测试，断言`900px`平板断点、`640px`手机断点、导航横向滚动、搜索单栏状态、AI助手窄屏约束和影评单列规则。
- [ ] 运行`node --test tests/publicResponsiveSource.test.mjs`，确认因规则缺失而失败。
- [ ] 在`src/styles/global.css`末尾增加集中式响应式覆盖。
- [ ] 再次运行测试并确认通过。

### Task 2: 全站搜索窄屏交互

**Files:**
- Modify: `public/global-search.js`
- Modify: `src/styles/global.css`
- Modify: `tests/globalSearchClient.test.mjs`
- Modify: `tests/globalSearchShell.test.mjs`

- [ ] 写入失败测试，要求窄屏支持结果列表和预览状态切换。
- [ ] 为搜索根节点维护`is-previewing`状态，手机端选择结果后显示预览，返回键回到列表。
- [ ] 保持平板和桌面双栏、键盘导航及标签展开逻辑不变。
- [ ] 运行搜索专项测试。

### Task 3: 首页和详情页重排

**Files:**
- Modify: `src/styles/global.css`
- Test: `tests/publicResponsiveSource.test.mjs`

- [ ] 调整首页导航、Hero、主线、近期笔记、影像、书架和统计模块的平板与手机布局。
- [ ] 调整文章、书评、影评和About页面的行宽、标题、元数据和图片布局。
- [ ] 确保跑马灯和书架仅在自身容器横向滚动，页面本身不溢出。
- [ ] 运行响应式契约测试。

### Task 4: AI助手窄屏窗口

**Files:**
- Modify: `public/assistant.js`
- Modify: `src/styles/global.css`
- Modify: `tests/assistantClientCore.test.mjs`

- [ ] 写入失败测试，要求窄屏忽略已保存的桌面窗口位置和尺寸。
- [ ] 手机端禁用拖动和自由缩放，窗口固定在安全边距内。
- [ ] 平板和桌面继续恢复用户保存的窗口状态。
- [ ] 运行AI助手专项测试。

### Task 5: 浏览器和构建验收

**Files:**
- Test: `tests/publicResponsiveSource.test.mjs`

- [ ] 使用Puppeteer在390×844、768×1024、1440×1000检查首页、About、文章、书评和影评。
- [ ] 检查`scrollWidth === clientWidth`、导航可达、搜索和AI窗口不越界。
- [ ] 运行`node --test`。
- [ ] 运行`npm run build`。
- [ ] 运行`git diff --check`，不执行提交或推送。
