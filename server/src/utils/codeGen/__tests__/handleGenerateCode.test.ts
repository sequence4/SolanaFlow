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
    await expect(handleGenerateCode([], projectId)).rejects.toThrow('No nodes found')
  })

  it('resolves when given valid nodes', async () => {
    const nodes = [
      { id: 'n1', data: { code: 'fn do_something() {}' } },
      { id: 'n2', data: { code: 'fn do_other_thing() {}' } },
    ]
    await expect(handleGenerateCode(nodes, projectId)).resolves.toBeUndefined()
  })
})
