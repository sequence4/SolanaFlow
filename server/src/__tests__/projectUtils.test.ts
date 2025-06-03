import fs from 'fs';
import { startAnchorDeployTask, mockUpdateTaskStatus } from './mock-anchor-deploy.test';

// Mock the real function
jest.mock('../utils/projectUtils', () => ({
  startAnchorDeployTask: jest.requireActual('./mock-anchor-deploy.test').startAnchorDeployTask
}));

// Mock fs.existsSync
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true)
}));

describe('startAnchorDeployTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterAll(() => {
    // Restore the original fs module to avoid affecting other tests
    jest.unmock('fs');
  });
  
  it('skips key-copy when SIGNED flag is provided', async () => {
    // Act
    await startAnchorDeployTask('test-project-id', 'test-creator-id', 'SIGNED');
    
    // Assert
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(mockUpdateTaskStatus).toHaveBeenCalledWith(
      'task-id',
      'succeed',
      'Signed tx already broadcast by frontend'
    );
  });
  
  it('checks for file existence when SIGNED flag is not provided', async () => {
    // Act
    await startAnchorDeployTask('test-project-id', 'test-creator-id', 'some-other-key');
    
    // Assert
    expect(fs.existsSync).toHaveBeenCalledWith('some-other-key.json');
  });
}); 