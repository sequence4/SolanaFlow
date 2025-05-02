import { POST } from '../../../app/api/waitlist/route';
import { makeAgent, toNodeHandler } from './testUtils';
import { db } from '@/lib/db';

const agent = makeAgent(toNodeHandler(POST));

beforeAll(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      wallet_address VARCHAR(255),
      full_name VARCHAR(255),
      telegram_handle VARCHAR(255),
      twitter_handle VARCHAR(255),
      discord_username VARCHAR(255),
      referred_by VARCHAR(255),
      source VARCHAR(255),
      signup_ip VARCHAR(255),
      meta JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

afterEach(async () => {
  await db.query('TRUNCATE TABLE waitlist');
});

describe('POST /api/waitlist', () => {
  it('201 + row inserted on happy path', async () => {
    const payload = { email: 'alice@example.com' };

    await agent
      .post('/api/waitlist')
      .send(payload)
      .set('Content-Type', 'application/json')
      .expect(201);

    const { rowCount } = await db.query(
      'SELECT 1 FROM waitlist WHERE email=$1',
      [payload.email]
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
  });

  it('409 on duplicate e-mail (unique constraint)', async () => {
    const email = 'dup@example.com';
    await db.query('INSERT INTO waitlist (email) VALUES ($1)', [email]);

    await agent
      .post('/api/waitlist')
      .send({ email })
      .set('Content-Type', 'application/json')
      .expect(409);
  });
}); 