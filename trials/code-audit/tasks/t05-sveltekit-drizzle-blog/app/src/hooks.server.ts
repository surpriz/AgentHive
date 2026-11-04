import type { Handle } from '@sveltejs/kit';
import { authorFromCookies } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.author = await authorFromCookies(event.cookies);
  if (event.url.pathname.startsWith('/write') && !event.locals.author) {
    return new Response(null, { status: 302, headers: { location: '/login' } });
  }
  return resolve(event);
};
