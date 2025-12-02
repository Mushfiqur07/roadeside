const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: { 
    type: String, 
    unique: true, 
    required: true,
    default: function() {
      const timestamp = Date.now().toString();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `PAY-${timestamp}-${random}`;
    }
  },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mechanic', default: null },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['cash', 'bkash', 'nagad', 'rocket', 'card'], default: 'cash' },
  transactionId: { type: String, default: '' },
  commissionRate: { type: Number, default: 0.1 }, // 10%
  commissionAmount: { type: Number, default: 0 },
  netToMechanic: { type: Number, default: 0 },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'completed' }
}, { timestamps: true });

// Ensure paymentId exists before validation
paymentSchema.pre('validate', function(next) {
  if (!this.paymentId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.paymentId = `PAY-${timestamp}-${random}`;
  }
  next();
});

paymentSchema.pre('save', function(next) {
  if (this.isModified('amount') || this.isModified('commissionRate')) {
    const commission = Math.round((this.amount * this.commissionRate) * 100) / 100;
    this.commissionAmount = commission;
    this.netToMechanic = Math.round((this.amount - commission) * 100) / 100;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);


