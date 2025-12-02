const mongoose = require('mongoose');

const mechanicChangeLogSchema = new mongoose.Schema(
  {
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Mechanic', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, default: '' },
    diffs: { type: Object, required: true } // { field: { from, to } }
  },
  { timestamps: true, collection: 'mechanic_change_logs' }
);

module.exports = mongoose.models.MechanicChangeLog || mongoose.model('MechanicChangeLog', mechanicChangeLogSchema);



