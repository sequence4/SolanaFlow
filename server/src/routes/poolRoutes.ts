import express, { RequestHandler } from 'express';
import {
  rentContainer,
  releaseContainer,
} from '@/controllers/poolController';

const router = express.Router();

router.post('/rent', rentContainer as RequestHandler);

router.post('/release/:id', releaseContainer as RequestHandler);

export default router;
