import { Router }  from 'express';
import multer      from 'multer';
import path        from 'path';
import fs          from 'fs';
import { fileURLToPath } from 'url';
import * as c      from '../controllers/chat.controller.js';
import auth        from '../middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Multer for group DP uploads ───────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'temp');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => cb(null, `groupdp_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error(`Unsupported image type: ${file.mimetype}`), false);
    }
});

const router = Router();

// ─── Core ──────────────────────────────────────────────────────────────────────
router.get('/',                                     auth, c.getChats);
router.post('/direct',                              auth, c.createDirect);
router.post('/group',                               auth, c.createGroup);

// ─── Invites ──────────────────────────────────────────────────────────────────
router.get('/invites/me',                           auth, c.getMyInvites);
router.post('/:chatId/invite',                      auth, c.inviteToGroup);
router.post('/:chatId/invite/accept',               auth, c.acceptInvite);
router.post('/:chatId/invite/decline',              auth, c.declineInvite);

// ─── Group management ─────────────────────────────────────────────────────────
router.put('/:chatId/info',                         auth, c.updateGroupInfo);
router.put('/:chatId/dp',                           auth, upload.single('groupDP'), c.updateGroupDP); // 👈 multer here
router.put('/:chatId/permissions',                  auth, c.updateGroupPermissions);

// ─── Membership ───────────────────────────────────────────────────────────────
router.delete('/:chatId/members/:userId',           auth, c.removeMember);
router.post('/:chatId/leave',                       auth, c.leaveGroup);

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ message: 'Image too large (max 5MB)' });
    if (err)
        return res.status(400).json({ message: err.message });
    next();
});

export default router;