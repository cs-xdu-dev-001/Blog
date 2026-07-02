---
title: "网站上线清单"
description: "把静态站点发布到服务器时，需要检查域名、Nginx、SSL 和端口。"
date: 2025-08-27
category: "Operations"
featured: true
---

网站上线不是只把文件传到服务器。真正要检查的是访问链路：域名是否指向服务器，Web 服务是否启动，HTTPS 是否可用，端口是否放行。

## 域名解析

域名解析在阿里云完成。核心是让域名指向服务器公网 IP。解析生效后，再继续配置服务器侧服务。

## 安装 Nginx

Nginx 作为静态文件服务器：

```bash
sudo apt update
sudo apt install nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

站点文件放在：

```bash
/var/www/html/
```

## 配置 HTTPS

SSL 证书使用 Certbot 生成和接入 Nginx：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx
```

配置完成后，重点检查 `80` 和 `443` 端口是否放行。HTTP 能访问不代表 HTTPS 一定正常，两个入口都需要测。

## 上线判断

上线完成的最低标准是：域名能打开首页，HTTPS 证书有效，刷新子页面不报错，服务器重启后 Nginx 能自动启动。
