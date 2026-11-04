import { NextResponse } from 'next/server';

/**
 * CORS for the public API. The browser extension runs on whatever page the user
 * is on, so the origin cannot be known ahead of time; we echo it back.
 */
export function withCors(req: Request, res: NextResponse): NextResponse {
  const origin = req.headers.get('origin') ?? '*';
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  res.headers.set('Vary', 'Origin');
  return res;
}

export function preflight(req: Request): NextResponse {
  return withCors(req, new NextResponse(null, { status: 204 }));
}
