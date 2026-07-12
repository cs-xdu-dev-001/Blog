import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const MIN_PUBLIC_FONT_SIZE = 15;
const baseUrl = process.env.BLOG_AUDIT_URL || 'http://127.0.0.1:4323';

function browserExecutable() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const executablePath = browserExecutable();
if (!executablePath) {
  throw new Error('No Chromium browser found. Set BROWSER_PATH before running the typography audit.');
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'networkidle0', timeout: 30000 });
  const discovered = await page.evaluate(() => ({
    post: document.querySelector('a[href^="/posts/"]')?.getAttribute('href') || '',
    reading: document.querySelector('a[href^="/reading/"]')?.getAttribute('href') || '',
  }));
  const routes = [...new Set(['/', '/about', '/reading', discovered.post, discovered.reading].filter(Boolean))];
  const groupedViolations = new Map();

  for (const route of routes) {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle0', timeout: 30000 });
    const pageViolations = await page.evaluate((minimum) => {
      const excluded = '.cms-page, .dn-assistant, .sr-only, script, style, svg, [aria-hidden="true"]';
      const selectorPartFor = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes = [...element.classList].slice(0, 3).map((name) => `.${name}`).join('');
        return `${element.tagName.toLowerCase()}${id}${classes}`;
      };
      const selectorFor = (element) => {
        const parts = [selectorPartFor(element)];
        if (element.id || element.classList.length) return parts.join(' > ');

        let node = element.parentElement;
        while (node && node !== document.body && parts.length < 3) {
          parts.unshift(selectorPartFor(node));
          if (node.id || node.classList.length) break;
          node = node.parentElement;
        }
        return parts.join(' > ');
      };
      const directText = (element) => [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(' ');

      return [...document.body.querySelectorAll('*')].flatMap((element) => {
        if (element.matches(excluded) || element.closest('.cms-page, .dn-assistant, .sr-only, [aria-hidden="true"]')) return [];
        const text = directText(element) || (element.matches('input, textarea') ? element.getAttribute('placeholder') || '' : '');
        if (!text) return [];
        if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return [];
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return [];
        const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
        if (!Number.isFinite(fontSize) || fontSize >= minimum) return [];
        return [{ selector: selectorFor(element), text: text.slice(0, 80), fontSize }];
      });
    }, MIN_PUBLIC_FONT_SIZE);

    pageViolations.forEach((violation) => {
      const key = `${route}\u0000${violation.selector}\u0000${violation.fontSize}`;
      const existing = groupedViolations.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }
      groupedViolations.set(key, { route, ...violation, count: 1 });
    });
  }

  const violations = [...groupedViolations.values()]
    .sort((left, right) => left.route.localeCompare(right.route)
      || left.fontSize - right.fontSize
      || left.selector.localeCompare(right.selector));

  if (violations.length) {
    console.error(JSON.stringify({ minimum: MIN_PUBLIC_FONT_SIZE, violations }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ minimum: MIN_PUBLIC_FONT_SIZE, routes, violations: 0 }, null, 2));
  }
} finally {
  await browser.close();
}
