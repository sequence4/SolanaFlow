import type { ZodSchema, infer as Infer } from 'zod';
import type { NextRequest } from 'next/server';

export type NextRequestTyped<S extends ZodSchema> = NextRequest & {
  parsed: Infer<S>;
}; 