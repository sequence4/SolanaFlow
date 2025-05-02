import supertest from 'supertest';
import { createServer } from 'http';

describe('security headers', () => {
  it(
    'mock simple security headers test', 
    async () => {
      const server = createServer((req, res) => {
        res.setHeader('content-security-policy', "default-src 'self'");
        res.setHeader('x-frame-options', 'SAMEORIGIN');
        res.writeHead(200);
        res.end('OK');
      }).listen(0);
      
      try {
        const res = await supertest(server).get('/');
        expect(res.headers['content-security-policy']).toMatch(/default-src/);
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      } finally {
        server.close();
      }
    },
    20000
  );
}); 