import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { fetchYcCompanies } from '@/lib/scraper/yc';

export async function GET(req: Request) {
  if (!(await getCurrentProfile())) return unauthorized();
  const { searchParams } = new URL(req.url);
  return NextResponse.json(
    await fetchYcCompanies({
      batch: searchParams.get('batch') ?? '',
      industry: searchParams.get('industry') ?? '',
      limit: Number(searchParams.get('limit') ?? '30'),
    }),
  );
}
