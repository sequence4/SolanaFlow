import { runDeployPipeline } from '../runDeployPipeline'
import * as env from '../prepEnv'

jest.mock('../prepEnv', () => ({
  prepEnv: jest.fn()
}))

const prepEnv = env.prepEnv as jest.Mock

describe('runDeployPipeline - environment stage', () => {
  it('emits environment stage and awaits prep', async () => {
    const logs: any[] = []
    prepEnv.mockResolvedValue({ rootPath: 'x', containerName: 'c', containerUrl: 'u' })

    await runDeployPipeline({
      projectId: 'p',
      userId: 'u',
      graph: { nodes: [], edges: [] },
      sendProgress: (m) => logs.push(m)
    })

    expect(logs[0]).toEqual({
      stage: 'environment',
      message: 'Preparing your build environment…'
    })
    expect(prepEnv).toHaveBeenCalledWith('p', 'u')
  })
})
