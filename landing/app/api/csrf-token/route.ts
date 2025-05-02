import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-static';

export async function GET() {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store the token in a cookie that's HTTP-only
  const response = NextResponse.json({ token });
  
  // Set the token in a cookie (secure in production)
  response.cookies.set({
    name: 'csrf-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 // 1 hour
  });

  return response;
} 