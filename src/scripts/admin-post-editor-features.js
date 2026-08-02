export function detectOptionalEditorFeatures(markdown) {
  const source = String(markdown || '');
  const lines = source.split(/\r?\n/);
  const hasTable = lines.some((line, index) => {
    const next = lines[index + 1] || '';
    return line.includes('|')
      && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
  });

  return {
    codeMirror: /^\s{0,3}(?:`{3,}|~{3,})/m.test(source),
    table: hasTable,
    latex: /(^|[^\\])\${1,2}(?!\s)(?:[^$\n]|\\\$)+?\${1,2}/m.test(source)
      || /^\s*\$\$\s*$/m.test(source),
  };
}

