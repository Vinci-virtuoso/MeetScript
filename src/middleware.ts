import { defineMiddleware } from 'astro:middleware';
export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set(
    'Content-Security-Policy',
    "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  );
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
});
