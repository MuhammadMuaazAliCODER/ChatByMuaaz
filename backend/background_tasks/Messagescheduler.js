
import cron    from 'node-cron';
import Message from '../models/Message.js';
import Chat    from '../models/Chat.js';
import { sendMessageNotification } from '../websocket/socket.js';


const buildPayload = (message) => ({
    _id:         message._id,
    chatId:      message.chat._id ?? message.chat,
    content:     message.content,
    type:        message.type,
    sender: {
        _id:            message.sender._id,
        name:           message.sender.name,
        username:       message.sender.username,
        profilePicture: message.sender.profilePicture
    },
    senderName:   message.sender.name,
    senderAvatar: message.sender.profilePicture,
    createdAt:    message.createdAt
});


const processDueMessage = async (message, now) => {
   
    message.scheduleStatus = 'sent';
    message.status         = 'sent';
    message.isScheduled    = false;
    await message.save();

  
    await Chat.findByIdAndUpdate(message.chat._id ?? message.chat, {
        lastMessage: message._id,
        updatedAt:   now
    });

   
    const chat = await Chat.findById(message.chat._id ?? message.chat)
        .populate('participants', 'name username profilePicture');

    const senderId = message.sender._id.toString();
    const payload  = buildPayload(message);

    if (chat) {
        for (const participant of chat.participants) {
            if (participant._id.toString() !== senderId) {
                await sendMessageNotification(participant._id.toString(), payload);
            }
        }
    }

    
    for (const extraUser of (message.scheduledFor || [])) {
        const uid = extraUser._id?.toString() ?? extraUser.toString();
        if (uid !== senderId) {
            await sendMessageNotification(uid, payload);
        }
    }
};


export const startMessageScheduler = () => {
   
    cron.schedule('* * * * *', async () => {
        const now = new Date();

        let dueMessages;
        try {
            dueMessages = await Message.find({
                isScheduled:    true,
                scheduleStatus: 'pending',
                scheduledAt:    { $lte: now }
            })
            .populate('sender',       'name username profilePicture')
            .populate('scheduledFor', 'name username profilePicture')
            .populate('chat');
        } catch (err) {
            console.error('[Scheduler] DB query error:', err);
            return;
        }

        if (dueMessages.length === 0) return;

        console.log(`[Scheduler] Processing ${dueMessages.length} scheduled message(s) at ${now.toISOString()}`);

       
        await Promise.allSettled(
            dueMessages.map(msg =>
                processDueMessage(msg, now).catch(err =>
                    console.error(`[Scheduler] Failed to process message ${msg._id}:`, err)
                )
            )
        );
    });

    console.log('[Scheduler] Message scheduler started — running every minute.');
};