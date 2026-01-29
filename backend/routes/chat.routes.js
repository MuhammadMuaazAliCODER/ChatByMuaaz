import { Router } from 'express';
import * as c from '../controllers/chat.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', auth, c.getChats);
router.post('/direct', auth, c.createDirect);
router.post('/group', auth, c.createGroup);

export default router;
