import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ ok: true, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev' });
}
