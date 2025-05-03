import { z } from 'zod';
import {
  EMAIL_RE,
  SOL_PUBKEY_RE,
  HANDLE_RE,
  DISCORD_RE,
} from '@/utils/validators';

export const WaitlistSchema = z
  .object({
    email: z
      .string()
      .regex(EMAIL_RE)
      .optional()
      .or(z.literal('')),
    wallet_address: z
      .string()
      .regex(SOL_PUBKEY_RE)
      .optional()
      .or(z.literal('')),
    full_name: z.string().max(80).optional(),
    telegram_handle: z.string().regex(HANDLE_RE).optional(),
    twitter_handle: z.string().regex(HANDLE_RE).optional(),
    discord_username: z.string().regex(DISCORD_RE).optional(),
    referred_by: z.string().max(64).optional(),
    source: z.string().max(256).optional(),
  })
  .refine((d) => d.email || d.wallet_address, {
    message: 'email or wallet required',
    path: [],
  });
