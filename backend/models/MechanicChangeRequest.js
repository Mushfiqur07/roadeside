const mongoose = require('mongoose');

const mechanicChangeRequestSchema = new mongoose.Schema(
  {
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mechanic', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewerNotes: { type: String, default: '' },
    fieldsChanged: {
      type: Object,
      required: true
      // Example: { priceRange: { from: {min:200,max:500}, to: {min:300,max:900} }, garage: { from: {...}, to: {...} } }
    },
    decidedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'mechanic_change_requests' }
);

module.exports = mongoose.models.MechanicChangeRequest || mongoose.model('MechanicChangeRequest', mechanicChangeRequestSchema);



