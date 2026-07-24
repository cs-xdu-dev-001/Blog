import type { APIRoute } from 'astro';
import { servePostImage } from '../../../lib/server/postImageResponse.mjs';

export const GET: APIRoute = ({ params }) => servePostImage(params.path || '');
