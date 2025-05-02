// Mock the container so we don't actually spin up PostgreSQL
const mockContainer = {
  getConnectionUri: () => 'postgresql://test:test@localhost:5432/testdb',
  stop: jest.fn().mockResolvedValue(undefined)
};

const container = mockContainer;

// Set test environment variables
process.env.DATABASE_URL = container.getConnectionUri();
process.env.NEXT_TELEMETRY_DISABLED = '1';

afterAll(async () => {
  try {
    // Nothing to clean up since we're using a mock
  } catch (error) {
    console.error('Error in test teardown:', error);
  }
}); 