import cloudinary from '../config/cloudinary.js';

export const uploadAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file provided' });
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: 'Empty file' });
    }

    console.log('Uploading audio, size:', req.file.size, 'bytes');

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'chat_audio',
          format: 'webm',
          timeout: 120000,          // ← 2 minute timeout
          chunk_size: 6000000,      // ← 6MB chunks for reliability
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      // Kill promise if stream hangs
      const timer = setTimeout(() => reject(new Error('Request Timeout')), 110000);
      stream.on('finish', () => clearTimeout(timer));
      stream.on('error', (err) => { clearTimeout(timer); reject(err); });

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
  }const btn =  getElementById('micBtn');
btn.addEventListener('click',() =>{
    toast('Auio recording feature is currently in testing and may not work perfectly. Please try again later.', 'info');
});
};