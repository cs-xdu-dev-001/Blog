# Dev Notes

Dev Notes是一个个人博客和内容管理项目，重点不是模板化展示，而是把技术笔记、影像档案、阅读书架、空间足迹和AI助手放在同一个站点里长期维护。

项目基于Astro服务端模式构建，使用SQLite保存管理端数据，前端风格参考极简白底、轻卡片、轨道动效和内容型博客的呈现方式。

## 功能

- 首页：动态字标、主线、近期笔记、影像档案、阅读书架、统计模块、空间地图、雷达图和关于入口。
- 文章：支持Markdown内容、文章列表、文章详情和精选文章。
- 影像档案：维护电影/剧集条目、状态、评论、佳句和封面。
- 阅读书架：维护已读、在读和计划阅读的书籍，支持封面和书评信息。
- 管理端：提供站点信息、首页文案、社交链接、AI助手、About、首页模块、影像、阅读、雷达标签、地图等配置入口。
- AI助手：可接入兼容OpenAI Chat Completions或Responses风格的第三方API，也支持代理和限额配置。

## 技术栈

- Astro 5
- TailwindCSS
- TypeScript
- better-sqlite3
- Node.js适配器，服务端输出

## 本地启动

先安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

默认访问：

- 博客首页：http://127.0.0.1:4321/
- 管理端：http://127.0.0.1:4321/admin

如果端口被占用，可以指定端口：

```bash
npm run dev -- --host 127.0.0.1 --port 4323
```

## 构建

```bash
npm run build
```

本地预览构建产物：

```bash
npm run preview
```

生产启动：

```bash
npm run start
```

## 管理端账号

开发环境默认用户名是`admin`，密码使用代码里的本地开发hash。生产环境不要依赖默认值，必须配置：

```env
ADMIN_USERNAME=你的用户名
ADMIN_PASSWORD_HASH=你的密码hash
ADMIN_SESSION_SECRET=一段足够长的随机字符串
```

生成密码hash：

```bash
node -e "import('./src/lib/server/auth.mjs').then(({createPasswordHash})=>console.log(createPasswordHash('你的密码')))"
```

## 环境变量

复制示例文件：

```bash
cp .env.example .env
```

常用变量：

- `BLOG_DB_PATH`：SQLite数据库路径，默认是`data/blog.sqlite`。
- `ADMIN_USERNAME`：管理端用户名。
- `ADMIN_PASSWORD_HASH`：管理端密码hash。
- `ADMIN_SESSION_SECRET`：管理端会话签名密钥。
- `ASSISTANT_API_MODE`：AI接口类型，`chat`或`responses`。
- `ASSISTANT_BASE_URL`：AI接口Base URL。
- `ASSISTANT_API_KEY`：AI接口密钥。
- `ASSISTANT_MODEL`：模型名。
- `ASSISTANT_PROXY_URL`：服务端AI请求代理。

真实`.env`不要提交到GitHub。

## 数据和上传文件

运行数据默认保存在：

- `data/blog.sqlite`
- `public/uploads/reading`
- `public/uploads/watch`

这些目录已经加入`.gitignore`，不会默认提交。部署前建议单独备份：

```bash
tar -czf blog-data-backup.tgz data public/uploads
```

如果要迁移服务器，需要同时迁移数据库和上传文件，否则管理端配置、影像封面、书籍封面可能不完整。

## 内容维护

文章的Markdown源文件在`src/content/posts`，管理端文章数据会写入SQLite。首次导入本地Markdown可以运行：

```bash
npm run posts:import
```

影像和阅读数据主要通过管理端维护。封面图片建议用条目标题命名，后续查找和替换会更省事。

## 测试

当前主要测试命令：

```bash
node --test tests/siteConfigRepository.test.mjs tests/postRepository.test.mjs
```

也可以运行单项文章仓库测试：

```bash
npm run test:posts
```

## 部署前检查

1. 运行`npm run build`。
2. 确认`.env`没有被提交。
3. 配置生产环境的`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET`。
4. 备份并迁移`data`和`public/uploads`。
5. 如果启用AI助手，确认APIKey、Base URL、模型名和代理配置可用。
6. 推GitHub前建议先提交一个checkpoint，方便回滚。

## Git建议

这个项目已经有较多视觉和管理端状态，后续每完成一个满意阶段建议提交一次：

```bash
git add .
git commit -m "Checkpoint: stable blog homepage and admin"
```

视觉大改、管理端结构调整、数据结构变更前，建议先提交或打tag。
