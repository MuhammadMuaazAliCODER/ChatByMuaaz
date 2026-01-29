import { Router } from 'express';
import * as c from '../controllers/user.controller.js';
import auth from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', auth, c.getUsers);
router.get('/search', auth, c.searchUsers);

export default router;
