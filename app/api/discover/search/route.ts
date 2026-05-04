import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { googleLinkedinSearch } from '@/lib/scraper/linkedin-search';

export async function GET(req: Request) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') ?? '';
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });
  const limit = Number(searchParams.get('limit') ?? '10');
  return NextResponse.json(await googleLinkedinSearch(q, limit));
}
