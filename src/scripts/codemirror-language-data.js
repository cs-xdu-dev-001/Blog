import { LanguageDescription, StreamLanguage } from '@codemirror/language';

export const languages = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx'],
    extensions: ['js', 'mjs', 'cjs', 'jsx'],
    load: async () => {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ jsx: true });
    },
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx'],
    extensions: ['ts', 'tsx'],
    load: async () => {
      const { javascript } = await import('@codemirror/lang-javascript');
      return javascript({ typescript: true, jsx: true });
    },
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py'],
    extensions: ['py'],
    load: async () => {
      const { python } = await import('@codemirror/lang-python');
      return python();
    },
  }),
  LanguageDescription.of({
    name: 'Shell',
    alias: ['bash', 'sh'],
    extensions: ['sh'],
    load: async () => {
      const { shell } = await import('@codemirror/legacy-modes/mode/shell');
      return StreamLanguage.define(shell);
    },
  }),
  LanguageDescription.of({
    name: 'SQL',
    extensions: ['sql'],
    load: async () => {
      const { sql, StandardSQL } = await import('@codemirror/lang-sql');
      return sql({ dialect: StandardSQL });
    },
  }),
  LanguageDescription.of({
    name: 'JSON',
    extensions: ['json'],
    load: async () => {
      const { json } = await import('@codemirror/lang-json');
      return json();
    },
  }),
  LanguageDescription.of({
    name: 'HTML',
    extensions: ['html', 'htm'],
    load: async () => {
      const { html } = await import('@codemirror/lang-html');
      return html();
    },
  }),
  LanguageDescription.of({
    name: 'CSS',
    extensions: ['css'],
    load: async () => {
      const { css } = await import('@codemirror/lang-css');
      return css();
    },
  }),
  LanguageDescription.of({
    name: 'Markdown',
    alias: ['md'],
    extensions: ['md', 'markdown'],
    load: async () => {
      const { markdown } = await import('@codemirror/lang-markdown');
      return markdown();
    },
  }),
];
