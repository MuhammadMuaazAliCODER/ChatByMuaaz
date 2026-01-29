import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

// Convert import.meta.url to __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the uploads/voice directory if it doesn't exist
const dir = path.join(__dirname, '..', 'uploads', 'voice');
fs.mkdirSync(dir, { recursive: true });

// Multer storage configuration
const storage = multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.random() + '.wav');
    }
});

export default multer({ storage });
