---
title: "爬取个人博客页面"
description: "用 Python requests 和 BeautifulSoup 抓取博客页面，并处理中文编码问题。"
date: 2025-08-31
category: "Python"
featured: false
---

这次练习的目标很小：抓取一个博客页面，从页面里找出特定标题下的内容。重点不是爬虫规模，而是请求、编码和 HTML 解析流程。

## 请求页面

用 `requests` 请求页面，并设置常见浏览器 User-Agent：

```python
import requests
from bs4 import BeautifulSoup

url = "https://luckyou.asia/posts/helloworld/"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

response = requests.get(url, headers=headers, timeout=10)
response.raise_for_status()
response.encoding = "utf-8"
```

这里手动指定 `utf-8` 是为了解决中文乱码。要在读取 `response.text` 之前设置编码。

## 解析内容

用 BeautifulSoup 解析 HTML，再从标题节点向后找相邻内容：

```python
soup = BeautifulSoup(response.text, "lxml")
quote_sections = soup.find_all("h3")

for title_tag in quote_sections:
    title_text = title_tag.get_text(strip=True)
    print(f"【 {title_text} 】")

    for sibling in title_tag.find_next_siblings():
        if sibling.name == "h3":
            break

        if sibling.name in ["p", "blockquote"]:
            content_text = sibling.get_text(strip=True)
            if content_text:
                print(f"  - {content_text}")
```

## 环境依赖

服务器上需要安装解析依赖：

```bash
sudo apt install python3-bs4 python3-lxml
```

## 复盘

这个脚本适合验证思路，不适合直接扩大成高频爬虫。继续扩展前，需要补充重试、限速、异常记录和目标站点规则检查。
