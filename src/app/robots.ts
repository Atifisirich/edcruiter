import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms', '/security', '/data-deletion', '/safeguarding', '/about', '/login'],
    },
  };
}
