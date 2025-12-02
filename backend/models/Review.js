const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mechanic', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500, default: '' },
}, {
  timestamps: true
});

reviewSchema.index({ mechanicId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ requestId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);



