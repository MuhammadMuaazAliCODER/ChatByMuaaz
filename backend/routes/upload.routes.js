import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authenticateToken from '../middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ── Ensure upload directory exists ────────────────────
const AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// ── Multer config ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_DIR),
  filename:    (req, file, cb) => {
    const unique = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/wav',
      'audio/mpeg',
      'application/octet-stream' // some browsers send this for webm
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`), false);
    }
  }
});

// ── POST /upload/audio ────────────────────────────────
// 1. Saves file to disk temporarily
// 2. Returns the public URL to the client
// 3. Schedules deletion of the file after 5 minutes
//    (enough time for the client to send the message
//     and the recipient(s) to load it)
router.post('/audio', authenticateToken, upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No audio file received' });
  }

  const filename = req.file.filename;
  const filePath = path.join(AUDIO_DIR, filename);

  // Build the public URL the client will embed in the message
  const url = `${req.protocol}://${req.get('host')}/uploads/audio/${filename}`;

  // ── Auto-delete after 5 minutes ───────────────────
  setTimeout(() => {
    fs.unlink(filePath, err => {
      if (err && err.code !== 'ENOENT') {
        // ENOENT = already deleted, that's fine
        console.error('[Upload] Failed to delete audio file:', err.message);
      } else {
        console.log('[Upload] Auto-deleted audio file:', filename);
      }
    });
  }, 5 * 60 * 1000); // 5 minutes

  return res.json({ success: true, url });
});

// ── Error handler for multer ──────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Audio file too large (max 10MB)' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

export default router;