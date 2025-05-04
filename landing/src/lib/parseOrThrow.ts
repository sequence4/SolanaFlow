import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import type { NextRequestTyped } from './typed-request';

export async function parseOrThrow<S extends ZodSchema>(
  req: Request,
  schema: S,
): Promise<NextRequestTyped<S> | NextResponse> {
  try {
    const body = await req.json();
    const parsed = await schema.parseAsync(body);
    return Object.assign(req, { parsed }) as NextRequestTyped<S>;
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid input', details: (err as Error).message },
      { status: 400 },
    );
  }
} 