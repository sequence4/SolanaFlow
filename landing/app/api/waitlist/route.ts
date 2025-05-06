import { NextResponse } from 'next/server';
import { WaitlistSchema } from '@/lib/waitlistSchema';
import { parseOrThrow } from '@/lib/parseOrThrow';
import { waitlistLimit } from '@/lib/rateLimit';
import { safeQuery } from '@/lib/db';

export const dynamic = 'force-static';

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const { success, reset } = await waitlistLimit.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'rate-limit exceeded' },
      { status: 429, headers: { 'Retry-After': reset.toString() } },
    );
  }

  const parsedOr400 = await parseOrThrow(req, WaitlistSchema);
  if (parsedOr400 instanceof NextResponse) return parsedOr400;
  const { parsed } = parsedOr400;

  const n = (v?: string | null) =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

  try {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null;

    const insert = await safeQuery(
      `INSERT INTO waitlist
           (email, wallet_address, full_name,
            telegram_handle, twitter_handle, discord_username,
            referred_by, source, signup_ip, meta, consent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
      [
        n(parsed.email),
        n(parsed.wallet_address),
        n(parsed.full_name),
        n(parsed.telegram_handle),
        n(parsed.twitter_handle),
        n(parsed.discord_username),
        n(parsed.referred_by),
        n(parsed.source),
        clientIp,
        req.headers,
        parsed.consent,
      ],
    );

    if (insert.rowCount === 0) {
      return NextResponse.json({ error: 'duplicate' }, { status: 409 });
    }

    return new NextResponse(null, { status: 201 });
  } catch (err) {
    console.error('waitlist insert failed:', err);
    return NextResponse.json(
      { error: 'db insert failed' },
      { status: 500 },
    );
  }
}
