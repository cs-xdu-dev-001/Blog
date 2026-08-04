import path from 'node:path';

export function getUploadsRoot() {
  const configured = String(process.env.BLOG_UPLOADS_ROOT || '').trim();
  return path.resolve(configured || path.join(process.cwd(), 'public', 'uploads'));
}

export function getUploadDir(kind) {
  return path.join(getUploadsRoot(), String(kind || '').trim());
}
