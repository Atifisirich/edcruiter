import type { MetadataRoute } from 'next';

const SITE = 'https://edcruiter.com';

// Public marketing and legal pages only. Vacancies and candidate pages are
// created by schools and are not listed here.
const PAGES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/features', priority: 0.8 },
  { path: '/how-it-works', priority: 0.8 },
  { path: '/product/ai-job-generator', priority: 0.7 },
  { path: '/product/ai-resume-screening', priority: 0.7 },
  { path: '/product/ai-video-interview', priority: 0.7 },
  { path: '/jobs', priority: 0.7 },
  { path: '/about', priority: 0.6 },
  { path: '/contact', priority: 0.6 },
  { path: '/security', priority: 0.5 },
  { path: '/safeguarding', priority: 0.5 },
  { path: '/privacy', priority: 0.4 },
  { path: '/terms', priority: 0.4 },
  { path: '/data-deletion', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(({ path, priority }) => ({ url: `${SITE}${path}`, lastModified, priority }));
}
