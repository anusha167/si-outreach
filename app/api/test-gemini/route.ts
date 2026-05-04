import { NextResponse } from 'next/server';
import { getCurrentProfile, unauthorized } from '@/lib/auth';
import { testGemini } from '@/lib/gemini';

export async function GET() {
  if (!(await getCurrentProfile())) return unauthorized();
  return NextResponse.json(await testGemini());
}
