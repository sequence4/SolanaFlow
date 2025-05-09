import { prepEnv, isUrlAlive, resolveContainerUrl } from '../prepEnv';
import pool from 'src/config/database';
import { 
  startProjectContainer, 
  startCreateProjectDirectoryTask, 
} from '../../projectUtils';
import { execSync } from 'child_process';

jest.mock('src/config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../../projectUtils', () => ({
  startProjectContainer: jest.fn(),
  startCreateProjectDirectoryTask: jest.fn(),
  getContainerName: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../prepEnv', () => {
  const originalModule = jest.requireActual('../prepEnv');
  return {
    ...originalModule,
    isUrlAlive: jest.fn(),
    resolveContainerUrl: jest.fn(),
  };
});

describe('prepEnv function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return existing container when URL is alive', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rowCount: 1,
      rows: [{ root_path: 'test-project', container_url: 'http://test-container:3000' }]
    });

    (isUrlAlive as jest.Mock).mockResolvedValue(true);

    const result = await prepEnv('test-project-id', 'test-user-id');

    expect(result).toEqual({
      rootPath: 'test-project',
      containerName: 'test-container',
      containerUrl: 'http://test-container:3000'
    });

    expect(pool.query).toHaveBeenCalledWith(
      "SELECT root_path, container_url FROM solanaproject WHERE id = $1", 
      ['test-project-id']
    );

    expect(isUrlAlive).toHaveBeenCalledWith('http://test-container:3000');

    expect(startProjectContainer).not.toHaveBeenCalled();
  });

  test('should start new container when URL is not alive', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rowCount: 1,
      rows: [{ root_path: 'test-project', container_url: 'http://test-container:3000' }]
    });

    (isUrlAlive as jest.Mock).mockResolvedValue(false);

    (startProjectContainer as jest.Mock).mockResolvedValue('new-container');
    (resolveContainerUrl as jest.Mock).mockResolvedValue('http://new-container:3000');

    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('Folder does not exist');
    });

    const result = await prepEnv('test-project-id', 'test-user-id');

    expect(result).toEqual({
      rootPath: 'test-project',
      containerName: 'new-container',
      containerUrl: 'http://new-container:3000'
    });

    expect(pool.query).toHaveBeenCalledWith(
      "SELECT root_path, container_url FROM solanaproject WHERE id = $1", 
      ['test-project-id']
    );

    expect(isUrlAlive).toHaveBeenCalledWith('http://test-container:3000');

    expect(startProjectContainer).toHaveBeenCalledWith('test-project-id', 'test-user-id');

    expect(resolveContainerUrl).toHaveBeenCalledWith('new-container');

    expect(pool.query).toHaveBeenCalledWith(
      "UPDATE solanaproject SET container_url=$1, container_name=$2 WHERE id=$3",
      ['http://new-container:3000', 'new-container', 'test-project-id']
    );

    expect(startCreateProjectDirectoryTask).toHaveBeenCalledWith(
      'test-user-id', 'test-project', 'test-project-id'
    );
  });

  test('should throw error when project not found', async () => {
    (pool.query as jest.Mock).mockResolvedValue({
      rowCount: 0,
      rows: []
    });

    await expect(prepEnv('non-existent-id', 'test-user-id'))
      .rejects.toThrow('Project not found');

    expect(pool.query).toHaveBeenCalledWith(
      "SELECT root_path, container_url FROM solanaproject WHERE id = $1", 
      ['non-existent-id']
    );
  });
}); 