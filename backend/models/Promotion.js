const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['percent', 'flat', 'boost_supply'], default: 'percent' },
  value: { type: Number, required: true },
  maxDiscount: { type: Number, default: 0 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  target: { type: String, enum: ['all', 'user', 'area'], default: 'all' },
  area: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon'
    },
    coordinates: { type: [[[Number]]], default: undefined }
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

promotionSchema.index({ code: 1 }, { unique: true });
promotionSchema.index({ startsAt: 1, endsAt: 1, isActive: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);


