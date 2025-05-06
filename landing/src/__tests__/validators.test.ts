import {
  isEmail,
  isSolPubkey,
  isHandle,
  isDiscordHandle,
} from '@/utils/validators';

describe('utils/validators', () => {
  // ── email ─────────────────────────────
  it('accepts a valid RFC-5322 email', () => {
    expect(isEmail('foo.bar+1@sub.example.co')).toBe(true);
  });
  it('rejects a malformed email', () => {
    expect(isEmail('foo@bar')).toBe(false);
  });

  // ── Solana pubkey ─────────────────────
  it('accepts a 44-char base-58 key', () => {
    expect(
      isSolPubkey('6z7CD8WuEg3DKoaUYpoa5Dhx3XJRoXnUjYQeUo78noHH')
    ).toBe(true);
  });
  it('rejects a key that is too short', () => {
    expect(isSolPubkey('123')).toBe(false);
  });

  // ── Social handles ────────────────────
  it('accepts "@handle" with underscore', () => {
    expect(isHandle('@good_handle')).toBe(true);
  });
  it('rejects handle with space', () => {
    expect(isHandle('@bad handle')).toBe(false);
  });

  // ── Discord ───────────────────────────
  it('accepts a valid Discord username', () => {
    expect(isDiscordHandle('Alice_123#9876')).toBe(true);
  });
  it('rejects Discord without discriminator', () => {
    expect(isDiscordHandle('Bob')).toBe(false);
  });
}); 