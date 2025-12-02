const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String },
  attachments: [
    {
      url: { type: String },
      type: { type: String, enum: ['image', 'file', 'location'], default: 'file' },
      metadata: { type: mongoose.Schema.Types.Mixed }
    }
  ],
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ChatSchema = new mongoose.Schema({
  serviceRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', index: true, required: true, unique: true },
  participants: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      role: { type: String, enum: ['user', 'mechanic', 'admin'], required: true },
      lastReadAt: { type: Date }
    }
  ],
  messages: [MessageSchema],
  isClosed: { type: Boolean, default: false },
  closedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

ChatSchema.index({ 'participants.userId': 1 });

module.exports = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);



