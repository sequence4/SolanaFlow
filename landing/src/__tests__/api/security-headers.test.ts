import supertest from 'supertest';
import next from 'next';
import { createServer } from 'http';

// Skip this test for now as it requires a build
describe.skip('security headers', () => {
  let server: any;

  beforeAll(async () => {
    const app = next({ dev: false, dir: '.' });
    await app.prepare();
    server = createServer((req, res) => app.getRequestHandler()(req, res)).listen(0);
  });

  afterAll(() => server?.close());

  it('sends basic security headers', async () => {
    const res = await supertest(server).get('/');
    expect(res.headers['content-security-policy']).toMatch(/default-src/);
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
}); 