import type { APIRoute } from 'astro';
import { serveUploadedImage } from '../../../lib/server/postImageResponse.mjs';

export const GET: APIRoute = ({ params }) => (
  serveUploadedImage(params.kind || '', params.path || '')
);
