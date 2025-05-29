import { WorkspaceHandle } from 'src/utils/container/interfaces'
import { handleGenerateCode } from '../handleGenerateCode'

jest.mock('src/controllers/fileController', () => ({
  getProjectFileTree: jest.fn(),
}))
jest.mock('src/controllers/taskController', () => ({
  getTaskStatus: jest.fn(),
}))

describe('handleGenerateCode', () => {
  const projectId = 'proj-abc-123'

  it('rejects when nodes array is empty', async () => {
    await expect(handleGenerateCode({
      projectId,
      graph: { nodes: [] },
      workspace: {} as WorkspaceHandle,
      sendProgress: jest.fn(),
      userId: 'user-123'
    })).rejects.toThrow('No nodes found')
  })

  it('resolves when given valid nodes', async () => {
    const nodes = [
      { id: 'n1', type: 'node', config: { code: 'fn do_something() {}' } },
      { id: 'n2', type: 'node', config: { code: 'fn do_other_thing() {}' } },
    ]
    await expect(handleGenerateCode({
      projectId,
      graph: { nodes },
      workspace: {} as WorkspaceHandle,
      sendProgress: jest.fn(),
      userId: 'user-123'
    })).resolves.toBeUndefined()
  })
})
