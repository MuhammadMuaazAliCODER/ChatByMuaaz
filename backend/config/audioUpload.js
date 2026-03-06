// config/audioUpload.js
import multer from 'multer';

// Use memory storage — we stream directly to Cloudinary, no temp files needed
const storage = multer.memoryStorage();

const audioUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('audio/')) {
      return cb(new Error('Only audio files are allowed'), false);
    }
    cb(null, true);
  }
});

export default audioUpload;