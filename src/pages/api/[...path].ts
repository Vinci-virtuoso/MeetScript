import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { app } from '../../server/app';
import type { Env } from '../../server/env';
export const ALL: APIRoute = ({ request }) =>
  app.fetch(request, env as unknown as Env);
