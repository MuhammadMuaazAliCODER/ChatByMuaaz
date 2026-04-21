import Chat from '../models/Chat.js';
import { uploadToCloudinary, unlinkAsync } from '../config/cloudinary.js';
import dotenv from 'dotenv';
dotenv.config();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isAdmin    = (chat, userId) => chat.admin.toString() === userId.toString();
const isMember   = (chat, userId) => chat.participants.some(p => p.toString() === userId.toString());
const hasPending = (chat, userId) => chat.pendingInvites.some(i => i.user.toString() === userId.toString());

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getChats = async (req, res) => {
    try {
        const chats = await Chat.find({ participants: req.user._id })
            .populate('participants', 'name username online verified')
            .populate({
                path: 'lastMessageRef',
                populate: { path: 'sender', select: 'name username' }
            })
            .sort({ updatedAt: -1 });

        res.json({ chats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// get pending invites for the logged-in user
export const getMyInvites = async (req, res) => {
    try {
        const chats = await Chat.find({ 'pendingInvites.user': req.user._id })
            .populate('pendingInvites.user',       'name username')
            .populate('pendingInvites.invitedBy',  'name username')
            .select('name groupDP pendingInvites');

        res.json({ invites: chats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ─── Direct chat ──────────────────────────────────────────────────────────────

export const createDirect = async (req, res) => {
    try {
        const { userId } = req.body;

        let chat = await Chat.findOne({
            type: 'direct',
            participants: { $all: [req.user._id, userId] }
        }).populate('participants', 'name username online verified');

        if (!chat) {
            chat = await Chat.create({
                type: 'direct',
                participants: [req.user._id, userId]
            });
            chat = await Chat.findById(chat._id)
                .populate('participants', 'name username online verified');
        }

        res.json(chat);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ─── Create group ─────────────────────────────────────────────────────────────

// creator is added as participant immediately; everyone else gets an invite
export const createGroup = async (req, res) => {
    try {
        const { name, participantsToInvite = [] } = req.body;

        const pendingInvites = participantsToInvite.map(uid => ({
            user:      uid,
            invitedBy: req.user._id
        }));

        const chat = await Chat.create({
            type: 'group',
            name,
            participants:   [req.user._id],     // only creator is in from the start
            admin:          req.user._id,
            pendingInvites
        });

        const populatedChat = await Chat.findById(chat._id)
            .populate('participants',             'name username online verified')
            .populate('pendingInvites.user',      'name username')
            .populate('pendingInvites.invitedBy', 'name username');

        res.status(201).json(populatedChat);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ─── Invite flow ──────────────────────────────────────────────────────────────

export const inviteToGroup = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { userId } = req.body;

        const chat = await Chat.findById(chatId);
        if (!chat || chat.type !== 'group')
            return res.status(404).json({ message: 'Group not found' });

        if (chat.permissions.onlyAdminCanAddMembers && !isAdmin(chat, req.user._id))
            return res.status(403).json({ message: 'Only admin can invite members' });

        if (!isMember(chat, req.user._id))
            return res.status(403).json({ message: 'You are not a member of this group' });

        if (isMember(chat, userId))
            return res.status(400).json({ message: 'User is already a member' });

        if (hasPending(chat, userId))
            return res.status(400).json({ message: 'Invite already sent to this user' });

        chat.pendingInvites.push({ user: userId, invitedBy: req.user._id });
        await chat.save();

        res.json({ message: 'Invite sent' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const acceptInvite = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: 'Group not found' });

        const invite = chat.pendingInvites.find(
            i => i.user.toString() === req.user._id.toString()
        );
        if (!invite)
            return res.status(400).json({ message: 'No pending invite found' });

        // move from pending → participants
        chat.pendingInvites = chat.pendingInvites.filter(
            i => i.user.toString() !== req.user._id.toString()
        );
        chat.participants.push(req.user._id);
        await chat.save();

        const updated = await Chat.findById(chatId)
            .populate('participants', 'name username online verified');

        res.json({ message: 'Joined group', chat: updated });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const declineInvite = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ message: 'Group not found' });

        if (!hasPending(chat, req.user._id))
            return res.status(400).json({ message: 'No pending invite found' });

        chat.pendingInvites = chat.pendingInvites.filter(
            i => i.user.toString() !== req.user._id.toString()
        );
        await chat.save();

        res.json({ message: 'Invite declined' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ─── Group management ─────────────────────────────────────────────────────────

export const updateGroupInfo = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { name }   = req.body;

        const chat = await Chat.findById(chatId);
        if (!chat || chat.type !== 'group')
            return res.status(404).json({ message: 'Group not found' });

        if (!isMember(chat, req.user._id))
            return res.status(403).json({ message: 'Not a group member' });

        if (chat.permissions.onlyAdminCanEditGroupInfo && !isAdmin(chat, req.user._id))
            return res.status(403).json({ message: 'Only admin can edit group info' });

        if (name) chat.name = name;
        await chat.save();

        res.json({ message: 'Group info updated', chat });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const updateGroupDP = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat || chat.type !== 'group')
            return res.status(404).json({ message: 'Group not found' });

        if (!isMember(chat, req.user._id))
            return res.status(403).json({ message: 'Not a group member' });

        if (chat.permissions.onlyAdminCanEditGroupInfo && !isAdmin(chat, req.user._id))
            return res.status(403).json({ message: 'Only admin can change group picture' });

        if (!req.file)
            return res.status(400).json({ message: 'No image file provided' });

        const imageUrl = await uploadToCloudinary(req.file.path, 'group_pictures');
        chat.groupDP = imageUrl;
        await chat.save();

        res.json({ message: 'Group picture updated', groupDP: chat.groupDP });
    } catch (e) {
        // clean up temp file if cloudinary upload failed
        if (req.file?.path) {
            try { await unlinkAsync(req.file.path); } catch (_) {}
        }
        res.status(500).json({ error: e.message });
    }
};

export const updateGroupPermissions = async (req, res) => {
    try {
        const { chatId } = req.params;
        const {
            onlyAdminCanSendMessages,
            onlyAdminCanEditGroupInfo,
            onlyAdminCanAddMembers
        } = req.body;

        const chat = await Chat.findById(chatId);
        if (!chat || chat.type !== 'group')
            return res.status(404).json({ message: 'Group not found' });

        if (!isAdmin(chat, req.user._id))
            return res.status(403).json({ message: 'Only admin can change permissions' });

        // only update fields that were actually passed in
        if (onlyAdminCanSendMessages !== undefined)
            chat.permissions.onlyAdminCanSendMessages = onlyAdminCanSendMessages;
        if (onlyAdminCanEditGroupInfo !== undefined)
            chat.permissions.onlyAdminCanEditGroupInfo = onlyAdminCanEditGroupInfo;
        if (onlyAdminCanAddMembers !== undefined)
            chat.permissions.onlyAdminCanAddMembers = onlyAdminCanAddMembers;

        await chat.save();
        res.json({ message: 'Permissions updated', permissions: chat.permissions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ─── Membership ───────────────────────────────────────────────────────────────

export const removeMember = async (req, res) => {
    try {
        const { chatId, userId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat || chat.type !== 'group')
            return res.status(404).json({ message: 'Group not found' });

        if (!isAdmin(chat, req.user._id))
            return res.status(403).json({ message: 'Only admin can remove members' });

        if (userId === req.user._id.toString())
            return res.status(400).json({ message: 'Admin cannot remove themselves — use leaveGroup' });

        if (!isMember(chat, userId))
            return res.status(400).json({ message: 'User is not a member' });

        chat.participants = chat.participants.filter(p => p.toString() !== userId);
        await chat.save();

        res.json({ message: 'Member removed' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

export const leaveGroup = async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat || chat.type !== 'group')
            return res.status(404).json({ message: 'Group not found' });

        if (!isMember(chat, req.user._id))
            return res.status(400).json({ message: 'You are not in this group' });

        // if admin leaves, promote the next participant automatically
        if (isAdmin(chat, req.user._id)) {
            const remaining = chat.participants.filter(
                p => p.toString() !== req.user._id.toString()
            );
            chat.admin = remaining.length > 0 ? remaining[0] : null;
        }

        chat.participants = chat.participants.filter(
            p => p.toString() !== req.user._id.toString()
        );
        await chat.save();

        res.json({ message: 'Left group' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};