import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/** Helper – turn "", "   ", undefined → null (keeps valid strings) */
const n = (v?: string | null) => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
};

export async function POST(req: NextRequest) {
  const body = await req.json();

  /* 1 ─ basic validation */
  if (!n(body.email) && !n(body.wallet_address)) {
    return NextResponse.json(
      { error: 'email or wallet required' },
      { status: 400 }
    );
  }

  /* 2 ─ best-effort client IP */
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;

  try {
    /* 3 ─ insert row */
    await db.query(
      `INSERT INTO waitlist
         (email, wallet_address, full_name,
          telegram_handle, twitter_handle, discord_username,
          referred_by, source, signup_ip, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) DO NOTHING`,
      [
        n(body.email),
        n(body.wallet_address),
        n(body.full_name),
        n(body.telegram_handle),
        n(body.twitter_handle),
        n(body.discord_username),
        n(body.referred_by),   // now NULL when no ?ref=
        n(body.source),
        clientIp,
        req.headers           // meta JSONB
      ]
    );

    return new NextResponse(null, { status: 201 });
  } catch (err) {
    console.error('waitlist insert failed:', err);
    return NextResponse.json(
      { error: 'db insert failed' },
      { status: 500 }
    );
  }
}
