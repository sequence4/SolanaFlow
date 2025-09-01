import 'dotenv/config';   
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
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
import ephemeralRoutes from '@/routes/ephemeral';
import deployRelayRoutes from '@/routes/deploy';
import { startCleanupWorker } from "./workers/cleanupWorker";
import { awsSecretsEnabled } from './utils/aws/awsSecrets';
import { componentReloadServer } from './utils/websocket/componentReloadServer';

if (!awsSecretsEnabled()) {
  console.warn('[boot] AWS Secrets disabled (SKIP_AWS_SECRETS=1 or missing creds). Using on‑disk keypairs.');
}

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
app.use('/api/projects', ephemeralRoutes);
app.use('/api/projects', deployRelayRoutes);
app.use(internalCertRoute);

app.get('/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

app.use(errorHandler);

// Create HTTP server for both Express and WebSocket
const server = createServer(app);

// Initialize WebSocket server for hot reload
if (process.env.NODE_ENV !== 'production') {
  try {
    componentReloadServer.initialize(server);
    console.log('[ComponentReloadServer] WebSocket server initialized for hot reload');
  } catch (error) {
    console.error('[ComponentReloadServer] Failed to initialize WebSocket server:', error);
  }
}

// Add API endpoint for manual component reload
app.post('/api/component/reload/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { reason } = req.body;
  
  try {
    componentReloadServer.forceReload(projectId, reason);
    res.json({ success: true, message: 'Reload triggered' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add endpoint to get WebSocket status
app.get('/api/component/ws-status', (_req, res) => {
  res.json(componentReloadServer.getStatus());
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (process.env.NODE_ENV !== "test") {
    startCleanupWorker();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  componentReloadServer.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
