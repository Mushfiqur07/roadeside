const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: String, required: true },
  planName: { type: String, required: true },
  price: { type: Number, required: true },
  period: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  benefits: [{ type: String }], // e.g., 'priority_response', 'discount_10'
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, required: true },
  status: { type: String, enum: ['active','expired','cancelled'], default: 'active' }
}, { timestamps: true });

subscriptionSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);


