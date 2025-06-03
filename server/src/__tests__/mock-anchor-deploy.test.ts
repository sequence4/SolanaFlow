/* eslint-env jest */
import fs from 'fs';

// Jest mocks
export const mockCreateTask = jest.fn().mockResolvedValue('task-id');
export const mockUpdateTaskStatus = jest.fn().mockResolvedValue(undefined);

/**
 * Mock implementation of startAnchorDeployTask used in unit tests.
 */
export async function startAnchorDeployTask(
  projectId: string,
  creatorId: string,
  ephemeralPubkey?: string,
): Promise<string> {
  const taskId = await mockCreateTask('Anchor Deploy', creatorId, projectId);

  if (ephemeralPubkey === 'SIGNED') {
    await mockUpdateTaskStatus(taskId, 'succeed', 'Signed tx already broadcast by frontend');
    return taskId;
  }

  // Mimic the fs.existsSync call the real function performs
  fs.existsSync(`${ephemeralPubkey}.json`);
  return taskId;
} 