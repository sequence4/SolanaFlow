import express from 'express';
import { register, login, logout, getUser, updateApiKey } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', authMiddleware, logout);
router.get('/user', authMiddleware, getUser);

router.post('/update-api-key', authMiddleware, updateApiKey);


export default router;
