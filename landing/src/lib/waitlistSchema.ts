import { z } from 'zod';

export const WaitlistSchema = z
  .object({
    /* required */
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'Invalid email address' }),
    consent: z.literal(true, { errorMap: () => ({ message: 'Consent required' }) }),

    /* optional */
    wallet_address:   z.string().min(32).max(44).optional(),
    full_name:        z.string().max(80).optional(),
    telegram_handle:  z.string().max(32).optional(),
    twitter_handle:   z.string().max(32).optional(),
    discord_username: z.string().max(37).optional(),
    referred_by:      z.string().optional(),
    source:           z.string().optional(),
  })
  .strict();
