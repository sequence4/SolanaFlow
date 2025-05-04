import supertest from 'supertest';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { NextRequest } from 'next/server';
import { middleware as csrfMw } from '@/app/middleware';
import { POST as waitlistHandler } from '@/app/api/waitlist/route';
import { GET as csrfGet } from '@/app/api/csrf-token/route';
import { toNodeHandler } from './testUtils';

async function runMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const webReq = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as HeadersInit,
  });
  const nextReq = new NextRequest(webReq.url, {
    method: webReq.method,
    headers: webReq.headers,
  });
  const mwRes = csrfMw(nextReq);

  if (!mwRes || mwRes.headers.get('x-middleware-next') === '1') return false;

  res.writeHead(mwRes.status, Object.fromEntries(mwRes.headers));
  const text = await mwRes.text();
  res.end(text);
  return true;
}

function makeApi() {
  const server = createServer(async (req, res) => {
    if (await runMiddleware(req, res)) return;

    if (req.url?.startsWith('/api/csrf-token')) {
      await toNodeHandler(csrfGet)(req, res);
    } else if (req.url?.startsWith('/api/waitlist')) {
      await toNodeHandler(waitlistHandler)(req, res);
    }
  });
  return supertest(server);
}

const VALID_BODY = {
  wallet_address: 'C56G3dVh1e6KzjYAVc9w1u87rXsHW8gqetfTqtdhQ2jU',
};

describe('CSRF middleware', () => {
  it('allows POST when header & cookie match', async () => {
    const api = makeApi();

    const tokRes = await api.get('/api/csrf-token').expect(200);
    const token = tokRes.body.token;
    const cookie = tokRes.headers['set-cookie'][0];

    await api
      .post('/api/waitlist')
      .set('Cookie', cookie)
      .set('x-csrf-token', token)
      .send(VALID_BODY)
      .expect(201);
  });

  it('rejects POST with missing header', async () => {
    const api = makeApi();
    const tokRes = await api.get('/api/csrf-token');
    const cookie = tokRes.headers['set-cookie'][0];

    await api
      .post('/api/waitlist')
      .set('Cookie', cookie)
      .send(VALID_BODY)
      .expect(403);
  });

  it('rejects cross-origin request', async () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
    const api = makeApi();
    const tokRes = await api.get('/api/csrf-token');
    const token = tokRes.body.token;
    const cookie = tokRes.headers['set-cookie'][0];

    await api
      .post('/api/waitlist')
      .set('Cookie', cookie)
      .set('x-csrf-token', token)
      .set('Origin', 'https://evil.com')
      .send(VALID_BODY)
      .expect(403);
  });
}); 