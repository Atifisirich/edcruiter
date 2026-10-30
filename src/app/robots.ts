import type { MetadataRoute } from 'next';

const SITE = 'https://edcruiter.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private workspaces and APIs have nothing for a search engine; they
      // sit behind sign-in anyway, but should not show up in results at all.
      disallow: ['/admin', '/api/', '/candidate/', '/reviewer', '/superadmin', '/school/setup', '/teacher'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
