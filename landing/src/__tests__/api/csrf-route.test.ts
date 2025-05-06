import { GET } from '../../../app/api/csrf-token/route';
import { makeAgent, toNodeHandler } from './testUtils';

describe('GET /api/csrf-token', () => {
  it('returns 200 + {token} and sets http-only cookie', async () => {
    const agent = makeAgent(toNodeHandler(GET));

    const res = await agent.get('/api/csrf-token').expect(200);

    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toHaveLength(64);

    expect(res.headers['set-cookie'][0]).toMatch(/csrf-token=.*; HttpOnly/);
  });
}); 