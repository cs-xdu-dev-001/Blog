# 极简个人博客实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建一个本地可运行的极简个人技术博客，包含首页、文章列表页、关于页和 5 篇从 Notion 整理的首版文章。

**Architecture:** 使用 Astro 做静态站点，TailwindCSS 负责极简视觉系统，文章用 Astro Content Collections 管理。组件保持少量且边界清楚，避免引入 UI 组件库。

**Tech Stack:** Astro、TailwindCSS、TypeScript、Markdown、Astro Content Collections。

---

## 文件结构

- 创建：`package.json`，项目脚本和依赖入口。
- 创建：`astro.config.mjs`，Astro 配置。
- 创建：`tailwind.config.mjs`，Tailwind 内容扫描和主题扩展。
- 创建：`tsconfig.json`，TypeScript 配置。
- 创建：`src/styles/global.css`，全局极简设计系统和 Markdown 样式。
- 创建：`src/content/config.ts`，文章集合 schema。
- 创建：`src/content/posts/*.md`，5 篇文章。
- 创建：`src/layouts/BaseLayout.astro`，站点 HTML 外壳。
- 创建：`src/layouts/ArticleLayout.astro`，文章详情页布局。
- 创建：`src/components/Header.astro`，顶部导航。
- 创建：`src/components/MinimalFooter.astro`，页脚。
- 创建：`src/components/ArticleIndex.astro`，文章列表组件。
- 创建：`src/pages/index.astro`，首页。
- 创建：`src/pages/writing.astro`，文章列表页。
- 创建：`src/pages/about.astro`，关于页。
- 创建：`src/pages/posts/[slug].astro`，文章动态路由。

## Task 1：项目初始化

- [ ] Step 1：创建 Astro + Tailwind 依赖。

运行：

```bash
npm init -y
npm install astro @astrojs/tailwind tailwindcss @tailwindcss/typography typescript
```

预期：生成 `package.json` 和 `package-lock.json`，依赖安装成功。

- [ ] Step 2：写入基础配置文件。

创建 `astro.config.mjs`、`tailwind.config.mjs`、`tsconfig.json`，确保 Astro 能识别 Tailwind 和 TypeScript。

- [ ] Step 3：运行基础检查。

```bash
npx astro --version
```

预期：输出 Astro 版本。

- [ ] Step 4：提交。

```bash
git add package.json package-lock.json astro.config.mjs tailwind.config.mjs tsconfig.json
git commit -m "chore: initialize astro project"
```

## Task 2：全局设计系统和布局

- [ ] Step 1：创建 `src/styles/global.css`。

包含 Tailwind directives、字体栈、白底黑字、12 列网格辅助类、文章正文样式、代码块样式和基础交互。

- [ ] Step 2：创建布局和基础组件。

创建：

- `src/layouts/BaseLayout.astro`
- `src/components/Header.astro`
- `src/components/MinimalFooter.astro`

要求：导航只包含 `Home / Writing / About`，无阴影、无装饰背景。

- [ ] Step 3：创建占位首页验证布局。

创建 `src/pages/index.astro`，使用大标题、留白和网格验证视觉方向。

- [ ] Step 4：运行开发服务器检查。

```bash
npm run dev
```

预期：首页能打开，排版不是默认 Astro 页面。

- [ ] Step 5：提交。

```bash
git add src astro.config.mjs tailwind.config.mjs tsconfig.json package.json package-lock.json
git commit -m "feat: add minimal layout system"
```

## Task 3：文章集合和内容迁移

- [ ] Step 1：创建 `src/content/config.ts`。

字段：

- `title`
- `description`
- `date`
- `category`
- `featured`

- [ ] Step 2：创建 5 篇 Markdown 文章。

文章文件：

- `src/content/posts/hugo-deploy.md`
- `src/content/posts/website-launch.md`
- `src/content/posts/website-update.md`
- `src/content/posts/ci-cd-blog.md`
- `src/content/posts/crawl-personal-blog.md`

内容来自已读取的 Notion 笔记，整理成可读文章，不原样堆命令。

- [ ] Step 3：运行内容检查。

```bash
npx astro check
```

预期：集合 schema 通过，文章 frontmatter 无错误。

- [ ] Step 4：提交。

```bash
git add src/content
git commit -m "feat: add initial blog posts"
```

## Task 4：页面实现

- [ ] Step 1：创建 `src/components/ArticleIndex.astro`。

支持传入文章列表，输出编号、日期、分类、标题和摘要。

- [ ] Step 2：创建 `src/layouts/ArticleLayout.astro`。

负责文章标题区、元信息、正文样式和返回链接。

- [ ] Step 3：实现页面。

创建或更新：

- `src/pages/index.astro`
- `src/pages/writing.astro`
- `src/pages/about.astro`
- `src/pages/posts/[slug].astro`

- [ ] Step 4：运行构建。

```bash
npm run build
```

预期：静态页面构建成功。

- [ ] Step 5：提交。

```bash
git add src
git commit -m "feat: build minimal blog pages"
```

## Task 5：本地运行和视觉检查

- [ ] Step 1：启动本地服务。

```bash
npm run dev
```

预期：终端输出本地访问地址。

- [ ] Step 2：检查页面。

检查：

- `/`
- `/writing`
- `/about`
- `/posts/hugo-deploy`

- [ ] Step 3：运行生产构建。

```bash
npm run build
```

预期：构建成功，没有类型或内容错误。

- [ ] Step 4：提交收尾修改。

```bash
git status --short
git add .
git commit -m "chore: verify minimal blog locally"
```

## 自检

- 规格中的页面范围已覆盖。
- 规格中的极简 UI 要求已映射到全局 CSS 和组件。
- 规格中的首版 Notion 内容迁移已映射到 Task 3。
- 规格中的验证要求已映射到 Task 5。
- 未保留 TBD、TODO 或未决占位。
