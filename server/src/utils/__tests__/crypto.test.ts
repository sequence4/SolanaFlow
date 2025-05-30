import { encrypt, decrypt } from '../crypto';

// Mock the environment variable
process.env.API_KEY_ENCRYPTION_SECRET = 'c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2';

describe('Crypto utilities', () => {
  test('encrypt→decrypt returns original text', () => {
    const plain = 'secret🐱‍👤';
    const buf = encrypt(plain);
    expect(decrypt(buf)).toBe(plain);
  });
  
  test('handles empty string', () => {
    const plain = '';
    const buf = encrypt(plain);
    expect(decrypt(buf)).toBe(plain);
  });
  
  test('handles long text', () => {
    const plain = 'A'.repeat(1000);
    const buf = encrypt(plain);
    expect(decrypt(buf)).toBe(plain);
  });
}); 