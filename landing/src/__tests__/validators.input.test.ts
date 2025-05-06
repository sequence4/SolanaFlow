import { WaitlistSchema } from '@/lib/waitlistSchema';

describe('WaitlistSchema', () => {
  it('accepts a minimal valid email payload', () => {
    expect(() =>
      WaitlistSchema.parse({
        email: 'a@b.com',
        consent: true
      }),
    ).not.toThrow();
  });

  it('rejects missing email + wallet', () => {
    expect(() => WaitlistSchema.parse({})).toThrow(/email.+required/i);
  });

  it('rejects over-long full_name', () => {
    expect(() =>
      WaitlistSchema.parse({
        email: 'a@b.com',
        consent: true,
        full_name: 'A'.repeat(81),
      }),
    ).toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() =>
      WaitlistSchema.parse({
        email: 'a@b.com',
        consent: true,
        evil: 'hacker',
      }),
    ).toThrow(/unrecognized key/i);
  });
}); 