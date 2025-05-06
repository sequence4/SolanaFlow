# API Integration Tests

This directory contains integration tests for the API routes using Jest and Supertest.

## Setup

The tests use Testcontainers to spin up an isolated PostgreSQL database for each test run. This ensures that the tests are isolated and repeatable.

## Running Tests

To run the API integration tests:

```bash
pnpm test:api
```

## How It Works

1. **Test Database**: Using Testcontainers, a PostgreSQL container is started for the duration of the tests. The database connection URL is automatically set in the environment.

2. **Test Utilities**: The `testUtils.ts` file provides helpers to test API routes:
   - `toNodeHandler`: Wraps a Next.js App Router handler into a Node HTTP handler for Supertest
   - `makeAgent`: Creates a Supertest agent for a specific route handler

3. **Test Structure**:
   - Tests are written in a BDD style using Jest's `describe` and `it`
   - Each test acts as if making a real HTTP request to the API
   - Database operations are performed to verify the correct state after API calls

## Example

```typescript
import { POST as myRouteHandler } from '@/app/api/my-route/route';
import { makeAgent, toNodeHandler } from './testUtils';

describe('POST /api/my-route', () => {
  it('returns 200 and expected response', async () => {
    const agent = makeAgent(toNodeHandler(myRouteHandler));
    
    const res = await agent
      .post('/api/my-route')
      .send({ key: 'value' })
      .expect(200);
    
    expect(res.body).toEqual({ success: true });
  });
});
```

## Benefits

- Tests run in isolation with their own database
- No need to start the entire Next.js server
- Fast execution time
- Resembles real HTTP requests
- Tests both the API logic and database interactions 