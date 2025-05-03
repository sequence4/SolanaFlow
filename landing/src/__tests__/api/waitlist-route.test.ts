import { POST } from '@/app/api/waitlist/route';
import { makeAgent, toNodeHandler } from './testUtils';
import { db } from '@/lib/db';

const agent = makeAgent(toNodeHandler(POST));

afterEach(async () => {
  await db.query('TRUNCATE TABLE waitlist');
});

describe('POST /api/waitlist', () => {
  it('201 + row inserted', async () => {
    await agent
      .post('/api/waitlist')
      .send({ email: 'alice@example.com' })
      .set('Content-Type', 'application/json')
      .expect(201);

    const { rowCount } = await db.query(
      'SELECT 1 FROM waitlist WHERE email=$1',
      ['alice@example.com']
    );
    expect(rowCount).toBe(1);
  });

  it('400 when neither email nor wallet is supplied', async () => {
    const res = await agent
      .post('/api/waitlist')
      .send({ full_name: 'Jane Doe' })
      .set('Content-Type', 'application/json')
      .expect(400);
    
    expect(res.body.error).toBe('invalid input');
  }, 10000);
  
  it('400 when invalid wallet address is supplied', async () => {
    const res = await agent
      .post('/api/waitlist')
      .send({ wallet_address: 'invalid-wallet-address' })
      .set('Content-Type', 'application/json')
      .expect(400);
    
    expect(res.body.error).toBe('invalid input');
  });

  it('400 when invalid email is supplied', async () => {
    const res = await agent
      .post('/api/waitlist')
      .send({ email: 'not-an-email' })
      .set('Content-Type', 'application/json')
      .expect(400);
    
    expect(res.body.error).toBe('invalid input');
  });
  
  it('409 on duplicate email', async () => {
    const email = 'dup@example.com';
    await db.query('INSERT INTO waitlist (email) VALUES ($1)', [email]);

    await agent
      .post('/api/waitlist')
      .send({ email })
      .set('Content-Type', 'application/json')
      .expect(409);
  });

  it('returns 429 on 6th request in a minute', async () => {
    for (let i = 0; i < 5; i++) {
      await agent.post('/api/waitlist').send({
        wallet_address: `6z7CD8WuEg3DKoaUYpoa5Dhx3XJRoXnUjYQeUo78noH${i}`
      });
    }
    await agent
      .post('/api/waitlist')
      .send({ wallet_address: '6z7CD8WuEg3DKoaUYpoa5Dhx3XJRoXnUjYQeUo78noHF' })
      .expect(429);
  });
}); 