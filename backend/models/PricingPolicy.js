const mongoose = require('mongoose');

const bandSchema = new mongoose.Schema(
  {
    vehicleType: { type: String, enum: ['bike', 'car', 'truck', 'bus', 'cng', 'rickshaw'], required: true },
    service: {
      type: String,
      enum: [
        'engine_repair',
        'tire_change',
        'battery_jump',
        'fuel_delivery',
        'lockout_service',
        'towing',
        'brake_repair',
        'electrical_repair',
        'ac_repair',
        'general_maintenance',
        'oil_change'
      ],
      required: true
    },
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const pricingPolicySchema = new mongoose.Schema(
  {
    // Allowed auto-apply price change delta (fraction). Example: 0.3 => 30%
    maxPriceDeltaFraction: { type: Number, default: 0.3, min: 0 },
    // Default allowed price range if no band matches
    defaultMin: { type: Number, default: 100, min: 0 },
    defaultMax: { type: Number, default: 5000, min: 0 },
    // Per-service recommended bands
    bands: { type: [bandSchema], default: [] }
  },
  { timestamps: true, collection: 'pricing_policies' }
);

module.exports = mongoose.models.PricingPolicy || mongoose.model('PricingPolicy', pricingPolicySchema);



