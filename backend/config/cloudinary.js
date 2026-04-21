import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { promisify } from 'util';
import dotenv from 'dotenv';
dotenv.config();

const unlinkAsync = promisify(fs.unlink);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadToCloudinary = async (filePath, folder = 'profile_pictures') => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder,
            transformation: [
                { width: 1024, height: 1024, crop: 'limit' },
                { quality: 'auto' }
            ]
        });
        await unlinkAsync(filePath);
        return result.secure_url;
    } catch (error) {
        try { await unlinkAsync(filePath); } catch (_) {}
        throw new Error('Failed to upload image to Cloudinary');
    }
};

export { unlinkAsync };