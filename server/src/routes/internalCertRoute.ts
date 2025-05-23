import express, { RequestHandler } from 'express';
import { allowCertificate } from '@/controllers/certController';

const router = express.Router();

router.get('/api/cert-allow', allowCertificate as RequestHandler);

export default router;
