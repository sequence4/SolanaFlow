import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { WaitlistSchema } from '@/lib/waitlistSchema';
import { waitlistLimit } from '@/lib/rateLimit';
import type { z } from 'zod';

export const dynamic = 'force-static';

const n = (v?: string | null) => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
};

export async function POST(req: NextRequest) {
  const ip = req.headers
    .get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || '127.0.0.1';

  const { success, reset } = await waitlistLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'rate-limit exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': reset.toString() },
      },
    );
  }

  let data: z.infer<typeof WaitlistSchema>;
  try {
    data = WaitlistSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid input' }, { status: 400 });
  }

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null;

  try {
    const insert = await db.query(
      `INSERT INTO waitlist
         (email, wallet_address, full_name,
          telegram_handle, twitter_handle, discord_username,
          referred_by, source, signup_ip, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [
        n(data.email),
        n(data.wallet_address),
        n(data.full_name),
        n(data.telegram_handle),
        n(data.twitter_handle),
        n(data.discord_username),
        n(data.referred_by),
        n(data.source),
        clientIp,
        req.headers   
      ]
    );

    if (insert.rowCount === 0) {
      return NextResponse.json(
        { error: 'duplicate' },
        { status: 409 }
      );
    }

    return new NextResponse(null, { status: 201 });
  } catch (err) {
    console.error('waitlist insert failed:', err);
    return NextResponse.json(
      { error: 'db insert failed' },
      { status: 500 }
    );
  }
}
