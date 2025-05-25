import { handleGenerateCode } from '../handleGenerateCode';

jest.mock('src/controllers/fileController', () => ({
  getProjectFileTree: jest.fn(),
}));
jest.mock('src/controllers/taskController', () => ({
  getTaskStatus: jest.fn(),
}));

describe('handleGenerateCode()', () => {
  const projectId = 'proj-abc-123';

  it('throws “No nodes found” when given an empty array', async () => {
    await expect(handleGenerateCode([], projectId))
      .rejects
      .toThrow('No nodes found');
  });

  it('accepts a minimal valid node set and resolves without error', async () => {
    const nodes = [
      {
        id: 'n1',
        data: { code: 'fn do_something() {}' },
      },
      {
        id: 'n2',
        data: { code: 'fn do_other_thing() {}' },
      },
    ];

    await expect(handleGenerateCode(nodes, projectId))
      .resolves
      .toBeUndefined();
  });
});
