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
    
    expect(res.body.error).toBe('email or wallet required');
  }, 10000);
  
  it('409 on duplicate email', async () => {
    const email = 'dup@example.com';
    await db.query('INSERT INTO waitlist (email) VALUES ($1)', [email]);

    await agent
      .post('/api/waitlist')
      .send({ email })
      .set('Content-Type', 'application/json')
      .expect(409);
  });
}); 