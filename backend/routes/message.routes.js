import { Router } from 'express';
import { getMessages, sendText, sendVoice } from '../controllers/message.controller.js';
import auth from '../middleware/auth.middleware.js';
import upload from '../config/multer.js'; // this is your multer instance

const router = Router();

router.get('/:chatId', auth, getMessages);
router.post('/', auth, sendText);
router.post('/voice', auth, upload.single('audio'), sendVoice);

export default router;
