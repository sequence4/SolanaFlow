// Mock implementation of startAnchorDeployTask for testing
const mockCreateTask = jest.fn().mockResolvedValue('task-id');
const mockUpdateTaskStatus = jest.fn().mockResolvedValue(undefined);

exports.startAnchorDeployTask = async (projectId, creatorId, ephemeralPubkey) => {
  const taskId = await mockCreateTask('Anchor Deploy', creatorId, projectId);
  
  if (ephemeralPubkey === 'SIGNED') {
    await mockUpdateTaskStatus(taskId, 'succeed', 'Signed tx already broadcast by frontend');
    return taskId;
  }
  
  // This would be where fs.existsSync gets called in the real function
  require('fs').existsSync(ephemeralPubkey + '.json');
  
  return taskId;
};

exports.mockCreateTask = mockCreateTask;
exports.mockUpdateTaskStatus = mockUpdateTaskStatus; 