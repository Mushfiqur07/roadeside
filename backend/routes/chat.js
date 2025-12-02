const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Chat = require('../models/Chat');
const Request = require('../models/Request');

const router = express.Router();

// Base ping
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Chat API', endpoints: ['POST /create','GET /by-request/:requestId','GET /mine'] });
});

// Ensure uploads directory exists
const uploadsRoot = path.join(__dirname, '..', 'uploads', 'chat');
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsRoot);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

// Get or create chat by service request id
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ success: false, message: 'requestId is required' });

    const request = await Request.findById(requestId).populate([
      { path: 'userId', select: 'role' },
      { path: 'mechanicId', populate: { path: 'userId', select: 'role' } }
    ]);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // Permission: requester, assigned mechanic, or admin can create
    const requesterId = request.userId?._id?.toString();
    const mechanicUserId = request.mechanicId?.userId?._id?.toString();
    const isParticipant = [requesterId, mechanicUserId].includes(req.user._id.toString()) || req.user.role === 'admin';
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not authorized' });

    let chat = await Chat.findOne({ serviceRequestId: requestId });
    if (!chat) {
      const participants = [];
      if (requesterId) participants.push({ userId: requesterId, role: 'user' });
      if (mechanicUserId) participants.push({ userId: mechanicUserId, role: 'mechanic' });
      chat = await Chat.create({ serviceRequestId: requestId, participants });
    }
    return res.json({ success: true, chat });
  } catch (e) {
    console.error('Chat create error:', e);
    return res.status(500).json({ success: false, message: 'Failed to create chat' });
  }
});

// Get chat by request
router.get('/by-request/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const chat = await Chat.findOne({ serviceRequestId: requestId });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    const isParticipant = chat.participants.some(p => p.userId.toString() === req.user._id.toString()) || req.user.role === 'admin';
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not authorized' });
    return res.json({ success: true, chat });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to get chat' });
  }
});

// Get my chats
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const chats = await Chat.find({ 'participants.userId': req.user._id })
      .sort({ updatedAt: -1 })
      .select('-messages');
    return res.json({ success: true, chats });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to get chats' });
  }
});

// Admin: list all chats
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const chats = await Chat.find({}).sort({ updatedAt: -1 }).select('-messages');
    return res.json({ success: true, chats });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to get chats' });
  }
});

// Get messages with pagination
router.get('/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before, limit = 50 } = req.query;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    const isParticipant = chat.participants.some(p => p.userId.toString() === req.user._id.toString()) || req.user.role === 'admin';
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not authorized' });

    let messages = chat.messages || [];
    if (before) {
      const beforeDate = new Date(before);
      messages = messages.filter(m => new Date(m.createdAt) < beforeDate);
    }
    messages = messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Number(limit)).reverse();
    return res.json({ success: true, messages });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
});

// Upload attachment
router.post('/:chatId/upload', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    const isParticipant = chat.participants.some(p => p.userId.toString() === req.user._id.toString()) || req.user.role === 'admin';
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not authorized' });

    const files = (req.files || []).map(f => ({
      url: `/uploads/chat/${path.basename(f.path)}`,
      type: (f.mimetype || '').startsWith('image/') ? 'image' : 'file',
      metadata: { originalName: f.originalname, size: f.size, mimetype: f.mimetype }
    }));
    return res.json({ success: true, files });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to upload' });
  }
});

// Mark read
router.post('/:chatId/mark-read', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const now = new Date();
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    const participant = chat.participants.find(p => p.userId.toString() === req.user._id.toString());
    if (!participant) return res.status(403).json({ success: false, message: 'Not authorized' });
    participant.lastReadAt = now;
    chat.messages.forEach(m => {
      if (m.senderId.toString() !== req.user._id.toString()) m.status = 'read';
    });
    await chat.save();
    // emit via socket if available
    try {
      const io = req.app.get('io');
      io.to(`chat_${chat._id}`).emit('mark_read', { chatId: chat._id, userId: req.user._id, timestamp: now });
    } catch {}
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to mark read' });
  }
});

module.exports = router;


