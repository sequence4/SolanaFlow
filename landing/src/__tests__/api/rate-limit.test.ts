import { POST } from '@/app/api/waitlist/route';
import { makeAgent, toNodeHandler } from './testUtils';

const agent = makeAgent(toNodeHandler(POST));

describe('rate-limit branch coverage', () => {
  it('returns 429 on 6th hit from same IP', async () => {
    for (let i = 0; i < 5; i++) {
      await agent.post('/api/waitlist')
        .send({ wallet_address: `6z7CD8WuEg3DKoaUYpoa5Dhx3XJRoXnUjYQeUo78noH${i}` })
        .set('Content-Type', 'application/json');
    }

    const r = await agent.post('/api/waitlist')
      .send({ wallet_address: '6z7CD8WuEg3DKoaUYpoa5Dhx3XJRoXnUjYQeUo78noHF' })
      .set('Content-Type', 'application/json');

    expect(r.status).toBe(429);
    expect(r.body.error).toBe('rate-limit exceeded');
  });

  it('400 on invalid JSON body', async () => {
    const r = await agent.post('/api/waitlist')
      .set('Content-Type', 'text/plain')
      .set('x-forwarded-for', '203.0.113.123')
      .send('not-json');
    expect(r.status).toBe(400);
  });
}); 