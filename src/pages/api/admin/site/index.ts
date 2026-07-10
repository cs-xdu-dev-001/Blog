import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { siteConfigRepository } from '../../../../lib/server/siteConfigRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  return Response.json({
    config: siteConfigRepository.getSiteConfig(),
    sections: siteConfigRepository.listSections(),
  });
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const config = siteConfigRepository.updateSiteConfig(input.config || {});
  const sections = Array.isArray(input.sections) ? input.sections : [];
  sections.forEach((section) => {
    if (!section?.key) return;
    siteConfigRepository.updateSection(section.key, section);
  });

  return Response.json({
    config,
    sections: siteConfigRepository.listSections(),
  });
};
