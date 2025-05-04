import { WaitlistSchema } from '@/lib/waitlistSchema';

describe('WaitlistSchema', () => {
  it('accepts a minimal valid wallet payload', () => {
    expect(() =>
      WaitlistSchema.parse({
        wallet_address: 'C56G3dVh1e6KzjYAVc9w1u87rXsHW8gqetfTqtdhQ2jU',
      }),
    ).not.toThrow();
  });

  it('rejects missing email + wallet', () => {
    expect(() => WaitlistSchema.parse({})).toThrow('email or wallet required');
  });

  it('rejects over-long full_name', () => {
    expect(() =>
      WaitlistSchema.parse({
        wallet_address: 'C56G3dVh1e6KzjYAVc9w1u87rXsHW8gqetfTqtdhQ2jU',
        full_name: 'A'.repeat(81),
      }),
    ).toThrow();
  });
}); 