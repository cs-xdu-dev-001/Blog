# Editor Performance and Agent Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the Milkdown editor bundle and make Agent proposals safe, reviewable editor transactions.

**Architecture:** Replace CodeMirror's full language catalog through a Vite alias backed by a small local catalog. Extend the existing Milkdown bridge with immutable review snapshots and stale-review rejection while keeping Agent output outside the editor until explicit acceptance.

**Tech Stack:** Astro, Vite, Milkdown Crepe, CodeMirror, ProseMirror, Node test runner.

---

### Task 1: Limited CodeMirror Language Catalog

**Files:**
- Create: `src/scripts/codemirror-language-data.js`
- Modify: `astro.config.mjs`
- Modify: `src/scripts/admin-post-milkdown.js`
- Test: `tests/adminPostPreviewSource.test.mjs`

- [ ] **Step 1: Write the failing catalog test**

Add source assertions that require a Vite alias for `@codemirror/language-data`, require the approved language imports, and reject legacy language imports:

```js
const astroConfig = read('astro.config.mjs');
const languageCatalog = read('src/scripts/codemirror-language-data.js');

assert.match(astroConfig, /@codemirror\/language-data/);
assert.match(astroConfig, /codemirror-language-data\.js/);
for (const language of [
  '@codemirror/lang-javascript',
  '@codemirror/lang-python',
  '@codemirror/lang-sql',
  '@codemirror/lang-json',
  '@codemirror/lang-html',
  '@codemirror/lang-css',
  '@codemirror/lang-markdown',
  '@codemirror/legacy-modes/mode/shell',
]) {
  assert.match(languageCatalog, new RegExp(language.replaceAll('/', '\\/')));
}
assert.doesNotMatch(languageCatalog, /legacy-modes\/mode\/apl/);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/adminPostPreviewSource.test.mjs
```

Expected: FAIL because the local language catalog and alias do not exist.

- [ ] **Step 3: Implement the local catalog**

Create `src/scripts/codemirror-language-data.js` with `LanguageDescription` entries for the approved languages and export them as `languages`:

```js
import { LanguageDescription } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { sql, StandardSQL } from '@codemirror/lang-sql';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export const languages = [
  LanguageDescription.of({ name: 'JavaScript', alias: ['js'], extensions: ['js', 'mjs', 'cjs'], load: async () => javascript() }),
  LanguageDescription.of({ name: 'TypeScript', alias: ['ts'], extensions: ['ts', 'tsx'], load: async () => javascript({ typescript: true, jsx: true }) }),
  LanguageDescription.of({ name: 'Python', alias: ['py'], extensions: ['py'], load: async () => python() }),
  LanguageDescription.of({ name: 'Shell', alias: ['bash', 'sh'], extensions: ['sh'], load: async () => StreamLanguage.define(shell) }),
  LanguageDescription.of({ name: 'SQL', extensions: ['sql'], load: async () => sql({ dialect: StandardSQL }) }),
  LanguageDescription.of({ name: 'JSON', extensions: ['json'], load: async () => json() }),
  LanguageDescription.of({ name: 'HTML', extensions: ['html', 'htm'], load: async () => html() }),
  LanguageDescription.of({ name: 'CSS', extensions: ['css'], load: async () => css() }),
  LanguageDescription.of({ name: 'Markdown', alias: ['md'], extensions: ['md'], load: async () => markdown() }),
];
```

Add a `resolve.alias` entry in `astro.config.mjs` that maps the exact package name to the local catalog. Import the local `languages` in `admin-post-milkdown.js` and pass it to `Crepe.Feature.CodeMirror`.

- [ ] **Step 4: Verify GREEN and measure**

Run:

```powershell
node --test tests/adminPostPreviewSource.test.mjs
npm run build
Get-ChildItem dist/client/_astro/admin-post-milkdown*.js | Select-Object Name,Length
```

Expected: test PASS; editor JS is below the current `1,488,392` byte baseline and build has no missing-export errors.

### Task 2: Immutable Agent Review Snapshot

**Files:**
- Modify: `src/scripts/admin-post-milkdown.js`
- Test: `tests/adminAgentEditorBridge.test.mjs`

- [ ] **Step 1: Write failing bridge tests**

Require review IDs, immutable source snapshots, and stale-review checks:

```js
assert.match(editor, /crypto\.randomUUID\(\)/);
assert.match(editor, /sourceDocument:\s*serializer\(state\.doc\)/);
assert.match(editor, /currentDocument\s*!==\s*review\.sourceDocument/);
assert.match(editor, /审阅已过期，请重新生成/);
assert.match(editor, /activeReviewId/);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
node --test tests/adminAgentEditorBridge.test.mjs
```

Expected: FAIL because reviews currently retain coordinates without a document snapshot.

- [ ] **Step 3: Capture and validate snapshots**

Extend `captureAITarget()` to return:

```js
{
  id: crypto.randomUUID(),
  scope,
  markdown,
  sourceDocument: serializer(state.doc),
  from,
  to,
}
```

Store the ID and source document in the active review. Before applying `replaceRange`, serialize the current document and compare it with `review.sourceDocument`. Reject stale reviews, close the review UI, and dispatch a visible editor notice without modifying Markdown.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
node --test tests/adminAgentEditorBridge.test.mjs
```

Expected: PASS.

### Task 3: Inline Review Controls

**Files:**
- Modify: `src/scripts/admin-post-milkdown.js`
- Modify: `src/styles/global.css`
- Test: `tests/adminAgentEditorBridge.test.mjs`
- Test: `tests/adminAgentPanel.test.mjs`

- [ ] **Step 1: Write failing interaction tests**

Require compact icon controls, accessible labels, and inline change styling:

```js
assert.match(editor, /aria-label', '放弃修改'/);
assert.match(editor, /aria-label', '接纳修改'/);
assert.match(editor, /textContent = '✕'/);
assert.match(editor, /textContent = '✓'/);
assert.match(styles, /\.post-ai-review-change/);
assert.match(styles, /\.post-ai-review-removed/);
assert.match(styles, /\.post-ai-review-added/);
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/adminAgentEditorBridge.test.mjs tests/adminAgentPanel.test.mjs
```

Expected: FAIL because the current review uses text buttons and a two-column comparison.

- [ ] **Step 3: Implement the inline review**

Render the original content in context with one replacement block containing removed and added Markdown. Use two icon buttons:

```js
const discardButton = document.createElement('button');
discardButton.type = 'button';
discardButton.textContent = '✕';
discardButton.setAttribute('aria-label', '放弃修改');
discardButton.title = '放弃修改';

const acceptButton = document.createElement('button');
acceptButton.type = 'button';
acceptButton.textContent = '✓';
acceptButton.setAttribute('aria-label', '接纳修改');
acceptButton.title = '接纳修改';
```

Keep `Escape` as discard. Disable both buttons while an acceptance transaction is running.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/adminAgentEditorBridge.test.mjs tests/adminAgentPanel.test.mjs
```

Expected: PASS.

### Task 4: Full Regression and Runtime Verification

**Files:**
- Verify: `src/scripts/codemirror-language-data.js`
- Verify: `src/scripts/admin-post-milkdown.js`
- Verify: `src/styles/global.css`

- [ ] **Step 1: Run the complete suite**

```powershell
$tests = Get-ChildItem tests -Filter '*.test.mjs' | ForEach-Object FullName
node --test $tests
npm run build
git diff --check
```

Expected: all tests PASS, build succeeds, diff check is clean.

- [ ] **Step 2: Compare production assets**

```powershell
Get-ChildItem dist/client/_astro/admin-post-milkdown*.js |
  Select-Object Name,Length
```

Expected: editor JS is smaller than `1,488,392` bytes. Record the new raw and gzip sizes from Vite output.

- [ ] **Step 3: Verify in a browser**

Open an admin post editor and verify:

1. The editor becomes interactive without a long blank loading state.
2. JavaScript, TypeScript, Python, Shell, SQL, JSON, HTML, CSS and Markdown code blocks work.
3. Agent selection and document proposals render inline.
4. `✕` leaves Markdown unchanged.
5. `✓` writes once and marks the post unsaved.
6. Editing after proposal creation makes the proposal expire instead of overwriting content.
7. Locked notes remain unavailable before unlock.

- [ ] **Step 4: Leave implementation ready for user-controlled Git**

Do not commit or push implementation changes until the user requests `git`.
