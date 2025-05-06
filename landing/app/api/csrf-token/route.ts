import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-static';

export async function GET() {
  const token = crypto.randomBytes(32).toString('hex');
  
  const response = NextResponse.json({ token });
  
  response.cookies.set({
    name: 'csrf-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60
  });

  return response;
} 