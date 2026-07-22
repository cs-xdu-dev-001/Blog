import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(relativePath) {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : '';
}

const layout = read('src/layouts/AdminLayout.astro');
const baseLayout = read('src/layouts/BaseLayout.astro');
const styles = read('src/styles/global.css');
const posts = read('src/pages/admin/posts.astro');
const topics = read('src/pages/admin/topics.astro');
const watch = read('src/pages/admin/watch.astro');
const reading = read('src/pages/admin/reading.astro');
const radar = read('src/pages/admin/radar.astro');
const map = read('src/pages/admin/map.astro');
const site = read('src/pages/admin/site.astro');
const home = read('src/pages/admin/home.astro');
const assistant = read('src/pages/admin/assistant.astro');
const about = read('src/pages/admin/about.astro');
const postEditor = read('src/pages/admin/posts/[id]/edit.astro');
const watchNew = read('src/pages/admin/watch/new.astro');
const watchEdit = read('src/pages/admin/watch/[id]/edit.astro');
const readingNew = read('src/pages/admin/reading/new.astro');
const readingEdit = read('src/pages/admin/reading/[id]/edit.astro');
const topicNew = read('src/pages/admin/topics/new.astro');
const topicEdit = read('src/pages/admin/topics/[slug]/edit.astro');

test('admin shell exposes only content and site navigation groups', () => {
  assert.match(layout, /label: '内容'/);
  assert.match(layout, /label: '站点'/);
  assert.doesNotMatch(layout, /label: '视觉'|label: '系统'/);
  assert.doesNotMatch(layout, /slot name="sidebar-actions"/);
  assert.match(layout, /href: '\/admin\/home'/);
  assert.match(layout, /href: '\/admin\/assistant'/);
  assert.match(layout, /href: '\/admin\/about'/);
});

test('admin breadcrumbs navigate through content, site, and module indexes', () => {
  for (const page of [posts, topics, watch, reading]) {
    assert.match(page, /class="cms-admin-breadcrumb"><a href="\/admin\/posts">内容<\/a>/);
  }
  assert.match(posts, /<a href="\/admin\/posts"[^>]*>笔记<\/a>/);
  assert.match(topics, /<a href="\/admin\/topics"[^>]*>主线<\/a>/);
  assert.match(watch, /<a href="\/admin\/watch"[^>]*>影像档案<\/a>/);
  assert.match(reading, /<a href="\/admin\/reading"[^>]*>阅读书架<\/a>/);

  for (const page of [site, home, assistant, about, radar, map]) {
    assert.match(page, /class="cms-admin-breadcrumb"><a href="\/admin\/site">站点<\/a>/);
  }
  assert.match(home, /<a href="\/admin\/home"[^>]*>首页模块<\/a>/);
  assert.match(assistant, /<a href="\/admin\/assistant"[^>]*>AI助手<\/a>/);
  assert.match(about, /<a href="\/admin\/about"[^>]*>关于<\/a>/);

  for (const page of [watchNew, watchEdit]) assert.match(page, /<a href="\/admin\/watch">影像档案<\/a>/);
  for (const page of [readingNew, readingEdit]) assert.match(page, /<a href="\/admin\/reading">阅读书架<\/a>/);
  for (const page of [topicNew, topicEdit]) assert.match(page, /<a href="\/admin\/topics">主线<\/a>/);

  assert.match(styles, /\.cms-admin-breadcrumb a:focus-visible/);
});

test('admin shell supports a persistent accessible light and dark theme', () => {
  assert.match(baseLayout, /dataset\.adminTheme/);
  assert.match(baseLayout, /dev-notes-admin-theme/);
  assert.match(baseLayout, /prefers-color-scheme:\s*dark/);
  assert.match(layout, /data-admin-theme-toggle/);
  assert.match(postEditor, /data-admin-theme-toggle/);
  assert.match(baseLayout, /localStorage\.setItem/);
  assert.match(styles, /html\[data-admin-theme="light"\] \.cms-page/);
  assert.match(styles, /\.cms-page ::selection/);
  assert.match(styles, /\.post-editor-page ::selection/);
  assert.match(styles, /--cms-selection-bg:/);
});

test('all admin surfaces use the shared readable workbench contract', () => {
  assert.match(styles, /--cms-font-size-base:\s*15px/);
  assert.match(styles, /\.cms-index-shell\s*\{/);
  assert.match(styles, /\.cms-editor-page\s*\{/);
  for (const page of [posts, topics, watch, reading, radar, map, site, home, assistant, about]) {
    assert.ok(page, 'admin page should exist');
    assert.doesNotMatch(page, /slot="sidebar-actions"/);
    assert.doesNotMatch(page, /cms-hero/);
  }
});

test('content indexes keep only meaningful filters and open dedicated editors', () => {
  assert.doesNotMatch(watch, /缺图|缺影评|缺佳句/);
  assert.match(watch, /全部/);
  assert.match(watch, /在看/);
  assert.match(watch, /已看/);
  assert.match(watch, /观看近况/);
  assert.match(watch, /精选/);
  assert.match(watch, /href="\/admin\/watch\/new"/);

  assert.doesNotMatch(reading, /缺封面|缺书评|缺摘句|完整度/);
  assert.match(reading, /在读/);
  assert.match(reading, /已读/);
  assert.match(reading, /待读/);
  assert.match(reading, /精选/);
  assert.match(reading, /href="\/admin\/reading\/new"/);

  assert.match(topics, /href="\/admin\/topics\/new"/);
  assert.doesNotMatch(topics, /cms-metrics|首页标题/);
});

test('watch reading and topic editors have dedicated routes', () => {
  assert.match(watchNew, /data-watch-create-page/);
  assert.match(watchEdit, /data-watch-editor-page/);
  assert.match(readingNew, /data-reading-create-page/);
  assert.match(readingEdit, /data-reading-editor-page/);
  assert.match(topicNew, /data-topic-create-page/);
  assert.match(topicEdit, /data-topic-editor-page/);
});

test('single record APIs support dedicated editor loading', () => {
  const watchApi = read('src/pages/api/admin/watch/[id].ts');
  const readingApi = read('src/pages/api/admin/reading/[id].ts');
  const radarApi = read('src/pages/api/admin/radar/[id].ts');
  const topicApi = read('src/pages/api/admin/topics/[slug].ts');

  for (const api of [watchApi, readingApi, radarApi, topicApi]) {
    assert.match(api, /export const GET/);
  }
});

test('site settings are split into clear Chinese pages', () => {
  assert.match(site, /data-site-section="site"/);
  assert.match(home, /data-site-section="home"/);
  assert.match(assistant, /data-site-section="assistant"/);
  assert.match(about, /data-site-section="about"/);
  assert.match(about, />标题</);
  assert.match(about, />正文</);
  assert.doesNotMatch(about, /ABOUT|About标题|About正文/);
});

test('map modes live in the main toolbar instead of sidebar tools', () => {
  assert.match(map, /data-map-mode="heat"/);
  assert.match(map, /data-map-mode="pin"/);
  assert.match(map, /data-map-mode="label"/);
  assert.doesNotMatch(map, /地图工具|Travel Map|Control/);
});
