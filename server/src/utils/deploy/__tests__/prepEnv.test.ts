import { prepEnv } from '../../dapp-gen/prepEnv'
import poolMock from '../../../../tests/__mocks__/@db'
import * as containerUtils from '../../container'
import * as helpers from '../../container/containerHelpers'
import { mockNextQueryOnce } from '../../../../tests/test-helpers/mockDbQueries'

jest.mock('src/utils/container/containerHelpers', () => {
  const real = jest.requireActual('src/utils/container/containerHelpers');
  return {
    ...real,
    isUrlAlive: jest.fn(),
    folderExists: jest.fn(),
    resolveContainerUrl: jest.fn()
  };
});

jest.mock('../../container', () => ({
  startProjectContainer: jest.fn(),
  rentContainerFromPool: jest.fn()
}));

const startProjectContainer = containerUtils.startProjectContainer as jest.Mock
const rentContainerFromPool = containerUtils.rentContainerFromPool as jest.Mock
const isUrlAlive = helpers.isUrlAlive as jest.Mock
const folderExists = helpers.folderExists as jest.Mock
const resolveContainerUrl = helpers.resolveContainerUrl as jest.Mock

describe('prepEnv()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    poolMock.__resetFakeClient();
  })

  it('returns existing alive container', async () => {
    await mockNextQueryOnce({
      rowCount: 1,
      rows: [{ root_path: 'demo', container_url: 'http://warm-1:3000' }]
    });
    isUrlAlive.mockResolvedValue(true)

    const ws = await prepEnv('p1', 'u1')

    expect(ws).toEqual({
      rootPath: 'demo',
      containerName: 'warm-1',
      containerUrl: 'http://warm-1:3000'
    })
    expect(rentContainerFromPool).not.toHaveBeenCalled()
    expect(startProjectContainer).not.toHaveBeenCalled()
  })

  it('rents warm container when none stored', async () => {
    await mockNextQueryOnce({
      rowCount: 1,
      rows: [{ root_path: 'demo', container_url: null }]
    });
    rentContainerFromPool.mockResolvedValue({ name: 'warm-2', url: 'http://warm-2:3000' })
    folderExists.mockResolvedValue(true)

    const ws = await prepEnv('p2', 'u2')

    expect(ws.containerName).toBe('warm-2')
    expect(rentContainerFromPool).toHaveBeenCalled()
    expect(startProjectContainer).not.toHaveBeenCalled()
  })

  it('cold-starts when pool empty', async () => {
    await mockNextQueryOnce({
      rowCount: 1,
      rows: [{ root_path: 'demo', container_url: null }]
    });
    rentContainerFromPool.mockResolvedValue(null)
    startProjectContainer.mockResolvedValue('cold-1')
    resolveContainerUrl.mockResolvedValue('http://cold-1:3000')
    folderExists.mockResolvedValue(false)

    const ws = await prepEnv('p3', 'u3')

    expect(ws.containerName).toBe('cold-1')
    expect(startProjectContainer).toHaveBeenCalledWith('p3')
  })
})
