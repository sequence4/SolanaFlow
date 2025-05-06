const mockContainer = {
  getConnectionUri: () => 'postgresql://test:test@localhost:5432/testdb',
  stop: jest.fn().mockResolvedValue(undefined)
};

const container = mockContainer;

process.env.DATABASE_URL = container.getConnectionUri();
process.env.NEXT_TELEMETRY_DISABLED = '1';

afterAll(async () => {
  try {
  } catch (error) {
    console.error('Error in test teardown:', error);
  }
}); 