# 观看近况模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有双排影像轨道的前提下，增加可由管理端维护的对称立体观看近况，并清理公开页面小于15px的可见文字。

**Architecture:** 扩展现有`watch_items`和`watchRepository`，由`watchArchiveView`输出一组`activity`数据；首页只负责渲染双卡与交互。管理端继续使用现有影像编辑器，不增加新的后台模块。数据库迁移保持幂等，旧数据无需重建。

**Tech Stack:** Astro SSR、SQLite、better-sqlite3、原生JavaScript、CSS、Node Test Runner、Puppeteer视觉验收。

**Git约束:** 当前工作区已有用户未提交修改。本计划不执行`git add`、`git commit`、`git push`或回退操作。

---

### Task 1: 扩展数据库与影像仓储

**Files:**
- Modify: `src/lib/server/db.mjs`
- Modify: `src/lib/server/watchRepository.mjs`
- Modify: `tests/watchRepository.test.mjs`
- Modify: `tests/watchRepositoryCreate.test.mjs`
- Create: `tests/watchActivityRepository.test.mjs`

- [ ] **Step 1: 写迁移与唯一精选失败测试**

测试覆盖：旧表初始化后出现`progress_text`、`completed_at`、`is_activity_featured`；更新同状态第二个精选条目时，第一个自动取消；`watching`和`activity`筛选可用。

```js
const first = repo.create({ title: '大江大河', type: '剧集', status: '在看' });
const second = repo.create({ title: '大江大河2', type: '剧集', status: '在看' });
repo.update(first.id, { ...editable(first), is_activity_featured: true });
repo.update(second.id, { ...editable(second), is_activity_featured: true });
assert.equal(repo.get(first.id).is_activity_featured, 0);
assert.equal(repo.get(second.id).is_activity_featured, 1);
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `node --test tests/watchRepository.test.mjs tests/watchRepositoryCreate.test.mjs tests/watchActivityRepository.test.mjs`

Expected: 新字段、筛选或唯一精选断言失败。

- [ ] **Step 3: 实现幂等迁移**

在`initializeSchema(db)`创建新库字段，并通过`PRAGMA table_info(watch_items)`为旧库补字段：

```js
function ensureColumn(db, table, name, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((column) => column.name === name);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

ensureColumn(db, 'watch_items', 'progress_text', "TEXT NOT NULL DEFAULT ''");
ensureColumn(db, 'watch_items', 'completed_at', "TEXT NOT NULL DEFAULT ''");
ensureColumn(db, 'watch_items', 'is_activity_featured', 'INTEGER NOT NULL DEFAULT 0');
```

- [ ] **Step 4: 扩展仓储读写与筛选**

`normalize()`把两个精选字段转为数字；`insertMany()`、`create()`、`update()`读写新字段。`allowedFilters`增加`watching`和`activity`。保存`is_activity_featured=true`时，在事务内先清除同状态其他条目。

- [ ] **Step 5: 运行仓储测试**

Run: `node --test tests/watchRepository.test.mjs tests/watchRepositoryCreate.test.mjs tests/watchRepositoryRemove.test.mjs tests/watchActivityRepository.test.mjs`

Expected: 全部通过。

### Task 2: 输出观看近况视图

**Files:**
- Modify: `src/lib/server/watchArchiveView.mjs`
- Modify: `tests/watchArchiveView.test.mjs`

- [ ] **Step 1: 写视图失败测试**

为仓储数据加入《大江大河》和《主角》，断言：

```js
assert.equal(archive.activity.watching.title, '大江大河');
assert.equal(archive.activity.finished.title, '主角');
assert.equal(archive.stats.watched, 2);
assert.equal(archive.stats.wanted, 1);
```

同时验证缺少任一精选条目时`archive.activity === null`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchArchiveView.test.mjs`

Expected: `activity`不存在。

- [ ] **Step 3: 实现映射与选择**

映射新字段，并从`mapped`中选择：

```js
const watching = mapped.find((item) => item.status === '在看' && item.isActivityFeatured);
const finished = mapped.find((item) => item.status === '已看' && item.isActivityFeatured);
const activity = watching && finished ? { watching, finished } : null;
```

保留原`rows`生成逻辑。`在看`不计入`watched`或`wanted`，仍计入总数和类型统计。

- [ ] **Step 4: 运行视图测试**

Run: `node --test tests/watchArchiveView.test.mjs tests/watchArchive.test.mjs`

Expected: 全部通过。

### Task 3: 扩展管理端配置

**Files:**
- Modify: `src/pages/api/admin/watch/index.ts`
- Modify: `src/pages/api/admin/watch/[id].ts`
- Modify: `src/pages/admin/watch.astro`
- Modify: `public/admin-watch.js`
- Create: `tests/watchAdminActivitySource.test.mjs`

- [ ] **Step 1: 写管理端源码契约测试**

断言管理端包含`在看`状态、`progress_text`、`completed_at`、`is_activity_featured`、`watching`和`activity`筛选，并验证API转交全部字段。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchAdminActivitySource.test.mjs`

Expected: 新字段相关断言失败。

- [ ] **Step 3: 扩展API**

POST允许创建`在看`条目；PUT传递：

```ts
progress_text: String(body.progress_text || ''),
completed_at: String(body.completed_at || ''),
is_activity_featured: Boolean(body.is_activity_featured),
```

- [ ] **Step 4: 扩展管理页**

增加“在看”“观看近况”筛选。编辑器增加观看进度、完成日期和“展示在观看近况”开关；根据状态切换字段可见性。列表中的观看近况条目显示明确状态，不增加新的页面或弹窗。

- [ ] **Step 5: 运行管理端契约与仓储测试**

Run: `node --test tests/watchAdminActivitySource.test.mjs tests/watchActivityRepository.test.mjs`

Expected: 全部通过。

### Task 4: 加入初始内容与本地封面

**Files:**
- Create: `public/watch/大江大河.jpg`
- Create: `public/watch/主角.jpg`
- Modify: `src/data/watchImages.mjs`
- Modify: `scripts/init-watch-db.mjs`
- Modify: `data/blog.sqlite`（本地运行数据，Git忽略）

- [ ] **Step 1: 复制已确认封面到公开素材目录**

把草图使用的两张封面保存到`public/watch/`，不使用第三方热链。

- [ ] **Step 2: 增加图片映射**

```js
export const watchImages = {
  '大江大河': '/watch/%E5%A4%A7%E6%B1%9F%E5%A4%A7%E6%B2%B3.jpg',
  '主角': '/watch/%E4%B8%BB%E8%A7%92.jpg',
};
```

- [ ] **Step 3: 让初始化脚本保留观看近况字段**

初始化导入时将《大江大河》设为`在看`精选，将《主角》设为`已看`精选；不写评分、短评、进度或完成日期。

- [ ] **Step 4: 幂等更新本地数据库**

按标题查找并更新，缺少时创建。只修改这两个条目的状态、图片路径和观看近况精选字段，不重置其他影像数据。

- [ ] **Step 5: 查询本地数据确认结果**

Run: `node -e "/* 查询大江大河和主角 */"`

Expected: 两条记录图片路径正确，且分别成为`在看`和`已看`的观看近况精选。

### Task 5: 实现首页对称立体双卡

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Create: `tests/watchActivityHomepage.test.mjs`

- [ ] **Step 1: 写首页源码契约测试**

断言首页仅在`watchArchive.activity`完整时渲染`data-watch-activity`，包含两个`data-watch-activity-card`、键盘属性和本地图片；原`qzq-watch-marquee`仍存在且代码顺序在双卡之后。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/watchActivityHomepage.test.mjs`

Expected: 观看近况结构不存在。

- [ ] **Step 3: 添加双卡结构**

在`qzq-watch-summary`与`qzq-watch-marquee`之间插入等宽双卡。左卡文字左置、封面右置；右卡镜像排列。状态文字分别为“近期在看”和“近期看完”。

- [ ] **Step 4: 添加视觉样式**

实现固定等高网格、深色背景、独立封面层、稳定阴影和镜像倾角。所有可见文字至少15px，不使用模糊滤镜。

- [ ] **Step 5: 添加可重复入场和交互**

复用现有`data-reveal-section`机制，在模块离开视口时重置。仅为两张双卡添加`requestAnimationFrame`指针跟随；点击或键盘切换`is-active`和`aria-expanded`。不修改轨道动画。

- [ ] **Step 6: 运行首页契约测试**

Run: `node --test tests/watchActivityHomepage.test.mjs tests/watchArchiveView.test.mjs`

Expected: 全部通过。

### Task 6: 清理公开页面小字

**Files:**
- Modify: `src/styles/global.css`
- Create: `scripts/audit-public-font-sizes.mjs`
- Create: `tests/publicTypographySource.test.mjs`

- [ ] **Step 1: 建立可重复字号审计**

脚本使用`puppeteer-core`访问首页、关于页、文章页和阅读页，收集可见文本节点的计算字号，输出小于15px的选择器、文字和页面路径，并以非零状态退出。

- [ ] **Step 2: 运行审计并记录失败基线**

Run: `node scripts/audit-public-font-sizes.mjs`

Expected: 当前页面存在小于15px文字，脚本失败。

- [ ] **Step 3: 按实际渲染结果调整公开样式**

只修改审计命中的公开页面选择器。无信息价值的小标签删除，有价值的状态、时间、来源和导航文字提升到15px至16px。禁止使用全局通配符强制字号。

- [ ] **Step 4: 增加源码守卫**

验证新增观看近况样式不包含小于15px字号，并确认管理端和AI助手不被公开页面字号规则覆盖。

- [ ] **Step 5: 重跑字号审计**

Run: `node scripts/audit-public-font-sizes.mjs`

Expected: 四类公开页面均无小于15px的可见文字。

### Task 7: 全量验证与视觉验收

**Files:**
- No production file changes expected

- [ ] **Step 1: 运行全量测试**

Run: `node --test tests/*.test.mjs`

Expected: 0失败。

- [ ] **Step 2: 运行生产构建**

Run: `npm.cmd run build`

Expected: Astro构建完成，退出码0。

- [ ] **Step 3: 检查差异格式**

Run: `git diff --check`

Expected: 无空白错误。行尾转换警告可以记录，不视为失败。

- [ ] **Step 4: 桌面浏览器视觉检查**

在`1440×1000`和`1920×1080`检查：双卡等宽等高、标题基线一致、封面镜像、点击记录、重复入场、轨道独立轮换、无小字、无重叠和横向滚动条。

- [ ] **Step 5: 交互性能检查**

确认控制台无错误；快速移动鼠标时只存在一帧合并更新；卡片离开后透视归零；减少动态效果下无自动运动。

- [ ] **Step 6: 核对工作区**

只报告本次修改和既有未提交修改，不执行任何Git写操作。
