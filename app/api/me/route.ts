import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth';

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ logged_in: false });
  return NextResponse.json({
    logged_in: true,
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
  });
}
