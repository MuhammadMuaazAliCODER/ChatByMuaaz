import cron from 'node-cron';
import Message from '../models/Message.js';

cron.schedule('0 0 * * *', async () => {
    const res = await Message.deleteMany({ expiresAt: { $lt: new Date() } });
    console.log(`🗑 Deleted ${res.deletedCount} expired messages`);
});
