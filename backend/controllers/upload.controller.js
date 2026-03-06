// controllers/upload.controller.js
import cloudinary from '../config/cloudinary.js';

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload/audio
// Accepts a single audio file (field name: 'audio')
// Streams it to Cloudinary and returns the secure URL.
//
// Used by the frontend before sending a voice message:
//   1. Upload blob → get Cloudinary URL
//   2. Send message with type:'audio' and audioUrl: <cloudinary url>
// ─────────────────────────────────────────────────────────────────────────────
export const uploadAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file provided' });
    }

    // Stream the buffer directly to Cloudinary (no temp file on disk)
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video', // Cloudinary uses 'video' for audio files
          folder: 'chat_audio',
          format: 'webm',
          transformation: [{ quality: 'auto' }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.status(201).json({
      success: true,
      url: result.secure_url,
      duration: result.duration || null,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload audio',
      error: error.message
    });
  }
};