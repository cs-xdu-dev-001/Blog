import fs from 'node:fs';

function read(relativePath) {
  return fs.readFileSync(new URL(`../../src/styles/${relativePath}`, import.meta.url), 'utf8');
}

export const publicStyles = `${read('global.css')}\n${read('article.css')}`;
export const homeStyles = `${publicStyles}\n${read('home.css')}`;
export const adminStyles = `${read('admin.css')}\n${read('article.css')}`;
export const allStyles = `${homeStyles}\n${adminStyles}`;
