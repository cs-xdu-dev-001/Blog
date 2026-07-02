---
title: "博客 CI/CD 准备"
description: "为服务器配置专用 GitHub SSH 密钥，给后续自动部署打基础。"
date: 2026-04-21
category: "Automation"
featured: true
---

手动复制文件能跑通流程，但长期维护会很烦。做 CI/CD 前，先要让服务器能安全地从 GitHub 拉代码。

## 忽略构建产物

静态站点的构建产物不应该提交到源码仓库：

```bash
cat > .gitignore <<'EOF'
public/
.hugo_build.lock
.claude
QWEN.md
EOF
```

这里的关键是区分源码和产物。源码进 Git，构建结果由发布流程生成。

## 生成服务器专用密钥

给服务器单独生成一把连接 GitHub 的 SSH 密钥：

```bash
ssh-keygen -t ed25519 -C "blog-server" -f ~/.ssh/github_blog
```

生成后有两个文件：

- `~/.ssh/github_blog`：私钥，留在服务器上。
- `~/.ssh/github_blog.pub`：公钥，添加到 GitHub。

## 指定 GitHub 使用这把密钥

写入 SSH 配置：

```bash
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_blog
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
```

## 下一步

完成 SSH 后，后续可以继续做自动拉取、构建和重启服务。首版博客先把本地构建跑通，部署自动化可以作为第二阶段。
