import { NextResponse, type NextRequest } from 'next/server';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

const TOKEN_COOKIE = 'csrf-token';
const TOKEN_HEADER = 'x-csrf-token';

export function middleware(req: NextRequest) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (SAFE_METHODS.includes(req.method as (typeof SAFE_METHODS)[number])) {
    return NextResponse.next();
  }
  if (req.nextUrl.pathname === '/api/csrf-token') {
    return NextResponse.next();
  }

  const originOrRef = req.headers.get('origin') ?? req.headers.get('referer');
  if (
    originOrRef &&
    allowedOrigins.length > 0 &&
    !allowedOrigins.some((o) => originOrRef.startsWith(o))
  ) {
    return NextResponse.json({ error: 'forbidden origin' }, { status: 403 });
  }

  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;
  const headerToken = req.headers.get(TOKEN_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return NextResponse.json({ error: 'invalid csrf token' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
}; 