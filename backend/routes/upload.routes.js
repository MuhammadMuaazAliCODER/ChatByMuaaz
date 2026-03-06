// routes/upload.routes.js
import { Router } from 'express';
import auth from '../middleware/auth.middleware.js';
import audioUpload from '../config/audioUpload.js';
import { uploadAudio } from '../controllers/upload.controller.js';

const router = Router();

// POST /upload/audio
// Auth required — only logged-in users can upload
// audioUpload.single('audio') — expects field name 'audio'
router.post('/audio', auth, audioUpload.single('audio'), uploadAudio);

export default router;