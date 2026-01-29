import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/verify', auth, c.verify);
router.post('/logout', auth, c.logout);

export default router;
