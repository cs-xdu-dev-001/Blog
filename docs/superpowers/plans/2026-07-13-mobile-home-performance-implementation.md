# 首页移动端性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页影像轨道从720张常驻卡片改为48张固定卡槽，并让轨道与主题RAF只在可见且页面处于前台时运行。

**Architecture:** 保留`watchArchive.rows`作为完整数据源，在Astro首页中随机截取每行12条作为首批内容，并把完整行压缩为安全JSON供浏览器换批。浏览器使用轨道级事件委托和可见性状态控制动画，不给每张影像卡注册监听器。

**Tech Stack:** Astro、原生JavaScript、CSS动画、IntersectionObserver、ResizeObserver、Node.js Test Runner、Playwright浏览器测量

---

### Task 1: 建立性能回归约束

**Files:**
- Create: `tests/homePerformanceSource.test.mjs`

- [ ] **Step 1: 编写旧实现必然失败的源码测试**

测试读取`src/pages/index.astro`和`src/styles/global.css`，断言：

```js
assert.doesNotMatch(indexPage, /\[\.\.\.row\.items,\s*\.\.\.row\.items\]/);
assert.match(indexPage, /const WATCH_TRACK_BATCH_SIZE = 12/);
assert.match(indexPage, /data-watch-catalog/);
assert.match(indexPage, /decoding="async"/);
assert.match(indexPage, /fetchpriority="low"/);
assert.doesNotMatch(indexPage, /querySelectorAll\('\[data-watch-detail\]'\)\.forEach/);
assert.match(indexPage, /\(hover: hover\) and \(pointer: fine\)/);
assert.match(indexPage, /visibilitychange/);
assert.match(styles, /\.qzq-watch-marquee\.is-motion-paused[\s\S]*animation-play-state:\s*paused/);
```

- [ ] **Step 2: 运行测试并确认因旧实现失败**

Run: `node --test tests/homePerformanceSource.test.mjs`

Expected: FAIL，至少指出旧的全量复制表达式仍存在。

### Task 2: 将影像轨道改为固定卡槽池

**Files:**
- Modify: `src/pages/index.astro`
- Test: `tests/homePerformanceSource.test.mjs`

- [ ] **Step 1: 在Astro前置逻辑生成随机首批和安全目录JSON**

定义`WATCH_TRACK_BATCH_SIZE = 12`。每行从随机偏移循环取12条，生成`initialItems`；完整目录只保留卡片渲染需要的`title`、`type`、`status`、`rating`、`image`、`line`、`lineSource`和`href`，序列化后把`<`替换为`\u003c`。

- [ ] **Step 2: SSR仅渲染两份首批卡槽**

每行渲染`[...initialItems, ...initialItems]`，总计48张卡。轨道记录当前偏移和批次大小，页面嵌入`type="application/json"`目录。

- [ ] **Step 3: 为图片补充稳定尺寸和异步解码**

每张轨道图片增加：

```astro
width="600"
height="394"
loading="lazy"
decoding="async"
fetchpriority="low"
```

- [ ] **Step 4: 运行源码测试，确认卡槽与图片约束通过**

Run: `node --test tests/homePerformanceSource.test.mjs`

Expected: 与卡槽和图片有关的断言通过，交互生命周期断言仍失败。

### Task 3: 换批、事件委托和动画生命周期

**Files:**
- Modify: `src/pages/index.astro`
- Test: `tests/homePerformanceSource.test.mjs`

- [ ] **Step 1: 实现安全卡片构建和按轮换批次替换**

使用`document.createElement`、`textContent`和属性API创建卡片，禁止把目录内容直接拼进`innerHTML`。监听每条轨道的`animationiteration`，偏移增加12后同时重建两份相同批次。

- [ ] **Step 2: 详情导航改为轨道级事件委托**

在`.qzq-watch-marquee`上处理`dblclick`和`keydown`，通过`closest('[data-watch-detail]')`定位卡片。移除720份直接监听器。

- [ ] **Step 3: 倾斜和磁吸仅对精确指针启用**

使用：

```js
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
```

只有`finePointer.matches`且未开启减少动态效果时才注册对应指针交互。影像轨道采用委托，动态换批后无需重新注册。

- [ ] **Step 4: 轨道只在可见且前台时运行**

用IntersectionObserver维护影像区可见状态，用`document.visibilitychange`维护页面前台状态，统一切换`.is-motion-paused`。减少动态效果下始终暂停。

- [ ] **Step 5: 主题RAF改为按需启动**

用ResizeObserver缓存`orbitScale`，动画帧内不再调用`getBoundingClientRect()`。主题区离开视口或页面隐藏时取消RAF，重新进入时恢复。

- [ ] **Step 6: 运行源码测试**

Run: `node --test tests/homePerformanceSource.test.mjs`

Expected: PASS。

### Task 4: 恢复轻量移动轨道并验证性能预算

**Files:**
- Modify: `src/styles/global.css`
- Test: `tests/homePerformanceSource.test.mjs`

- [ ] **Step 1: 增加统一暂停规则**

```css
.qzq-watch-marquee.is-motion-paused .qzq-watch-track {
  animation-play-state: paused;
}
```

- [ ] **Step 2: 修改760px以下轨道规则**

移除影像轨道的`overflow-x:auto`、`scroll-snap-type`和`animation:none`，恢复两排反向自动动画；卡片宽度保持300px，轨道容器继续裁切并保留两侧淡出。

- [ ] **Step 3: 去除不必要的长期合成提示**

移除影像近期卡片和海报上的长期`will-change`，仅在实际交互状态依靠浏览器提升合成层。

- [ ] **Step 4: 运行完整自动验证**

Run: `node --test`

Expected: 全部测试通过。

Run: `npm run build`

Expected: Astro构建成功。

Run: `git diff --check`

Expected: 无格式错误。

- [ ] **Step 5: 运行真实浏览器性能测量**

在390×844、768×1024和1440×1000检查：

```text
watchCards <= 48
images <= 70
elements <= 1800
each track scrollWidth <= 16000
documentElement.scrollWidth === documentElement.clientWidth
```

- [ ] **Step 6: 截图复核**

检查两排反向轨道均可见，卡片比例稳定，影像区不再出现单张窄卡加大片空白，统计区和下一模块不重叠。
