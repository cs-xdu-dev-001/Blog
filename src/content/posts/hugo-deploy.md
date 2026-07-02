---
title: "Hugo 部署记录"
description: "一次从服务器环境、Hugo 安装到 Nginx 发布的静态站点部署记录。"
date: 2025-09-10
category: "Deployment"
featured: true
---

这篇记录来自早期个人博客实践。当时选择 Hugo，是因为它足够轻、生成静态文件方便，也能直接交给 Nginx 对外服务。现在不再沿用 Hugo 主题，但这套部署流程仍然有参考价值。

## 服务器环境

先通过 VS Code 远程连接服务器，确认基础工具可用：

```bash
git --version
go version
sudo snap install dart-sass
```

Hugo 可以从 release 页面下载 `.deb` 包安装，也可以直接使用 apt：

```bash
sudo apt install hugo -y
hugo version
```

## 创建站点

当时的目录结构很直接：

```bash
cd ~
mkdir myblog
cd myblog
hugo new site blog
```

主题放在 `themes` 目录下，配置写入 `hugo.toml`。这一步适合快速开始，但也意味着视觉会很依赖主题默认设计。

## 生成和发布

本地预览：

```bash
hugo server -D
```

生成静态文件：

```bash
hugo
```

生成结果会放在 `public` 目录。把这个目录下的文件复制到 Nginx 的站点目录即可：

```bash
cp -r public/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
```

## 后续判断

Hugo 的部署链路足够简单，但主题定制会逐渐变成负担。新的博客应该保留“静态、易部署”的优点，同时把界面层完全收回到自己手里。
