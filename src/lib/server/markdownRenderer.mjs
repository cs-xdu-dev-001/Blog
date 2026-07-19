import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

function slugifyHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    || 'section';
}

function textFromNode(node) {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(textFromNode).join('');
}

function headingPlugin(headings) {
  return () => (tree) => {
    visit(tree, 'heading', (node) => {
      const text = textFromNode(node).trim();
      if (!text) return;
      const slug = slugifyHeading(text);
      headings.push({ depth: node.depth, slug, text });
      node.data ||= {};
      node.data.hProperties ||= {};
      node.data.hProperties.id = slug;
    });
  };
}

function externalLinkPlugin() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href || '');
      if (!/^https?:\/\//i.test(href)) return;
      node.properties.target = '_blank';
      node.properties.rel = 'noreferrer';
    });
  };
}

function splitSoftBreaks(node) {
  if (!Array.isArray(node?.children)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && child.value.includes('\n')) {
      return child.value.split('\n').flatMap((part, index) => {
        const nodes = [];
        if (index > 0) nodes.push({ type: 'break' });
        if (part) nodes.push({ ...child, value: part });
        return nodes;
      });
    }
    splitSoftBreaks(child);
    return [child];
  });
}

function softBreakPlugin() {
  return (tree) => splitSoftBreaks(tree);
}

function redTextPlugin() {
  return (tree) => {
    visit(tree, (node) => {
      if (!Array.isArray(node.children)) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== 'text' || !child.value.includes('{{red:')) return [child];
        const parts = [];
        const pattern = /\{\{red:([^{}]+)\}\}/g;
        let lastIndex = 0;
        let match;
        while ((match = pattern.exec(child.value)) !== null) {
          if (match.index > lastIndex) {
            parts.push({ type: 'text', value: child.value.slice(lastIndex, match.index) });
          }
          parts.push({
            type: 'emphasis',
            data: {
              hName: 'span',
              hProperties: { className: ['article-red'] },
            },
            children: [{ type: 'text', value: match[1] }],
          });
          lastIndex = pattern.lastIndex;
        }
        if (lastIndex < child.value.length) {
          parts.push({ type: 'text', value: child.value.slice(lastIndex) });
        }
        return parts;
      });
    });
  };
}

export function markdownToHtml(markdown = '') {
  const headings = [];
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(softBreakPlugin)
    .use(redTextPlugin)
    .use(headingPlugin(headings))
    .use(remarkRehype)
    .use(externalLinkPlugin)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(String(markdown || ''));

  return { html: String(file), headings };
}

export function readingTimeForMarkdown(markdown = '') {
  const text = String(markdown || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`[\]()\-|~]/g, '');
  return Math.max(1, Math.ceil(text.length / 650));
}
