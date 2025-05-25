import { prepEnv } from '../prepEnv'
import pool from '../../../config/database'
import * as projectUtils from '../../projectUtils'
import * as containerPool from '../../container/rentContainerFromPool'
import * as helpers from '../../container/containerHelpers'
import * as resolver from '../../container/containerHelpers'

jest.mock('src/config/database', () => ({
  query: jest.fn()
}))

jest.mock('../src/utils/projectUtils', () => ({
  startProjectContainer: jest.fn(),
  startCreateProjectDirectoryTask: jest.fn()
}))

jest.mock('../src/utils/container/rentContainerFromPool', () => ({
  rentContainerFromPool: jest.fn()
}))

jest.mock('../src/utils/container/containerHelpers', () => {
  const real = jest.requireActual('../src/utils/container/containerHelpers')
  return {
    ...real,
    isUrlAlive: jest.fn(),
    folderExists: jest.fn()
  }
})

jest.mock('../src/utils/container/resolveContainerUrl', () => ({
  resolveContainerUrl: jest.fn()
}))

const db = pool as unknown as { query: jest.Mock }
const startProjectContainer = projectUtils.startProjectContainer as jest.Mock
const startCreateProjectDirectoryTask = projectUtils.startCreateProjectDirectoryTask as jest.Mock
const rentContainerFromPool = containerPool.rentContainerFromPool as jest.Mock
const isUrlAlive = helpers.isUrlAlive as jest.Mock
const folderExists = helpers.folderExists as jest.Mock
const resolveContainerUrl = resolver.resolveContainerUrl as jest.Mock

describe('prepEnv()', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns existing alive container', async () => {
    db.query.mockResolvedValue({
      rowCount: 1,
      rows: [{ root_path: 'demo', container_url: 'http://warm-1:3000' }]
    })
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
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ root_path: 'demo', container_url: null }]
    })
    rentContainerFromPool.mockResolvedValue({ name: 'warm-2', url: 'http://warm-2:3000' })
    folderExists.mockResolvedValue(true)

    const ws = await prepEnv('p2', 'u2')

    expect(ws.containerName).toBe('warm-2')
    expect(rentContainerFromPool).toHaveBeenCalled()
    expect(startProjectContainer).not.toHaveBeenCalled()
    expect(db.query).toHaveBeenCalledWith(
      'UPDATE solanaproject SET container_url = $1, container_name = $2 WHERE id = $3',
      ['http://warm-2:3000', 'warm-2', 'p2']
    )
  })

  it('cold-starts when pool empty', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ root_path: 'demo', container_url: null }]
    })
    rentContainerFromPool.mockResolvedValue(null)
    startProjectContainer.mockResolvedValue('cold-1')
    resolveContainerUrl.mockResolvedValue('http://cold-1:3000')
    folderExists.mockResolvedValue(false)

    const ws = await prepEnv('p3', 'u3')

    expect(ws.containerName).toBe('cold-1')
    expect(startProjectContainer).toHaveBeenCalledWith('p3', 'u3')
    expect(startCreateProjectDirectoryTask).toHaveBeenCalledWith('u3', 'demo', 'p3')
  })
})
