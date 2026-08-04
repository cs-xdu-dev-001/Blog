import fs from 'node:fs';
import path from 'node:path';

const assetDir = path.resolve('dist', 'client', '_astro');
if (!fs.existsSync(assetDir)) throw new Error('dist/client/_astro不存在，请先执行npm run build');

const files = fs.readdirSync(assetDir).map((name) => ({
  name,
  bytes: fs.statSync(path.join(assetDir, name)).size,
}));
const budgets = [
  { pattern: /^admin-post-milkdown\..+\.js$/, max: 180_000, label: '编辑器核心JS' },
  { pattern: /^admin-post-milkdown-code\..+\.js$/, max: 80_000, label: '代码扩展JS' },
  { pattern: /^admin-post-milkdown-table\..+\.js$/, max: 45_000, label: '表格扩展JS' },
  { pattern: /^admin-post-milkdown-latex\..+\.js$/, max: 300_000, label: '公式扩展JS' },
  { pattern: /^global\..+\.css$/, max: 140_000, label: '公开端公共CSS', required: true },
  { pattern: /^home\..+\.css$/, max: 60_000, label: '首页CSS', required: true },
  { pattern: /^admin\..+\.css$/, max: 150_000, label: '管理端CSS', required: true },
  { pattern: /^article\..+\.css$/, max: 45_000, label: '文章排版CSS', required: true },
];

let failed = false;
for (const budget of budgets) {
  const matches = files.filter((file) => budget.pattern.test(file.name));
  if (!matches.length) {
    if (budget.required) {
      console.log(`缺失 ${budget.label}`);
      failed = true;
    }
    continue;
  }
  const largest = matches.sort((a, b) => b.bytes - a.bytes)[0];
  const result = largest.bytes <= budget.max ? '通过' : '超标';
  console.log(`${result} ${budget.label}: ${(largest.bytes / 1024).toFixed(1)} KiB / ${(budget.max / 1024).toFixed(1)} KiB`);
  if (largest.bytes > budget.max) failed = true;
}
if (failed) process.exitCode = 1;
