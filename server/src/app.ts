// ░░ FIRST, make sure env-vars are in place ░░
import './bootstrapEnv';
import express from 'express';
import cors from 'cors';
import authRoutes from '@/routes/authRoutes';
import projectRoutes from '@/routes/projectRoutes';
import fileRoutes from '@/routes/fileRoutes';
import orgRoutes from '@/routes/orgRoutes';
import taskRoutes from '@/routes/taskRoutes';
import aiRoutes from '@/routes/aiRoutes';
import { errorHandler } from '@/middleware/errorHandler';
import containerRoutes from '@/routes/containerRoutes';
import cookieParser from 'cookie-parser';
import deployRoutes from '@/routes/deployRoutes';
import workspaceRoutes from '@/routes/workspaceRoutes';
import poolRoutes from '@/routes/poolRoutes';
import internalCertRoute from '@/routes/internalCertRoute';
import artifactRoute from '@/routes/artifactRoute';
import { startCleanupWorker } from "./workers/cleanupWorker";

if (!process.env.DOCKER_HOST) {
  throw new Error('DOCKER_HOST missing – check server/.env');
}
console.log('[DEBUG] DOCKER_HOST =', process.env.DOCKER_HOST);

const app = express();
const PORT = process.env.PORT || 9999;

app.use((req, _res, next) => {
  console.log('[TRACE] %s %s [Headers: %s]', 
    req.method, 
    req.url, 
    JSON.stringify({
      'content-type': req.headers['content-type'],
      'origin': req.headers.origin,
      'authorization': req.headers.authorization ? 'present' : 'absent'
    })
  );
  next();
});

app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/files', fileRoutes);
app.use('/org', orgRoutes);
app.use('/tasks', taskRoutes);
app.use('/ai', aiRoutes);
app.use('/api/container', containerRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/projects', artifactRoute);
app.use('/workspace', workspaceRoutes);
app.use('/api/pool', poolRoutes); 
app.use(internalCertRoute);

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (process.env.NODE_ENV !== "test") {
    startCleanupWorker();
  }
});

export default app;
