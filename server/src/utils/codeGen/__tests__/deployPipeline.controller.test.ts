import request from 'supertest';
import express from 'express';
import router from '../../../routes/deployRoutes';
import { runDeployPipeline } from '../../../utils/deploy/runDeployPipeline';

jest.mock('../../../utils/deploy/runDeployPipeline', () => ({
  runDeployPipeline: jest.fn().mockResolvedValue(undefined),
}));

const fakeAuth = (_req: any, _res: any, next: any) => {
  _req.user = { id: 'user-456' };
  next();
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/deploy', fakeAuth, router);
  return app;
}

describe('POST /api/deploy/:id/deploy-pipeline', () => {
  it('forwards projectId, userId and graph to runDeployPipeline', async () => {
    const app  = makeApp();
    const body = { graph: { foo: 'bar', nodes: [1, 2, 3] } };

    await request(app)
      .post('/api/deploy/proj-123/deploy-pipeline')
      .send(body)
      .expect(200);

    expect(runDeployPipeline).toHaveBeenCalledTimes(1);
    expect(runDeployPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-123',
        userId:   'user-456',
        graph:    body.graph,
        sendProgress: expect.any(Function),
      }),
    );
  });
});
