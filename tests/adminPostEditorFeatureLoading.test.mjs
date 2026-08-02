import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { detectOptionalEditorFeatures } from '../src/scripts/admin-post-editor-features.js';

test('detects optional editor features from the current markdown', () => {
  assert.deepEqual(detectOptionalEditorFeatures('普通正文'), {
    codeMirror: false,
    table: false,
    latex: false,
  });
  assert.deepEqual(detectOptionalEditorFeatures('```js\nconst value = 1;\n```'), {
    codeMirror: true,
    table: false,
    latex: false,
  });
  assert.deepEqual(detectOptionalEditorFeatures('| 名称 | 值 |\n| --- | --- |\n| A | 1 |'), {
    codeMirror: false,
    table: true,
    latex: false,
  });
  assert.deepEqual(detectOptionalEditorFeatures('行内公式$E=mc^2$\n\n$$\nx^2\n$$'), {
    codeMirror: false,
    table: false,
    latex: true,
  });
});

test('advanced editor features are split behind dynamic imports', () => {
  const source = fs.readFileSync(new URL('../src/scripts/admin-post-milkdown.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /^import .*feature\/code-mirror/m);
  assert.doesNotMatch(source, /^import .*feature\/table/m);
  assert.doesNotMatch(source, /^import .*feature\/latex/m);
  assert.doesNotMatch(source, /^import .*codemirror-language-data/m);
  assert.match(source, /import\('\.\/admin-post-milkdown-code\.js'\)/);
  assert.match(source, /import\('\.\/admin-post-milkdown-table\.js'\)/);
  assert.match(source, /import\('\.\/admin-post-milkdown-latex\.js'\)/);
});
